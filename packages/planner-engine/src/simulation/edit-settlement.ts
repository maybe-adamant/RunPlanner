import type { Catalog } from '../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
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
import type { ProjectCommand } from '../authored-project/commands/types';
import type { ProjectDocument, RoomOccurrence } from '../authored-project/model';
import { roomActionKey } from '../authored-project/room-actions/state';
import {
  discardDisplacedHermesShrineDelivery,
  hermesShrineDeliverySourceAddress,
  hermesShrinePurchaseAction,
  offerFor,
  parseHermesShrineDeliveryEntryKey,
  purchaseFor,
} from '../authored-project/hermes-shrine-delivery';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  attestClockedTraitPickupPlacementForProjectEvaluationAssembly,
} from './evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { simulateProjectAssembly } from './evaluation/project';
import type { SemanticFinding } from './model';

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
  const purchase = purchaseFor(shrine, source.generationKey);
  return Object.freeze({
    rewardType: offerFor(shrine, source.generationKey)?.rewardType,
    delay: purchase?.delay,
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

/**
 * An engine contract failure beside the settled assembly: a repair the
 * settlement refused to repeat, or a timed outcome whose reached branches
 * disagree on its landing.
 */
export interface SettlementFault {
  readonly key: string;
  readonly owner: SemanticAddress;
}

export interface ProjectEditSettlement {
  readonly assembly: ProjectEvaluationAssembly;
  readonly fault?: SettlementFault;
}

function divergentOutcomeLandingFault(
  assembly: ProjectEvaluationAssembly,
): SettlementFault | undefined {
  for (const biome of assembly.evaluation.route.biomes) {
    const owner = 'rewards' in biome ? biome.rewards.divergentOutcomeLandings?.[0] : undefined;
    if (owner !== undefined)
      return Object.freeze({ key: `divergentLanding:${semanticAddressKey(owner)}`, owner });
  }
  return undefined;
}

interface ProjectEditSettlementOptions {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly command: ProjectCommand;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}

/**
 * Settle one semantic edit above structural commands and exact evaluation.
 * Preparation and Undo/Redo never call this operation. The result is total:
 * a repeated repair stops settlement, and it or a divergent timed-outcome
 * landing is reported as a fault beside the last evaluated assembly.
 */
export function settleProjectEdit(options: ProjectEditSettlementOptions): ProjectEditSettlement {
  const settled = settleProjectEditRepairs(options);
  if (settled.fault !== undefined) return settled;
  const fault = divergentOutcomeLandingFault(settled.assembly);
  return fault === undefined ? settled : Object.freeze({ ...settled, fault });
}

function settleProjectEditRepairs(options: ProjectEditSettlementOptions): ProjectEditSettlement {
  const { catalog, before, command } = options;
  const evaluate = (project: ProjectDocument): ProjectEvaluationAssembly => {
    const result = options.evaluate(project);
    candidateArtifactsForProjectEvaluationAssembly(result);
    if (result.project !== project)
      throw new Error('Edit evaluation does not match its authored snapshot');
    return result;
  };
  const beforeArtifacts = candidateArtifactsForProjectEvaluationAssembly(before);
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
  // The reroll pool is a fixed budget: a new spend past it is refused, while
  // an upstream edit that shrinks the pool keeps its spends with a finding.
  if (addsRerollSpend(before.project, project, command)) {
    const overspent = (evaluated: ProjectEvaluationAssembly) =>
      new Set(
        evaluated.evaluation.findings
          .filter((finding) => finding.code === 'rerollPoolExceeded')
          .map((finding) => semanticAddressKey(finding.origin)),
      );
    const prior = overspent(before);
    if ([...overspent(assembly)].some((owner) => !prior.has(owner)))
      throw new ProjectCommandContractError(
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
        if (fault !== undefined) return Object.freeze({ assembly, fault });
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
        if (fault !== undefined) return Object.freeze({ assembly, fault });
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
    if (due.length === 0) return Object.freeze({ assembly });
    for (const { address, capability, incompatible } of due) {
      const fault = consume(`delivery:${semanticAddressKey(address)}`, address);
      if (fault !== undefined) return Object.freeze({ assembly, fault });
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

/** Settles one command; undefined when the command authority refuses it or it changes nothing. */
export function settleCommandUnlessRefused(
  catalog: Catalog,
  before: ProjectEvaluationAssembly,
  command: ProjectCommand,
): ProjectEvaluationAssembly | undefined {
  let settled: ProjectEditSettlement;
  let evaluated = false;
  try {
    settled = settleProjectEdit({
      catalog,
      before,
      command,
      evaluate: (project) => {
        evaluated = true;
        return simulateProjectAssembly(catalog, project);
      },
    });
  } catch (error) {
    // A refusal before anything is evaluated is the command's own; later ones are engine defects.
    if (error instanceof ProjectCommandContractError && !evaluated) return undefined;
    throw error;
  }
  return settled.assembly.project === before.project ? undefined : settled.assembly;
}

/**
 * Settles one command unless it is refused or adds a finding. A partly authored
 * route keeps its later frontier finding; an earlier block would replace it.
 */
export function settleCommandWithoutNewFinding(
  catalog: Catalog,
  before: ProjectEvaluationAssembly,
  command: ProjectCommand,
): ProjectEvaluationAssembly | undefined {
  const settled = settleCommandUnlessRefused(catalog, before, command);
  if (settled === undefined) return undefined;
  const key = (finding: SemanticFinding) => `${finding.code} ${semanticAddressKey(finding.origin)}`;
  const known = new Set(before.evaluation.findings.map(key));
  return settled.evaluation.findings.every((finding) => known.has(key(finding)))
    ? settled
    : undefined;
}

/** Every screen reroll count authored anywhere in a project: trait, Pom, Well and Pool screens. */
function screenRerollTotal(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce((sum: number, entry) => sum + screenRerollTotal(entry), 0);
  if (value === null || typeof value !== 'object') return 0;
  return Object.entries(value).reduce(
    (sum, [key, entry]) =>
      sum + (key === 'rerollCount' && typeof entry === 'number' ? entry : screenRerollTotal(entry)),
    0,
  );
}

/** Whether the command presses a new reroll or raises a screen's reroll count. */
function addsRerollSpend(
  before: ProjectDocument,
  after: ProjectDocument,
  command: ProjectCommand,
): boolean {
  if (command.kind === 'InsertReroll' || command.kind === 'InsertHubReroll') return true;
  if (
    command.kind !== 'SetStygianWellRerollCount' &&
    command.kind !== 'SetPurgingPoolRerollCount' &&
    command.kind !== 'ReplaceTraitOffer' &&
    command.kind !== 'ReplaceLevelResolution'
  )
    return false;
  return screenRerollTotal(after.route) > screenRerollTotal(before.route);
}
