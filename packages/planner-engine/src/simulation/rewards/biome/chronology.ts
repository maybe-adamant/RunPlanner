import type { Catalog } from '../../../catalog-schema';
import { fieldsOptionalRewardCountSupport } from '../../fields-optional-count';
import type { PurgingPoolAssessment } from '../../purging-pool';
import type { HermesShrineCandidateContext } from '../../hermes-shrine';
import {
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createBiomeAddress,
  createTargetAddress,
  createEchoKeepsakeReplayAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TargetAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import type { StygianWellCandidateContext } from '../../stygian-well';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/sea-star';
import type { ResolvedRewardOffer } from '../../../reward-kernel';
import type { HistoryStateView } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import type { CanonicalDecision } from '../../materialization/model';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from '../model';
import {
  createAcquisitionConversionCandidateArtifacts,
  createDerivedAcquisitionEntryCandidateArtifacts,
  createSteadyGrowthCandidateArtifacts,
  createPurgingPoolCandidateArtifacts,
  createHermesShrineCandidateArtifacts,
  createStygianWellCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../../candidate-artifacts';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../../candidates/trait-offer-capability';
import type { TraitOfferCandidateContext } from '../../traits';
import {
  type ReachedSteadyGrowthThreshold,
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../traits';
import {
  createRunState,
  createRunStateDerivationCache,
  publishRunStateThroughCoverage,
  type RunStateSnapshot,
} from '../run-state';
import { createBiomeRewardFacts, visibleStoreOptionNames } from '../facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type ShipLifecycleCandidateContext,
} from '../lifecycle-artifacts';
import { BiomeRewardSimulationContractError } from './biome-contract';
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
import { type AuthoredSiteSettlementResult } from './generation/authored-site-settlement';
import { applyOutgoingGenerationTransition } from './generation/outgoing-generation';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import { applyGorgonStartedTransition } from './encounter-acquisition/gorgon-started';
import { applyEncounterSettlementTransition } from './encounter-acquisition/encounter-settlement';
import {
  applyAcquisitionPointReachedTransition,
  type HermesShrineRefillState,
} from './encounter-acquisition/acquisition-point-reached';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import type { PendingHubBoardGeneration as GenerationPendingHubBoardGeneration } from './generation/emissions';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import {
  publishBiomeRewardEvaluationAssembly,
  type BiomeRewardEvaluationAssembly,
  type TraitChildSettlementCheckpoints,
} from './publication';

import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerFrontier,
} from '../producer-frontiers';
import {
  advanceRewardBranches,
  initializeRewardBranches,
  publicRewardBranch,
  applyExperimentalHammerEquipResult,
  type OfferProcessingPeer,
} from '../processing';
import type { AcquisitionRoleFrontier } from '../acquisition-settlement';
import { addRewardFinding } from '../findings';
import { mergeEquivalentRewardBranches, type RewardBranchState } from '../branch-primitives';
import type { ReachedTraitChildCheckpoint } from '../trait-settlement';
import { rewardFinding } from '../findings';
import {
  assessExperimentalHammerEquipResult,
  applyEchoFigLeafReplay,
  applyEchoCallingCardReplay,
  applyEchoTimePieceReplay,
} from '../../keepsakes';
import { createArcanaFearState } from '../../arcana-fear';
import { createKeepsakeEquipResultAddress } from '../../../authored-project/addresses';
import {
  createJudgmentArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

/**
 * One persistent Ephyra board-generation region. The region starts from the
 * post-Hub-entry reward branches and contains every open physical door,
 * independently from the later six-room visit chronology.
 */
type PendingHubBoardGeneration = GenerationPendingHubBoardGeneration;

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

const rewardFacts = createBiomeRewardFacts;

export function evaluateBiomeRewardChronology(
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
    import('../../candidate-artifacts').JudgmentArcanaCandidateCapability
  >();
  const keepsakeSelectionContexts = new Map<
    string,
    import('../../candidate-artifacts').KeepsakeSelectionCandidateCapability
  >();
  const keepsakeEquipResultContexts = new Map<
    string,
    import('../../candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const acquisitionConversionContexts = new Map<string, readonly AcquisitionRoleFrontier[]>();
  const derivedAcquisitionEntryContexts = new Map<
    string,
    readonly import('../acquisition-settlement').DerivedAcquisitionEntryFrontier[]
  >();
  const figLeafPhaseCandidates = new Map<string, import('../model').FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, import('../model').GorgonPhaseCandidateSupport>();
  const nemesisRandomEventCandidates = new Map<
    string,
    import('../model').NemesisRandomEventCandidateSupport
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
      readonly import('../acquisition-settlement').DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    const incomingByOwner = new Map<
      string,
      import('../acquisition-settlement').DerivedAcquisitionEntryFrontier[]
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
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly PurgingPoolAssessment[];
    }
  >();
  const hermesShrineAssessments = new Map<
    string,
    {
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly HermesShrineCandidateContext[];
    }
  >();
  const stygianWellAssessments = new Map<
    string,
    {
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly StygianWellCandidateContext[];
    }
  >();
  const hermesShrineTravelDealRefills = new Map<
    string,
    readonly import('../../hermes-shrine').HermesShrineTravelDealRefillAssessment[]
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
    for (const entry of result.emissions.findings) {
      const evaluations = entry.levelResolutionEvaluations ?? [];
      if (evaluations.length === 0)
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
      for (const evaluation of evaluations)
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology, evaluation);
    }
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
        const gorgon = applyGorgonStartedTransition({
          catalog,
          event,
          room: room?.kind === 'authored' ? room : undefined,
          view: room === undefined ? undefined : views.get(semanticAddressKey(room.origin)),
          branches,
          evaluationBlocked: gorgonEvaluationBlocked,
        });
        branches = gorgon.branches;
        if (gorgon.candidate !== undefined)
          gorgonPhaseCandidates.set(gorgon.candidate.key, gorgon.candidate.value);
        if (gorgon.eligiblePhaseKey !== undefined)
          eligibleGorgonPhases.add(gorgon.eligiblePhaseKey);
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
        const gorgonPhaseKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
        const gorgonCandidate =
          room?.kind === 'authored'
            ? gorgonPhaseCandidates.get(
                semanticAddressKey(
                  createEncounterPhaseAddress(
                    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                    { kind: 'occurrence', occurrenceId: room.occurrenceId },
                    event.phaseKey,
                  ),
                ),
              )
            : undefined;
        const transition = applyEncounterSettlementTransition({
          catalog,
          snapshot,
          event,
          room,
          view: views.get(semanticAddressKey(event.origin)),
          branches,
          routeLoadout,
          enteredBiomeCount,
          fullRunBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
          gorgonEligible: eligibleGorgonPhases.has(gorgonPhaseKey),
          gorgonCandidate,
          gorgonPhaseBlocked: blockedGorgonPhases.has(gorgonPhaseKey),
          gorgonEvaluationBlocked,
        });
        branches = transition.branches;
        for (const entry of transition.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(transition.roleFrontiers);
        for (const settlement of transition.traitChildSettlements)
          recordTraitChildSettlements(
            Object.freeze([settlement.checkpoint]),
            settlement.occurrenceOwner,
          );
        if (transition.judgmentCandidate !== undefined)
          judgmentArcanaContexts.set(
            transition.judgmentCandidate.key,
            Object.freeze({
              inactiveArcanaKeys: transition.judgmentCandidate.inactiveArcanaKeys,
              requiredCount: transition.judgmentCandidate.requiredCount,
            }),
          );
        if (transition.nemesisCandidate !== undefined)
          nemesisRandomEventCandidates.set(
            transition.nemesisCandidate.key,
            transition.nemesisCandidate.value,
          );
        if (transition.runtimeOfferFallback !== undefined)
          runtimeOfferFallbacks.set(
            transition.runtimeOfferFallback.key,
            Object.freeze({
              address: transition.runtimeOfferFallback.address,
              preferredKey: transition.runtimeOfferFallback.preferredKey,
              fallbackKey: transition.runtimeOfferFallback.fallbackKey,
            }),
          );
        if (transition.blockGorgonPhaseKey !== undefined)
          blockedGorgonPhases.add(transition.blockGorgonPhaseKey);
        gorgonEvaluationBlocked = transition.gorgonEvaluationBlocked;
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
        const sourceRoom = rooms.get(semanticAddressKey(event.origin));
        const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
        const shrineKey = semanticAddressKey(event.origin);
        const refillState: HermesShrineRefillState | undefined = event.point.startsWith(
          'hermesShrinePurchase:',
        )
          ? Object.freeze({
              firstRushedInitialGeneration: firstRushedInitialGenerationByShrine.has(shrineKey),
              refillAssessments: hermesShrineTravelDealRefills.get(shrineKey),
              refillSupported: hermesShrineTravelDealRefillValid.get(shrineKey),
            })
          : undefined;
        const transition = applyAcquisitionPointReachedTransition({
          catalog,
          snapshot,
          event,
          room,
          declaration: room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
          roomView: views.get(semanticAddressKey(event.origin)),
          sourceBranches: branches,
          enteredBiomeCount,
          routeLoadout,
          rewardLookups: rewardLookup.internal,
          authoredSeaStarDuplicateSiteKeys: Object.freeze([...authoredSeaStarDuplicateSiteKeys]),
          purgingPoolAssessment: purgingPoolAssessments.get(shrineKey),
          hermesShrineRefillState: refillState,
        });
        branches = transition.branches;
        for (const entry of transition.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(transition.roleFrontiers);
        if (room !== undefined)
          recordTraitChildSettlements(transition.traitChildSettlements, room.origin);
        for (const fallback of transition.runtimeOfferFallbacks)
          runtimeOfferFallbacks.set(
            semanticAddressKey(fallback.address),
            Object.freeze({
              address: fallback.address,
              preferredKey: fallback.preferredKey,
              fallbackKey: fallback.fallbackKey,
            }),
          );
        if (transition.authoredSiteSettlement !== undefined && room !== undefined)
          applyAuthoredSiteSettlementResult(transition.authoredSiteSettlement, room.origin);
        if (transition.hermesShrineRefillState !== undefined) {
          const next = transition.hermesShrineRefillState;
          if (next.firstRushedInitialGeneration)
            firstRushedInitialGenerationByShrine.add(shrineKey);
          else firstRushedInitialGenerationByShrine.delete(shrineKey);
          if (next.refillAssessments === undefined) hermesShrineTravelDealRefills.delete(shrineKey);
          else hermesShrineTravelDealRefills.set(shrineKey, next.refillAssessments);
          if (next.refillSupported === undefined)
            hermesShrineTravelDealRefillValid.delete(shrineKey);
          else hermesShrineTravelDealRefillValid.set(shrineKey, next.refillSupported);
        }
        break;
      }
      case 'wellPurchase': {
        const transition = applyWellPurchaseTransition({
          catalog,
          snapshot,
          event,
          room: rooms.get(semanticAddressKey(event.origin)),
          branches,
        });
        for (const finding of transition.findings)
          findings.set(findingIdentityKey(finding.finding), finding);
        for (const fallback of transition.runtimeOfferFallbacks)
          runtimeOfferFallbacks.set(
            fallback.key,
            Object.freeze({
              address: fallback.address,
              preferredKey: fallback.preferredKey,
              fallbackKey: fallback.fallbackKey,
            }),
          );
        branches = transition.branches;
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
        if (exited.runStateCheckpoint !== undefined)
          captureRunState(
            exited.runStateCheckpoint.owner,
            exited.runStateCheckpoint.room,
            exited.runStateCheckpoint.view,
          );
        branches = exited.branches;
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
  return publishBiomeRewardEvaluationAssembly({
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
