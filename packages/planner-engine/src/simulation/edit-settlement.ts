import type { Catalog } from '../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createHubRerollAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import {
  ProjectCommandContractError,
  projectCommandAddress,
} from '../authored-project/commands/contract';
import { applyProjectCommand } from '../authored-project/commands/dispatch';
import { roomActionRemovalCommand } from '../authored-project/commands/room-action-reset';
import { authoredLevelResolutionAt } from '../authored-project/commands/level-resolution';
import { authoredTraitOfferAt } from '../authored-project/commands/trait-offer';
import type { ProjectCommand } from '../authored-project/commands/types';
import type {
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from '../authored-project/model';
import { roomActionKey } from '../authored-project/room-actions/state';
import { rerolledScreenCount } from '../authored-project/screen-rerolls';
import {
  discardDisplacedHermesShrineDelivery,
  hermesShrineDeliverySourceAddress,
  hermesShrinePurchaseAction,
  offerFor,
  parseHermesShrineDeliveryEntryKey,
  purchasedOfferFor,
} from '../authored-project/hermes-shrine-delivery';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  attestClockedTraitPickupPlacementForProjectEvaluationAssembly,
} from './evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { candidateBiome, candidateBiomeRooms } from './candidates/evaluated-biome';

function occurrences(project: ProjectDocument) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).map((occurrence) => ({
      occurrence,
      owner: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      ),
    })),
  );
}
function occurrenceAt(
  project: ProjectDocument,
  owner: OccurrenceAddress,
): RoomOccurrence | undefined {
  return project.route.biomes
    .find((biome) => biome.biomeKey === owner.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === owner.occurrenceId);
}
function placements(assembly: ProjectEvaluationAssembly) {
  return assembly.evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome ? (biome.rewards.generatedPickupPlacements ?? []) : [],
  );
}
/** The authored facts behind one delivery obligation: the sold offer and its purchase terms. */
function purchasedObligation(project: ProjectDocument, entryKey: string) {
  const source = parseHermesShrineDeliveryEntryKey(entryKey);
  if (source === undefined) return undefined;
  const occurrence = occurrenceAt(project, hermesShrineDeliverySourceAddress(source));
  const shrine = occurrence?.hermesShrine;
  const purchased =
    occurrence === undefined
      ? undefined
      : purchasedOfferFor(shrine, occurrence.roomActions.order, source.generationKey);
  return Object.freeze({
    rewardType: offerFor(shrine, source.generationKey)?.rewardType,
    delay: purchased?.delay,
    rushed:
      occurrence === undefined
        ? undefined
        : hermesShrinePurchaseAction(occurrence.roomActions.order, source.generationKey)?.rushed,
  });
}
function sameObligation(
  before: ReturnType<typeof purchasedObligation>,
  after: ReturnType<typeof purchasedObligation>,
): boolean {
  return (
    before?.rewardType === after?.rewardType &&
    before?.delay === after?.delay &&
    before?.rushed === after?.rushed
  );
}

/** An engine contract failure beside the settled assembly: a repair the settlement refused to repeat. */
export interface SettlementFault {
  readonly key: string;
  readonly owner: SemanticAddress;
}

/** The stale actions one room lost to an edit, in their former order. */
export interface RemovedStaleRoomActions {
  readonly occurrence: OccurrenceAddress;
  readonly actions: readonly RoomActionReference[];
}

export interface ProjectEditSettlement {
  readonly assembly: ProjectEvaluationAssembly;
  readonly fault?: SettlementFault;
  /** Rows the edit left with no context, removed by the same edit; absent when none. */
  readonly removedStaleActions?: readonly RemovedStaleRoomActions[];
}

/** Each evaluated room's roster rows by room, with whether each is stale. */
function evaluatedRosters(assembly: ProjectEvaluationAssembly) {
  const rosters = new Map<
    string,
    { readonly owner: OccurrenceAddress; readonly stale: ReadonlyMap<string, boolean> }
  >();
  const routeKey = assembly.project.route.routeKey;
  for (const plan of assembly.project.route.biomes) {
    const biome = candidateBiome(assembly.evaluation, routeKey, plan.biomeKey);
    if (biome === undefined) continue;
    for (const room of candidateBiomeRooms(biome)) {
      if (room.origin.kind !== 'occurrence') continue;
      const key = semanticAddressKey(room.origin);
      if (rosters.has(key)) continue;
      rosters.set(
        key,
        Object.freeze({
          owner: room.origin,
          stale: new Map(room.roomActionRoster.rows.map((row) => [row.key, row.stale])),
        }),
      );
    }
  }
  return rosters;
}

/** Whether the edit changed the room's authored occurrence. */
function roomEdited(before: ProjectDocument, after: ProjectDocument, owner: OccurrenceAddress) {
  const previous = occurrenceAt(before, owner);
  const next = occurrenceAt(after, owner);
  return previous !== next && JSON.stringify(previous) !== JSON.stringify(next);
}

/**
 * The stale rows an edit removes: every row the edit left with no context, and
 * in each room the edit changed, every stale row retained from before it.
 * Rooms the evaluation does not reach keep their rows until it does.
 */
function staleRowsToRemove(
  before: ProjectEvaluationAssembly,
  beforeRosters: ReturnType<typeof evaluatedRosters>,
  assembly: ProjectEvaluationAssembly,
) {
  const removals: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  for (const [roomKey, { owner, stale }] of evaluatedRosters(assembly)) {
    const current = occurrenceAt(assembly.project, owner);
    if (current === undefined) continue;
    const prior = beforeRosters.get(roomKey)?.stale;
    let edited: boolean | undefined;
    for (const reference of current.roomActions.order) {
      const key = roomActionKey(reference);
      if (stale.get(key) !== true || reference.kind === 'interactKeepsakeRack') continue;
      const orphaned = prior?.get(key) === false;
      if (!orphaned && (edited ??= roomEdited(before.project, assembly.project, owner)) === false)
        continue;
      removals.push({ owner, reference });
    }
  }
  return removals;
}

/** The fixed reroll pool refusing a new spend; known only once the edit is evaluated. */
export class RerollPoolRefusal extends ProjectCommandContractError {}

interface ProjectEditSettlementOptions {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly command: ProjectCommand;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}

/**
 * Settle one semantic edit above structural commands and exact evaluation.
 * Preparation and Undo/Redo never call this operation. The result is total:
 * a repeated repair stops settlement and is reported as a fault beside the
 * last evaluated assembly.
 */
export function settleProjectEdit(options: ProjectEditSettlementOptions): ProjectEditSettlement {
  const { catalog, before, command } = options;
  const evaluate = (project: ProjectDocument): ProjectEvaluationAssembly => {
    const result = options.evaluate(project);
    candidateArtifactsForProjectEvaluationAssembly(result);
    if (result.project !== project)
      throw new Error('Edit evaluation does not match its authored snapshot');
    return result;
  };
  const beforeArtifacts = candidateArtifactsForProjectEvaluationAssembly(before);
  const beforeRosters = evaluatedRosters(before);
  const removedStale: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  const settled = (
    assembly: ProjectEvaluationAssembly,
    fault?: SettlementFault,
  ): ProjectEditSettlement => {
    const byRoom = new Map<string, RemovedStaleRoomActions>();
    for (const { owner, reference } of removedStale) {
      const key = semanticAddressKey(owner);
      const room = byRoom.get(key);
      byRoom.set(key, {
        occurrence: owner,
        actions: Object.freeze([...(room?.actions ?? []), reference]),
      });
    }
    return Object.freeze({
      assembly,
      ...(fault === undefined ? {} : { fault }),
      ...(byRoom.size === 0
        ? {}
        : {
            removedStaleActions: Object.freeze(
              [...byRoom.values()].map((room) => Object.freeze(room)),
            ),
          }),
    });
  };
  const beforeExitedOwners = new Set(
    before.evaluation.route.biomes.flatMap((biome) =>
      'history' in biome
        ? biome.history.events.flatMap((event) =>
            event.kind === 'roomExited' ? [semanticAddressKey(event.origin)] : [],
          )
        : [],
    ),
  );
  if (command.kind === 'RemoveRoomAction') {
    const owner = createOccurrenceAddress(
      createBiomeAddress(command.action.routeKey, command.action.biomeKey),
      command.action.occurrenceId,
    );
    const reference = occurrenceAt(before.project, owner)?.roomActions.order.find(
      (reference) => roomActionKey(reference) === command.action.actionKey,
    );
    if (
      reference?.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === 'roomExit' &&
      reference.entryKey === 'echoDoubleShopReward'
    ) {
      const capability = beforeArtifacts
        .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
        ?.derivedAcquisitionEntries.at(
          createAcquisitionEntryAddress(
            createAcquisitionSiteAddress(owner, reference.siteKey),
            reference.entryKey,
          ),
        );
      if (
        capability?.kind === 'echoDoubleShopReward' &&
        capability.participation === 'required' &&
        capability.retainedSourceMismatch !== true
      )
        return Object.freeze({ assembly: before });
    }
  }
  const beforePlacements = new Map(
    placements(before).map((placement) => [semanticAddressKey(placement.address), placement]),
  );
  if (command.kind === 'UnplaceGeneratedDelivery') {
    const owner = createOccurrenceAddress(
      createBiomeAddress(command.action.routeKey, command.action.biomeKey),
      command.action.occurrenceId,
    );
    const reference = occurrenceAt(before.project, owner)?.roomActions.order.find(
      (reference) => roomActionKey(reference) === command.action.actionKey,
    );
    if (reference?.kind === 'interactAcquisitionEntry') {
      const address = createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(owner, reference.siteKey),
        reference.entryKey,
      );
      if (beforePlacements.get(semanticAddressKey(address))?.assessment.kind === 'valid')
        return Object.freeze({ assembly: before });
    }
  }
  if (
    command.kind === 'PlaceClockedTraitPickup' &&
    !attestClockedTraitPickupPlacementForProjectEvaluationAssembly(before, command)
  )
    return Object.freeze({ assembly: before });
  let project = applyProjectCommand(before.project, catalog, command);
  if (project === before.project) return Object.freeze({ assembly: before });
  let assembly = evaluate(project);
  // The reroll pool is a fixed budget at each spend's own point: a new spend
  // past it is refused. An earlier spend takes precedence, so an edit that
  // leaves later spends short keeps them with their findings.
  const spendOwners = addedRerollSpendOwners(catalog, before.project, project, command);
  if (spendOwners.size > 0) {
    // Each over-spending owner and how far past the pool it goes.
    const overspent = (evaluated: ProjectEvaluationAssembly) =>
      new Map(
        evaluated.evaluation.findings
          .filter((finding) => finding.code === 'rerollPoolExceeded')
          .map((finding) => [
            semanticAddressKey(finding.origin),
            Number(finding.evidence.cost) - Number(finding.evidence.remaining),
          ]),
      );
    const prior = overspent(before);
    if (
      [...overspent(assembly)].some(
        ([owner, excess]) => spendOwners.has(owner) && excess > (prior.get(owner) ?? 0),
      )
    )
      throw new RerollPoolRefusal(
        command.kind,
        projectCommandAddress(command),
        'the reroll pool has nothing left for this spend',
      );
  }
  // Each repair consumes one exact displaced owner or required obligation. A
  // repeated repair means an inconsistent contact, not permission to replay
  // forever: settlement stops with the last evaluated assembly and the fault.
  const repaired = new Set<string>();
  const consume = (key: string, owner: SemanticAddress): SettlementFault | undefined => {
    if (repaired.has(key)) return Object.freeze({ key, owner });
    repaired.add(key);
    return undefined;
  };
  for (;;) {
    const displaced = placements(assembly).find(
      (placement) =>
        placement.assessment.kind === 'invalid' &&
        beforePlacements.get(semanticAddressKey(placement.address))?.assessment.kind === 'valid',
    );
    if (displaced !== undefined && displaced.address.site.owner.kind === 'occurrence') {
      const owner = displaced.address.site.owner;
      const current = occurrenceAt(project, owner);
      const reference = current?.roomActions.order.find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === displaced.address.site.pointKey &&
          reference.entryKey === displaced.address.entryKey,
      );
      if (reference !== undefined) {
        const fault = consume(
          `displaced:${semanticAddressKey(displaced.address)}`,
          displaced.address,
        );
        if (fault !== undefined) return settled(assembly, fault);
        project = applyProjectCommand(project, catalog, {
          kind:
            displaced.address.site.pointKey === 'hermesShrineDelivery'
              ? 'UnplaceGeneratedDelivery'
              : 'RemoveRoomAction',
          action: createRoomActionAddress(
            createBiomeAddress(owner.routeKey, owner.biomeKey),
            owner.occurrenceId,
            roomActionKey(reference),
          ),
        });
        assembly = evaluate(project);
        continue;
      }
    }
    const artifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
    const newlyRequiredGold = occurrences(project).flatMap(({ owner, occurrence }) => {
      const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
      const site = createAcquisitionSiteAddress(owner, 'roomExit');
      return (artifacts.biomeAt(biome)?.derivedAcquisitionEntries.entriesAt(site) ?? []).flatMap(
        ({ address, capability }) => {
          if (
            capability.kind !== 'echoDoubleShopReward' ||
            capability.participation !== 'required' ||
            capability.sourceOfferKey === undefined ||
            occurrence.roomActions.order.some(
              (reference) =>
                reference.kind === 'interactAcquisitionEntry' &&
                reference.siteKey === site.pointKey &&
                reference.entryKey === address.entryKey,
            )
          )
            return [];
          const prior = beforeArtifacts.biomeAt(biome)?.derivedAcquisitionEntries.at(address);
          const previouslyNonrequired =
            prior?.kind === 'echoDoubleShopPlaceholder' ||
            (prior?.kind === 'echoDoubleShopReward' && prior.participation === 'optional') ||
            (prior === undefined &&
              occurrenceAt(before.project, owner)?.state.kind === 'shop' &&
              beforeExitedOwners.has(semanticAddressKey(owner)));
          return previouslyNonrequired
            ? [{ address, sourceOfferKey: capability.sourceOfferKey }]
            : [];
        },
      );
    });
    if (newlyRequiredGold.length > 0) {
      for (const { address, sourceOfferKey } of newlyRequiredGold) {
        const fault = consume(`gold:${semanticAddressKey(address)}`, address);
        if (fault !== undefined) return settled(assembly, fault);
        project = applyProjectCommand(project, catalog, {
          kind: 'PlaceEchoGoldPickup',
          site: address.site,
          entryKey: 'echoDoubleShopReward',
          sourceOfferKey,
        });
      }
      assembly = evaluate(project);
      continue;
    }
    const due = occurrences(project).flatMap(({ owner, occurrence }) => {
      const site = createAcquisitionSiteAddress(owner, 'hermesShrineDelivery');
      return (
        artifacts
          .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
          ?.derivedAcquisitionEntries.entriesAt(site) ?? []
      ).flatMap(({ address, capability }) => {
        if (capability.kind !== 'hermesShrineDelivery') return [];
        const ranked = occurrence.roomActions.order.some(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === site.pointKey &&
            reference.entryKey === address.entryKey,
        );
        const prior = occurrences(before.project).flatMap(({ occurrence, owner }) =>
          occurrence.roomActions.order.flatMap((reference) =>
            reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === 'hermesShrineDelivery' &&
            reference.entryKey === address.entryKey
              ? [{ owner, reference }]
              : [],
          ),
        );
        const incompatible =
          !sameObligation(
            purchasedObligation(before.project, address.entryKey),
            purchasedObligation(project, address.entryKey),
          ) ||
          prior.some(
            ({ owner, reference }) =>
              semanticAddressKey(owner) !== semanticAddressKey(address.site.owner) ||
              reference.encounterPhaseKey !== capability.encounterPhaseKey,
          );
        return ranked ? [] : [{ address, capability, incompatible }];
      });
    });
    if (due.length === 0) {
      // A row with no context has nothing to repair: the edit that orphans it removes it.
      // An installed route keeps exactly the rows it was authored with.
      const stale =
        command.kind === 'ReplaceRoute' ? [] : staleRowsToRemove(before, beforeRosters, assembly);
      if (stale.length === 0) return settled(assembly);
      const pass: { owner: OccurrenceAddress; reference: RoomActionReference; index: number }[] =
        [];
      // Last first, each through its owning removal, as a reset removes rows.
      for (const { owner, reference } of stale.reverse()) {
        const key = roomActionKey(reference);
        const order = occurrenceAt(project, owner)?.roomActions.order ?? [];
        // A removal can take another row with it, such as a pickup with its purchase.
        if (!order.some((candidate) => roomActionKey(candidate) === key)) continue;
        const address = createRoomActionAddress(
          createBiomeAddress(owner.routeKey, owner.biomeKey),
          owner.occurrenceId,
          key,
        );
        const fault = consume(`stale:${semanticAddressKey(address)}`, address);
        if (fault !== undefined) return settled(assembly, fault);
        try {
          project = applyProjectCommand(
            project,
            catalog,
            roomActionRemovalCommand(owner, reference),
          );
        } catch (error) {
          // The roster and the removal command disagree: an engine defect.
          if (error instanceof ProjectCommandContractError)
            return settled(assembly, Object.freeze({ key: `stale:${key}`, owner: address }));
          throw error;
        }
        const remaining = new Set(
          (occurrenceAt(project, owner)?.roomActions.order ?? []).map(roomActionKey),
        );
        order.forEach((candidate, index) => {
          if (!remaining.has(roomActionKey(candidate)))
            pass.push({ owner, reference: candidate, index });
        });
      }
      removedStale.push(...pass.sort((left, right) => left.index - right.index));
      assembly = evaluate(project);
      continue;
    }
    for (const { address, capability, incompatible } of due) {
      const fault = consume(`delivery:${semanticAddressKey(address)}`, address);
      if (fault !== undefined) return settled(assembly, fault);
      if (incompatible)
        project = discardDisplacedHermesShrineDelivery(catalog, project, address.entryKey);
      project = applyProjectCommand(project, catalog, {
        kind: 'PlaceHermesShrineDelivery',
        entry: address,
        ...(capability.encounterPhaseKey === undefined
          ? {}
          : { encounterPhaseKey: capability.encounterPhaseKey }),
      });
    }
    assembly = evaluate(project);
  }
}

/** The earlier-screen count of the trait offer or Pom choice a screen command addresses. */
function addressedScreenRerollCount(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'ReplaceTraitOffer'
        | 'ReplaceLevelResolution'
        | 'InsertTraitScreenReroll'
        | 'InsertLevelScreenReroll';
    }
  >,
): number {
  const screens =
    command.kind === 'ReplaceTraitOffer' || command.kind === 'InsertTraitScreenReroll'
      ? authoredTraitOfferAt(document, catalog, command.trait)
      : authoredLevelResolutionAt(document, catalog, command.levelResolution);
  return screens === null || screens === undefined || screens.kind === 'random'
    ? 0
    : rerolledScreenCount(screens);
}

const ROOM_REROLL_KINDS = new Set(['reroll', 'rerollStygianWell', 'rerollPurgingPool']);

/**
 * The owners of the spends a command adds: a new room or Hub press, a new Well
 * or Pool reroll, or a raised screen count. Empty when it adds none.
 */
function addedRerollSpendOwners(
  catalog: Catalog,
  before: ProjectDocument,
  after: ProjectDocument,
  command: ProjectCommand,
): ReadonlySet<string> {
  switch (command.kind) {
    case 'InsertReroll':
    case 'InsertStygianWellReroll':
    case 'InsertPurgingPoolReroll': {
      const known = new Set(
        (occurrenceAt(before, command.occurrence)?.roomActions.order ?? []).map(roomActionKey),
      );
      return new Set(
        (occurrenceAt(after, command.occurrence)?.roomActions.order ?? []).flatMap((reference) =>
          ROOM_REROLL_KINDS.has(reference.kind) && !known.has(roomActionKey(reference))
            ? [
                semanticAddressKey(
                  createRoomActionAddress(
                    createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
                    command.occurrence.occurrenceId,
                    roomActionKey(reference),
                  ),
                ),
              ]
            : [],
        ),
      );
    }
    case 'InsertHubReroll': {
      const hubActions = (project: ProjectDocument) =>
        project.route.biomes
          .find((biome) => biome.biomeKey === command.hub.biomeKey)
          ?.topology?.decisions.find(
            (decision) => decision.kind === 'hub' && decision.hubKey === command.hub.hubKey,
          );
      const actionsOf = (project: ProjectDocument) => {
        const hub = hubActions(project);
        return hub?.kind === 'hub' ? hub.actions : [];
      };
      const known = new Set(
        actionsOf(before).flatMap((action) => (action.kind === 'reroll' ? [action.rerollId] : [])),
      );
      return new Set(
        actionsOf(after).flatMap((action) =>
          action.kind === 'reroll' && !known.has(action.rerollId)
            ? [
                semanticAddressKey(
                  createHubRerollAddress(
                    createBiomeAddress(command.hub.routeKey, command.hub.biomeKey),
                    command.hub.hubKey,
                    action.rerollId,
                  ),
                ),
              ]
            : [],
        ),
      );
    }
    case 'ReplaceTraitOffer':
    case 'ReplaceLevelResolution':
    case 'InsertTraitScreenReroll':
    case 'InsertLevelScreenReroll':
      return addressedScreenRerollCount(after, catalog, command) >
        addressedScreenRerollCount(before, catalog, command)
        ? new Set([semanticAddressKey(projectCommandAddress(command) as SemanticAddress)])
        : new Set();
    default:
      return new Set();
  }
}
