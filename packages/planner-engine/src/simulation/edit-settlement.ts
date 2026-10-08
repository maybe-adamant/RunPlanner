import type { Catalog } from '../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import { applyProjectCommand } from '../authored-project/commands/dispatch';
import { projectCommandAuthoringAddresses } from '../authored-project/commands/contract';
import { derivedAcquisitionEntryAncestor } from './progressive/finding-location';
import type { ProjectCommand } from '../authored-project/commands/types';
import type { ProjectDocument, RoomOccurrence } from '../authored-project/model';
import { roomActionKey } from '../authored-project/room-actions/state';
import { parseClockedTraitGeneratedPickupEntryKey } from '../authored-project/acquisition/pickup-producers';
import {
  discardDisplacedHermesShrineDelivery,
  hermesShrineDeliverySourceAddress,
  hermesShrinePurchaseAction,
  offerFor,
  parseHermesShrineDeliveryEntryKey,
  purchaseFor,
} from '../authored-project/hermes-shrine-delivery';
import {
  agreedTimedEffectContact,
  type TimedEffectContact,
} from './rewards/timed-effects/contacts';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  attestClockedTraitPickupPlacementForProjectEvaluationAssembly,
} from './evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';

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
function contacts(assembly: ProjectEvaluationAssembly): readonly TimedEffectContact[] {
  const artifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  return assembly.project.route.biomes.flatMap(
    (biome) =>
      artifacts.biomeAt(createBiomeAddress(assembly.project.route.routeKey, biome.biomeKey))
        ?.roomLifecycles.timedEffects ?? [],
  );
}
function contactKey(contact: TimedEffectContact): string {
  return JSON.stringify([contact.effect, semanticAddressKey(contact.owner), contact.phaseKey]);
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

/** A repair the settlement refused to repeat; its owner stays repairable by hand. */
export interface SettlementFault {
  readonly key: string;
  readonly owner: SemanticAddress;
}

export interface ProjectEditSettlement {
  readonly assembly: ProjectEvaluationAssembly;
  readonly fault?: SettlementFault;
}

/**
 * Settle one semantic edit above structural commands and exact evaluation.
 * Preparation and Undo/Redo never call this operation. The result is total:
 * a repeated repair stops settlement and is reported as a fault beside the
 * last evaluated assembly.
 */
export function settleProjectEdit(options: {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly command: ProjectCommand;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}): ProjectEditSettlement {
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
  const authoredAddresses = projectCommandAuthoringAddresses(command, before.project);
  const authoredEntries = new Set(
    command.kind === 'PlaceHermesShrineDelivery' || command.kind === 'PlaceClockedTraitPickup'
      ? []
      : authoredAddresses.flatMap((address) => {
          const entry = derivedAcquisitionEntryAncestor(address);
          return entry === undefined ? [] : [semanticAddressKey(entry)];
        }),
  );
  const authoredOutcomes = new Set(authoredAddresses.map(semanticAddressKey));
  let project = applyProjectCommand(before.project, catalog, command);
  if (project === before.project) return Object.freeze({ assembly: before });
  let assembly = evaluate(project);
  const beforeContacts = new Map(contacts(before).map((contact) => [contactKey(contact), contact]));
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
    const repairs: {
      readonly key: string;
      readonly owner: SemanticAddress;
      readonly command: ProjectCommand;
    }[] = [];
    const currentContacts = contacts(assembly);
    const keys = new Set(currentContacts.map(contactKey));
    const exitedOwners = new Set(
      assembly.evaluation.route.biomes.flatMap((biome) =>
        'history' in biome
          ? biome.history.events.flatMap((event) =>
              event.kind === 'roomExited' ? [semanticAddressKey(event.origin)] : [],
            )
          : [],
      ),
    );
    const absentContacts = [...beforeContacts.values()]
      .filter(
        (contact) =>
          !keys.has(contactKey(contact)) && exitedOwners.has(semanticAddressKey(contact.owner)),
      )
      .map((contact) => ({
        ...contact,
        cohorts: Object.freeze([Object.freeze([])]),
        deferred: false,
      }));
    for (const contact of [...currentContacts, ...absentContacts]) {
      const previous = beforeContacts.get(contactKey(contact));
      const oldSignature = agreedTimedEffectContact(previous);
      const signature = agreedTimedEffectContact(contact);
      if (
        contact.effect !== 'clockedPickup' &&
        (signature === undefined || signature === oldSignature)
      )
        continue;
      const old = occurrenceAt(before.project, contact.owner);
      const current = occurrenceAt(project, contact.owner);
      if (old === undefined || current === undefined) continue;
      if (contact.effect === 'steadyGrowth') {
        if (
          authoredOutcomes.has(
            semanticAddressKey(createSteadyGrowthOutcomeAddress(contact.owner, contact.phaseKey)),
          )
        )
          continue;
        const value = current.encounters.steadyGrowthTargetByPhase?.[contact.phaseKey];
        if (
          value !== undefined &&
          value === old.encounters.steadyGrowthTargetByPhase?.[contact.phaseKey]
        )
          repairs.push({
            key: contactKey(contact),
            owner: contact.owner,
            command: {
              kind: 'ReplaceSteadyGrowthTarget',
              outcome: createSteadyGrowthOutcomeAddress(contact.owner, contact.phaseKey),
              targetTraitKey: null,
            },
          });
      } else if (contact.effect === 'transcendentEmbryo') {
        if (
          authoredOutcomes.has(
            semanticAddressKey(
              createTranscendentEmbryoOutcomeAddress(contact.owner, contact.phaseKey),
            ),
          )
        )
          continue;
        const value = current.encounters.transcendentEmbryoBlessingByPhase?.[contact.phaseKey];
        if (
          value !== undefined &&
          JSON.stringify(value) ===
            JSON.stringify(old.encounters.transcendentEmbryoBlessingByPhase?.[contact.phaseKey])
        )
          repairs.push({
            key: contactKey(contact),
            owner: contact.owner,
            command: {
              kind: 'ReplaceTranscendentEmbryoTransformation',
              outcome: createTranscendentEmbryoOutcomeAddress(contact.owner, contact.phaseKey),
              value: null,
            },
          });
      } else {
        for (const reference of current.roomActions.order) {
          if (
            reference.kind !== 'interactAcquisitionEntry' ||
            reference.encounterPhaseKey !== contact.phaseKey ||
            parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) === undefined
          )
            continue;
          if (
            !old.roomActions.order.some(
              (prior) => roomActionKey(prior) === roomActionKey(reference),
            )
          )
            continue;
          if (
            authoredEntries.has(
              semanticAddressKey(
                createAcquisitionEntryAddress(
                  createAcquisitionSiteAddress(contact.owner, reference.siteKey),
                  reference.entryKey,
                ),
              ),
            )
          )
            continue;
          const source = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey)!;
          const oldSource = agreedTimedEffectContact(previous, source.acquisitionIdentity);
          const newSource = agreedTimedEffectContact(contact, source.acquisitionIdentity);
          if (newSource === undefined || oldSource === newSource) continue;
          repairs.push({
            key: `${contactKey(contact)}:${reference.entryKey}`,
            owner: contact.owner,
            command: {
              kind: 'RemoveRoomAction',
              action: createRoomActionAddress(
                createBiomeAddress(contact.owner.routeKey, contact.owner.biomeKey),
                contact.owner.occurrenceId,
                roomActionKey(reference),
              ),
            },
          });
        }
      }
    }
    if (repairs.length > 0) {
      for (const repair of repairs) {
        const fault = consume(repair.key, repair.owner);
        if (fault !== undefined) return Object.freeze({ assembly, fault });
        project = applyProjectCommand(project, catalog, repair.command);
      }
      assembly = evaluate(project);
      continue;
    }
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
        const inherited = occurrences(before.project).some(
          ({ occurrence: prior }) =>
            prior.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[address.entryKey] !==
            undefined,
        );
        const oldProof =
          beforePlacements.get(semanticAddressKey(address))?.assessment.kind === 'valid';
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
        // A delivery already ranked at this exact due contact with an unchanged
        // obligation corresponds to it; reaching it later proves nothing new.
        const corresponds = prior.length > 0 && !incompatible;
        const resetInherited =
          inherited &&
          !oldProof &&
          !corresponds &&
          !authoredEntries.has(semanticAddressKey(address)) &&
          !repaired.has(`delivery:${semanticAddressKey(address)}`);
        return ranked && !resetInherited
          ? []
          : [{ address, capability, incompatible, resetInherited }];
      });
    });
    if (due.length === 0) return Object.freeze({ assembly });
    for (const { address, capability, incompatible, resetInherited } of due) {
      const fault = consume(`delivery:${semanticAddressKey(address)}`, address);
      if (fault !== undefined) return Object.freeze({ assembly, fault });
      if (incompatible || resetInherited)
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
