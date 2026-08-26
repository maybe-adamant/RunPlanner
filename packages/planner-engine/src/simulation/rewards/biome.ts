import type { Catalog } from '../../catalog-schema';
import { evaluateRequirement } from '../../requirements';
import { fieldsOptionalRewardCountSupport } from '../fields-optional-count';
import { isPurgingPoolEligibleTrait, type PurgingPoolAssessment } from '../purging-pool';
import {
  assessHermesShrineTravelDealRefill,
  type HermesShrineCandidateContext,
} from '../hermes-shrine';
import {
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createGorgonPhaseAddress,
  createBiomeAddress,
  createTraitOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createTargetAddress,
  createEchoKeepsakeReplayAddress,
  createRoomRunStateCheckpointAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../authored-project/defaults';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../authored-project/artificer';
import { parseHermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import { hermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import { applyStygianWellPurchase, advanceStygianWellBossUses } from '../stygian-well';
import { type StygianWellCandidateContext } from '../stygian-well';
import { parseSeaStarDuplicateSiteKey } from '../../authored-project/sea-star';
import { materializeGorgonAthenaOffer } from '../../authored-project/traits';
import { selectedEncounterDefinitionKey } from '../../authored-project/room-state/encounter-envelope';
import { applyConcreteAcquisition, type ResolvedRewardOffer } from '../../reward-kernel';
import type { HistoryStateView } from '../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../materialization';
import type { CanonicalDecision } from '../materialization/model';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../finding-regions';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from './model';
import {
  createAcquisitionConversionCandidateArtifacts,
  createDerivedAcquisitionEntryCandidateArtifacts,
  createSteadyGrowthCandidateArtifacts,
  createPurgingPoolCandidateArtifacts,
  createHermesShrineCandidateArtifacts,
  createStygianWellCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../candidate-artifacts';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../candidates/trait-offer-capability';
import type { TraitOfferCandidateContext } from '../traits';
import {
  type ReachedSteadyGrowthThreshold,
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  hasActiveChaosSemanticTag,
} from '../traits';
import {
  createRunState,
  createRunStateDerivationCache,
  publishRunStateThroughCoverage,
  type RunStateSnapshot,
} from './run-state';
import { createBiomeRewardFacts, visibleStoreOptionNames } from './facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
  type ShipLifecycleCandidateContext,
} from './lifecycle-artifacts';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { canonicalArtificerSource } from './reward-sources';
import { selectedTraitOfferProducts } from './selected-trait-products';
import { prepareRewardEvaluationInputs } from './prepared-inputs';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import {
  applyTargetGenerationCompletedTransition,
  type TargetGenerationFrontier,
} from './generation/target-generation-completed';
import { applyRoomCreatedTransition } from './generation/room-created';
import { flushHubBoard } from './generation/hub-board';
import {
  settleAuthoredAcquisitionSite as settleAuthoredAcquisitionSiteTransition,
  type AuthoredSiteSettlementResult,
} from './generation/authored-site-settlement';
import { applyOutgoingGenerationTransition } from './generation/outgoing-generation';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';
import { historyFindingChronology, rewardFindingChronologyForRoom } from './finding-chronology';
import type { PendingHubBoardGeneration as GenerationPendingHubBoardGeneration } from './generation/emissions';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
export type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';

import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerCandidateArtifacts,
  type RewardProducerFrontier,
} from './producer-frontiers';
import {
  advanceRewardBranches,
  initializeRewardBranches,
  publicRewardBranch,
  applyExperimentalHammerEquipResult,
  type OfferProcessingPeer,
} from './processing';
import type { AcquisitionRoleFrontier } from './acquisition-settlement';
import {
  withStoredArtificerReplacements,
  settleArtificerReplacementAcquisition,
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
} from './acquisition-settlement';
import { addRewardFinding } from './findings';
import { mergeEquivalentRewardBranches, type RewardBranchState } from './branch-primitives';
import {
  settleEncounterTraitOffer,
  processEncounterTraitOffer,
  type ReachedTraitChildCheckpoint,
} from './trait-settlement';
import { rewardFinding } from './findings';
import {
  assessExperimentalHammerEquipResult,
  refreshKeepsakeFatedStatus,
  attestGorgonBranchState,
  attestPendingGorgonRarity,
  consumeGorgonAppearance,
  expirePendingGorgon,
  assessGorgonEligibility,
  assessGorgonChildSettlement,
  applyEchoFigLeafReplay,
  applyEchoCallingCardReplay,
  applyEchoTimePieceReplay,
} from '../keepsakes';
import {
  activateTemporaryArcana,
  createArcanaFearState,
  inactiveArcanaKeys,
  judgmentRequiredCount,
} from '../arcana-fear';
import {
  createJudgmentArcanaAddress,
  createKeepsakeEquipResultAddress,
} from '../../authored-project/addresses';
import {
  createJudgmentArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

/**
 * One persistent Ephyra board-generation region. The region starts from the
 * post-Hub-entry reward branches and contains every open physical door,
 * independently from the later six-room visit chronology.
 */
type PendingHubBoardGeneration = GenerationPendingHubBoardGeneration;

export { BiomeRewardSimulationContractError } from './biome-contract';

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

const rewardFacts = createBiomeRewardFacts;

/** One declaration-owned SurfaceShop fallback edge at the reached action. */
function hermesShrineRuntimeFallbackRewardType(
  catalog: Catalog,
  generationKey: import('../../authored-project/model').HermesShrineGenerationKey,
  rewardType: string,
  refill: import('../hermes-shrine').HermesShrineTravelDealRefillAssessment | undefined,
): string | undefined {
  const sourceGenerationKey =
    generationKey === 'travelDealRefill' ? refill?.sourceGenerationKey : generationKey;
  const slotKey = sourceGenerationKey?.startsWith('initial:')
    ? sourceGenerationKey.slice('initial:'.length)
    : undefined;
  if (slotKey !== 'first' && slotKey !== 'secondLeft' && slotKey !== 'secondRight')
    return undefined;
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  const group = profile?.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? ''];
  const option = group?.options.values.find((candidate) => candidate.rewardType === rewardType);
  // A refill is generated only from its published same-slot domain. Initial
  // visible entries use their declaration group; both cases still take one
  // option-declared edge, never a semantic Shrine/Death-Defiance rule.
  const supported =
    generationKey === 'travelDealRefill' ? refill?.candidateRewardTypes : group?.rewardTypes;
  return option?.runtimeOfferFallbackRewardTypes?.find(
    (candidate) => supported?.includes(candidate) === true,
  );
}

function stygianWellRuntimeFallbackItemKey(
  catalog: Catalog,
  itemKey: string,
  nested: boolean,
): string | undefined {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const option = profile?.groups.values
    .flatMap((group) => group.options.values)
    .find((candidate) => candidate.key === itemKey);
  if (nested) {
    const twist = profile?.groups.values
      .flatMap((group) => group.options.values)
      .find((candidate) => candidate.key === 'RandomStoreItem');
    return twist?.stygianWell?.nestedRuntimeOfferFallbacks?.find(
      (edge) => edge.preferredItemKey === itemKey,
    )?.fallbackItemKey;
  }
  const group = profile?.groups.values.find(
    (candidate) => candidate.options.byKey[itemKey] !== undefined,
  );
  const fallbackRewardType = option?.runtimeOfferFallbackRewardTypes?.[0];
  return fallbackRewardType === undefined
    ? undefined
    : group?.options.values.find((candidate) => candidate.rewardType === fallbackRewardType)?.key;
}

interface BiomeRewardEvaluationAssembly {
  readonly simulation: BiomeRewardSimulation;
  readonly producerArtifacts: RewardProducerCandidateArtifacts;
  readonly lifecycleArtifacts: RoomLifecycleCandidateArtifacts;
  readonly traitOfferArtifacts: import('../candidates/trait-offer-capability').TraitOfferCandidateArtifacts;
  readonly levelResolutionArtifacts: import('../candidates/trait-offer-capability').LevelResolutionCandidateArtifacts;
  readonly judgmentArcanaArtifacts: import('../candidate-artifacts').JudgmentArcanaCandidateArtifacts;
  readonly keepsakeSelectionArtifacts: import('../candidate-artifacts').KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResultArtifacts: import('../candidate-artifacts').KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversionArtifacts: import('../candidate-artifacts').AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntryArtifacts: import('../candidate-artifacts').DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowthArtifacts: import('../candidate-artifacts').SteadyGrowthCandidateArtifacts;
  readonly purgingPoolArtifacts: import('../candidate-artifacts').PurgingPoolCandidateArtifacts;
  readonly hermesShrineArtifacts: import('../candidate-artifacts').HermesShrineCandidateArtifacts;
  readonly stygianWellArtifacts: import('../candidate-artifacts').StygianWellCandidateArtifacts;
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
  readonly findingRegions: readonly FindingRegionEntry[];
}

export interface TraitChildSettlementCheckpoint {
  readonly branches: readonly RewardBranch[];
  readonly runStateSnapshots: readonly RunStateSnapshot[];
}

export interface TraitChildSettlementCheckpoints {
  readonly at: (address: SemanticAddress) => TraitChildSettlementCheckpoint | undefined;
}

export function evaluateBiomeRewardsAssemblyInternal(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const fullRunBiomeCount = catalog.routes.byKey[snapshot.routeKey]?.biomeKeys.length;
  if (fullRunBiomeCount === undefined) {
    throw new BiomeRewardSimulationContractError(
      `${snapshot.routeKey} has no catalog route for Boss Judgment effects`,
    );
  }
  const prepared = prepareRewardEvaluationInputs(catalog, snapshot, history);
  const {
    layout,
    rewardLookup,
    rooms,
    views,
    targets,
    additionalContinuations,
    hubTargetByOrigin,
    lifecycle,
  } = prepared;
  const authoredSeaStarDuplicateSiteKeys = new Set(
    [...rooms.values()].flatMap((room) =>
      room.kind === 'authored'
        ? Object.keys(room.acquisitionSites).filter(
            (siteKey) => parseSeaStarDuplicateSiteKey(siteKey) !== undefined,
          )
        : [],
    ),
  );
  const forcedSparkChaosSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'sparkChaos' ? [continuation.origin.occurrenceId] : [],
    ),
  );
  const batchesByParent = prepared.batchesByParent;
  const judgmentArcanaContexts = new Map<
    string,
    import('../candidate-artifacts').JudgmentArcanaCandidateCapability
  >();
  const keepsakeSelectionContexts = new Map<
    string,
    import('../candidate-artifacts').KeepsakeSelectionCandidateCapability
  >();
  const keepsakeEquipResultContexts = new Map<
    string,
    import('../candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const acquisitionConversionContexts = new Map<string, readonly AcquisitionRoleFrontier[]>();
  const derivedAcquisitionEntryContexts = new Map<
    string,
    readonly import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[]
  >();
  const figLeafPhaseCandidates = new Map<string, import('./model').FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, import('./model').GorgonPhaseCandidateSupport>();
  const nemesisRandomEventCandidates = new Map<
    string,
    import('./model').NemesisRandomEventCandidateSupport
  >();
  const runtimeOfferFallbacks = new Map<
    string,
    {
      readonly address: SemanticAddress;
      readonly preferredKey: string;
      readonly fallbackKey: string;
    }
  >();
  const blockedGorgonPhases = new Set<string>();
  let gorgonEvaluationBlocked = false;
  const eligibleGorgonPhases = new Set<string>();
  function recordAcquisitionRoleFrontiers(
    frontiers: readonly AcquisitionRoleFrontier[] | undefined,
  ): void {
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      acquisitionConversionContexts.set(
        key,
        Object.freeze([...(acquisitionConversionContexts.get(key) ?? []), frontier]),
      );
      const replacement = frontier.artificerReplacementCandidate;
      const replacementKey = semanticAddressKey(frontier.artificerReplacementAddress);
      if (replacement !== undefined && !producerFrontiers.has(replacementKey))
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: frontier.historySequence,
            reachableBranchCount: frontier.branchesBeforeRole.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.artificerReplacementAddress]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) =>
              semanticAddressKey(owner) === replacementKey
                ? replacement.evaluateOffer(offer)
                : fail('Artificer replacement frontier received a foreign owner'),
          }),
        );
    }
  }
  function recordRuntimeOfferFallbacks(
    fallbacks:
      | readonly {
          readonly address: SemanticAddress;
          readonly preferredRewardType: string;
          readonly fallbackRewardType: string;
        }[]
      | undefined,
  ): void {
    for (const fallback of fallbacks ?? []) {
      const key = semanticAddressKey(fallback.address);
      runtimeOfferFallbacks.set(
        key,
        Object.freeze({
          address: fallback.address,
          preferredKey: fallback.preferredRewardType,
          fallbackKey: fallback.fallbackRewardType,
        }),
      );
    }
  }
  function recordDerivedAcquisitionEntryFrontiers(
    frontiers:
      readonly import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    const incomingByOwner = new Map<
      string,
      import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[]
    >();
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      incomingByOwner.set(key, [...(incomingByOwner.get(key) ?? []), frontier]);
    }
    for (const [key, incoming] of incomingByOwner) {
      const firstIncoming = incoming[0];
      const completeIncomingCohort =
        firstIncoming !== undefined && incoming.length === firstIncoming.branchCohortSize;
      const combined = Object.freeze(
        completeIncomingCohort
          ? incoming
          : [...(derivedAcquisitionEntryContexts.get(key) ?? []), ...incoming],
      );
      derivedAcquisitionEntryContexts.set(key, combined);
      const first = combined[0];
      if (
        (first?.kind !== 'travelDealRefill' &&
          first?.kind !== 'infernalContractReward' &&
          first?.kind !== 'echoDoubleShopReward') ||
        combined.length !== first.branchCohortSize ||
        combined.some((candidate) => candidate.evaluateOffer === undefined) ||
        producerFrontiers.has(key)
      )
        continue;
      recordAcquisitionRoleFrontiers(
        combined.flatMap((candidate) => candidate.roleFrontiers ?? Object.freeze([])),
      );
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy:
            first.kind === 'travelDealRefill'
              ? ('jointShopInventory' as const)
              : ('sequential' as const),
          generationHistorySequence: Math.max(
            ...combined.flatMap((candidate) =>
              candidate.branchesBeforeEntry.map((branch) => branch.processedThroughHistorySequence),
            ),
          ),
          reachableBranchCount: combined.length,
          acquisitionHorizon:
            first.kind === 'travelDealRefill' || first.kind === 'echoDoubleShopReward'
              ? ('generationOnly' as const)
              : ('ownEnteredLifecycle' as const),
          owners: Object.freeze([first.address]),
          evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
            if (semanticAddressKey(owner) !== key)
              return fail('derived Shop reward frontier received a foreign owner');
            const results = combined.map((candidate) => candidate.evaluateOffer!(offer));
            return Object.freeze({
              findings: Object.freeze(results.flatMap((result) => result.findings)),
              supported: results.every((result) => result.supported),
            });
          },
        }),
      );
    }
  }

  /**
   * Judgment is one authored exact set, so its pre-effect domain cannot be
   * picked from an arbitrary reward branch. Branches may still differ in
   * reward bags and history, but they must agree on the complete Arcana
   * frontier consumed by this transition. The branch merge authority keeps
   * Arcana/Fear in its identity key; this is the local assertion at the point
   * where one public capability is published.
   */
  function attestJudgmentArcanaFrontier(
    branchesAtFrontier: readonly RewardBranchState[],
  ): readonly { readonly key: string; readonly rarity: 'Epic' | 'Heroic' }[] | undefined {
    const first = branchesAtFrontier[0]?.arcanaFear.arcana.active;
    if (first === undefined) return undefined;
    const identity = JSON.stringify(first);
    if (
      !branchesAtFrontier.every(
        (branch) => JSON.stringify(branch.arcanaFear.arcana.active) === identity,
      )
    ) {
      throw new BiomeRewardSimulationContractError(
        'Judgment candidate frontier has divergent Arcana state across surviving branches',
      );
    }
    return first;
  }
  // A Hub replaces its source's zero-target terminal envelope. Its source
  // still reaches an outgoing lifecycle checkpoint, but that checkpoint
  // creates the Hub rather than a normal reward batch.
  const hubTakeoverSources = new Set(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => semanticAddressKey(decision.source.origin)),
  );
  // Hub visit targets and their entered local rooms restore to an existing
  // parent rather than generating another ordinary decision. Their outgoing
  // checkpoints must still advance reward history without inventing a batch.
  const activeHubVisit = prepared.activeHubVisit;
  const hubRestoringSources = new Set([
    ...snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) =>
        decision.visits.flatMap((visit) => [
          semanticAddressKey(visit.target.room.origin),
          ...visit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
      ),
    ...(activeHubVisit === undefined
      ? []
      : [
          semanticAddressKey(activeHubVisit.target.room.origin),
          ...activeHubVisit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
  ]);
  const frontierSource =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? semanticAddressKey(snapshot.frontier.parent.origin)
      : undefined;
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: RewardStoreSupportEntry[] = [];
  const targetHistoryByOrigin = new Map<string, TargetRewardHistoryCheckpoint>();
  const targetGenerationByParent = new Map<string, TargetGenerationFrontier>();
  const findings = new Map<string, FindingRegionEntry>();
  const purgingPoolAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly PurgingPoolAssessment[];
    }
  >();
  const hermesShrineAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly HermesShrineCandidateContext[];
    }
  >();
  const stygianWellAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly StygianWellCandidateContext[];
    }
  >();
  const hermesShrineTravelDealRefills = new Map<
    string,
    readonly import('../hermes-shrine').HermesShrineTravelDealRefillAssessment[]
  >();
  const hermesShrineTravelDealRefillValid = new Map<string, boolean>();
  // The handler's FirstSpeedUpPurchase guard belongs to the Shrine room, not
  // to a branch.  We still require Travel Deal to agree across every branch
  // at that first action prefix before publishing a refill generation.
  const firstRushedInitialGenerationByShrine = new Set<string>();
  // H's event is a passive room feature, not a replacement for any cage or
  // optional leaf.  Keep an over-cap authored count materialized for repair,
  // but make the one reserved physical optional position an evaluated error.
  for (const room of rooms.values()) {
    if (room.kind !== 'authored' || room.fieldsOptionalRewardCount === undefined) continue;
    const passive = createEncounterPhaseAddress(
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
      'Passive',
    );
    const owner = createNemesisRandomEventAddress(passive);
    const support = fieldsOptionalRewardCountSupport(catalog, room, room.origin);
    if (
      support === undefined ||
      !support.reservesNemesisPosition ||
      room.fieldsOptionalRewardCount <= support.effectiveMaximum
    )
      continue;
    addRewardFinding(
      findings,
      rewardFinding('fieldsOptionalCapacityUnavailable', owner, {
        physicalCapacity: support.physicalMaximum,
        effectiveCapacity: support.effectiveMaximum,
        selectedCount: room.fieldsOptionalRewardCount,
      }),
      ownerRegion(owner),
    );
  }
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const runStateSnapshotsByOwner = new Map<string, RunStateSnapshot>();
  const traitChildSettlementBuilders = new Map<
    string,
    {
      readonly occurrenceOwner: SemanticAddress;
      readonly branches: RewardBranchState[];
      readonly candidateContexts: TraitOfferCandidateContext[];
      readonly runStateSnapshots: Map<string, RunStateSnapshot>;
    }
  >();
  const steadyGrowthCandidateContexts = new Map<string, ReachedSteadyGrowthThreshold[]>();
  const steadyGrowthOutcomeAddresses = new Map<string, SteadyGrowthOutcomeAddress>();
  function recordTraitChildSettlements(
    checkpoints: readonly ReachedTraitChildCheckpoint[] | undefined,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const checkpoint of checkpoints ?? []) {
      const key = semanticAddressKey(checkpoint.address);
      const current = traitChildSettlementBuilders.get(key);
      if (current === undefined)
        traitChildSettlementBuilders.set(key, {
          occurrenceOwner,
          branches: [checkpoint.branch],
          candidateContexts:
            checkpoint.candidateContext === undefined ? [] : [checkpoint.candidateContext],
          runStateSnapshots: new Map(),
        });
      else {
        current.branches.push(checkpoint.branch);
        if (checkpoint.candidateContext !== undefined)
          current.candidateContexts.push(checkpoint.candidateContext);
      }
    }
  }
  const hubDecisionsBySource = new Map(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => [semanticAddressKey(decision.source.origin), decision]),
  );
  let peers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches(
    initialBranches,
    initialBranches === undefined ? createArcanaFearState(catalog, routeLoadout) : undefined,
    catalog,
    initialBranches === undefined ? routeLoadout.startingKeepsakeKey : undefined,
    initialBranches === undefined ? routeLoadout.keepsakeEquipResults : undefined,
    initialBranches === undefined ? snapshot.routeKey : undefined,
    initialBranches === undefined ? routeLoadout : undefined,
  );
  const echoKeepsakeReplay = createEchoKeepsakeReplayAddress(
    createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
  );
  const echoHammerResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'experimentalHammer',
  );
  const biomeStartSequence = history.events[0]?.sequence ?? 0;
  const giftStates = branches.map((branch) => {
    const gift = branch.traitHistory?.equippedTraits.EchoRepeatKeepsakeBoon;
    return gift?.echoRepeatedKeepsakeKey === undefined || gift.acquisitionIdentity === undefined
      ? undefined
      : Object.freeze({
          capturedKeepsakeKey: gift.echoRepeatedKeepsakeKey,
          acquisitionIdentity: gift.acquisitionIdentity,
          replayCount: gift.echoKeepsakeReplayCount ?? 0,
        });
  });
  if (giftStates.some((state) => JSON.stringify(state) !== JSON.stringify(giftStates[0])))
    throw new BiomeRewardSimulationContractError(
      'Echo keepsake replay frontier is divergent across surviving branches',
    );
  const giftState = giftStates[0];
  if (giftState !== undefined) {
    const declaration = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey];
    if (declaration?.echoGift.availability !== 'eligible')
      throw new BiomeRewardSimulationContractError(
        `Echo captured ineligible keepsake ${giftState.capturedKeepsakeKey}`,
      );
    const replayEffect = declaration.echoGift.effect;
    if (
      replayEffect.kind === 'experimentalHammer' &&
      new Set(branches.map((branch) => branch.keepsakes.currentKey)).size !== 1
    )
      throw new BiomeRewardSimulationContractError(
        'Echo Experimental Hammer replay frontier has divergent current keepsakes',
      );
    const recordReplay = (branch: RewardBranchState): RewardBranchState => {
      const before = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = foldTraitHistoryEvents(catalog, [
        ...before.events,
        Object.freeze({
          kind: 'echoKeepsakeReplay' as const,
          owner: echoKeepsakeReplay,
          acquisitionRole: 'echoKeepsakeReplay' as const,
          sequence: biomeStartSequence,
          acquisitionPoint: 'biomeStart' as const,
          traitKey: 'EchoRepeatKeepsakeBoon' as const,
          acquisitionIdentity: giftState.acquisitionIdentity,
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
        }),
      ]);
      return Object.freeze({
        ...branch,
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
      });
    };
    if (replayEffect.kind === 'figLeaf' && giftState.replayCount === 0) {
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoFigLeafReplay(branch.keepsakes),
            }),
          ),
        ),
      );
    } else if (
      replayEffect.kind === 'experimentalHammer' &&
      giftState.replayCount === 0 &&
      branches[0]?.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      keepsakeEquipResultContexts.set(
        semanticAddressKey(echoHammerResult),
        Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                before: branch.traitHistory ?? createTraitHistoryState(),
                fatedStatus: branch.keepsakes.fatedStatus,
                arcanaFear: branch.arcanaFear,
                loadout: routeLoadout,
              }),
            ),
          ),
        }),
      );
      const authored = snapshot.echoKeepsakeReplayResults?.experimentalHammer;
      if (authored === undefined) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultMissing', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else if (
        branches.some(
          (branch) =>
            !assessExperimentalHammerEquipResult(
              catalog,
              authored,
              branch.traitHistory ?? createTraitHistoryState(),
              routeLoadout,
            ).legal,
        )
      ) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultUnavailable', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyExperimentalHammerEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                snapshot.echoKeepsakeReplayResults,
                echoHammerResult,
                biomeStartSequence,
                routeLoadout,
                'Common',
              ),
            ),
          ),
        );
      }
    } else if (replayEffect.kind === 'callingCard') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'callingCard')
        throw new BiomeRewardSimulationContractError('Echo Calling Card replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoCallingCardReplay(
                branch.keepsakes,
                charges.rarificationChargesByRank.Common,
              ),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'timePiece') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'timePiece')
        throw new BiomeRewardSimulationContractError('Echo Time Piece replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoTimePieceReplay(
                branch.keepsakes,
                charges.conversionChargesByRank.Common,
              ),
            }),
          ),
        ),
      );
    }
  }
  let pendingHubBoard: PendingHubBoardGeneration | undefined;
  const runStateDerivationCache = createRunStateDerivationCache();

  function captureRunState(
    owner: RunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): void {
    const ownerKey = semanticAddressKey(owner);
    if (runStateSnapshotsByOwner.has(ownerKey) || branches.length === 0) return;
    const declaration = catalog.rooms.byKey[source.gameName];
    if (declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} has no declaration for run-state snapshot`,
      );
    }
    const currentShopNames = visibleStoreOptionNames(
      source,
      hermesShrineAssessments.get(semanticAddressKey(source.origin))?.assessments,
    );
    // One token represents this exact rewardFacts closure: current/source room,
    // declaration, immutable view, entered-biome count, shop names, peer
    // context, and reward lookups. It cannot alias a later checkpoint even
    // when that checkpoint retains the same RewardHistoryState identity.
    const factsContextToken = Object.freeze({});
    const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
      createRunState({
        catalog,
        owner,
        historyView: view,
        branches: checkpointBranches,
        enteredBiomeCount,
        derivationCache: runStateDerivationCache,
        factsContextToken,
        rewardFacts: (branchHistory) =>
          rewardFacts(
            catalog,
            source,
            source,
            declaration,
            view,
            branchHistory,
            enteredBiomeCount,
            currentShopNames,
          ),
      });
    const snapshot = snapshotFor(checkpointBranches);
    if (snapshot !== undefined) runStateSnapshotsByOwner.set(ownerKey, snapshot);
    // Trait-child candidate checkpoints retain only generation snapshots. Room
    // lifecycle diagnostics are occurrence-local and never become a later
    // candidate-generation authority.
    if (owner.kind === 'roomRunStateCheckpoint') return;
    for (const checkpoint of traitChildSettlementBuilders.values()) {
      if (
        semanticAddressKey(checkpoint.occurrenceOwner) !== semanticAddressKey(source.origin) ||
        checkpoint.runStateSnapshots.has(ownerKey)
      )
        continue;
      const checkpointSnapshot = snapshotFor(checkpoint.branches);
      if (checkpointSnapshot !== undefined)
        checkpoint.runStateSnapshots.set(ownerKey, checkpointSnapshot);
    }
  }

  function recordTargetSlotHistory(
    origin: TargetAddress,
    historySequence: number,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): void {
    if (checkpointBranches.length === 0) {
      return;
    }
    targetHistoryByOrigin.set(
      semanticAddressKey(origin),
      Object.freeze({
        origin,
        historySequence,
        histories: Object.freeze(checkpointBranches.map((branch) => branch.history)),
        pendingSpellDrops: Object.freeze(
          checkpointBranches.map((branch) =>
            Object.values(branch.pendingHermesShrineDeliveries).some(
              (delivery) => delivery.reward.offer.rewardType === 'SpellDrop',
            ),
          ),
        ),
      }),
    );
  }

  function recordBlankFrontierTargetHistory(): void {
    const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
    if (frontier?.kind !== 'exitDecision' || frontier.parent.origin.kind !== 'occurrence') {
      return;
    }
    const source = rooms.get(semanticAddressKey(frontier.parent.origin));
    const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    if (source === undefined || declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${semanticAddressKey(frontier.origin)} has no reward-history frontier source`,
      );
    }
    const exitKeys =
      layout.progression.kind === 'hub'
        ? semanticAddressKey(frontier.parent.origin) ===
          semanticAddressKey(snapshot.entryRoom.origin)
          ? Object.freeze([layout.progression.entry.exitKey])
          : Object.freeze([])
        : Object.freeze(
            [...declaration.exits]
              .sort((left, right) => left.index - right.index)
              .map((exit) => `exit${exit.index}`),
          );
    const nextExitKey = exitKeys[frontier.targets.length];
    const historySequence = history.events.at(-1)?.sequence;
    if (nextExitKey === undefined || historySequence === undefined) {
      return;
    }
    const origin = createTargetAddress(
      createBiomeAddress(frontier.origin.routeKey, frontier.origin.biomeKey),
      frontier.origin.source,
      nextExitKey,
    );
    if (!targetHistoryByOrigin.has(semanticAddressKey(origin))) {
      recordTargetSlotHistory(origin, historySequence);
    }
  }

  function applyAuthoredSiteSettlementResult(
    result: AuthoredSiteSettlementResult,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const entry of result.emissions.findings)
      addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
    recordAcquisitionRoleFrontiers(result.emissions.acquisitionRoleFrontiers);
    recordRuntimeOfferFallbacks(result.emissions.runtimeOfferFallbacks);
    recordDerivedAcquisitionEntryFrontiers(result.emissions.derivedEntryFrontiers);
    recordTraitChildSettlements(result.emissions.traitChildSettlements, occurrenceOwner);
    for (const frontier of result.producerFrontiers)
      indexRewardProducerFrontier(producerFrontiers, frontier);
  }

  function flushPendingHubBoard(): void {
    const flushed = flushHubBoard(catalog, pendingHubBoard);
    if (flushed === undefined) return;
    branches = flushed.branches;
    peers = flushed.peers;
    for (const entry of flushed.findings)
      addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
    for (const frontier of flushed.producerFrontiers)
      indexRewardProducerFrontier(producerFrontiers, frontier);
    pendingHubBoard = undefined;
  }

  for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'encounterStarted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room?.kind === 'authored' && room.lifecycleProfileKey === 'ShipCombatRoom') {
          const view = views
            .get(semanticAddressKey(event.origin))
            ?.encounterStarts.find((candidate) => candidate.phaseKey === event.phaseKey)?.before;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} ${event.phaseKey} has no pre-encounter Run State view`,
            );
          }
          captureRunState(
            createRoomRunStateCheckpointAddress(room.origin, {
              kind: 'beforeEncounterStart',
              phaseKey: event.phaseKey,
            }),
            room,
            view,
          );
        }
        const figLeafTransition = applyEncounterStartedTransition(
          catalog,
          snapshot,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        branches = figLeafTransition.branches;
        for (const entry of figLeafTransition.figLeafCandidates)
          figLeafPhaseCandidates.set(entry.key, entry.candidate);
        for (const entry of figLeafTransition.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        // Gorgon is an additive appearance on the existing phase. Eligibility
        // is evaluated at the predecessor/pre-room checkpoint after Fig Leaf
        // execution; the pending branch remains untouched until completion.
        const gorgonDeclaration =
          room !== undefined && room.kind === 'authored'
            ? catalog.rooms.byKey[room.gameName]
            : undefined;
        const gorgonView =
          room === undefined ? undefined : views.get(semanticAddressKey(room.origin));
        const gorgonPhase =
          room !== undefined && room.kind === 'authored'
            ? room.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey)
            : undefined;
        if (
          room !== undefined &&
          room.kind === 'authored' &&
          gorgonDeclaration !== undefined &&
          gorgonPhase !== undefined &&
          gorgonView !== undefined
        ) {
          const gorgonStatus = attestGorgonBranchState(branches);
          const gorgonRarity = attestPendingGorgonRarity(branches);
          const selectedEncounterKey = selectedEncounterDefinitionKey(
            catalog,
            gorgonDeclaration,
            room.encounters,
            event.phaseKey,
            semanticAddressKey(event.origin),
          );
          const gorgonEffect = catalog.keepsakes.values.find(
            (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
          )?.effect;
          const gorgonOrigin = createEncounterPhaseAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            { kind: 'occurrence', occurrenceId: room.occurrenceId },
            event.phaseKey,
          );
          const gorgonCandidateSupported =
            !gorgonEvaluationBlocked &&
            gorgonStatus === 'pending' &&
            gorgonEffect?.kind === 'gorgonAmulet' &&
            gorgonView.preparation.ledgers.counters.biomeDepthCache >=
              gorgonEffect.minimumBiomeDepth &&
            gorgonDeclaration.blocksGorgon === false &&
            gorgonPhase.blocksGorgon === false &&
            selectedEncounterKey !== undefined &&
            catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon === true &&
            event.execution === 'normal';
          gorgonPhaseCandidates.set(
            semanticAddressKey(gorgonOrigin),
            Object.freeze({
              origin: gorgonOrigin,
              supported: gorgonCandidateSupported,
              ...(gorgonRarity === undefined ? {} : { rarity: gorgonRarity }),
            }),
          );
          if (
            gorgonStatus === 'pending' &&
            gorgonEffect?.kind === 'gorgonAmulet' &&
            selectedEncounterKey === gorgonEffect.naturalEncounterKey
          ) {
            branches = Object.freeze(
              branches.map((branch) =>
                Object.freeze({ ...branch, keepsakes: expirePendingGorgon(branch.keepsakes) }),
              ),
            );
          } else if (
            assessGorgonEligibility({
              status: gorgonStatus,
              biomeDepthCache: gorgonView.preparation.ledgers.counters.biomeDepthCache,
              minimumBiomeDepth:
                gorgonEffect?.kind === 'gorgonAmulet'
                  ? gorgonEffect.minimumBiomeDepth
                  : Number.POSITIVE_INFINITY,
              roomBlocked: gorgonDeclaration.blocksGorgon === true,
              encounterBlocked:
                gorgonPhase.blocksGorgon === true ||
                selectedEncounterKey === undefined ||
                catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon !== true,
              figLeafSkipped: event.execution === 'skippedByFigLeaf',
              athenaTriggerConditionMet:
                room.encounters.gorgonResultByPhase?.[event.phaseKey]?.athenaTriggerConditionMet ===
                true,
            })
          ) {
            if (!gorgonEvaluationBlocked)
              eligibleGorgonPhases.add(`${semanticAddressKey(event.origin)}::${event.phaseKey}`);
          }
        }
        break;
      }
      case 'roomEntered': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const entered = applyRoomEnteredTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          forcedSparkChaosSourceOccurrenceIds,
          branches,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin as CanonicalAuthoredRoom['origin'],
            event.sequence,
            'localRoomLifecycle',
          ),
          enteredBiomeCount,
          Object.freeze({
            purgingPool:
              room?.kind === 'authored' &&
              purgingPoolAssessments.has(semanticAddressKey(room.origin)),
            hermesShrine:
              room?.kind === 'authored' &&
              hermesShrineAssessments.has(semanticAddressKey(room.origin)),
            stygianWell:
              room?.kind === 'authored' &&
              stygianWellAssessments.has(semanticAddressKey(room.origin)),
          }),
        );
        branches = entered.branches;
        for (const entry of entered.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        if (entered.purgingPoolAssessment !== undefined)
          purgingPoolAssessments.set(
            semanticAddressKey(entered.purgingPoolAssessment.origin),
            entered.purgingPoolAssessment,
          );
        if (entered.hermesShrineAssessment !== undefined)
          hermesShrineAssessments.set(
            semanticAddressKey(entered.hermesShrineAssessment.origin),
            entered.hermesShrineAssessment,
          );
        if (entered.stygianWellAssessment !== undefined)
          stygianWellAssessments.set(
            semanticAddressKey(entered.stygianWellAssessment.origin),
            entered.stygianWellAssessment,
          );
        if (entered.runStateCheckpoint !== undefined) {
          const { owner, room: checkpointRoom, view } = entered.runStateCheckpoint;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${checkpointRoom.gameName} has no room-entry Run State view`,
            );
          }
          captureRunState(owner, checkpointRoom, view);
        }
        break;
      }
      case 'roomPrepared':
        branches = applyRoomPreparedTransition(event, branches);
        break;
      case 'keepsakeRackUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyKeepsakeRackUsedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin))?.entry,
          routeLoadout,
          branches,
        );
        branches = transition.branches;
        if (transition.keepsakeSelectionCandidate !== undefined)
          keepsakeSelectionContexts.set(
            transition.keepsakeSelectionCandidate.key,
            transition.keepsakeSelectionCandidate.candidate,
          );
        for (const candidate of transition.keepsakeEquipResultCandidates)
          keepsakeEquipResultContexts.set(candidate.key, candidate.candidate);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        break;
      }
      case 'roomCreated': {
        const transition = applyRoomCreatedTransition({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          targets,
          hubTargetByOrigin,
          additionalContinuations,
          expectedStores,
          hermesShrineAssessments,
          batchesByParent,
          ...('current' in history ? { historyCurrent: history.current } : {}),
          branches,
          peers,
          ...(pendingHubBoard === undefined ? {} : { pendingHubBoard }),
          lifecycle,
          routeLoadout,
          enteredBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
        });
        if (transition.keepsakeSelectionCandidate !== undefined)
          keepsakeSelectionContexts.set(
            transition.keepsakeSelectionCandidate.key,
            transition.keepsakeSelectionCandidate.candidate,
          );
        if (transition.hubRunStateCheckpoint !== undefined)
          captureRunState(
            transition.hubRunStateCheckpoint.owner,
            transition.hubRunStateCheckpoint.source,
            transition.hubRunStateCheckpoint.view,
          );
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        branches = transition.branches;
        peers = transition.peers;
        pendingHubBoard = transition.pendingHubBoard;
        break;
      }
      case 'targetGenerationCompleted': {
        if (
          event.origin.kind === 'hubSlot' &&
          pendingHubBoard?.participants.length === hubTargetByOrigin.size
        ) {
          flushPendingHubBoard();
        }
        const targetGeneration =
          event.origin.kind === 'target'
            ? targetGenerationByParent.get(semanticAddressKey(event.parentOrigin))
            : undefined;
        const transition = applyTargetGenerationCompletedTransition(event, targetGeneration);
        if (transition.nextTargetHistory !== undefined)
          recordTargetSlotHistory(transition.nextTargetHistory, event.sequence);
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        const ownerKey = semanticAddressKey(event.origin);
        const source = rooms.get(ownerKey);
        const sourceViews = views.get(ownerKey);
        const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
        const batch = batchesByParent.get(ownerKey);
        const hubDecisionOwner = hubDecisionsBySource.get(ownerKey)?.origin;
        const frontierOwner =
          frontierSource === ownerKey &&
          snapshot.kind === 'biomePrefix' &&
          snapshot.frontier?.kind === 'exitDecision'
            ? snapshot.frontier.origin
            : undefined;
        const transition = applyOutgoingGenerationTransition({
          catalog,
          snapshot,
          event,
          layout,
          source,
          sourceViews,
          declaration,
          batch,
          hubDecisionOwner,
          frontierOwner,
          emptyOutgoing: lifecycle.emptyOutgoingOwnerKeys.has(ownerKey),
          hubTakeover: hubTakeoverSources.has(ownerKey),
          hubRestoring: hubRestoringSources.has(ownerKey),
          branches,
          enteredBiomeCount,
          routeLoadout,
          rewardLookups: rewardLookup.internal,
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const settlement of transition.siteSettlements)
          applyAuthoredSiteSettlementResult(settlement, source?.origin ?? event.origin);
        if (transition.runStateCheckpoint !== undefined)
          captureRunState(
            transition.runStateCheckpoint.owner,
            transition.runStateCheckpoint.source,
            transition.runStateCheckpoint.view,
            transition.runStateCheckpoint.branches,
          );
        if (transition.targetGeneration !== undefined)
          targetGenerationByParent.set(
            transition.targetGeneration.parentKey,
            transition.targetGeneration.frontier,
          );
        if (transition.targetHistoryCheckpoint !== undefined)
          recordTargetSlotHistory(
            transition.targetHistoryCheckpoint.origin,
            transition.targetHistoryCheckpoint.historySequence,
            transition.targetHistoryCheckpoint.branches,
          );
        for (const entry of transition.storeSupportEntries) storeSupportEntries.push(entry);
        for (const entry of transition.expectedStores)
          expectedStores.set(entry.targetKey, entry.storeKey);
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        branches = transition.branches;
        peers = transition.peers;
        break;
      }
      case 'offerPointMaterialized': {
        const roomKey = semanticAddressKey(event.origin);
        const transition = applyOfferPointMaterializedTransition({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          lifecycle,
          branches,
          enteredBiomeCount,
          routeLoadout,
          rewardLookups: rewardLookup.internal,
          authoredSeaStarDuplicateSiteKeys,
          shipLifecycleCandidateAlreadyPublished: shipLifecycleContexts.has(roomKey),
        });
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        if (transition.shipLifecycleCandidate !== undefined)
          shipLifecycleContexts.set(roomKey, transition.shipLifecycleCandidate);
        branches = transition.branches;
        break;
      }
      case 'offerPointAcquired': {
        const settlement = applyReachedOfferSettlement({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          branches,
          priorFindings: Object.freeze([...findings.values()]),
          enteredBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const entry of settlement.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(
          settlement.traitChildSettlements,
          settlement.traitChildOccurrenceOwner,
        );
        branches = settlement.branches;
        break;
      }
      case 'producerRoleAdvanced': {
        const settlement = applyReachedOfferSettlement({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          branches,
          priorFindings: Object.freeze([...findings.values()]),
          enteredBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const entry of settlement.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(
          settlement.traitChildSettlements,
          settlement.traitChildOccurrenceOwner,
        );
        branches = settlement.branches;
        break;
      }
      case 'bossDefeated':
      case 'encounterInteractionReached':
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
        if (event.kind === 'bossDefeated') {
          branches = Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                ...branch,
                stygianWell: advanceStygianWellBossUses(branch.stygianWell),
              }),
            ),
          );
        }
        if (
          event.kind === 'encounterInteractionReached' &&
          event.interaction === 'gorgon' &&
          room !== undefined &&
          declaration !== undefined &&
          room.kind === 'authored' &&
          eligibleGorgonPhases.has(`${semanticAddressKey(event.origin)}::${event.phaseKey}`)
        ) {
          const result = room.encounters.gorgonResultByPhase?.[event.phaseKey];
          const phase = room.encounterPhases.find(
            (candidate) => candidate.slotKey === event.phaseKey,
          );
          const encounterPhaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            { kind: 'occurrence', occurrenceId: room.occurrenceId },
            event.phaseKey,
          );
          const gorgonPhaseAddress = createGorgonPhaseAddress(encounterPhaseAddress);
          const gorgonAddress = createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena');
          const gorgonKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
          const gorgonSnapshot = gorgonPhaseCandidates.get(
            semanticAddressKey(encounterPhaseAddress),
          );
          const gorgonOffer =
            result?.athenaOffer == null || gorgonSnapshot?.rarity === undefined
              ? undefined
              : materializeGorgonAthenaOffer(catalog, result.athenaOffer, gorgonSnapshot.rarity);
          if (
            phase?.blocksGorgon !== true &&
            declaration.blocksGorgon !== true &&
            result?.athenaTriggerConditionMet === true &&
            result.athenaOffer === null &&
            !blockedGorgonPhases.has(gorgonKey)
          ) {
            const gorgonEffect = catalog.keepsakes.values.find(
              (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
            )?.effect;
            const settlements = branches.map((branch) =>
              settleEncounterTraitOffer(
                catalog,
                branch,
                gorgonAddress.owner,
                null,
                event.sequence,
                'encounterCompleted',
                findings,
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                'gorgonAthena',
                gorgonSnapshot?.rarity,
                Object.freeze({
                  ...routeLoadout,
                  ...(declaration.boonRarityOverride === undefined
                    ? {}
                    : { boonRarityRoomOverride: declaration.boonRarityOverride }),
                }),
                undefined,
                gorgonEffect?.kind === 'gorgonAmulet' ? gorgonEffect.providerKey : undefined,
              ),
            );
            for (const settlement of settlements) {
              if (settlement.blockedChild === undefined) continue;
              recordTraitChildSettlements([settlement.blockedChild], room.origin);
            }
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
          } else if (
            phase?.blocksGorgon !== true &&
            declaration.blocksGorgon !== true &&
            result?.athenaTriggerConditionMet === true &&
            result.athenaOffer != null &&
            gorgonOffer !== undefined &&
            assessGorgonChildSettlement(catalog, result.athenaOffer) &&
            !blockedGorgonPhases.has(gorgonKey)
          ) {
            const beforeEvaluations = branches.map(
              (branch) => branch.traitEvaluations?.length ?? 0,
            );
            const processed = branches.map((branch) =>
              processEncounterTraitOffer(
                catalog,
                branch,
                gorgonAddress.owner,
                gorgonOffer,
                event.sequence,
                'encounterCompleted',
                findings,
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                'gorgonAthena',
                gorgonSnapshot?.rarity,
              ),
            );
            const valid = processed.every((branch, index) => {
              const evaluations = branch.traitEvaluations ?? [];
              const evaluation = evaluations[evaluations.length - 1];
              return (
                evaluations.length > beforeEvaluations[index]! &&
                evaluation !== undefined &&
                evaluation.assessments.every((assessment) => assessment.legal) &&
                evaluation.composition.legal &&
                evaluation.replacementComposition.legal &&
                evaluation.targetedAcquisition.legal
              );
            });
            if (valid) {
              branches = Object.freeze(
                processed.map((branch) =>
                  Object.freeze({
                    ...branch,
                    keepsakes: consumeGorgonAppearance(branch.keepsakes),
                  }),
                ),
              );
            } else {
              blockedGorgonPhases.add(gorgonKey);
              gorgonEvaluationBlocked = true;
            }
          } else if (
            result?.athenaTriggerConditionMet === true &&
            result.athenaOffer === undefined
          ) {
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
            addRewardFinding(
              findings,
              rewardFinding('rewardAcquisitionUnavailable', gorgonAddress.owner, {
                reason: 'gorgonAthenaOfferMissing',
              }),
              ownerRegion(gorgonAddress.owner),
              historyFindingChronology(event.sequence),
            );
          } else if (result?.athenaTriggerConditionMet === true && result.athenaOffer != null) {
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
            addRewardFinding(
              findings,
              rewardFinding('rewardAcquisitionUnavailable', gorgonAddress.owner, {
                reason: 'gorgonAthenaOfferInvalid',
              }),
              ownerRegion(gorgonAddress.owner),
              historyFindingChronology(event.sequence),
            );
          }
        }
        if (
          event.kind === 'bossDefeated' &&
          room?.kind === 'authored' &&
          (() => {
            const declaration = catalog.rooms.byKey[room.gameName];
            return declaration?.mode.kind === 'automatic' && declaration.mode.role === 'boss';
          })() &&
          enteredBiomeCount < fullRunBiomeCount
        ) {
          const owner = createJudgmentArcanaAddress(
            event.origin as import('../../authored-project/addresses').OccurrenceAddress,
            event.phaseKey,
          );
          // Barren suppresses Judgment at this exact seam.  The later
          // encounter completion may mature Barren, but cannot retroactively
          // re-enable this boss-defeated effect.
          const judgmentBranches = branches.filter(
            (branch) =>
              !hasActiveChaosSemanticTag(
                branch.traitHistory ?? createTraitHistoryState(),
                'Barren',
              ),
          );
          const activeArcana = attestJudgmentArcanaFrontier(judgmentBranches);
          const firstArcanaFear = judgmentBranches[0]?.arcanaFear;
          const requiredCount =
            activeArcana === undefined || firstArcanaFear === undefined
              ? undefined
              : judgmentRequiredCount(catalog, firstArcanaFear);
          if (requiredCount !== undefined && firstArcanaFear !== undefined) {
            judgmentArcanaContexts.set(
              semanticAddressKey(owner),
              Object.freeze({
                inactiveArcanaKeys: inactiveArcanaKeys(catalog, firstArcanaFear).filter(
                  (key) =>
                    judgmentBranches[0]?.keepsakes.fatedStatus !== 'Fated' ||
                    catalog.arcanaCards.byKey[key]?.fatedIncompatible !== true,
                ),
                requiredCount,
              }),
            );
          }
          branches = Object.freeze(
            branches.flatMap((branch) => {
              if (
                hasActiveChaosSemanticTag(
                  branch.traitHistory ?? createTraitHistoryState(),
                  'Barren',
                )
              )
                return [advanceRewardBranches([branch], event.sequence)[0]!];
              const required = judgmentRequiredCount(catalog, branch.arcanaFear);
              if (required === undefined)
                return [advanceRewardBranches([branch], event.sequence)[0]!];
              const selected = room.encounters.judgmentArcanaKeysByPhase?.[event.phaseKey] ?? [];
              if (selected.length !== required) {
                addRewardFinding(
                  findings,
                  rewardFinding(
                    selected.length === 0
                      ? 'judgmentOutcomeMissing'
                      : 'judgmentOutcomeWrongCardinality',
                    owner,
                    Object.freeze({ required, selected: selected.length }),
                  ),
                  ownerRegion(owner),
                  historyFindingChronology(event.sequence),
                );
                return [];
              }
              const assessed = activateTemporaryArcana(catalog, branch.arcanaFear, selected, {
                owner,
                sequence: event.sequence,
              });
              if (
                !assessed.legal ||
                (branch.keepsakes.fatedStatus === 'Fated' &&
                  selected.some(
                    (key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true,
                  ))
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding(
                    'judgmentOutcomeTargetUnavailable',
                    owner,
                    Object.freeze({ reason: assessed.legal ? 'fatedExcluded' : assessed.reason }),
                  ),
                  ownerRegion(owner),
                  historyFindingChronology(event.sequence),
                );
                return [];
              }
              return [
                Object.freeze({
                  ...branch,
                  arcanaFear: assessed.state,
                  keepsakes: refreshKeepsakeFatedStatus(catalog, branch.keepsakes, assessed.state),
                  processedThroughHistorySequence: event.sequence,
                }),
              ];
            }),
          );
          break;
        }
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.kind !== 'authored') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (event.kind === 'encounterCompleted') {
          const matchingRewards =
            room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ??
            [];
          if (room.lifecycleProfileKey === 'FieldsCombatRoom' || matchingRewards.length === 0) {
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          if (matchingRewards.length !== 1 || matchingRewards[0] === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
            );
          }
          const settlement = settleOwnedAcquisitionSite(
            catalog,
            branches,
            {
              siteOwner: matchingRewards[0].origin,
              pointKey: event.phaseKey,
              entryKey: matchingRewards[0].slotKey,
              source: withStoredArtificerReplacements(
                room,
                Object.freeze({ ...matchingRewards[0], instanceProvenance: 'free' }),
              ),
              historySequence: event.sequence,
              authoredSeaStarDuplicateSiteKeys,
            },
            (branchHistory) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.preOutgoing ?? roomView.entry,
                branchHistory,
                enteredBiomeCount,
              ),
            findings,
            undefined,
            rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
          );
          recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
          recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
          branches = settlement.branches;
          break;
        }
        if (event.kind === 'encounterInteractionReached' && event.interaction === 'gorgon') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const selectedEncounterKey = selectedEncounterDefinitionKey(
          catalog,
          declaration,
          room.encounters,
          event.phaseKey,
          semanticAddressKey(event.origin),
        );
        // Nemesis uses the existing encounter interaction as its only source
        // action.  Its accepted trait trade is intentionally a plain
        // current-trait removal: the generated Triple Gold entry remains a
        // later, ordinary acquisition action and therefore observes the
        // post-removal trait frontier just like every other pickup.
        if (
          event.kind === 'encounterInteractionReached' &&
          event.interaction === 'encounter' &&
          selectedEncounterKey === 'NemesisRandomEvent'
        ) {
          const outcome = room.encounters.nemesisRandomEventByPhase?.[event.phaseKey];
          const eventOwner = createNemesisRandomEventAddress(
            createEncounterPhaseAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
          );
          const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
          if (policy !== undefined) {
            const traitDomain = (branch: RewardBranchState) => {
              const traits = branch.traitHistory ?? createTraitHistoryState();
              const eligible = Object.values(traits.equippedTraits).filter((equipped) => {
                const declaration = catalog.traits.byKey[equipped.traitKey];
                return (
                  declaration !== undefined &&
                  equipped.providerKind === 'olympian' &&
                  equipped.rarity !== undefined
                );
              });
              const common = eligible.filter((equipped) => equipped.rarity === 'Common');
              return (common.length === 0 ? eligible : common).map((equipped) => equipped.traitKey);
            };
            const branchAssessments = branches.map((branch) => {
              const facts = rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.preOutgoing ?? roomView.entry,
                branch.history,
                enteredBiomeCount,
              );
              const runProgressLegal = (rewardType: string) => {
                const canonicalRewardType =
                  rewardType === 'StackUpgradeBig' ? 'StackUpgrade' : rewardType;
                const entries = catalog.rewards.stores.byKey.RunProgress?.entries.filter(
                  (entry) => entry.rewardType === canonicalRewardType,
                );
                // Plain consumable results are declaration-owned and have no
                // RunProgress gate. For the three gated event categories,
                // reuse the normalized store requirements rather than mirror
                // Hammer, Pom, or Path policy here.
                return (
                  entries === undefined ||
                  entries.length === 0 ||
                  entries.some(
                    (entry) =>
                      entry.requirement === undefined ||
                      evaluateRequirement(entry.requirement, facts.requirements),
                  )
                );
              };
              // NPCData names TalentLegal (rather than routeTalentLegal).
              // The non-Shop event has no current-shop exclusion, leaving the
              // source predicate's Spell Drop and all-invested facts.
              const talentLegal =
                (facts.requirements.records.useRecord.SpellDrop ?? 0) >= 1 &&
                facts.requirements.flags.allSpellInvested !== true;
              const applicable = (variant: {
                readonly rewardType: string;
                readonly enteredBiome: { readonly min?: number; readonly max?: number };
                readonly requirement: string;
              }) =>
                (variant.enteredBiome.min === undefined ||
                  enteredBiomeCount >= variant.enteredBiome.min) &&
                (variant.enteredBiome.max === undefined ||
                  enteredBiomeCount <= variant.enteredBiome.max) &&
                (variant.requirement === 'none' ||
                  (variant.requirement === 'pomLegal' && runProgressLegal('StackUpgrade')) ||
                  (variant.requirement === 'hammerEarlyOrLate' &&
                    runProgressLegal('WeaponUpgrade')) ||
                  (variant.requirement === 'talentLegal' && talentLegal));
              return Object.freeze({
                freeItemRewardTypes: Object.freeze([...policy.freeItem.resultRewardTypes]),
                goldTradeRewardTypes: Object.freeze(
                  policy.goldTrade.variants.filter(applicable).map((variant) => variant.rewardType),
                ),
                damageTradeRewardTypes: Object.freeze(
                  policy.damageTrade.variants
                    .filter(applicable)
                    .map((variant) => variant.rewardType),
                ),
                damageContestSuccessRewardTypes: Object.freeze(
                  policy.damageContest.successResultRewardTypes.filter((rewardType) =>
                    rewardType === 'StackUpgrade'
                      ? runProgressLegal('StackUpgrade')
                      : rewardType === 'TalentDrop'
                        ? talentLegal
                        : true,
                  ),
                ),
                traitTradeTraitKeys: Object.freeze(traitDomain(branch)),
              });
            });
            nemesisRandomEventCandidates.set(
              semanticAddressKey(eventOwner),
              Object.freeze({
                origin: eventOwner,
                familyKeys: Object.freeze([
                  'freeItem',
                  'goldTrade',
                  'damageTrade',
                  'traitTrade',
                  'damageContest',
                ] as const),
                goldTradeResponses: policy.goldTrade.response,
                damageTradeResponses: policy.damageTrade.response,
                traitTradeResponses: policy.traitTrade.response,
                damageContestResults: Object.freeze(['success', 'failure'] as const),
                traitTradeRewardType: policy.traitTrade.fixedResultRewardType,
                damageContestFailureRewardType: policy.damageContest.failureResultRewardType,
                branches: Object.freeze(branchAssessments),
              }),
            );
          }
          if (outcome === null || outcome === undefined) {
            addRewardFinding(
              findings,
              rewardFinding('nemesisOutcomeMissing', eventOwner, {}),
              ownerRegion(eventOwner),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
          } else {
            const assessments = nemesisRandomEventCandidates.get(
              semanticAddressKey(eventOwner),
            )?.branches;
            const outcomeLegal =
              assessments !== undefined &&
              assessments.every((assessment) => {
                const result =
                  room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]
                    ?.entries.result;
                const rewardType = result?.offer.rewardType;
                if (rewardType === undefined) return false;
                switch (outcome.kind) {
                  case 'freeItem':
                    return assessment.freeItemRewardTypes.includes(rewardType);
                  case 'goldTrade':
                    return assessment.goldTradeRewardTypes.includes(rewardType);
                  case 'damageTrade':
                    return assessment.damageTradeRewardTypes.includes(rewardType);
                  case 'damageContest':
                    return outcome.result === 'success'
                      ? assessment.damageContestSuccessRewardTypes.includes(rewardType)
                      : policy?.damageContest.failureResultRewardType === rewardType;
                  case 'traitTrade':
                    return (
                      rewardType === policy?.traitTrade.fixedResultRewardType &&
                      assessment.traitTradeTraitKeys.includes(outcome.traitKey)
                    );
                }
              });
            if (!outcomeLegal) {
              addRewardFinding(
                findings,
                rewardFinding('nemesisOutcomeUnavailable', eventOwner, { kind: outcome.kind }),
                ownerRegion(eventOwner),
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
              );
            } else if (outcome.kind === 'traitTrade' && outcome.response === 'accept') {
              branches = Object.freeze(
                branches.map((branch) => {
                  const before = branch.traitHistory ?? createTraitHistoryState();
                  const traitHistory = foldTraitHistoryEvents(catalog, [
                    ...before.events,
                    Object.freeze({
                      kind: 'traitRemoval' as const,
                      owner: createEncounterPhaseAddress(
                        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                        { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
                        event.phaseKey,
                      ),
                      acquisitionRole: 'nemesisTraitTrade',
                      sequence: event.sequence,
                      acquisitionPoint: 'encounterInteraction',
                      traitKey: outcome.traitKey,
                      match: 'currentTraitKey' as const,
                    }),
                  ]);
                  return Object.freeze({
                    ...branch,
                    history: attachTraitHistory(branch.history, traitHistory),
                    traitHistory,
                  });
                }),
              );
            }
            if (outcome.kind === 'freeItem') {
              const result =
                room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]
                  ?.entries.result;
              const edge = policy?.freeItem.runtimeOfferFallbacks.find(
                (candidate) => candidate.preferredRewardType === result?.offer.rewardType,
              );
              if (
                edge !== undefined &&
                assessments?.every((assessment) =>
                  assessment.freeItemRewardTypes.includes(edge.fallbackRewardType),
                )
              ) {
                runtimeOfferFallbacks.set(
                  semanticAddressKey(eventOwner),
                  Object.freeze({
                    address: eventOwner,
                    preferredKey: edge.preferredRewardType,
                    fallbackKey: edge.fallbackRewardType,
                  }),
                );
              }
            }
          }
        }
        const authoredEncounterOffer =
          selectedEncounterKey === undefined
            ? undefined
            : room.encounters.traitOffersByPhase?.[event.phaseKey]?.[selectedEncounterKey];
        if (authoredEncounterOffer === null && selectedEncounterKey !== undefined) {
          const producer =
            catalog.encounterDefinitions.byKey[selectedEncounterKey]?.traitOfferProducer;
          const phaseOwner = {
            kind: 'occurrence' as const,
            occurrenceId: room.occurrenceId,
          };
          const phaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            phaseOwner,
            event.phaseKey,
          );
          const settlements = branches.map((branch) =>
            settleEncounterTraitOffer(
              catalog,
              branch,
              phaseAddress,
              null,
              event.sequence,
              'encounterCompleted',
              findings,
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
              'selection',
              undefined,
              Object.freeze({
                ...routeLoadout,
                ...(declaration.boonRarityOverride === undefined
                  ? {}
                  : { boonRarityRoomOverride: declaration.boonRarityOverride }),
              }),
              undefined,
              producer?.giverKey,
            ),
          );
          for (const settlement of settlements) {
            if (settlement.blockedChild === undefined) continue;
            recordTraitChildSettlements([settlement.blockedChild], room.origin);
          }
          break;
        }
        if (authoredEncounterOffer != null && selectedEncounterKey !== undefined) {
          const phaseOwner = {
            kind: 'occurrence' as const,
            occurrenceId: room.occurrenceId,
          };
          const phaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            phaseOwner,
            event.phaseKey,
          );
          const settlements = branches.map((branch) =>
            settleEncounterTraitOffer(
              catalog,
              branch,
              phaseAddress,
              authoredEncounterOffer,
              event.sequence,
              'encounterCompleted',
              findings,
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
              'selection',
              undefined,
              Object.freeze({
                ...routeLoadout,
                ...(declaration.boonRarityOverride === undefined
                  ? {}
                  : { boonRarityRoomOverride: declaration.boonRarityOverride }),
              }),
              branches.map((candidate) => candidate.traitHistory ?? createTraitHistoryState()),
            ),
          );
          for (const settlement of settlements) {
            const checkpoint = settlement.blockedChild;
            if (checkpoint === undefined) continue;
            recordTraitChildSettlements([checkpoint], room.origin);
          }
          branches = Object.freeze(settlements.map((settlement) => settlement.branch));
        }
        break;
      }
      case 'encounterEndEffectsApplied': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyEncounterEndEffectsTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          enteredBiomeCount,
          fullRunBiomeCount,
          branches,
        );
        branches = transition.branches;
        recordDerivedAcquisitionEntryFrontiers(transition.derivedAcquisitionEntryFrontiers);
        for (const { address, threshold } of transition.steadyGrowthThresholds) {
          const key = semanticAddressKey(address);
          steadyGrowthOutcomeAddresses.set(key, address);
          const current = steadyGrowthCandidateContexts.get(key) ?? [];
          current.push(threshold);
          steadyGrowthCandidateContexts.set(key, current);
        }
        recordTraitChildSettlements(transition.traitChildSettlements, event.origin);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        break;
      }
      case 'acquisitionPointReached': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError('shop purchases have no authored room');
        }
        if (event.point.startsWith('hermesShrinePurchase:')) {
          const generationKey = event.point.slice(
            'hermesShrinePurchase:'.length,
          ) as import('../../authored-project/model').HermesShrineGenerationKey;
          const slotKey = generationKey.startsWith('initial:')
            ? (generationKey.slice(
                'initial:'.length,
              ) as import('../../authored-project/model').HermesShrineSlotKey)
            : undefined;
          const purchase =
            generationKey === 'travelDealRefill'
              ? room.hermesShrine?.travelDealRefill?.purchase
              : room.hermesShrine?.purchaseBySlot?.[slotKey!];
          const offer =
            generationKey === 'travelDealRefill'
              ? room.hermesShrine?.travelDealRefill?.offer
              : room.hermesShrine?.offerBySlot[slotKey!];
          if (purchase === undefined || offer === undefined || offer === null) {
            addRewardFinding(
              findings,
              rewardFinding('rewardSourceUnavailable', room.origin, { generationKey }),
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          const sourceKey = hermesShrineDeliveryEntryKey(room.origin, generationKey);
          const shrineKey = semanticAddressKey(room.origin);
          const fallbackRewardType = hermesShrineRuntimeFallbackRewardType(
            catalog,
            generationKey,
            offer.offer.rewardType,
            hermesShrineTravelDealRefills.get(shrineKey)?.[0],
          );
          if (
            fallbackRewardType !== undefined &&
            (generationKey !== 'travelDealRefill' ||
              hermesShrineTravelDealRefillValid.get(shrineKey) === true)
          ) {
            const address = createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery'),
              sourceKey,
            );
            runtimeOfferFallbacks.set(
              semanticAddressKey(address),
              Object.freeze({
                address,
                preferredKey: offer.offer.rewardType,
                fallbackKey: fallbackRewardType,
              }),
            );
          }
          if (
            generationKey === 'travelDealRefill' &&
            hermesShrineTravelDealRefillValid.get(shrineKey) !== true
          ) {
            addRewardFinding(
              findings,
              rewardFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
                reason: 'noQualifyingFirstRushedPurchase',
              }),
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          if (purchase.rushed && generationKey.startsWith('initial:')) {
            const shrineKey = semanticAddressKey(room.origin);
            if (!firstRushedInitialGenerationByShrine.has(shrineKey)) {
              firstRushedInitialGenerationByShrine.add(shrineKey);
              const preRushView =
                roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
                roomView.preOutgoing ??
                roomView.entry;
              const qualifies = branches.every(
                (branch) => branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
              );
              if (qualifies) {
                const refillAssessments = Object.freeze(
                  branches.flatMap((branch) => {
                    const assessment = assessHermesShrineTravelDealRefill(
                      catalog,
                      room.hermesShrine!,
                      generationKey,
                      [
                        rewardFacts(
                          catalog,
                          room,
                          room,
                          declaration,
                          preRushView,
                          branch.history,
                          enteredBiomeCount,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          branch,
                        ).requirements,
                      ],
                    );
                    return assessment === undefined ? [] : [assessment];
                  }),
                );
                hermesShrineTravelDealRefills.set(shrineKey, refillAssessments);
                const refill = room.hermesShrine?.travelDealRefill?.offer;
                const supported =
                  refill !== undefined &&
                  refill !== null &&
                  refillAssessments.length === branches.length &&
                  refillAssessments.every((assessment) =>
                    assessment.candidateRewardTypes.includes(refill.offer.rewardType),
                  );
                hermesShrineTravelDealRefillValid.set(shrineKey, supported);
                if (refill === undefined || refill === null) {
                  addRewardFinding(
                    findings,
                    rewardFinding('hermesShrineTravelDealRefillMissing', room.origin, {
                      generationKey,
                    }),
                    ownerRegion(room.origin),
                    rewardFindingChronologyForRoom(
                      snapshot,
                      room.origin,
                      event.sequence,
                      'localRoomLifecycle',
                    ),
                  );
                } else if (!supported) {
                  addRewardFinding(
                    findings,
                    rewardFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
                      generationKey,
                      rewardType: refill.offer.rewardType,
                    }),
                    ownerRegion(room.origin),
                    rewardFindingChronologyForRoom(
                      snapshot,
                      room.origin,
                      event.sequence,
                      'localRoomLifecycle',
                    ),
                  );
                }
              }
            }
          }
          if (!purchase.rushed) {
            branches = Object.freeze(
              branches.map((branch) =>
                Object.freeze({
                  ...branch,
                  pendingHermesShrineDeliveries: Object.freeze({
                    ...branch.pendingHermesShrineDeliveries,
                    [sourceKey]: Object.freeze({
                      sourceKey,
                      sourceOrigin: room.origin,
                      generationKey,
                      reward: offer,
                      remainingUses: purchase.delay,
                    }),
                  }),
                }),
              ),
            );
          } else {
            // Rush is deliberately one source action, but it is still an
            // ordinary free pickup.  The Shrine offer owns its resolution
            // detail; no second host-owned action is authored for this case.
            const site = createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery');
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const settled = settlePickupAcquisitionSite(
              catalog,
              branches,
              {
                siteOwner: room.origin,
                site,
                entries: Object.freeze({ [sourceKey]: offer }),
                order: Object.freeze([sourceKey]),
                requiredEntryKeys: new Set([sourceKey]),
                producerLifecycleKey: 'HermesShrineDelivery',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
                artificerReplacementFor(source, role) {
                  const replacementSite = artificerAcquisitionSite(room.origin, source);
                  return (
                    room.acquisitionSites[acquisitionSiteStorageKey(replacementSite)]?.entries[
                      artificerReplacementEntryKey(source, role)
                    ] ?? null
                  );
                },
                artificerReplacementSiteFor(source) {
                  return artificerAcquisitionSite(room.origin, source);
                },
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settled.roleFrontiers);
            recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
            // The entry is not retained at the source: the one purchase row
            // itself owns this immediate pickup's controls and chronology.
            branches = settled.branches;
          }
          break;
        }
        const purgingPoolSlotKey = event.point.startsWith('purgingPool:')
          ? event.point.slice('purgingPool:'.length)
          : undefined;
        if (
          purgingPoolSlotKey === 'left' ||
          purgingPoolSlotKey === 'middle' ||
          purgingPoolSlotKey === 'right'
        ) {
          const traitKey = room.purgingPool?.traitKeyBySlot[purgingPoolSlotKey];
          const row = room.roomActionRoster.rows.find(
            (candidate) =>
              candidate.rank !== null &&
              candidate.reference.kind === 'sellPurgingPoolTrait' &&
              candidate.reference.slotKey === purgingPoolSlotKey,
          );
          if (row === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} has no ranked Pool sale row for ${purgingPoolSlotKey}`,
            );
          }
          const owner = createRoomActionAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            room.occurrenceId,
            row.key,
          );
          const poolGenerationComplete =
            purgingPoolAssessments
              .get(semanticAddressKey(room.origin))
              ?.assessments.every((assessment) => assessment.complete) === true;
          const available =
            poolGenerationComplete &&
            traitKey !== null &&
            traitKey !== undefined &&
            branches.every((branch) => {
              const equipped = (branch.traitHistory ?? createTraitHistoryState()).equippedTraits[
                traitKey
              ];
              return equipped !== undefined && isPurgingPoolEligibleTrait(catalog, equipped);
            });
          if (!available) {
            addRewardFinding(
              findings,
              rewardFinding('purgingPoolSaleUnavailable', owner, {
                slotKey: purgingPoolSlotKey,
                ...(traitKey === null || traitKey === undefined ? {} : { traitKey }),
              }),
              // A stale Pool action has no active roster contribution, so its
              // enclosing occurrence remains the progressive atomic region;
              // the finding origin itself stays the exact retained action.
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          branches = Object.freeze(
            branches.map((branch) => {
              const before = branch.traitHistory ?? createTraitHistoryState();
              const traitHistory = foldTraitHistoryEvents(catalog, [
                ...before.events,
                Object.freeze({
                  kind: 'traitRemoval' as const,
                  owner,
                  acquisitionRole: 'purgingPoolSale',
                  sequence: event.sequence,
                  acquisitionPoint: event.point,
                  traitKey,
                  match: 'currentTraitKey' as const,
                }),
              ]);
              return Object.freeze({
                ...branch,
                history: attachTraitHistory(branch.history, traitHistory),
                traitHistory,
              });
            }),
          );
          break;
        }
        const roomActionLocalParts = event.point.startsWith('localReward:')
          ? event.point.slice('localReward:'.length).split(':')
          : undefined;
        if (room.lifecycleProfileKey === 'FieldsCombatRoom' && roomActionLocalParts !== undefined) {
          const [groupKey, slotKey] = roomActionLocalParts;
          const localReward =
            groupKey === 'cages'
              ? room.localRewards?.find((reward) => reward.slotKey === slotKey)
              : groupKey === 'optionalRewards'
                ? room.fieldsOptionalRewards?.find((reward) => reward.slotKey === slotKey)
                : undefined;
          const acquisitionView = roomView.acquisitionPoints?.find(
            (point) => point.point === event.point,
          )?.before;
          if (localReward === undefined || acquisitionView === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} has no Fields acquisition ${event.point}`,
            );
          }
          const settlement = settleOwnedAcquisitionSite(
            catalog,
            branches,
            {
              siteOwner: localReward.origin,
              pointKey: event.point,
              entryKey: localReward.slotKey,
              source: withStoredArtificerReplacements(
                room,
                Object.freeze({ ...localReward, instanceProvenance: 'free' }),
              ),
              historySequence: event.sequence,
              deferArtificerReplacement: true,
              authoredSeaStarDuplicateSiteKeys,
            },
            (branchHistory) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                acquisitionView,
                branchHistory,
                enteredBiomeCount,
              ),
            findings,
            undefined,
            rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
          );
          recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
          recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
          branches = settlement.branches;
          break;
        }
        if (event.siteKey !== undefined && event.entryKey !== undefined) {
          const site = room.acquisitionSites[event.siteKey];
          const shrineDelivery =
            event.siteKey === 'hermesShrineDelivery'
              ? parseHermesShrineDeliveryEntryKey(event.entryKey)
              : undefined;
          if (site !== undefined && shrineDelivery !== undefined) {
            const sourceOrigin = {
              kind: 'occurrence' as const,
              routeKey: shrineDelivery.routeKey,
              biomeKey: shrineDelivery.biomeKey,
              occurrenceId: shrineDelivery.sourceOccurrenceId,
            };
            const sourceKey = hermesShrineDeliveryEntryKey(
              sourceOrigin,
              shrineDelivery.generationKey,
            );
            const due = branches.map((branch) => branch.pendingHermesShrineDeliveries[sourceKey]);
            const firstDue = due[0];
            const agreedDue =
              firstDue !== undefined &&
              due.length === branches.length &&
              due.every(
                (delivery) =>
                  delivery !== undefined &&
                  semanticAddressKey(delivery.dueAt ?? room.origin) ===
                    semanticAddressKey(room.origin),
              )
                ? firstDue
                : undefined;
            const retained = site.entries[event.entryKey];
            const entry = createAcquisitionEntryAddress(site.address, event.entryKey);
            if (
              agreedDue === undefined ||
              retained === undefined ||
              retained === null ||
              JSON.stringify(retained.offer) !== JSON.stringify(agreedDue.reward.offer)
            ) {
              addRewardFinding(
                findings,
                rewardFinding('rewardSourceUnavailable', entry, {
                  reason:
                    agreedDue === undefined
                      ? 'staleHermesShrineDelivery'
                      : 'retainedSourceMismatch',
                }),
                ownerRegion(entry),
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
              );
              break;
            }
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const settled = settlePickupAcquisitionSite(
              catalog,
              branches,
              {
                siteOwner: room.origin,
                site: site.address,
                entries: Object.freeze({ [event.entryKey]: retained }),
                order: Object.freeze([event.entryKey]),
                requiredEntryKeys: new Set([event.entryKey]),
                producerLifecycleKey: 'HermesShrineDelivery',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settled.roleFrontiers);
            recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
            const settledEntryKey = semanticAddressKey(entry);
            branches = Object.freeze(
              settled.branches.map((branch) => {
                // A role can split or merge reward branches, so cardinality
                // cannot decide whether this particular pending item settled.
                // Its own ordinary pickup event is the authoritative success
                // witness.  Blocked/no-op successors retain the pending item.
                const settledThisEntry = branch.events.some(
                  (candidate) =>
                    (candidate.kind === 'concreteAcquisition' ||
                      candidate.kind === 'conversionToGold' ||
                      candidate.kind === 'artificerConversion') &&
                    candidate.settlement !== undefined &&
                    semanticAddressKey(candidate.settlement.entry) === settledEntryKey,
                );
                if (!settledThisEntry) return branch;
                const { [sourceKey]: delivered, ...remaining } =
                  branch.pendingHermesShrineDeliveries;
                void delivered;
                return Object.freeze({
                  ...branch,
                  pendingHermesShrineDeliveries: Object.freeze(remaining),
                });
              }),
            );
            break;
          }
          const parsed = parseArtificerReplacementEntryKey(event.entryKey);
          if (site !== undefined && parsed !== undefined) {
            const source = canonicalArtificerSource(room, parsed.sourceKey);
            const replacement = site.entries[event.entryKey];
            if (source === undefined || replacement === undefined) {
              throw new BiomeRewardSimulationContractError(
                `${room.gameName} lost Artificer source for ${event.entryKey}`,
              );
            }
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const row = room.roomActionRoster.rows.find(
              (candidate) =>
                candidate.reference.kind === 'interactAcquisitionEntry' &&
                candidate.reference.siteKey === event.siteKey &&
                candidate.reference.entryKey === event.entryKey,
            );
            const settlement = settleArtificerReplacementAcquisition(
              catalog,
              branches,
              {
                siteOwner: site.address.owner,
                pointKey: site.address.pointKey,
                sourceEntryKey: parsed.sourceKey,
                sourceOrigin: source.owner,
                sourceReward: source.reward,
                replacement,
                acquisitionRole: parsed.acquisitionRole,
                participation: row?.participation === 'required' ? 'mandatory' : 'optional',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
            recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
            branches = settlement.branches;
            break;
          }
        }
        const currentRow = room.roomActionRoster.rows.find(
          (row) =>
            row.rank !== null &&
            event.point ===
              (row.reference.kind === 'interactShopOffer'
                ? `shopOffer:${row.reference.offerKey}`
                : row.reference.kind === 'interactAcquisitionEntry'
                  ? `acquisitionEntry:${row.reference.siteKey}:${row.reference.entryKey}`
                  : ''),
        );
        const actionEntry =
          currentRow?.reference.kind === 'interactAcquisitionEntry'
            ? { siteKey: currentRow.reference.siteKey, entryKey: currentRow.reference.entryKey }
            : currentRow?.reference.kind === 'interactShopOffer'
              ? { siteKey: 'roomExit', entryKey: currentRow.reference.offerKey }
              : undefined;
        const currentRank = currentRow?.rank ?? undefined;
        const completeShopAfterOrder =
          room.entryState?.kind !== 'shop' ||
          currentRank === undefined ||
          !room.roomActionRoster.rows.some(
            (row) =>
              row.rank !== null &&
              row.rank > currentRank &&
              (row.reference.kind === 'interactShopOffer' ||
                (row.reference.kind === 'interactAcquisitionEntry' &&
                  row.reference.siteKey === 'roomExit')),
          );
        const settlement = settleAuthoredAcquisitionSiteTransition({
          catalog,
          snapshot,
          room,
          declaration,
          roomView,
          sourceBranches: branches,
          historySequence: event.sequence,
          enteredBiomeCount,
          routeLoadout,
          rewardLookups: rewardLookup.internal,
          authoredSeaStarDuplicateSiteKeys,
          ...(actionEntry === undefined ? {} : { onlyEntry: actionEntry }),
          completeShopAfterOrder,
        });
        applyAuthoredSiteSettlementResult(settlement, room.origin);
        branches = settlement.branches;
        break;
      }
      case 'wellPurchase': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const well = room?.kind === 'authored' ? room.stygianWell : undefined;
        const slot = event.generationKey.startsWith('initial:')
          ? (event.generationKey.slice(
              'initial:'.length,
            ) as import('../../authored-project/model').StygianWellSlotKey)
          : undefined;
        const itemKey =
          event.generationKey === 'travelDealRefill'
            ? well?.travelDealRefillKey
            : slot === undefined
              ? undefined
              : well?.offerKeyBySlot[slot];
        if (
          room?.kind !== 'authored' ||
          well === undefined ||
          !well.interacted ||
          itemKey === undefined ||
          itemKey === null
        ) {
          addRewardFinding(
            findings,
            rewardFinding('rewardSourceUnavailable', event.origin, {
              generationKey: event.generationKey,
            }),
            ownerRegion(event.origin),
            rewardFindingChronologyForRoom(
              snapshot,
              event.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
          );
          break;
        }
        const twistChildKey =
          event.generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot;
        const twistResultKey =
          itemKey === 'RandomStoreItem' && twistChildKey !== undefined
            ? well.twistResultKeyBySlot?.[twistChildKey]
            : undefined;
        const row =
          room?.kind === 'authored'
            ? room.roomActionRoster.rows.find(
                (candidate) =>
                  candidate.reference.kind === 'purchaseStygianWellOffer' &&
                  candidate.reference.generationKey === event.generationKey,
              )
            : undefined;
        if (row !== undefined) {
          const address = createRoomActionAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            room.occurrenceId,
            row.key,
          );
          const fallbackItemKey = stygianWellRuntimeFallbackItemKey(catalog, itemKey, false);
          if (fallbackItemKey !== undefined)
            runtimeOfferFallbacks.set(
              semanticAddressKey(address),
              Object.freeze({ address, preferredKey: itemKey, fallbackKey: fallbackItemKey }),
            );
          if (twistResultKey !== undefined && twistResultKey !== null) {
            const nestedFallback = stygianWellRuntimeFallbackItemKey(catalog, twistResultKey, true);
            if (nestedFallback !== undefined)
              runtimeOfferFallbacks.set(
                `${semanticAddressKey(address)}:twist`,
                Object.freeze({
                  address,
                  preferredKey: twistResultKey,
                  fallbackKey: nestedFallback,
                }),
              );
          }
        }
        branches = Object.freeze(
          branches.map((branch) => {
            const direct = applyStygianWellPurchase(catalog, branch.stygianWell, itemKey);
            const directOption = catalog.rewards.shops.byKey.RoomShop?.groups.values
              .flatMap((group) => group.options.values)
              .find((option) => option.key === itemKey);
            const nestedOption =
              twistResultKey === undefined || twistResultKey === null
                ? undefined
                : catalog.rewards.shops.byKey.RoomShop?.groups.values
                    .flatMap((group) => group.options.values)
                    .find((option) => option.key === twistResultKey);
            let history = branch.history;
            if (directOption?.stygianWell?.effect === 'lastStand') {
              history = applyConcreteAcquisition(catalog.rewards, history, {
                kind: 'consumable',
                gameName: 'LastStandDrop',
              });
            }
            if (nestedOption?.stygianWell?.effect === 'lastStand') {
              history = applyConcreteAcquisition(catalog.rewards, history, {
                kind: 'consumable',
                gameName: 'LastStandDrop',
              });
            }
            return Object.freeze({
              ...branch,
              history,
              stygianWell:
                twistResultKey === undefined || twistResultKey === null
                  ? direct
                  : applyStygianWellPurchase(catalog, direct, twistResultKey, false),
            });
          }),
        );
        break;
      }
      case 'roomExited': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const exited = applyRoomExitedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          resourcePlacements,
          branches,
        );
        branches = exited.branches;
        if (exited.runStateCheckpoint !== undefined)
          captureRunState(
            exited.runStateCheckpoint.owner,
            exited.runStateCheckpoint.room,
            exited.runStateCheckpoint.view,
          );
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
  }

  if (
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.parent.origin.kind === 'hubRoom'
  ) {
    const source = rooms.get(semanticAddressKey(snapshot.frontier.parent.origin));
    if (source?.kind === 'hub') {
      const current = 'current' in history ? history.current : history.afterTransition;
      captureRunState(snapshot.frontier.origin, source, current);
    }
  }

  recordBlankFrontierTargetHistory();
  const immutableFindingRegions = Object.freeze([...findings.values()]);
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
  );
  const traitCandidateContexts = new Map(traitProducts.candidateContexts);
  for (const [key, checkpoint] of traitChildSettlementBuilders) {
    if (checkpoint.candidateContexts.length === 0) continue;
    traitCandidateContexts.set(
      key,
      Object.freeze([...(traitCandidateContexts.get(key) ?? []), ...checkpoint.candidateContexts]),
    );
  }
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...runStateSnapshotsByOwner.values()].sort((left, right) => {
      const leftRoom = left.owner.kind === 'roomRunStateCheckpoint';
      const rightRoom = right.owner.kind === 'roomRunStateCheckpoint';
      return leftRoom === rightRoom ? 0 : leftRoom ? 1 : -1;
    }),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    discoveredRunStateSnapshots,
    discoveredRunStateSnapshots,
  );
  const traitChildSettlementProducts = new Map(
    [...traitChildSettlementBuilders].map(([key, checkpoint]) =>
      Object.freeze([
        key,
        Object.freeze({
          branches: Object.freeze(
            mergeEquivalentRewardBranches(checkpoint.branches).map(publicRewardBranch),
          ),
          runStateSnapshots: Object.freeze([...checkpoint.runStateSnapshots.values()]),
        }),
      ] as const),
    ),
  );
  const traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints = Object.freeze({
    at: (address: SemanticAddress) => traitChildSettlementProducts.get(semanticAddressKey(address)),
  });
  const simulation: BiomeRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze([...targetHistoryByOrigin.values()]),
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    rewardLookups: rewardLookup.public,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    purgingPoolAssessments: Object.freeze([...purgingPoolAssessments.values()]),
    hermesShrineAssessments: Object.freeze([...hermesShrineAssessments.values()]),
    stygianWellAssessments: Object.freeze([...stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        branches
          .flatMap((branch) => Object.values(branch.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.sourceKey,
                Object.freeze({
                  sourceKey: delivery.sourceKey,
                  sourceOrigin: delivery.sourceOrigin,
                  rewardType: delivery.reward.offer.rewardType,
                  deliveryKind:
                    delivery.dueAt === undefined ? ('pending' as const) : ('countdown' as const),
                  ...(delivery.dueAt === undefined ? {} : { hostOrigin: delivery.dueAt }),
                  ...(delivery.dueSequence === undefined
                    ? {}
                    : { hostSequence: delivery.dueSequence }),
                  remainingUses: delivery.remainingUses,
                }),
              ] as const,
          ),
      ).values(),
    ]),
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    runtimeOfferFallbacks: Object.freeze([
      ...traitProducts.runtimeOfferFallbacks,
      ...runtimeOfferFallbacks.values(),
    ]),
    figLeafPhaseCandidates: Object.freeze([...figLeafPhaseCandidates.values()]),
    gorgonPhaseCandidates: Object.freeze([...gorgonPhaseCandidates.values()]),
    nemesisRandomEventCandidates: Object.freeze([...nemesisRandomEventCandidates.values()]),
    steadyGrowthOutcomes: Object.freeze(
      [...steadyGrowthCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = steadyGrowthOutcomeAddresses.get(key);
        const first = thresholds[0];
        if (address === undefined || first === undefined) return [];
        return [
          Object.freeze({
            address,
            sourceTraitKey: first.traitKey,
            phaseKey: address.phaseKey,
            requiredIntervals: Object.freeze(
              thresholds.map((threshold) => threshold.requiredInterval),
            ),
            progressBefore: Object.freeze(
              thresholds.map(
                (threshold) =>
                  threshold.before.equippedTraits[threshold.traitKey]?.steadyGrowthProgress ?? 0,
              ),
            ),
          }),
        ];
      }),
    ),
    derivedAcquisitionEntries: Object.freeze(
      [...derivedAcquisitionEntryContexts.values()].flatMap((frontiers) => {
        const first = frontiers[0];
        const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
        return first === undefined || capability === undefined
          ? []
          : [Object.freeze({ address: first.address, ...capability })];
      }),
    ),
  });
  return Object.freeze({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(shipLifecycleContexts),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContexts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(judgmentArcanaContexts),
    keepsakeSelectionArtifacts:
      createKeepsakeSelectionCandidateArtifacts(keepsakeSelectionContexts),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      acquisitionConversionContexts,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      derivedAcquisitionEntryContexts,
    ),
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      steadyGrowthCandidateContexts,
    ),
    purgingPoolArtifacts: createPurgingPoolCandidateArtifacts(
      new Map(
        [...purgingPoolAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    hermesShrineArtifacts: createHermesShrineCandidateArtifacts(
      new Map(
        [...hermesShrineAssessments.values()].map(({ origin, assessments }) => {
          const travelDealRefills = hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
          return [
            semanticAddressKey(origin),
            Object.freeze(
              assessments.map((assessment, index) =>
                travelDealRefills?.[index] === undefined
                  ? assessment
                  : Object.freeze({ ...assessment, travelDealRefill: travelDealRefills[index] }),
              ),
            ),
          ] as const;
        }),
      ),
    ),
    stygianWellArtifacts: createStygianWellCandidateArtifacts(
      new Map(
        [...stygianWellAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    traitChildSettlementCheckpoints,
    findingRegions: Object.freeze(immutableFindingRegions),
  });
}

export function evaluateBiomeRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}
