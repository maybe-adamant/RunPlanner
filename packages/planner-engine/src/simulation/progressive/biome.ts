import type { Catalog } from '../../catalog-schema';
import {
  createOccurrenceAddress,
  createBiomeAddress,
  type BossCompletionArcanaAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceAddress,
  type SemanticAddress,
  type TargetAddress,
  type LevelResolutionAddress,
  type TraitOfferAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AcquisitionRoleAddress,
} from '../../authored-project/addresses';
import type { AuthoredBiomePlan, RouteLoadout } from '../../authored-project/model';
import { evaluateBiomeRoomGenerationAssemblyInternal } from '../generation/biome';
import { evaluateHubDecisionGenerationInternal } from '../generation/hub';
import type {
  GeneratedRoomGenerationValidation,
  HubRoomGenerationValidation,
  RoomTargetCandidateContext,
} from '../generation/model';
import {
  createBiomeCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type TraitOfferCandidateArtifacts,
} from '../candidate-artifacts';
import {
  composeBiomeHistoryPrefixWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type EncounterHistoryBlock,
} from '../history';
import type {
  CanonicalBiome,
  CanonicalAdditionalContinuation,
  CanonicalDecision,
  CanonicalHubVisit,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubVisitFrontier,
} from '../materialization';
import { selectedBatchContinuation } from '../materialization';
import { evaluateEncounterCandidatesInternal } from '../encounters/candidates';
import { structurallyActiveEncounterRooms } from '../encounters/structural';
import type {
  EncounterCandidateArtifacts,
  EncounterCandidateBoundary,
} from '../encounters/candidates';
import { materializeBiomePrefix } from '../materialization';
import type { SemanticFinding } from '../model';
import {
  ownerRegion,
  findingIdentityKey,
  type FindingRegionEntry,
  type FindingAggregate,
  type HistoryFindingChronology,
} from '../finding-regions';
import type { SelectedTraitOfferAssessment } from '../traits';
import {
  evaluateBiomeRewardsAssemblyInternal,
  type TraitChildSettlementCheckpoints,
} from '../rewards/biome';
import type { BiomeRewardSimulation, RewardBranch } from '../rewards';
import type {
  RewardProducerCandidateArtifacts,
  RewardProducerOwnerAddress,
} from '../rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from '../rewards/lifecycle-artifacts';
import type { FigLeafLifecycleState } from '../history';
import { attestFigLeafBranchState, attestGorgonBranchState } from '../keepsakes';

export interface BiomeGenerationValidation {
  readonly validity: 'invalid' | 'valid';
  readonly ordinary: GeneratedRoomGenerationValidation;
  readonly hub: HubRoomGenerationValidation;
  readonly findings: readonly SemanticFinding[];
}

export interface ProgressiveBiomeEvaluation {
  readonly materializedPrefix: MaterializedBiomePrefix;
  /**
   * The bounded structural slice whose ordinary lifecycle products reached a
   * canonical checkpoint. An encounter block keeps the larger authored
   * prefix visible while this slice prevents assessed-state leakage beyond
   * the failed room.
   */
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
  readonly findings: readonly SemanticFinding[];
  readonly blockedAt?: SemanticAddress;
}

export interface ProgressiveBiomeEvaluationAssembly {
  readonly evaluation: ProgressiveBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

export interface ProgressiveSeed {
  readonly history: CanonicalBiomeHistory;
  readonly rewardBranches: readonly RewardBranch[];
}

export interface ProgressiveBiomeContext {
  readonly enteredBiomeCount: number;
  /** A Postboss rack is reached only when this configured route continues. */
  readonly hasConfiguredSuccessor?: boolean;
  readonly loadout: RouteLoadout;
  readonly seed?: ProgressiveSeed;
}

function figLeafLifecycleState(
  catalog: Catalog,
  context: ProgressiveBiomeContext,
): FigLeafLifecycleState | undefined {
  if (context.seed !== undefined) {
    const state = attestFigLeafBranchState(context.seed.rewardBranches);
    return state === undefined
      ? undefined
      : { remainingUses: state.remainingUses, activatedThisBiome: false };
  }
  const keepsake = catalog.keepsakes.byKey[context.loadout.startingKeepsakeKey];
  const effect = keepsake?.effect;
  return effect?.kind === 'figLeaf' && keepsake !== undefined
    ? { remainingUses: effect.biomeUsesByRank[keepsake.rank], activatedThisBiome: false }
    : undefined;
}

interface ProgressiveGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

function generation(
  catalog: Catalog,
  productPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  encounterPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  history: BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  traitOffers: import('../candidate-artifacts').TraitOfferCandidateArtifacts,
  levelResolutions: import('../candidate-artifacts').LevelResolutionCandidateArtifacts,
  encounterBoundary?: EncounterCandidateBoundary,
): ProgressiveGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssemblyInternal(
    catalog,
    productPrefix,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  // An encounter block can occur after the active Hub visit's side-generation
  // checkpoint. Validate that visit against the selected authored envelope so
  // an earlier side-generation error remains available for chronological
  // comparison with the later encounter block.
  const hub = evaluateHubDecisionGenerationInternal(catalog, encounterPrefix, history);
  const encounters = evaluateEncounterCandidatesInternal(
    catalog,
    structurallyActiveEncounterRooms(encounterPrefix),
    new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room.preparation])),
    encounterBoundary,
    rewards.figLeafPhaseCandidates,
    attestGorgonBranchState(rewards.branches),
    rewards.gorgonPhaseCandidates,
  );
  const validation: BiomeGenerationValidation = Object.freeze({
    validity:
      ordinary.validation.validity === 'valid' &&
      hub.validity === 'valid' &&
      encounters.findings.length === 0
        ? 'valid'
        : 'invalid',
    ordinary: ordinary.validation,
    hub,
    findings: Object.freeze([
      ...ordinary.validation.findings,
      ...hub.findings,
      ...encounters.findings,
    ]),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createBiomeCandidateArtifacts(
      createBiomeAddress(productPrefix.routeKey, productPrefix.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
      encounters.artifacts,
      traitOffers,
      levelResolutions,
    ),
    findingRegions: Object.freeze([
      ...ordinary.findingRegions,
      ...hub.findingRegions,
      ...encounters.findingRegions,
    ]),
  });
}

interface ProgressiveProducts {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly encounterBlock?: EncounterHistoryBlock;
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
}

interface BlockedAncestorChain {
  readonly rewardOwner?: RewardProducerOwnerAddress | undefined;
  readonly occurrenceOwner?: OccurrenceAddress | undefined;
  readonly target?: TargetAddress | undefined;
}

interface SelectedTargetGenerationAssessment {
  readonly gameName: string;
  readonly context: RoomTargetCandidateContext;
}

function rewardOwnerAddress(address: SemanticAddress): RewardProducerOwnerAddress | undefined {
  switch (address.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
      return address;
    case 'traitOffer':
    case 'levelResolution':
      return rewardOwnerAddress(address.owner);
    case 'circeResolution':
    case 'echoPomTarget':
      return rewardOwnerAddress(address.trait);
    default:
      return undefined;
  }
}

function occurrenceOwnerAddress(address: SemanticAddress): OccurrenceAddress | undefined {
  if (address.kind === 'occurrence') return address;
  // A room-exit settlement finding is addressed to its atomic entry, whose
  // occurrence owner is intentionally one layer further out through its
  // exact site. Keep that ancestry when a settlement itself is the first
  // blocking region so the already-prepared pre-settlement candidate context
  // remains available for repairing the authored order.
  if (address.kind === 'acquisitionEntry') return occurrenceOwnerAddress(address.site);
  if (address.kind === 'acquisitionSite') return occurrenceOwnerAddress(address.owner);
  if (
    address.kind === 'traitOffer' ||
    address.kind === 'levelResolution' ||
    address.kind === 'circeResolution' ||
    address.kind === 'echoPomTarget'
  )
    return occurrenceOwnerAddress(
      address.kind === 'circeResolution' || address.kind === 'echoPomTarget'
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

function gameNameForTarget(
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

function blockedAncestorChain(
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

function products(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  context: ProgressiveBiomeContext,
): ProgressiveProducts {
  const lifecycleFigLeafState = figLeafLifecycleState(catalog, context);
  const composed = composeBiomeHistoryPrefixWithEncounterValidation(
    catalog,
    prefix,
    context.seed?.history.afterTransition,
    lifecycleFigLeafState,
  );
  if (composed === null) {
    throw new Error(`${prefix.biomeKey} materialized prefix has no composable history`);
  }
  const encounterBoundary =
    composed.kind === 'blocked'
      ? Object.freeze({
          blocked: Object.freeze({
            room: composed.block.room,
            before: composed.block.before,
          }),
        })
      : undefined;
  const generationPrefix =
    composed.kind === 'blocked' ? encounterBlockProductPrefix(prefix, composed.block) : prefix;
  // The encounter-aware composition already contains the exact preparation
  // checkpoint and every valid predecessor record. Re-composing the bounded
  // topology would erase that partial lifecycle and publish only creation.
  const history = composed.history;
  const rewards = evaluateBiomeRewardsAssemblyInternal(
    catalog,
    generationPrefix as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    },
    history,
    context.enteredBiomeCount,
    context.loadout,
    context.seed?.rewardBranches,
  );
  const roomGeneration = generation(
    catalog,
    generationPrefix as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    },
    prefix as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    },
    history,
    context.enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    rewards.traitOfferArtifacts,
    rewards.levelResolutionArtifacts,
    encounterBoundary,
  );
  return Object.freeze({
    evaluation: Object.freeze({
      history,
      rewards: rewards.simulation,
      roomGeneration: roomGeneration.validation,
      findings: Object.freeze(
        composed.kind === 'blocked' ? [encounterBlockFinding(composed.block)] : [],
      ),
      ...(composed.kind === 'blocked' ? { assessmentPrefix: generationPrefix } : {}),
    }),
    candidateArtifacts: roomGeneration.candidateArtifacts,
    ...(composed.kind === 'blocked' ? { encounterBlock: composed.block } : {}),
    findingRegions: Object.freeze([...roomGeneration.findingRegions, ...rewards.findingRegions]),
    traitChildSettlementCheckpoints: rewards.traitChildSettlementCheckpoints,
  });
}

/**
 * A generic clamp may retain a target only as an interaction frontier. Trait
 * acquisition happens during that target's room lifecycle, so the selected
 * offer and its opaque pre-offer capability must be carried from the original
 * selected-path assembly into the retained interaction product. Nothing after
 * the blocked offer is admitted.
 */
function retainBlockedRegionProducts(
  retainedRewards: BiomeRewardSimulation,
  retainedArtifacts: BiomeCandidateArtifacts,
  blockedArtifacts: BiomeCandidateArtifacts,
  selectedRewards: BiomeRewardSimulation,
  selectedArtifacts: BiomeCandidateArtifacts,
  selectedTraitChildSettlements: TraitChildSettlementCheckpoints,
  ancestors: BlockedAncestorChain,
  blockedAt: SemanticAddress,
  blockedRegionKey: string,
  selectedFindingRegions: readonly FindingRegionEntry[],
  frontierSettlementOwner: OccurrenceAddress | undefined,
): { readonly rewards: BiomeRewardSimulation; readonly artifacts: BiomeCandidateArtifacts } {
  const blockedTraitAt: TraitOfferAddress | undefined =
    blockedAt.kind === 'traitOffer'
      ? blockedAt
      : blockedAt.kind === 'circeResolution' || blockedAt.kind === 'echoPomTarget'
        ? blockedAt.trait
        : undefined;
  const blockedLevelAt: LevelResolutionAddress | undefined =
    blockedAt.kind === 'levelResolution' ? blockedAt : undefined;
  const blockedBossCompletionAt: BossCompletionArcanaAddress | undefined =
    blockedAt.kind === 'bossCompletionArcana' ? blockedAt : undefined;
  const blockedKeepsakeAt: KeepsakeSelectionAddress | undefined =
    blockedAt.kind === 'keepsakeSelection' ? blockedAt : undefined;
  const blockedKeepsakeEquipResultAt: KeepsakeEquipResultAddress | undefined =
    blockedAt.kind === 'keepsakeEquipResult' ? blockedAt : undefined;
  const blockedAcquisitionAt: AcquisitionRoleAddress | undefined =
    blockedAt.kind === 'acquisitionRole' ? blockedAt : undefined;
  const blockedKey = blockedTraitAt === undefined ? undefined : semanticAddressKey(blockedTraitAt);
  const selectedOfferPrefix: SelectedTraitOfferAssessment[] = [];
  if (blockedKey !== undefined) {
    for (const offer of selectedRewards.selectedTraitOffers) {
      selectedOfferPrefix.push(offer);
      if (semanticAddressKey(offer.address) === blockedKey) break;
    }
  }
  const retainedOfferKeys = new Set(
    retainedRewards.selectedTraitOffers.map((offer) => semanticAddressKey(offer.address)),
  );
  const selectedTraitOffers = Object.freeze([
    ...retainedRewards.selectedTraitOffers,
    ...selectedOfferPrefix.filter(
      (offer) => !retainedOfferKeys.has(semanticAddressKey(offer.address)),
    ),
  ]);
  const blockedRewardFindings = Object.freeze(
    selectedFindingRegions
      .filter((entry) => entry.atomicRegion === blockedRegionKey && entry.aggregate === 'reward')
      .map((entry) => entry.finding),
  );
  const blockedChildSettlement = selectedTraitChildSettlements.at(blockedAt);
  const retainedRunStateKeys = new Set(
    retainedRewards.runStateSnapshots.map((snapshot) => semanticAddressKey(snapshot.owner)),
  );
  const runStateSnapshots = Object.freeze([
    ...retainedRewards.runStateSnapshots,
    ...(blockedChildSettlement?.runStateSnapshots ?? []).filter(
      (snapshot) => !retainedRunStateKeys.has(semanticAddressKey(snapshot.owner)),
    ),
  ]);
  const retainedLevelFindingKeys = new Set(
    [...retainedRewards.findings, ...blockedRewardFindings]
      .filter((finding) => finding.origin.kind === 'levelResolution')
      .map((finding) => semanticAddressKey(finding.origin)),
  );
  const blockedLevelKey =
    blockedLevelAt === undefined ? undefined : semanticAddressKey(blockedLevelAt);
  const selectedLevelResolutionPrefix = selectedRewards.selectedLevelResolutions.filter(
    (resolution) => {
      const key = semanticAddressKey(resolution.address);
      return key === blockedLevelKey || retainedLevelFindingKeys.has(key);
    },
  );
  const retainedLevelKeys = new Set(
    retainedRewards.selectedLevelResolutions.map((resolution) =>
      semanticAddressKey(resolution.address),
    ),
  );
  const selectedLevelResolutions = Object.freeze([
    ...retainedRewards.selectedLevelResolutions,
    ...selectedLevelResolutionPrefix.filter(
      (resolution) => !retainedLevelKeys.has(semanticAddressKey(resolution.address)),
    ),
  ]);
  const retainedFindingKeys = new Set(
    retainedRewards.findings.map((finding) => findingIdentityKey(finding)),
  );
  const rewardFindings = Object.freeze([
    ...retainedRewards.findings,
    ...blockedRewardFindings.filter((finding) => {
      const key = findingIdentityKey(finding);
      if (retainedFindingKeys.has(key)) return false;
      retainedFindingKeys.add(key);
      return true;
    }),
  ]);
  // A room-exit acquisition child is assessed after the source room's outgoing
  // checkpoint. When that child is the progressive blocker, the clamped
  // execution prefix intentionally stops at the outgoing frontier, but the
  // selected attempt has already produced the bounded settlement result. Keep
  // that exact post-settlement branch product visible at the frontier; it is
  // the current room's state, not a replay of later topology.
  const settledCurrentSiteBranches =
    ancestors.occurrenceOwner === undefined ||
    frontierSettlementOwner === undefined ||
    semanticAddressKey(ancestors.occurrenceOwner) !== semanticAddressKey(frontierSettlementOwner) ||
    blockedAt.kind !== 'levelResolution'
      ? undefined
      : selectedRewards.branches.some((branch) =>
            branch.events.some(
              (event) =>
                event.kind === 'concreteAcquisition' &&
                event.settlement !== undefined &&
                semanticAddressKey(event.settlement.site.owner) ===
                  semanticAddressKey(ancestors.occurrenceOwner!),
            ),
          )
        ? selectedRewards.branches
        : undefined;
  const blockedCapability =
    blockedTraitAt === undefined
      ? undefined
      : (selectedArtifacts.traitOffers.at(blockedTraitAt) ??
        blockedArtifacts.traitOffers.at(blockedTraitAt));
  const retainedTraitKeys = new Set(
    selectedTraitOffers.map((offer) => semanticAddressKey(offer.address)),
  );
  const traitOffers: TraitOfferCandidateArtifacts = Object.freeze({
    at: (address: TraitOfferAddress) => {
      const key = semanticAddressKey(address);
      if (!retainedTraitKeys.has(key)) return undefined;
      return blockedKey !== undefined && key === blockedKey && blockedCapability !== undefined
        ? blockedCapability
        : retainedArtifacts.traitOffers.at(address);
    },
  });
  const selectedLevelKeys = new Set(
    selectedLevelResolutionPrefix.map((resolution) => semanticAddressKey(resolution.address)),
  );
  const levelResolutions = Object.freeze({
    at: (address: LevelResolutionAddress) => {
      const key = semanticAddressKey(address);
      if (!selectedLevelKeys.has(key)) return retainedArtifacts.levelResolutions.at(address);
      return (
        selectedArtifacts.levelResolutions.at(address) ??
        blockedArtifacts.levelResolutions.at(address) ??
        retainedArtifacts.levelResolutions.at(address)
      );
    },
  });
  const blockedBossCapability =
    blockedBossCompletionAt === undefined
      ? undefined
      : (selectedArtifacts.bossCompletionArcana.at(blockedBossCompletionAt) ??
        blockedArtifacts.bossCompletionArcana.at(blockedBossCompletionAt));
  const bossCompletionArcana =
    blockedBossCompletionAt === undefined || blockedBossCapability === undefined
      ? retainedArtifacts.bossCompletionArcana
      : Object.freeze({
          at: (address: BossCompletionArcanaAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedBossCompletionAt)
              ? blockedBossCapability
              : retainedArtifacts.bossCompletionArcana.at(address),
        });
  const blockedKeepsakeCapability =
    blockedKeepsakeAt === undefined
      ? undefined
      : (selectedArtifacts.keepsakeSelections.at(blockedKeepsakeAt) ??
        blockedArtifacts.keepsakeSelections.at(blockedKeepsakeAt));
  const keepsakeSelections =
    blockedKeepsakeAt === undefined || blockedKeepsakeCapability === undefined
      ? retainedArtifacts.keepsakeSelections
      : createKeepsakeSelectionCandidateArtifacts(
          new Map([
            ...retainedArtifacts.keepsakeSelections.entries(),
            [semanticAddressKey(blockedKeepsakeAt), blockedKeepsakeCapability] as const,
          ]),
        );
  const blockedKeepsakeEquipResultCapability =
    blockedKeepsakeEquipResultAt === undefined
      ? undefined
      : (selectedArtifacts.keepsakeEquipResults.at(blockedKeepsakeEquipResultAt) ??
        blockedArtifacts.keepsakeEquipResults.at(blockedKeepsakeEquipResultAt));
  const keepsakeEquipResults =
    blockedKeepsakeEquipResultAt === undefined || blockedKeepsakeEquipResultCapability === undefined
      ? retainedArtifacts.keepsakeEquipResults
      : createKeepsakeEquipResultCandidateArtifacts(
          new Map([
            ...retainedArtifacts.keepsakeEquipResults.entries(),
            [
              semanticAddressKey(blockedKeepsakeEquipResultAt),
              blockedKeepsakeEquipResultCapability,
            ] as const,
          ]),
        );
  const blockedAcquisitionCapability =
    blockedAcquisitionAt === undefined
      ? undefined
      : (selectedArtifacts.acquisitionConversions.at(blockedAcquisitionAt) ??
        blockedArtifacts.acquisitionConversions.at(blockedAcquisitionAt));
  const acquisitionConversions =
    blockedAcquisitionAt === undefined || blockedAcquisitionCapability === undefined
      ? retainedArtifacts.acquisitionConversions
      : Object.freeze({
          at: (address: AcquisitionRoleAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedAcquisitionAt)
              ? blockedAcquisitionCapability
              : retainedArtifacts.acquisitionConversions.at(address),
        });
  const rewardOwner = ancestors.rewardOwner;
  const rewardCapability =
    rewardOwner === undefined
      ? undefined
      : (selectedArtifacts.rewardProducers.at(rewardOwner) ??
        blockedArtifacts.rewardProducers.at(rewardOwner));
  const occurrenceOwner = ancestors.occurrenceOwner;
  const shipCapability =
    occurrenceOwner === undefined
      ? undefined
      : (selectedArtifacts.roomLifecycles.shipAt(occurrenceOwner) ??
        blockedArtifacts.roomLifecycles.shipAt(occurrenceOwner));
  const acquisitionOrderCapability =
    occurrenceOwner === undefined
      ? undefined
      : (selectedArtifacts.roomLifecycles.acquisitionOrderAt(occurrenceOwner) ??
        blockedArtifacts.roomLifecycles.acquisitionOrderAt(occurrenceOwner));
  const encounterCapability =
    occurrenceOwner === undefined
      ? undefined
      : (selectedArtifacts.encounters.roomAt(occurrenceOwner) ??
        blockedArtifacts.encounters.roomAt(occurrenceOwner));
  const blockedTarget = ancestors.target;
  const blockedTargetCapability =
    blockedTarget === undefined
      ? undefined
      : (selectedArtifacts.roomTargets.at(blockedTarget) ??
        blockedArtifacts.roomTargets.at(blockedTarget));
  const roomTargets =
    blockedTargetCapability === undefined
      ? retainedArtifacts.roomTargets
      : Object.freeze({
          at: (target: TargetAddress) =>
            blockedTarget !== undefined &&
            semanticAddressKey(target) === semanticAddressKey(blockedTarget)
              ? blockedTargetCapability
              : retainedArtifacts.roomTargets.at(target),
        });
  const rewardProducers: RewardProducerCandidateArtifacts =
    rewardCapability === undefined
      ? retainedArtifacts.rewardProducers
      : Object.freeze({
          at: (owner: RewardProducerOwnerAddress) =>
            rewardOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(rewardOwner)
              ? rewardCapability
              : retainedArtifacts.rewardProducers.at(owner),
        });
  const roomLifecycles =
    shipCapability === undefined && acquisitionOrderCapability === undefined
      ? retainedArtifacts.roomLifecycles
      : Object.freeze({
          shipAt: (owner: OccurrenceAddress) =>
            occurrenceOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(occurrenceOwner) &&
            shipCapability !== undefined
              ? shipCapability
              : retainedArtifacts.roomLifecycles.shipAt(owner),
          acquisitionOrderAt: (owner: OccurrenceAddress) =>
            occurrenceOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(occurrenceOwner) &&
            acquisitionOrderCapability !== undefined
              ? acquisitionOrderCapability
              : retainedArtifacts.roomLifecycles.acquisitionOrderAt(owner),
        });
  const encounters: EncounterCandidateArtifacts =
    encounterCapability === undefined
      ? retainedArtifacts.encounters
      : Object.freeze({
          at: retainedArtifacts.encounters.at,
          statusAt: retainedArtifacts.encounters.statusAt,
          gorgonAt: retainedArtifacts.encounters.gorgonAt,
          figLeafAt: retainedArtifacts.encounters.figLeafAt,
          roomAt: (owner: OccurrenceAddress) =>
            occurrenceOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(occurrenceOwner)
              ? encounterCapability
              : retainedArtifacts.encounters.roomAt(owner),
        });
  const artifacts = createBiomeCandidateArtifacts(
    retainedArtifacts.origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
    levelResolutions,
    bossCompletionArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    acquisitionConversions,
  );
  return Object.freeze({
    rewards:
      selectedTraitOffers.length === retainedRewards.selectedTraitOffers.length &&
      selectedLevelResolutions.length === retainedRewards.selectedLevelResolutions.length &&
      rewardFindings.length === retainedRewards.findings.length &&
      blockedChildSettlement === undefined &&
      settledCurrentSiteBranches === undefined
        ? retainedRewards
        : Object.freeze({
            ...retainedRewards,
            ...(settledCurrentSiteBranches === undefined
              ? blockedChildSettlement === undefined
                ? {}
                : { branches: blockedChildSettlement.branches }
              : { branches: settledCurrentSiteBranches }),
            validity: rewardFindings.length === 0 ? retainedRewards.validity : 'invalid',
            findings: rewardFindings,
            runStateSnapshots,
            selectedTraitOffers,
            selectedLevelResolutions,
          }),
    artifacts,
  });
}

function retainBlockedGenerationValidation(
  retained: BiomeGenerationValidation,
  selectedFindingRegions: readonly FindingRegionEntry[],
  blockedRegionKey: string,
  selectedTarget?: SelectedTargetGenerationAssessment,
): BiomeGenerationValidation {
  const findings = Object.freeze(
    selectedFindingRegions
      .filter(
        (entry) => entry.atomicRegion === blockedRegionKey && entry.aggregate === 'generation',
      )
      .map((entry) => entry.finding),
  );
  const selectedPressure = selectedTarget?.context.evaluateGameName(
    selectedTarget.gameName,
  ).pressure;
  const retainedPressureKeys = new Set(
    retained.ordinary.forcePressure.map((entry) => semanticAddressKey(entry.targetOrigin)),
  );
  const ordinaryForcePressure =
    selectedPressure === undefined ||
    retainedPressureKeys.has(semanticAddressKey(selectedPressure.targetOrigin))
      ? retained.ordinary.forcePressure
      : Object.freeze([...retained.ordinary.forcePressure, selectedPressure]);
  const ordinary =
    ordinaryForcePressure === retained.ordinary.forcePressure
      ? retained.ordinary
      : Object.freeze({ ...retained.ordinary, forcePressure: ordinaryForcePressure });
  if (findings.length === 0 && ordinary === retained.ordinary) return retained;
  const retainedKeys = new Set(retained.findings.map((finding) => findingIdentityKey(finding)));
  const merged = Object.freeze([
    ...retained.findings,
    ...findings.filter((finding) => {
      const key = findingIdentityKey(finding);
      if (retainedKeys.has(key)) return false;
      retainedKeys.add(key);
      return true;
    }),
  ]);
  return Object.freeze({
    ...retained,
    ordinary,
    ...(findings.length === 0 ? {} : { validity: 'invalid' as const }),
    findings: merged,
  });
}

function mergedFindings(
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

function findingOwnerOrigin(finding: SemanticFinding): SemanticAddress {
  let origin = finding.origin;
  while (
    origin.kind === 'traitOffer' ||
    origin.kind === 'levelResolution' ||
    origin.kind === 'acquisitionRole' ||
    origin.kind === 'circeResolution' ||
    origin.kind === 'echoPomTarget' ||
    origin.kind === 'acquisitionEntry' ||
    origin.kind === 'acquisitionSite'
  ) {
    origin =
      origin.kind === 'acquisitionRole'
        ? origin.owner
        : origin.kind === 'acquisitionEntry'
          ? origin.site
          : origin.kind === 'acquisitionSite'
            ? origin.owner
            : origin.kind === 'circeResolution' || origin.kind === 'echoPomTarget'
              ? origin.trait
              : origin.owner;
  }
  return origin;
}

function ownsOccurrence(origin: SemanticAddress, occurrenceId: string): boolean {
  if (
    origin.kind === 'traitOffer' ||
    origin.kind === 'levelResolution' ||
    origin.kind === 'acquisitionRole' ||
    origin.kind === 'circeResolution' ||
    origin.kind === 'echoPomTarget' ||
    origin.kind === 'acquisitionEntry' ||
    origin.kind === 'acquisitionSite'
  )
    return ownsOccurrence(
      origin.kind === 'acquisitionRole'
        ? origin.owner
        : origin.kind === 'acquisitionEntry'
          ? origin.site
          : origin.kind === 'acquisitionSite'
            ? origin.owner
            : origin.kind === 'circeResolution' || origin.kind === 'echoPomTarget'
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
            semanticAddressKey(slot.origin) === semanticAddressKey(origin) ||
            ownsOccurrence(origin, slot.origin.occurrenceId),
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
        semanticAddressKey(slot.origin) === semanticAddressKey(origin) ||
        ownsOccurrence(origin, slot.origin.occurrenceId),
    )
  );
}

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'target' in frontier && 'localSlots' in frontier;
}

interface LocatedFinding {
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
      semanticAddressKey(slot.origin) === semanticAddressKey(origin) ||
      (origin.kind === 'encounterPhase' &&
        origin.owner.kind === 'localChild' &&
        slot.origin.occurrenceId === origin.owner.occurrenceId &&
        slot.origin.groupKey === origin.owner.groupKey &&
        slot.origin.slotKey === origin.owner.slotKey) ||
      (slot.incomingReward !== undefined &&
        semanticAddressKey(slot.incomingReward.origin) === semanticAddressKey(origin)),
  );
  return index < 0 ? undefined : index;
}

interface HubVisitFindingLocation {
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

function hubVisitFrontier(
  visit: CanonicalHubVisit,
  location: HubVisitFindingLocation,
): MaterializedHubVisitFrontier {
  if (location.phase === 'targetLifecycle') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: Object.freeze([]),
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  if (location.phase === 'sideGeneration') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: visit.localSlots,
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  const localLifecycleIndex = location.localLifecycleIndex;
  if (localLifecycleIndex === undefined) {
    throw new Error(`Hub visit ${visit.visitIndex} local lifecycle has no local owner`);
  }
  const enteredLocalRooms = Object.freeze(
    visit.enteredLocalRooms.slice(0, localLifecycleIndex + 1),
  );
  const enteredOrigins = new Set(enteredLocalRooms.map((slot) => semanticAddressKey(slot.origin)));
  const localSlots = Object.freeze(
    visit.localSlots.map((slot) =>
      enteredOrigins.has(semanticAddressKey(slot.origin)) || !slot.entered
        ? slot
        : Object.freeze({ ...slot, entered: false }),
    ),
  );
  return Object.freeze({
    kind: 'hubVisit',
    origin: visit.origin,
    phase: location.phase,
    target: visit.target,
    localSlots,
    enteredLocalRooms: Object.freeze(
      enteredLocalRooms.map((slot) =>
        localSlots.find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(slot.origin),
        )!,
      ),
    ),
    // The local owner itself is the stopping room: earlier completed local
    // rooms restore their parent, but no restore may follow the invalid one.
    parentRestores: Object.freeze(visit.parentRestores.slice(0, localLifecycleIndex)),
  });
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

function locateFinding(
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
  // Boss completion is a terminal lifecycle child, not an authored Preboss
  // occurrence. It follows every decision in the materialized biome and has
  // no room occurrence to use for ordinary ownership lookup.
  if (
    finding.origin.kind === 'bossCompletionArcana' &&
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
  if (
    finding.origin.kind === 'keepsakeEquipResult' &&
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

function firstUnsupportedFinding(
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
function isProgressiveBlockingFinding(finding: SemanticFinding): boolean {
  return finding.code !== 'figLeafSkipUnavailable';
}

function findingsAtRegion(
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

function encounterBlockFinding(block: EncounterHistoryBlock): SemanticFinding {
  const finding = block.preparation.findings.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(block.blockedAt),
  );
  if (finding === undefined) {
    throw new Error(`encounter block ${semanticAddressKey(block.blockedAt)} has no finding`);
  }
  return finding;
}

function encounterBlockChronology(block: EncounterHistoryBlock): HistoryFindingChronology {
  return Object.freeze({
    kind: 'history',
    sequence: block.afterValidRecordPrefix.sequence,
    boundary: 'at',
  });
}

function encounterBlockProductPrefix(
  prefix: MaterializedBiomePrefix,
  block: EncounterHistoryBlock,
): MaterializedBiomePrefix {
  const located = locateFinding(prefix, encounterBlockFinding(block), ownerRegion(block.blockedAt));
  if (located === undefined) {
    throw new Error(
      `encounter block ${semanticAddressKey(block.blockedAt)} has no structural owner`,
    );
  }
  const clamped = clampPrefix(prefix, located);
  const decision =
    located.frontierBatch && prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : prefix.decisions[located.decisionIndex];
  if (decision?.kind !== 'batch') return clamped;
  const created = new Set(
    block.afterValidRecordPrefix.ledgers.roomCreations.map((event) =>
      semanticAddressKey(event.origin),
    ),
  );
  const targets = decision.targets.filter((target) =>
    created.has(semanticAddressKey(target.room.origin)),
  );
  const additional = decision.additional.filter((entry) =>
    created.has(semanticAddressKey(entry.room.origin)),
  );
  const frontier = exitFrontier(decision, targets, additional);
  return Object.freeze({ ...clamped, frontier });
}

function compareLocatedFindings(left: LocatedFinding, right: LocatedFinding): number {
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

function exitFrontier(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  targets: readonly CanonicalTarget[] = [],
  additional: readonly CanonicalAdditionalContinuation[] = decision.additional,
): MaterializedExitDecisionFrontier {
  const partialBatch =
    targets.length > 0
      ? Object.freeze({ ...decision, targets: Object.freeze([...targets]) })
      : undefined;
  return Object.freeze({
    kind: 'exitDecision',
    origin: decision.origin,
    parent: decision.parent,
    targets: Object.freeze([...targets]),
    additional,
    ...(partialBatch === undefined ? {} : { partialBatch, batchState: partialBatch.batchState }),
    selectedExitKey: decision.selectedExitKey,
    selectedOrigin: decision.selectedOrigin,
  });
}

function clampPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  // A Judgment finding occurs only after the terminal Boss encounter. The
  // authored prefix is already the exact pre-completion state; trimming its
  // Preboss decision would falsely erase that state rather than merely
  // suppressing the Postboss and later-biome consequences.
  if (located.finding.origin.kind === 'bossCompletionArcana') return prefix;
  if (located.decisionIndex < 0) {
    return Object.freeze({
      kind: 'biomePrefix',
      routeKey: prefix.routeKey,
      biomeKey: prefix.biomeKey,
      ...(prefix.entryRoom === undefined ? {} : { entryRoom: prefix.entryRoom }),
      decisions: Object.freeze([]),
      biomeState: prefix.biomeState,
    });
  }
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined) return prefix;
  if (decision.kind === 'hub') {
    if (located.hubVisitIndex !== undefined) {
      const frontierVisit = decision.visits[located.hubVisitIndex];
      if (frontierVisit === undefined) return prefix;
      const phase = located.hubVisitPhase;
      if (phase === undefined) return prefix;
      const frontier = hubVisitFrontier(frontierVisit, {
        visitIndex: located.hubVisitIndex,
        phase,
        ...(located.hubLocalLifecycleIndex === undefined
          ? {}
          : { localLifecycleIndex: located.hubLocalLifecycleIndex }),
      });
      return Object.freeze({
        ...prefix,
        decisions: Object.freeze([
          ...prefix.decisions.slice(0, located.decisionIndex),
          Object.freeze({
            ...decision,
            // The blocked visit is represented by a phase-aware frontier.
            // Completed prior visits remain canonical; replay must not make
            // the blocked visit's later local lifecycle or Hub return true.
            visits: Object.freeze(decision.visits.slice(0, located.hubVisitIndex)),
          }),
        ]),
        frontier,
      });
    }
    return Object.freeze({
      ...prefix,
      // Board targets are all physically generated by the Hub's outgoing
      // checkpoint. A board-owned failure prevents visits, not that already
      // reached board region or its reward producers from existing.
      decisions: Object.freeze([
        ...prefix.decisions.slice(0, located.decisionIndex),
        Object.freeze({ ...decision, visits: Object.freeze([]) }),
      ]),
      frontier: Object.freeze({ kind: 'hubBoard', origin: decision.origin }),
    });
  }
  const retainedTargets =
    located.targetIndex === undefined
      ? Object.freeze([])
      : decision.targets.slice(0, located.targetIndex);
  const retainedAdditional =
    located.additionalIndex === undefined
      ? decision.additional
      : decision.additional.slice(0, located.additionalIndex + 1);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, retainedTargets, retainedAdditional),
  });
}

/**
 * A selected target's incoming offer is produced with that target, before
 * the target's own room lifecycle. A generic target or incoming-offer
 * finding therefore retains that one target in an interaction-only prefix:
 * its offer can be corrected from the actual offer-time checkpoint, while
 * the execution prefix still excludes the invalid room and every later
 * lifecycle effect. All other generic boundaries use the ordinary clamp.
 */
function retainedInteractionPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  const terminalDecision = prefix.decisions.at(-1);
  if (terminalDecision?.kind === 'batch') {
    const selected = selectedBatchContinuation(terminalDecision);
    if (
      selected?.kind === 'normal' &&
      selected.target.continuation === 'startsCompletion' &&
      ownsOccurrence(findingOwnerOrigin(located.finding), selected.target.room.occurrenceId)
    ) {
      // The selected Preboss and its completion tail are the final authored
      // region. Keep this exact terminal product for reward repair rather
      // than inventing a Hub frontier that history cannot compose.
      return prefix;
    }
  }
  if (located.targetIndex === undefined) return clampPrefix(prefix, located);
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined || decision.kind !== 'batch') return clampPrefix(prefix, located);
  // A batch's physical targets share one reward-store envelope.  Interaction
  // replay therefore has to retain the complete authored target set even when
  // the first blocked owner belongs to an earlier peer.  The execution prefix
  // above remains clamped at that owner, so later room lifecycles are not
  // admitted merely because their offer-time products are needed to resolve
  // the shared store.
  const targets =
    located.targetIndex === undefined ? Object.freeze([]) : Object.freeze([...decision.targets]);
  const additional =
    located.additionalIndex === undefined
      ? decision.additional
      : decision.additional.slice(0, located.additionalIndex + 1);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, targets, additional),
  });
}

/**
 * Evaluates the materializable prefix before applying its first-invalid clamp.
 * This is an engine-internal diagnostic product. Repair callers may consult
 * only the exact blocked owner’s pre-decision frontier, never later owners.
 * A bounded aggregate candidate may inspect findings across its complete
 * proposed region, but it must not publish the resulting downstream lifecycle
 * as selected simulation output.
 */
export function evaluateProgressiveBiomeBeforeClamp(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluation | null {
  return (
    evaluateProgressiveBiomeAssemblyBeforeClamp(catalog, biome, plan, context)?.evaluation ?? null
  );
}

export function evaluateProgressiveBiomeAssemblyBeforeClamp(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(catalog, biome, plan, context.loadout);
  if (initial?.entryRoom === undefined) return null;
  const materializedPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, materializedPrefix, context);
  const encounterLocated =
    evaluated.encounterBlock === undefined
      ? undefined
      : locateFinding(
          materializedPrefix,
          encounterBlockFinding(evaluated.encounterBlock),
          ownerRegion(evaluated.encounterBlock.blockedAt),
          encounterBlockChronology(evaluated.encounterBlock),
        );
  const unsupported = firstUnsupportedFinding(
    materializedPrefix,
    evaluated.findingRegions,
    () => true,
    encounterLocated?.regionKey,
  );
  return Object.freeze({
    evaluation: Object.freeze({
      materializedPrefix,
      ...evaluated.evaluation,
      findings: mergedFindings(evaluated.evaluation),
      ...(evaluated.encounterBlock !== undefined
        ? { blockedAt: evaluated.encounterBlock.blockedAt }
        : unsupported === undefined
          ? {}
          : { blockedAt: unsupported.finding.origin }),
    }),
    candidateArtifacts: evaluated.candidateArtifacts,
  });
}

/**
 * Evaluates the maximum materializable authored prefix, then clamps once at
 * the first unsupported semantic owner. The retained prefix is replayed so no
 * history, reward, or candidate product claims coverage beyond that owner.
 */
export function evaluateProgressiveBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluation | null {
  return evaluateProgressiveBiomeAssembly(catalog, biome, plan, context)?.evaluation ?? null;
}

export function evaluateProgressiveBiomeAssembly(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(catalog, biome, plan, context.loadout);
  if (initial?.entryRoom === undefined) return null;
  const authoredPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, authoredPrefix, context);
  const encounterLocated =
    evaluated.encounterBlock === undefined
      ? undefined
      : locateFinding(
          authoredPrefix,
          encounterBlockFinding(evaluated.encounterBlock),
          ownerRegion(evaluated.encounterBlock.blockedAt),
          encounterBlockChronology(evaluated.encounterBlock),
        );
  const unsupported = firstUnsupportedFinding(
    authoredPrefix,
    evaluated.findingRegions,
    () => true,
    encounterLocated?.regionKey,
  );
  const genericPrecedesEncounter =
    unsupported !== undefined &&
    (encounterLocated === undefined || compareLocatedFindings(unsupported, encounterLocated) <= 0);
  if (genericPrecedesEncounter && unsupported !== undefined) {
    return clampSelectedProducts(
      catalog,
      authoredPrefix,
      context,
      Object.freeze({
        history: evaluated.evaluation.history,
        roomGeneration: evaluated.evaluation.roomGeneration,
        rewards: evaluated.evaluation.rewards,
        candidateArtifacts: evaluated.candidateArtifacts,
        findingRegions: evaluated.findingRegions,
        traitChildSettlementCheckpoints: evaluated.traitChildSettlementCheckpoints,
      }),
      unsupported,
    );
  }
  const blockedAt =
    evaluated.encounterBlock !== undefined ? evaluated.encounterBlock.blockedAt : undefined;
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluated.evaluation,
      materializedPrefix: authoredPrefix,
      ...(evaluated.evaluation.assessmentPrefix === undefined
        ? {}
        : { assessmentPrefix: evaluated.evaluation.assessmentPrefix }),
      findings: mergedFindings(evaluated.evaluation),
      ...(blockedAt === undefined ? {} : { blockedAt }),
    }),
    candidateArtifacts: createBiomeCandidateArtifacts(
      evaluated.candidateArtifacts.origin,
      evaluated.candidateArtifacts.roomTargets,
      evaluated.candidateArtifacts.rewardProducers,
      evaluated.candidateArtifacts.roomLifecycles,
      evaluated.candidateArtifacts.encounters,
      evaluated.candidateArtifacts.traitOffers,
      evaluated.candidateArtifacts.levelResolutions,
      evaluated.candidateArtifacts.bossCompletionArcana,
      evaluated.candidateArtifacts.keepsakeSelections,
      evaluated.candidateArtifacts.keepsakeEquipResults,
      evaluated.candidateArtifacts.acquisitionConversions,
    ),
  });
}

/**
 * Clamps a complete-invalid canonical attempt using its already selected
 * products. Only the bounded execution and interaction prefixes are replayed.
 */
export function evaluateProgressiveBiomeAssemblyFromSelectedProducts(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
  selectedProducts: ProgressiveBiomeSelectedProducts,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(catalog, biome, plan, context.loadout);
  if (initial?.entryRoom === undefined) return null;
  const authoredPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const unsupported = firstUnsupportedFinding(
    authoredPrefix,
    selectedProducts.findingRegions,
    isProgressiveBlockingFinding,
  );
  if (unsupported === undefined) {
    // Fig Leaf's retained-invalid authored selections do not clamp the
    // execution prefix: the selected phase executes normally and remains
    // repairable at its exact owner. Reuse the complete products so
    // history/topology/lifecycle stay visible while rewards publish the error.
    // Re-composing here would lose the already-attested Fig Leaf frontier and
    // could incorrectly turn a legal first selection into an ordinary phase.
    return Object.freeze({
      evaluation: Object.freeze({
        materializedPrefix: authoredPrefix,
        history: selectedProducts.history,
        roomGeneration: selectedProducts.roomGeneration,
        rewards: selectedProducts.rewards,
        findings: Object.freeze(selectedProducts.findingRegions.map((entry) => entry.finding)),
      }),
      candidateArtifacts: selectedProducts.candidateArtifacts,
    });
  }
  return clampSelectedProducts(catalog, authoredPrefix, context, selectedProducts, unsupported);
}

function clampSelectedProducts(
  catalog: Catalog,
  authoredPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  context: ProgressiveBiomeContext,
  selectedProducts: ProgressiveBiomeSelectedProducts,
  unsupported: LocatedFinding,
): ProgressiveBiomeEvaluationAssembly | null {
  const retainedFindings = findingsAtRegion(
    authoredPrefix,
    selectedProducts.findingRegions,
    unsupported.regionKey,
  );
  const clamped = clampPrefix(authoredPrefix, unsupported);
  if (clamped.entryRoom === undefined) return null;
  const executionPrefix = clamped as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, executionPrefix, context);
  const interactionPrefix = retainedInteractionPrefix(
    authoredPrefix,
    unsupported,
  ) as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const interactionProducts = products(catalog, interactionPrefix, context);
  const ancestors = blockedAncestorChain(authoredPrefix, unsupported);
  const selectedTargetAssessment = (() => {
    const target = ancestors.target;
    if (target === undefined) return undefined;
    const gameName = gameNameForTarget(authoredPrefix, target);
    const evaluate =
      selectedProducts.candidateArtifacts.roomTargets.at(target) ??
      interactionProducts.candidateArtifacts.roomTargets.at(target);
    return gameName === undefined || evaluate === undefined
      ? undefined
      : Object.freeze({ gameName, context: evaluate });
  })();
  const retainedRoomGeneration = retainBlockedGenerationValidation(
    evaluated.evaluation.roomGeneration,
    selectedProducts.findingRegions,
    unsupported.regionKey,
    selectedTargetAssessment,
  );
  const blockedProducts = retainBlockedRegionProducts(
    evaluated.evaluation.rewards,
    evaluated.candidateArtifacts,
    interactionProducts.candidateArtifacts,
    selectedProducts.rewards,
    selectedProducts.candidateArtifacts,
    selectedProducts.traitChildSettlementCheckpoints,
    ancestors,
    unsupported.finding.origin,
    unsupported.regionKey,
    selectedProducts.findingRegions,
    authoredPrefix.frontier?.kind === 'exitDecision' &&
      authoredPrefix.frontier.parent.origin.kind === 'occurrence'
      ? authoredPrefix.frontier.parent.origin
      : undefined,
  );
  const retainedRewards = blockedProducts.rewards;
  const retainedInteractions = blockedProducts.artifacts;
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluated.evaluation,
      materializedPrefix: authoredPrefix,
      roomGeneration: retainedRoomGeneration,
      rewards: retainedRewards,
      assessmentPrefix: executionPrefix,
      findings: mergedFindings(evaluated.evaluation, retainedFindings),
      blockedAt: unsupported.finding.origin,
    }),
    candidateArtifacts: createBiomeCandidateArtifacts(
      evaluated.candidateArtifacts.origin,
      retainedInteractions.roomTargets,
      retainedInteractions.rewardProducers,
      retainedInteractions.roomLifecycles,
      retainedInteractions.encounters,
      retainedInteractions.traitOffers,
      retainedInteractions.levelResolutions,
      retainedInteractions.bossCompletionArcana,
      retainedInteractions.keepsakeSelections,
      retainedInteractions.keepsakeEquipResults,
      retainedInteractions.acquisitionConversions,
    ),
  });
}
