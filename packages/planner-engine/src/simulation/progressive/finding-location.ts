import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type OccurrenceAddress,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { RoomTargetCandidateContext } from '../generation/model';
import type { BiomeHistoryPrefix, EncounterHistoryBlock } from '../history';
import type {
  CanonicalBiome,
  CanonicalDecision,
  CanonicalHubVisit,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import type { SemanticFinding } from '../model';
import {
  findingIdentityKey,
  ownerRegion,
  type FindingAggregate,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';
import type { BiomeRewardSimulation } from '../rewards';
import type { BiomeCandidateArtifacts } from '../candidate-artifacts';
import type { RewardProducerOwnerAddress } from '../rewards/producer-frontiers';
import type { TraitChildSettlementCheckpoints } from '../rewards/biome';
import type { BiomeGenerationValidation, ProgressiveBiomeEvaluation } from './products';

export interface BlockedAncestorChain {
  readonly rewardOwner?: RewardProducerOwnerAddress | undefined;
  readonly occurrenceOwner?: OccurrenceAddress | undefined;
  readonly target?: TargetAddress | undefined;
}

export interface SelectedTargetGenerationAssessment {
  readonly gameName: string;
  readonly context: RoomTargetCandidateContext;
}

export function rewardOwnerAddress(
  address: SemanticAddress,
): RewardProducerOwnerAddress | undefined {
  switch (address.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntry':
      return address;
    case 'traitOffer':
    case 'levelResolution':
      return rewardOwnerAddress(address.owner);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'echoLastRunBoon':
    case 'echoLastReward':
      return rewardOwnerAddress(address.trait);
    default:
      return undefined;
  }
}

export function acquisitionRoleAncestor(
  address: SemanticAddress,
): AcquisitionRoleAddress | undefined {
  if (address.kind === 'acquisitionRole') return address;
  const trait =
    address.kind === 'traitOffer'
      ? address
      : address.kind === 'traitAcquisitionTarget' ||
          address.kind === 'circeResolution' ||
          address.kind === 'echoPomTarget' ||
          address.kind === 'echoLastRunBoon' ||
          address.kind === 'echoLastReward' ||
          address.kind === 'allTogetherSet'
        ? address.trait
        : undefined;
  if (trait !== undefined) return createAcquisitionRoleAddress(trait.owner, trait.acquisitionRole);
  return address.kind === 'levelResolution'
    ? createAcquisitionRoleAddress(address.owner, address.acquisitionRole)
    : undefined;
}

export function derivedAcquisitionEntryAncestor(
  address: SemanticAddress,
): AcquisitionEntryAddress | undefined {
  if (address.kind === 'acquisitionEntry') return address;
  if (address.kind === 'acquisitionRole')
    return address.owner.kind === 'acquisitionEntry' ? address.owner : undefined;
  const owner = rewardOwnerAddress(address);
  return owner?.kind === 'acquisitionEntry' ? owner : undefined;
}

export function occurrenceOwnerAddress(address: SemanticAddress): OccurrenceAddress | undefined {
  if (address.kind === 'occurrence') return address;
  if (address.kind === 'fountainRarityOutcome') return occurrenceOwnerAddress(address.action);
  if (address.kind === 'steadyGrowthOutcome') {
    return address.owner.kind === 'occurrence' ? address.owner : undefined;
  }
  // A room-exit settlement finding is addressed to its atomic entry, whose
  // occurrence owner is intentionally one layer further out through its
  // exact site. Keep that ancestry when a settlement itself is the first
  // blocking region so the already-prepared pre-settlement candidate context
  // remains available for repairing the authored order.
  if (address.kind === 'acquisitionEntry') return occurrenceOwnerAddress(address.site);
  if (address.kind === 'acquisitionRole') return occurrenceOwnerAddress(address.owner);
  if (address.kind === 'acquisitionSite') return occurrenceOwnerAddress(address.owner);
  if (
    address.kind === 'traitOffer' ||
    address.kind === 'levelResolution' ||
    address.kind === 'traitAcquisitionTarget' ||
    address.kind === 'circeResolution' ||
    address.kind === 'echoPomTarget' ||
    address.kind === 'echoLastRunBoon' ||
    address.kind === 'echoLastReward'
  )
    return occurrenceOwnerAddress(
      address.kind === 'traitAcquisitionTarget' ||
        address.kind === 'circeResolution' ||
        address.kind === 'echoPomTarget' ||
        address.kind === 'echoLastRunBoon' ||
        address.kind === 'echoLastReward'
        ? address.trait
        : address.owner,
    );
  if (address.kind === 'encounterPhase' && address.owner.kind === 'occurrence') {
    return createOccurrenceAddress(
      createBiomeAddress(address.routeKey, address.biomeKey),
      address.owner.occurrenceId,
    );
  }
  if ('occurrenceId' in address) {
    return createOccurrenceAddress(
      createBiomeAddress(address.routeKey, address.biomeKey),
      address.occurrenceId,
    );
  }
  return undefined;
}

function targetForOccurrence(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  occurrenceId: OccurrenceAddress['occurrenceId'],
): TargetAddress | undefined {
  for (const { decision } of prefixDecisionEntries(prefix)) {
    if (decision.kind === 'batch') {
      const target = decision.targets.find(
        (candidate) => candidate.room.occurrenceId === occurrenceId,
      );
      if (target !== undefined) return target.origin;
      continue;
    }
    // Hub targets are HubSlotAddress owners rather than ordinary TargetAddress
    // owners; their parent-local capability is represented by the lifecycle
    // artifact, not the ordinary room-target candidate surface.
  }
  return undefined;
}

export function gameNameForTarget(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  target: TargetAddress,
): string | undefined {
  const entry = prefixDecisionEntries(prefix).find(
    ({ decision }) =>
      decision.kind === 'batch' &&
      decision.source.kind === 'occurrence' &&
      target.source.kind === 'occurrence' &&
      decision.source.occurrenceId === target.source.occurrenceId,
  );
  if (entry?.decision.kind !== 'batch') return undefined;
  return entry.decision.targets.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(target),
  )?.room.gameName;
}

export function blockedAncestorChain(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  located: LocatedFinding,
): BlockedAncestorChain {
  const occurrenceOwner = occurrenceOwnerAddress(located.finding.origin);
  const target =
    located.decisionIndex < 0
      ? occurrenceOwner === undefined
        ? undefined
        : targetForOccurrence(prefix, occurrenceOwner.occurrenceId)
      : (() => {
          const entry = prefixDecisionEntries(prefix).find(
            (candidate) => candidate.decisionIndex === located.decisionIndex,
          );
          if (entry?.decision.kind === 'batch' && located.targetIndex !== undefined) {
            return entry.decision.targets[located.targetIndex]?.origin;
          }
          return occurrenceOwner === undefined
            ? undefined
            : targetForOccurrence(prefix, occurrenceOwner.occurrenceId);
        })();
  return Object.freeze({
    ...(rewardOwnerAddress(located.finding.origin) === undefined
      ? {}
      : { rewardOwner: rewardOwnerAddress(located.finding.origin) }),
    ...(occurrenceOwner === undefined ? {} : { occurrenceOwner }),
    ...(target === undefined ? {} : { target }),
  });
}

/**
 * Products from a complete canonical attempt that remain authoritative while
 * the authored prefix is replayed at its first unsupported region. The
 * complete path has already paid to produce these opaque capabilities and
 * finding regions; the clamp must not rebuild the same full prefix merely to
 * rediscover them.
 */
export interface ProgressiveBiomeSelectedProducts {
  /** The complete history assembled before progressive validity clamping. */
  readonly history: BiomeHistoryPrefix;
  /** Generation validation already evaluated against that complete history. */
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
}

export function mergedFindings(
  evaluated: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>,
  retained: readonly SemanticFinding[] = [],
): readonly SemanticFinding[] {
  const findings = [
    ...retained,
    ...evaluated.findings,
    ...evaluated.roomGeneration.findings,
    ...evaluated.rewards.findings,
  ];
  const seen = new Set<string>();
  return Object.freeze(
    findings.filter((finding) => {
      const key = findingIdentityKey(finding);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

export function findingOwnerOrigin(finding: SemanticFinding): SemanticAddress {
  let origin = finding.origin;
  while (
    origin.kind === 'traitOffer' ||
    origin.kind === 'naturalSelectionResult' ||
    origin.kind === 'levelResolution' ||
    origin.kind === 'acquisitionRole' ||
    origin.kind === 'traitAcquisitionTarget' ||
    origin.kind === 'circeResolution' ||
    origin.kind === 'echoPomTarget' ||
    origin.kind === 'echoLastRunBoon' ||
    origin.kind === 'echoLastReward' ||
    origin.kind === 'allTogetherSet' ||
    origin.kind === 'nemesisRandomEvent' ||
    origin.kind === 'steadyGrowthOutcome' ||
    origin.kind === 'acquisitionEntry' ||
    origin.kind === 'acquisitionSite'
  ) {
    origin =
      origin.kind === 'acquisitionRole'
        ? origin.owner
        : origin.kind === 'nemesisRandomEvent'
          ? origin.encounter
          : origin.kind === 'acquisitionEntry'
            ? origin.site
            : origin.kind === 'acquisitionSite'
              ? origin.owner
              : origin.kind === 'naturalSelectionResult' ||
                  origin.kind === 'traitAcquisitionTarget' ||
                  origin.kind === 'circeResolution' ||
                  origin.kind === 'echoPomTarget' ||
                  origin.kind === 'echoLastRunBoon' ||
                  origin.kind === 'echoLastReward' ||
                  origin.kind === 'allTogetherSet'
                ? origin.trait
                : origin.owner;
  }
  return origin;
}

export function ownsOccurrence(origin: SemanticAddress, occurrenceId: string): boolean {
  if (origin.kind === 'fountainRarityOutcome') return ownsOccurrence(origin.action, occurrenceId);
  if (
    origin.kind === 'traitOffer' ||
    origin.kind === 'naturalSelectionResult' ||
    origin.kind === 'levelResolution' ||
    origin.kind === 'acquisitionRole' ||
    origin.kind === 'traitAcquisitionTarget' ||
    origin.kind === 'circeResolution' ||
    origin.kind === 'echoPomTarget' ||
    origin.kind === 'echoLastRunBoon' ||
    origin.kind === 'echoLastReward' ||
    origin.kind === 'allTogetherSet' ||
    origin.kind === 'nemesisRandomEvent' ||
    origin.kind === 'steadyGrowthOutcome' ||
    origin.kind === 'acquisitionEntry' ||
    origin.kind === 'acquisitionSite'
  )
    return ownsOccurrence(
      origin.kind === 'acquisitionRole'
        ? origin.owner
        : origin.kind === 'nemesisRandomEvent'
          ? origin.encounter
          : origin.kind === 'acquisitionEntry'
            ? origin.site
            : origin.kind === 'acquisitionSite'
              ? origin.owner
              : origin.kind === 'naturalSelectionResult' ||
                  origin.kind === 'traitAcquisitionTarget' ||
                  origin.kind === 'circeResolution' ||
                  origin.kind === 'echoPomTarget' ||
                  origin.kind === 'echoLastRunBoon' ||
                  origin.kind === 'echoLastReward' ||
                  origin.kind === 'allTogetherSet'
                ? origin.trait
                : origin.owner,
      occurrenceId,
    );
  if ('occurrenceId' in origin && origin.occurrenceId === occurrenceId) return true;
  return origin.kind === 'encounterPhase' && origin.owner.occurrenceId === occurrenceId;
}

function decisionOwnsFinding(decision: CanonicalDecision, finding: SemanticFinding): boolean {
  const origin = findingOwnerOrigin(finding);
  if (semanticAddressKey(decision.origin) === semanticAddressKey(origin)) return true;
  if (decision.kind === 'batch') {
    return (
      semanticAddressKey(decision.selectedOrigin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.rewardStore.origin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.parent.origin) === semanticAddressKey(origin) ||
      decision.targets.some(
        (target) =>
          semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
          ownsOccurrence(origin, target.room.occurrenceId),
      ) ||
      decision.additional.some(
        (continuation) =>
          semanticAddressKey(continuation.origin) === semanticAddressKey(origin) ||
          ownsOccurrence(origin, continuation.room.occurrenceId),
      )
    );
  }
  return (
    semanticAddressKey(decision.board.origin) === semanticAddressKey(origin) ||
    semanticAddressKey(decision.room.origin) === semanticAddressKey(origin) ||
    decision.board.targets.some(
      (target) =>
        semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
        ownsOccurrence(origin, target.room.occurrenceId),
    ) ||
    decision.visits.some(
      (visit) =>
        semanticAddressKey(visit.origin) === semanticAddressKey(origin) ||
        visit.localSlots.some(
          (slot) =>
            semanticAddressKey(slot.localVisit.origin) === semanticAddressKey(origin) ||
            ownsOccurrence(origin, slot.occurrenceId),
        ),
    )
  );
}

function activeHubFrontierOwnsFinding(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  finding: SemanticFinding,
): boolean {
  const frontier = prefix.kind === 'biomePrefix' ? prefix.frontier : undefined;
  if (!hasHubVisitDetails(frontier)) return false;
  const origin = findingOwnerOrigin(finding);
  return (
    semanticAddressKey(frontier.origin) === semanticAddressKey(origin) ||
    ownsOccurrence(origin, frontier.target.room.occurrenceId) ||
    frontier.localSlots.some(
      (slot) =>
        semanticAddressKey(slot.localVisit.origin) === semanticAddressKey(origin) ||
        ownsOccurrence(origin, slot.occurrenceId),
    )
  );
}

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'target' in frontier && 'localSlots' in frontier;
}

export interface LocatedFinding {
  readonly finding: SemanticFinding;
  /** Evaluator-owned atomic region used for first-blocking retention. */
  readonly regionKey: string;
  readonly aggregate?: FindingAggregate;
  readonly historySequence?: number;
  readonly historyBoundary?: 'before' | 'at' | 'after';
  readonly decisionIndex: number;
  /** The owner belongs to the physical batch retained at the exit frontier. */
  readonly frontierBatch?: boolean;
  /** Earlier normal-door targets are already generated before this target. */
  readonly targetIndex?: number;
  /** Entry-time sibling continuations are ordered separately from normal doors. */
  readonly additionalIndex?: number;
  /** Hub board targets exist before any selected Hub visit. */
  readonly hubBoardTargetIndex?: number;
  readonly hubVisitIndex?: number;
  readonly hubVisitPhase?: MaterializedHubVisitFrontier['phase'];
  readonly hubLocalLifecycleIndex?: number;
}

function targetIndex(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  finding: SemanticFinding,
): number | undefined {
  const index = decision.targets.findIndex(
    (target) =>
      semanticAddressKey(target.origin) === semanticAddressKey(findingOwnerOrigin(finding)) ||
      ownsOccurrence(findingOwnerOrigin(finding), target.room.occurrenceId),
  );
  return index < 0 ? undefined : index;
}

function additionalIndex(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  finding: SemanticFinding,
): number | undefined {
  const index = decision.additional.findIndex(
    (continuation) =>
      semanticAddressKey(continuation.origin) === semanticAddressKey(findingOwnerOrigin(finding)) ||
      ownsOccurrence(findingOwnerOrigin(finding), continuation.room.occurrenceId),
  );
  return index < 0 ? undefined : index;
}

function localSlotIndex(visit: CanonicalHubVisit, finding: SemanticFinding): number | undefined {
  const origin = findingOwnerOrigin(finding);
  const index = visit.localSlots.findIndex(
    (slot) =>
      semanticAddressKey(slot.localVisit.origin) === semanticAddressKey(origin) ||
      ownsOccurrence(origin, slot.occurrenceId) ||
      (slot.incomingReward !== undefined &&
        semanticAddressKey(slot.incomingReward.origin) === semanticAddressKey(origin)),
  );
  return index < 0 ? undefined : index;
}

export interface HubVisitFindingLocation {
  readonly visitIndex: number;
  readonly phase: MaterializedHubVisitFrontier['phase'];
  readonly localLifecycleIndex?: number;
}

function hubVisitFindingLocation(
  decision: Extract<CanonicalDecision, { readonly kind: 'hub' }>,
  finding: SemanticFinding,
  chronology?: FindingRegionEntry['chronology'],
): HubVisitFindingLocation | undefined {
  if (chronology?.kind === 'hubVisit') {
    return Object.freeze({
      visitIndex: chronology.visitIndex,
      phase: chronology.phase,
      ...(chronology.localLifecycleIndex === undefined
        ? {}
        : { localLifecycleIndex: chronology.localLifecycleIndex }),
    });
  }
  const origin = findingOwnerOrigin(finding);
  for (const [index, visit] of decision.visits.entries()) {
    const localIndex = localSlotIndex(visit, finding);
    if (localIndex !== undefined) {
      const enteredIndex = visit.enteredLocalRooms.findIndex(
        (slot) =>
          semanticAddressKey(slot.origin) ===
          semanticAddressKey(visit.localSlots[localIndex]!.origin),
      );
      return enteredIndex >= 0
        ? Object.freeze({
            visitIndex: index,
            phase: 'localRoomLifecycle',
            localLifecycleIndex: enteredIndex,
          })
        : Object.freeze({ visitIndex: index, phase: 'sideGeneration' });
    }
    if (ownsOccurrence(origin, visit.target.room.occurrenceId)) {
      return Object.freeze({ visitIndex: index, phase: 'targetLifecycle' });
    }
    if (semanticAddressKey(visit.origin) === semanticAddressKey(origin)) {
      return Object.freeze({ visitIndex: index, phase: 'targetLifecycle' });
    }
  }
  return undefined;
}

function hubBoardTargetIndex(
  decision: Extract<CanonicalDecision, { readonly kind: 'hub' }>,
  finding: SemanticFinding,
  visitLocation: HubVisitFindingLocation | undefined,
): number | undefined {
  if (visitLocation?.phase === 'targetLifecycle') return undefined;
  const origin = findingOwnerOrigin(finding);
  const index = decision.board.targets.findIndex(
    (target) =>
      semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
      (origin.kind === 'incomingReward' && origin.occurrenceId === target.room.occurrenceId),
  );
  return index < 0 ? undefined : index;
}

interface PrefixDecisionEntry {
  readonly decision: CanonicalDecision;
  readonly decisionIndex: number;
  readonly frontierBatch: boolean;
}

function prefixDecisionEntries(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
): readonly PrefixDecisionEntry[] {
  const completed = prefix.decisions.map((decision, decisionIndex) =>
    Object.freeze({ decision, decisionIndex, frontierBatch: false }),
  );
  const partialBatch =
    prefix.kind === 'biomePrefix' && prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined;
  return partialBatch === undefined
    ? Object.freeze(completed)
    : Object.freeze([
        ...completed,
        Object.freeze({
          decision: partialBatch,
          decisionIndex: prefix.decisions.length,
          frontierBatch: true,
        }),
      ]);
}

export function locateFinding(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  finding: SemanticFinding,
  atomicRegion: string = ownerRegion(finding.origin),
  chronology?: FindingRegionEntry['chronology'],
  aggregate?: FindingAggregate,
): LocatedFinding | undefined {
  const historyChronology =
    chronology?.kind === 'history'
      ? chronology
      : chronology?.kind === 'hubBoard' || chronology?.kind === 'hubVisit'
        ? chronology.history
        : undefined;
  // Automatic Boss Arcana effects are terminal lifecycle children, not
  // authored Preboss occurrences. They follow every decision in the
  // materialized biome and have no room occurrence to use for ordinary
  // ownership lookup.
  if (
    (finding.origin.kind === 'judgmentArcana' || finding.origin.kind === 'figurineArcana') &&
    finding.origin.routeKey === prefix.routeKey &&
    finding.origin.biomeKey === prefix.biomeKey
  ) {
    return Object.freeze({
      finding,
      decisionIndex: prefix.decisions.length - 1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  // The ordinary rack is a fixed Postboss first-action boundary, not an
  // authored occurrence or normal-door decision. Its invalid persisted value
  // still belongs to the completed biome's final assessable region.
  if (
    finding.origin.kind === 'keepsakeSelection' &&
    finding.origin.owner !== 'routeStart' &&
    finding.origin.routeKey === prefix.routeKey &&
    finding.origin.biomeKey === prefix.biomeKey
  ) {
    return Object.freeze({
      finding,
      decisionIndex: prefix.decisions.length - 1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  // Fixed Boss/Postboss occurrences are real lifecycle owners but are not
  // ordinary topology decisions. Occurrence-local findings belong to the
  // completed biome's final fixed-room region.
  const fixedOccurrence =
    finding.origin.kind === 'occurrence'
      ? finding.origin
      : finding.origin.kind === 'fountainRarityOutcome'
        ? occurrenceOwnerAddress(finding.origin)
        : undefined;
  if (
    fixedOccurrence !== undefined &&
    fixedOccurrence.routeKey === prefix.routeKey &&
    fixedOccurrence.biomeKey === prefix.biomeKey &&
    (prefix.fixedRoomLinks ?? []).some(
      (link) =>
        link.source.occurrenceId === fixedOccurrence.occurrenceId ||
        link.target.occurrenceId === fixedOccurrence.occurrenceId,
    )
  ) {
    return Object.freeze({
      finding,
      decisionIndex: prefix.decisions.length - 1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  // Retained Pool sales are occurrence-owned Postboss actions. They remain
  // repairable at the completed biome's final fixed-room region even when
  // their slot was cleared and therefore no longer has an active contribution.
  const automaticRoomAction = finding.origin.kind === 'roomAction' ? finding.origin : undefined;
  if (
    automaticRoomAction !== undefined &&
    automaticRoomAction.routeKey === prefix.routeKey &&
    automaticRoomAction.biomeKey === prefix.biomeKey &&
    (prefix.fixedRoomLinks ?? []).some(
      (link) =>
        link.source.occurrenceId === automaticRoomAction.occurrenceId ||
        link.target.occurrenceId === automaticRoomAction.occurrenceId,
    )
  ) {
    return Object.freeze({
      finding,
      decisionIndex: prefix.decisions.length - 1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  if (
    finding.origin.kind === 'keepsakeEquipResult' &&
    finding.origin.selection.kind === 'echoKeepsakeReplay' &&
    finding.origin.routeKey === prefix.routeKey &&
    finding.origin.biomeKey === prefix.biomeKey
  ) {
    return Object.freeze({
      finding,
      decisionIndex: -1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  if (
    finding.origin.kind === 'keepsakeEquipResult' &&
    finding.origin.selection.kind === 'keepsakeSelection' &&
    finding.origin.selection.owner !== 'routeStart' &&
    finding.origin.routeKey === prefix.routeKey &&
    finding.origin.biomeKey === prefix.biomeKey
  ) {
    return Object.freeze({
      finding,
      decisionIndex: prefix.decisions.length - 1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  if (
    prefix.entryRoom !== undefined &&
    ownsOccurrence(finding.origin, prefix.entryRoom.occurrenceId)
  ) {
    return Object.freeze({
      finding,
      decisionIndex: -1,
      regionKey: atomicRegion,
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(historyChronology === undefined
        ? {}
        : {
            historySequence: historyChronology.sequence,
            historyBoundary: historyChronology.boundary,
          }),
    });
  }
  const decisionEntry = prefixDecisionEntries(prefix).find(
    ({ decision }) =>
      decisionOwnsFinding(decision, finding) ||
      (decision.kind === 'hub' && activeHubFrontierOwnsFinding(prefix, finding)),
  );
  if (decisionEntry === undefined) return undefined;
  const { decision, decisionIndex, frontierBatch } = decisionEntry;
  const indexedTarget = decision.kind === 'batch' ? targetIndex(decision, finding) : undefined;
  const indexedAdditional =
    decision.kind === 'batch' ? additionalIndex(decision, finding) : undefined;
  const hubVisitLocation =
    decision.kind === 'hub' ? hubVisitFindingLocation(decision, finding, chronology) : undefined;
  const indexedHubBoard =
    decision.kind === 'hub' ? hubBoardTargetIndex(decision, finding, hubVisitLocation) : undefined;
  return Object.freeze({
    finding,
    regionKey: atomicRegion,
    ...(aggregate === undefined ? {} : { aggregate }),
    ...(historyChronology === undefined
      ? {}
      : {
          historySequence: historyChronology.sequence,
          historyBoundary: historyChronology.boundary,
        }),
    decisionIndex,
    ...(frontierBatch ? { frontierBatch: true } : {}),
    ...(indexedTarget === undefined ? {} : { targetIndex: indexedTarget }),
    ...(indexedAdditional === undefined ? {} : { additionalIndex: indexedAdditional }),
    ...(indexedHubBoard === undefined ? {} : { hubBoardTargetIndex: indexedHubBoard }),
    ...(hubVisitLocation === undefined
      ? {}
      : {
          hubVisitIndex: hubVisitLocation.visitIndex,
          hubVisitPhase: hubVisitLocation.phase,
          ...(hubVisitLocation.localLifecycleIndex === undefined
            ? {}
            : { hubLocalLifecycleIndex: hubVisitLocation.localLifecycleIndex }),
        }),
  });
}

export function firstUnsupportedFinding(
  prefix: MaterializedBiomePrefix,
  findingRegions: readonly FindingRegionEntry[],
  include: (finding: SemanticFinding) => boolean = () => true,
  excludedRegionKey?: string,
): LocatedFinding | undefined {
  const located: LocatedFinding[] = [];
  for (const entry of findingRegions) {
    const finding = entry.finding;
    if (finding.severity !== 'error' || !include(finding)) continue;
    const location = locateFinding(
      prefix,
      finding,
      entry.atomicRegion,
      entry.chronology,
      entry.aggregate,
    );
    if (location === undefined) {
      if (finding.severity === 'error') {
        throw new Error(
          `finding ${finding.code} at ${semanticAddressKey(finding.origin)} has no atomic region`,
        );
      }
      continue;
    }
    if (location.regionKey !== excludedRegionKey) located.push(location);
  }
  return located.sort(compareLocatedFindings)[0];
}

/**
 * Fig Leaf authored selections are intentionally repairable in place. Their
 * lifecycle phase still executes normally when chronology rejects the skip,
 * so the finding must not clamp the later authored topology/history prefix.
 */
export function isProgressiveBlockingFinding(finding: SemanticFinding): boolean {
  return finding.code !== 'figLeafSkipUnavailable';
}

export function findingsAtRegion(
  prefix: MaterializedBiomePrefix,
  findingRegions: readonly FindingRegionEntry[],
  regionKey: string,
): readonly SemanticFinding[] {
  const findings: SemanticFinding[] = [];
  for (const entry of findingRegions) {
    const finding = entry.finding;
    const location = locateFinding(
      prefix,
      finding,
      entry.atomicRegion,
      entry.chronology,
      entry.aggregate,
    );
    if (location === undefined) {
      if (finding.severity === 'error') {
        throw new Error(
          `finding ${finding.code} at ${semanticAddressKey(finding.origin)} has no atomic region`,
        );
      }
      continue;
    }
    if (location.regionKey === regionKey) findings.push(finding);
  }
  return Object.freeze(findings);
}

export function encounterBlockFinding(block: EncounterHistoryBlock): SemanticFinding {
  const finding = block.preparation.findings.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(block.blockedAt),
  );
  if (finding === undefined) {
    throw new Error(`encounter block ${semanticAddressKey(block.blockedAt)} has no finding`);
  }
  return finding;
}

export function encounterBlockChronology(block: EncounterHistoryBlock): HistoryFindingChronology {
  return Object.freeze({
    kind: 'history',
    sequence: block.afterValidRecordPrefix.sequence,
    boundary: 'at',
  });
}

export function compareLocatedFindings(left: LocatedFinding, right: LocatedFinding): number {
  const visitPhaseOrder = (phase: LocatedFinding['hubVisitPhase']): number =>
    phase === 'targetLifecycle'
      ? 0
      : phase === 'sideGeneration'
        ? 1
        : phase === 'localRoomLifecycle'
          ? 2
          : -1;
  const hubStageOrder = (value: LocatedFinding): number =>
    value.hubVisitIndex === undefined ? 0 : 1;
  const historyPosition = (value: LocatedFinding): readonly [number, number] | undefined =>
    value.historySequence === undefined || value.historyBoundary === undefined
      ? undefined
      : [
          value.historySequence,
          value.historyBoundary === 'before' ? 0 : value.historyBoundary === 'at' ? 1 : 2,
        ];
  const leftHistory = historyPosition(left);
  const rightHistory = historyPosition(right);
  const historyOrder =
    leftHistory === undefined || rightHistory === undefined
      ? 0
      : leftHistory[0] - rightHistory[0] || leftHistory[1] - rightHistory[1];
  return (
    historyOrder ||
    left.decisionIndex - right.decisionIndex ||
    (left.targetIndex ?? -1) - (right.targetIndex ?? -1) ||
    (left.additionalIndex === undefined ? Number.MAX_SAFE_INTEGER : left.additionalIndex) -
      (right.additionalIndex === undefined ? Number.MAX_SAFE_INTEGER : right.additionalIndex) ||
    hubStageOrder(left) - hubStageOrder(right) ||
    (left.hubBoardTargetIndex ?? -1) - (right.hubBoardTargetIndex ?? -1) ||
    (left.hubVisitIndex ?? -1) - (right.hubVisitIndex ?? -1) ||
    visitPhaseOrder(left.hubVisitPhase) - visitPhaseOrder(right.hubVisitPhase) ||
    (left.hubLocalLifecycleIndex ?? -1) - (right.hubLocalLifecycleIndex ?? -1)
  );
}
