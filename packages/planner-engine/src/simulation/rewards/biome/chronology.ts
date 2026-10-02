import type { Catalog } from '../../../catalog-schema';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type { PurgingPoolAssessment } from '../../commerce/purging-pool';
import type { HermesShrineCandidateContext } from '../../commerce/hermes-shrine';
import {
  createAcquisitionEntryAddress,
  createTravelDealRefillRealizationAddress,
  createEncounterPhaseAddress,
  createBiomeAddress,
  createHubDecisionAddress,
  createTargetAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type HubRoomAddress,
  type SemanticAddress,
  type TargetAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import type { StygianWellCandidateContext } from '../../commerce/stygian-well';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/acquisition/sea-star';
import { parseHermesShrineDeliveryEntryKey } from '../../../authored-project/hermes-shrine-delivery';
import type { HistoryStateView } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubDecision,
  CanonicalHubRoom,
} from '../../materialization';
import type { CanonicalDecision } from '../../materialization/model';
import { ownerRegion } from '../../finding-regions';
import { bossDoorRewardStoreMissingFinding } from '../../completeness';
import type { RewardBranch, BiomeRewardSimulation } from '../model';
import { createAcquisitionConversionCandidateArtifacts } from '../acquisition/artifacts';
import {
  createDerivedAcquisitionEntryCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../acquisition/artifacts';
import { createSteadyGrowthCandidateArtifacts } from '../../candidates/steady-growth';
import {
  createTranscendentEmbryoCandidateArtifacts,
  createFountainRarityCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';
import { createPurgingPoolCandidateArtifacts } from '../../commerce/purging-pool';
import { createHermesShrineCandidateArtifacts } from '../../commerce/hermes-shrine';
import { createStygianWellCandidateArtifacts } from '../../commerce/stygian-well';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../../candidates/trait-offer/capability';
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
import { addHubBoardRewardLookup } from '../../state/reward-lookups';
import { reachSimulationHistory } from '../../state/transitions';
import {
  normalizeOfferedRewardTypes,
  publishOfferedRewardTypes,
} from '../../state/offered-rewards';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyErisInteractedTransition } from './lifecycle-transitions/eris-interacted';
import { applyFountainUsedTransition } from './lifecycle-transitions/fountain-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import { applyEchoKeepsakeReplayTransition } from './lifecycle-transitions/echo-keepsake-replay';
import {
  createChronologyAccumulator,
  generationFindings,
  lifecycleFindings,
  mergedFindings,
  settledFindings,
  type ChronologyEmission,
} from './chronology-accumulator';
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

import { createRewardProducerCandidateArtifacts } from '../producer-frontiers';
import {
  advanceRewardBranches,
  initializeRewardBranches,
  publicRewardBranch,
} from '../branch-lifecycle';
import type { OfferProcessingPeer } from '../offer-generation';
import { resourcePlacementFindingRegions } from '../../resources';
import { mergeEquivalentRewardBranches, type RewardBranchState } from '../branch-primitives';
import { rewardFinding } from '../findings';
import { assessAuthoredBossDoorRewardStore } from './reward-store-support';
import type { WellRefillRealization } from '../model';
import { createArcanaFearState } from '../../arcana-fear';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

/**
 * One persistent Ephyra board-generation region. The region starts from the
 * post-Hub-entry reward branches and contains every open physical door,
 * independently from the later six-room visit chronology.
 */
type PendingHubBoardGeneration = GenerationPendingHubBoardGeneration;

/** Ordered accumulator writes for one authored-site settlement. */
function siteSettlementEmissions(
  result: AuthoredSiteSettlementResult,
  occurrenceOwner: SemanticAddress,
): readonly ChronologyEmission[] {
  return [
    {
      kind: 'findings',
      rule: 'add',
      entries: result.emissions.findings.flatMap((entry) => {
        const evaluations = entry.levelResolutionEvaluations ?? [];
        const added = {
          finding: entry.finding,
          atomicRegion: entry.atomicRegion,
          chronology: entry.chronology,
        };
        return evaluations.length === 0
          ? [added]
          : evaluations.map((evaluation) => ({ ...added, levelResolutionEvaluation: evaluation }));
      }),
    },
    { kind: 'acquisitionRoleFrontiers', frontiers: result.emissions.acquisitionRoleFrontiers },
    { kind: 'timelineFacts', facts: result.emissions.timelineFacts },
    {
      kind: 'derivedAcquisitionEntryFrontiers',
      frontiers: result.emissions.derivedEntryFrontiers,
    },
    {
      kind: 'traitChildSettlements',
      checkpoints: result.emissions.traitChildSettlements,
      occurrenceOwner,
    },
    { kind: 'producerFrontiers', frontiers: result.producerFrontiers },
  ];
}

const rewardFacts = createBiomeRewardFacts;

export function evaluateBiomeRewardChronology(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
  resourceFindings: readonly import('../../model').SemanticFinding[] = [],
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const enteredBiomeCount = routePosition.ordinal;
  const fullRunBiomeCount = routePosition.itineraryBiomeKeys.length;
  const prepared = prepareRewardEvaluationInputs(catalog, snapshot, history);
  const { layout, rooms, views, targets, additionalContinuations, hubTargetByOrigin, lifecycle } =
    prepared;
  const authoredSeaStarDuplicateSiteKeys = new Set(
    [...rooms.values()].flatMap((room) =>
      room.kind === 'authored'
        ? Object.keys(room.acquisitionSites).filter(
            (siteKey) => parseSeaStarDuplicateSiteKey(siteKey) !== undefined,
          )
        : [],
    ),
  );
  const chaosGateSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'chaos' ? [continuation.origin.occurrenceId] : [],
    ),
  );
  const ixionGeneratedChaosSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'chaos' && continuation.chaosOrigin !== undefined
        ? [continuation.origin.occurrenceId]
        : [],
    ),
  );
  const batchesByParent = prepared.batchesByParent;
  const accumulator = createChronologyAccumulator(rooms);
  const blockedGorgonPhases = new Set<string>();
  let gorgonEvaluationBlocked = false;
  const eligibleGorgonPhases = new Set<string>();

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
  const targetGenerationByParent = new Map<string, TargetGenerationFrontier>();
  const wellRefillRealizations = new Map<string, WellRefillRealization>();
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
    readonly import('../../commerce/hermes-shrine').HermesShrineTravelDealRefillAssessment[]
  >();
  const hermesShrineTravelDealRefillValid = new Map<string, boolean>();
  // The handler's FirstSpeedUpPurchase guard belongs to the Shrine room, not
  // to a branch.  We still require Travel Deal to agree across every branch
  // at that first action prefix before publishing a refill generation.
  const firstRushedInitialGenerationByShrine = new Set<string>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
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
    routeLoadout.startingKeepsakeKey,
    routeLoadout.keepsakeEquipResults,
    snapshot.routeKey,
    routeLoadout,
    { routePosition, historyView: history.biomeStart },
  );
  const echoReplay = applyEchoKeepsakeReplayTransition(
    catalog,
    snapshot,
    routePosition,
    routeLoadout,
    branches,
    history.events[0]?.sequence ?? 0,
  );
  branches = echoReplay.branches;
  accumulator.mergeEmissions([
    {
      kind: 'keepsakeEquipResultCandidates',
      candidates: echoReplay.keepsakeEquipResultCandidates,
    },
    lifecycleFindings(echoReplay.findings),
    { kind: 'timelineFacts', facts: echoReplay.timelineFacts },
    { kind: 'echoKeepsakeReplayOutcome', outcome: echoReplay.outcome },
  ]);
  let pendingHubBoard: PendingHubBoardGeneration | undefined;
  // A Hub interval ends at its departure: Hub exit or a visit's return, then any fountain use.
  const recordHubDeparture = (origin: HubRoomAddress, sequence: number, replace: boolean) => {
    const room = rooms.get(semanticAddressKey(origin));
    const view = history.viewsBySequence[sequence];
    if (room?.kind !== 'hub' || view === undefined || branches.length === 0) return;
    const hub = createHubDecisionAddress(
      createBiomeAddress(origin.routeKey, origin.biomeKey),
      origin.hubKey,
    );
    const departure = runStateAt(hub, room, view)(branches);
    if (departure === undefined) return;
    accumulator.mergeEmissions([
      { kind: 'hubDeparture', hub, hubGameName: room.gameName, departure, replace },
    ]);
  };
  const runStateDerivationCache = createRunStateDerivationCache();

  function runStateAt(
    owner: RunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
  ) {
    const declaration = routeRoomDeclaration(
      catalog.rooms.byKey[source.gameName],
      source.origin.routeKey,
    );
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
    // declaration, immutable view, shop names and peer context. Branch-varying
    // facts have separate cache identities, and the reached route position
    // travels inside each snapshot. This token cannot alias a later checkpoint
    // even when it retains the same history.
    const factsContextToken = Object.freeze({});
    const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
      createRunState({
        catalog,
        layout,
        owner,
        states: checkpointBranches.map((branch) =>
          reachSimulationHistory(branch.state, routePosition, view),
        ),
        derivationCache: runStateDerivationCache,
        factsContextToken,
        rewardFacts: (state) =>
          rewardFacts({
            catalog,
            state,
            source,
            currentRoom: source,
            sourceDeclaration: declaration,
            view,
            currentRoomShopOptionNames: currentShopNames,
            peerParentOrigin: source.origin,
            peerCreationSource: 'generatedTarget',
            hubBoardLookups: 'consulted',
          }),
      });
    return snapshotFor;
  }

  function captureRunState(
    owner: RunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): void {
    const ownerKey = semanticAddressKey(owner);
    if (accumulator.hasRunStateSnapshot(ownerKey) || branches.length === 0) return;
    const snapshotFor = runStateAt(owner, source, view);
    const snapshot = snapshotFor(checkpointBranches);
    if (snapshot !== undefined)
      accumulator.mergeEmissions([{ kind: 'runStateSnapshot', ownerKey, snapshot }]);
    // Trait-child candidate checkpoints retain only generation snapshots. Room
    // lifecycle diagnostics are occurrence-local and never become a later
    // candidate-generation authority.
    if (owner.kind === 'roomRunStateCheckpoint') return;
    for (const checkpoint of accumulator.traitChildCheckpointsAwaiting(source.origin, ownerKey)) {
      const checkpointSnapshot = snapshotFor(checkpoint.branches);
      if (checkpointSnapshot !== undefined)
        accumulator.mergeEmissions([
          {
            kind: 'traitChildRunStateSnapshot',
            childKey: checkpoint.key,
            ownerKey,
            snapshot: checkpointSnapshot,
          },
        ]);
    }
  }

  function targetSlotHistory(
    origin: TargetAddress,
    historySequence: number,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): readonly ChronologyEmission[] {
    if (checkpointBranches.length === 0) {
      return [];
    }
    const view = history.viewsBySequence[historySequence];
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(
        `No history view for target checkpoint ${historySequence}`,
      );
    }
    return [
      {
        kind: 'targetHistory',
        checkpoint: Object.freeze({
          origin,
          historySequence,
          states: Object.freeze(
            checkpointBranches.map((branch) =>
              reachSimulationHistory(branch.state, routePosition, view),
            ),
          ),
        }),
      },
    ];
  }

  function blankFrontierTargetHistory(): readonly ChronologyEmission[] {
    const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
    if (frontier?.kind !== 'exitDecision' || frontier.parent.origin.kind !== 'occurrence') {
      return [];
    }
    const source = rooms.get(semanticAddressKey(frontier.parent.origin));
    const declaration =
      source === undefined
        ? undefined
        : routeRoomDeclaration(catalog.rooms.byKey[source.gameName], source.origin.routeKey);
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
      return [];
    }
    const origin = createTargetAddress(
      createBiomeAddress(frontier.origin.routeKey, frontier.origin.biomeKey),
      frontier.origin.source,
      nextExitKey,
    );
    return accumulator.hasTargetHistory(semanticAddressKey(origin))
      ? []
      : targetSlotHistory(origin, historySequence);
  }

  function flushPendingHubBoard(): void {
    const flushed = flushHubBoard(catalog, pendingHubBoard);
    if (flushed === undefined) return;
    if (
      layout.progression.kind === 'hub' &&
      pendingHubBoard !== undefined &&
      flushed.peers.length === pendingHubBoard.participants.length &&
      flushed.branches.length > 0
    ) {
      const lookupKey = layout.progression.rewardLookup.key;
      branches = Object.freeze(
        flushed.branches.map((branch) =>
          Object.freeze({
            ...branch,
            state: addHubBoardRewardLookup(
              branch.state,
              lookupKey,
              flushed.peers.map((peer) => peer.offer.rewardType),
            ),
          }),
        ),
      );
    } else {
      branches = flushed.branches;
    }
    peers = flushed.peers;
    accumulator.mergeEmissions([
      generationFindings(flushed.findings),
      { kind: 'producerFrontiers', frontiers: flushed.producerFrontiers },
    ]);
    pendingHubBoard = undefined;
  }

  function reachHistorySequence(sequence: number): void {
    const view = history.viewsBySequence[sequence];
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(`No history view for event ${sequence}`);
    }
    branches = Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: reachSimulationHistory(branch.state, routePosition, view),
        }),
      ),
    );
  }

  historyEvents: for (const event of history.events) {
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
        accumulator.mergeEmissions([
          { kind: 'figLeafPhaseCandidates', candidates: figLeafTransition.figLeafCandidates },
          lifecycleFindings(figLeafTransition.findings),
        ]);
        const gorgon = applyGorgonStartedTransition({
          catalog,
          event,
          room: room?.kind === 'authored' ? room : undefined,
          view: room === undefined ? undefined : views.get(semanticAddressKey(room.origin)),
          branches,
          evaluationBlocked: gorgonEvaluationBlocked,
        });
        branches = gorgon.branches;
        accumulator.mergeEmissions([
          ...(gorgon.candidate === undefined
            ? []
            : [
                {
                  kind: 'gorgonPhaseCandidate' as const,
                  key: gorgon.candidate.key,
                  candidate: gorgon.candidate.value,
                },
              ]),
          lifecycleFindings(gorgon.findings),
        ]);
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
          chaosGateSourceOccurrenceIds,
          ixionGeneratedChaosSourceOccurrenceIds,
          branches,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin as CanonicalAuthoredRoom['origin'],
            event.sequence,
            'localRoomLifecycle',
          ),
          routePosition,
          Object.freeze({
            hermesShrine:
              room?.kind === 'authored' &&
              hermesShrineAssessments.has(semanticAddressKey(room.origin)),
            stygianWell:
              room?.kind === 'authored' &&
              stygianWellAssessments.has(semanticAddressKey(room.origin)),
          }),
        );
        branches = entered.branches;
        accumulator.mergeEmissions([
          lifecycleFindings(entered.findings),
          {
            kind: 'derivedAcquisitionEntryFrontiers',
            frontiers: entered.derivedAcquisitionEntryFrontiers,
          },
        ]);
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
        if (entered.hermesShrineDeliveryPlacementRequired) {
          reachHistorySequence(event.sequence);
          break historyEvents;
        }
        break;
      }
      case 'roomPrepared': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyRoomPreparedTransition(
          catalog,
          snapshot,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        accumulator.mergeEmissions([lifecycleFindings(transition.findings)]);
        branches = transition.branches;
        break;
      }
      case 'keepsakeRackUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyKeepsakeRackUsedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin))?.entry,
          routeLoadout,
          branches,
          enteredBiomeCount + 1,
        );
        branches = transition.branches;
        accumulator.mergeEmissions([
          { kind: 'timelineFacts', facts: transition.timelineFacts },
          ...(transition.keepsakeSelectionCandidate === undefined
            ? []
            : [
                {
                  kind: 'keepsakeSelectionCandidate' as const,
                  key: transition.keepsakeSelectionCandidate.key,
                  candidate: transition.keepsakeSelectionCandidate.candidate,
                },
              ]),
          {
            kind: 'keepsakeEquipResultCandidates',
            candidates: transition.keepsakeEquipResultCandidates,
          },
          lifecycleFindings(transition.findings),
        ]);
        break;
      }
      case 'erisInteracted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyErisInteractedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        branches = transition.branches;
        accumulator.mergeEmissions([lifecycleFindings(transition.findings)]);
        break;
      }
      case 'fountainUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const owner = event.owner;
        const transition = applyFountainUsedTransition(
          catalog,
          event,
          owner.kind === 'hubFountain'
            ? snapshot.decisions.find(
                (decision): decision is CanonicalHubDecision =>
                  decision.kind === 'hub' && decision.origin.hubKey === owner.hubKey,
              )?.fountain?.fountainRarityResult
            : room?.kind === 'authored'
              ? room.fountainRarityResult
              : undefined,
          branches,
          room?.kind === 'authored' ? room : undefined,
        );
        branches = transition.branches;
        if (transition.purgingPoolAssessment !== undefined)
          purgingPoolAssessments.set(
            transition.purgingPoolAssessment.key,
            transition.purgingPoolAssessment.value,
          );
        accumulator.mergeEmissions([
          { kind: 'timelineFacts', facts: transition.timelineFacts },
          ...(transition.candidate === undefined
            ? []
            : [
                {
                  kind: 'fountainRarityCandidate' as const,
                  key: transition.candidate.key,
                  candidate: transition.candidate.value,
                },
              ]),
          lifecycleFindings(transition.findings),
        ]);
        break;
      }
      case 'roomCreated': {
        accumulator.mergeEmissions([
          mergedFindings(resourcePlacementFindingRegions(event, resourceFindings)),
        ]);
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
          enteredBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
        });
        if (transition.keepsakeSelectionCandidate !== undefined)
          accumulator.mergeEmissions([
            {
              kind: 'keepsakeSelectionCandidate',
              key: transition.keepsakeSelectionCandidate.key,
              candidate: transition.keepsakeSelectionCandidate.candidate,
            },
          ]);
        if (transition.hubRunStateCheckpoint !== undefined)
          captureRunState(
            transition.hubRunStateCheckpoint.owner,
            transition.hubRunStateCheckpoint.source,
            transition.hubRunStateCheckpoint.view,
          );
        accumulator.mergeEmissions([
          generationFindings(transition.findings),
          { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
        ]);
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
          accumulator.mergeEmissions(
            targetSlotHistory(transition.nextTargetHistory, event.sequence),
          );
        branches = advanceRewardBranches(branches, event.sequence);
        // The game rebuilds its offered-reward set once, when the whole batch
        // has rooms and its exits unlock. The completed batch's own generated
        // offers are that set, so nothing reconstructs the rule here: the last
        // generated target simply publishes the peers this batch produced.
        //
        // Only ordinary exit batches publish. Hub slot and local visit slot
        // generations, the hub handoff batch and declaration-fixed room links
        // are deliberately excluded: the hub board has its own run-persistent
        // lookup with a different lifetime, and a fixed link reaches its target
        // without an offered door batch. Extra exits (Chaos gate, Zagreus
        // contract) are created at the parent's entry, so their offers are
        // already flushed from `peers` by this batch's outgoing checkpoint;
        // the game does count those doors, which is a recorded fidelity gap
        // rather than a behavior difference, since no such room offers a type
        // any inventory entry currently consults.
        if (
          event.origin.kind === 'target' &&
          targetGeneration !== undefined &&
          transition.nextTargetHistory === undefined &&
          targetGeneration.exitKeys.at(-1) === event.origin.exitKey
        ) {
          // Normalized once for the whole cohort: every branch of one batch
          // shares the same offered set and therefore the same frozen array.
          const offeredRewardTypes = normalizeOfferedRewardTypes(
            peers.map((peer) => peer.offer.rewardType),
          );
          branches = Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                ...branch,
                state: publishOfferedRewardTypes(branch.state, offeredRewardTypes),
              }),
            ),
          );
        }
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        const ownerKey = semanticAddressKey(event.origin);
        const source = rooms.get(ownerKey);
        const sourceViews = views.get(ownerKey);
        const declaration =
          source === undefined
            ? undefined
            : routeRoomDeclaration(catalog.rooms.byKey[source.gameName], source.origin.routeKey);
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
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const settlement of transition.siteSettlements)
          accumulator.mergeEmissions(
            siteSettlementEmissions(settlement, source?.origin ?? event.origin),
          );
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
          accumulator.mergeEmissions(
            targetSlotHistory(
              transition.targetHistoryCheckpoint.origin,
              transition.targetHistoryCheckpoint.historySequence,
              transition.targetHistoryCheckpoint.branches,
            ),
          );
        for (const entry of transition.expectedStores)
          expectedStores.set(entry.targetKey, entry.storeKey);
        accumulator.mergeEmissions([
          { kind: 'storeSupport', entries: transition.storeSupportEntries },
          generationFindings(transition.findings),
        ]);
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
          routeLoadout,
          authoredSeaStarDuplicateSiteKeys,
          shipLifecycleCandidateAlreadyPublished: shipLifecycleContexts.has(roomKey),
        });
        accumulator.mergeEmissions([
          generationFindings(transition.findings),
          { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
        ]);
        if (transition.shipLifecycleCandidate !== undefined)
          shipLifecycleContexts.set(roomKey, transition.shipLifecycleCandidate);
        branches = transition.branches;
        break;
      }
      case 'offerPointAcquired':
      case 'producerRoleAdvanced': {
        const settlement = applyReachedOfferSettlement({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          branches,
          priorFindings: accumulator.findingEntries(),
          authoredSeaStarDuplicateSiteKeys,
        });
        accumulator.mergeEmissions([
          settledFindings(settlement.findings),
          { kind: 'acquisitionRoleFrontiers', frontiers: settlement.roleFrontiers },
          {
            kind: 'traitChildSettlements',
            checkpoints: settlement.traitChildSettlements,
            occurrenceOwner: settlement.traitChildOccurrenceOwner,
          },
        ]);
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
            ? accumulator.gorgonPhaseCandidate(
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
          routePosition,
          event,
          room,
          view: views.get(semanticAddressKey(event.origin)),
          branches,
          enteredBiomeCount,
          fullRunBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
          gorgonEligible: eligibleGorgonPhases.has(gorgonPhaseKey),
          gorgonCandidate,
          gorgonPhaseBlocked: blockedGorgonPhases.has(gorgonPhaseKey),
          gorgonEvaluationBlocked,
        });
        branches = transition.branches;
        accumulator.mergeEmissions([
          settledFindings(transition.findings),
          { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
          {
            kind: 'traitOfferCandidateContacts',
            contacts: transition.traitOfferCandidateContacts,
          },
          ...transition.traitChildSettlements.map((settlement) => ({
            kind: 'traitChildSettlements' as const,
            checkpoints: Object.freeze([settlement.checkpoint]),
            occurrenceOwner: settlement.occurrenceOwner,
          })),
          ...(transition.judgmentCandidate === undefined
            ? []
            : [
                {
                  kind: 'judgmentArcanaCandidate' as const,
                  key: transition.judgmentCandidate.key,
                  candidate: Object.freeze({
                    activeArcanaKeys: transition.judgmentCandidate.activeArcanaKeys,
                    activeArcana: transition.judgmentCandidate.activeArcana,
                    inactiveArcanaKeys: transition.judgmentCandidate.inactiveArcanaKeys,
                    requiredCount: transition.judgmentCandidate.requiredCount,
                  }),
                },
              ]),
          ...(transition.figurineCandidate === undefined
            ? []
            : [
                {
                  kind: 'figurineArcanaCandidate' as const,
                  key: transition.figurineCandidate.key,
                  candidate: Object.freeze({
                    activeArcanaKeys: transition.figurineCandidate.activeArcanaKeys,
                    activeArcana: transition.figurineCandidate.activeArcana,
                    inactiveArcanaKeys: transition.figurineCandidate.inactiveArcanaKeys,
                    requiredCount: transition.figurineCandidate.requiredCount,
                    rarity: transition.figurineCandidate.rarity,
                  }),
                },
              ]),
          ...(transition.nemesisCandidate === undefined
            ? []
            : [
                {
                  kind: 'nemesisRandomEventCandidate' as const,
                  key: transition.nemesisCandidate.key,
                  candidate: transition.nemesisCandidate.value,
                },
              ]),
          { kind: 'bossArcanaOutcomes', outcomes: transition.bossArcanaOutcomes ?? [] },
          { kind: 'timelineFacts', facts: transition.timelineFacts },
        ]);
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
          branches,
        );
        branches = transition.branches;
        accumulator.mergeEmissions([
          { kind: 'timelineFacts', facts: transition.timelineFacts },
          {
            kind: 'derivedAcquisitionEntryFrontiers',
            frontiers: transition.derivedAcquisitionEntryFrontiers,
          },
          { kind: 'steadyGrowthThresholds', thresholds: transition.steadyGrowthThresholds },
          {
            kind: 'transcendentEmbryoThresholds',
            thresholds: transition.transcendentEmbryoThresholds,
          },
          {
            kind: 'traitChildSettlements',
            checkpoints: transition.traitChildSettlements,
            occurrenceOwner: event.origin,
          },
          lifecycleFindings(transition.findings),
        ]);
        if (transition.hermesShrineDeliveryPlacementRequired) {
          reachHistorySequence(event.sequence);
          break historyEvents;
        }
        break;
      }
      case 'hermesShrineDeliveriesScheduled': {
        const sourceRoom = rooms.get(semanticAddressKey(event.origin));
        const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
        const transition = applyAcquisitionPointReachedTransition({
          catalog,
          snapshot,
          event,
          room,
          declaration:
            room === undefined
              ? undefined
              : routeRoomDeclaration(catalog.rooms.byKey[room.gameName], room.origin.routeKey),
          roomView: views.get(semanticAddressKey(event.origin)),
          sourceBranches: branches,
          authoredSeaStarDuplicateSiteKeys: Object.freeze([...authoredSeaStarDuplicateSiteKeys]),
          purgingPoolAssessment: undefined,
          hermesShrineRefillState: undefined,
        });
        branches = transition.branches;
        accumulator.mergeEmissions([
          settledFindings(transition.findings),
          { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
          { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
          { kind: 'timelineFacts', facts: transition.timelineFacts },
          ...(room === undefined
            ? []
            : [
                {
                  kind: 'traitChildSettlements' as const,
                  checkpoints: transition.traitChildSettlements,
                  occurrenceOwner: room.origin,
                },
              ]),
        ]);
        break;
      }
      case 'acquisitionPointReached': {
        const sourceRoom = rooms.get(semanticAddressKey(event.origin));
        const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
        if (room !== undefined && event.point.startsWith('purgingPool:')) {
          const poolSlot = event.point.slice('purgingPool:'.length);
          const poolRow = room.roomActionRoster.rows.find(
            (row) =>
              !row.stale &&
              row.rank !== null &&
              row.reference.kind === 'sellPurgingPoolTrait' &&
              row.reference.slotKey === poolSlot,
          );
          if (poolRow !== undefined)
            accumulator.mergeEmissions([
              {
                kind: 'timelineFacts',
                facts: { nodes: [{ owner: poolRow.owner, included: true }] },
              },
            ]);
        }
        const deliverySource =
          event.siteKey === 'hermesShrineDelivery' && event.entryKey !== undefined
            ? parseHermesShrineDeliveryEntryKey(event.entryKey)
            : undefined;
        const shrineKey =
          deliverySource === undefined
            ? semanticAddressKey(event.origin)
            : semanticAddressKey({
                kind: 'occurrence' as const,
                routeKey: deliverySource.routeKey,
                biomeKey: deliverySource.biomeKey,
                occurrenceId: deliverySource.sourceOccurrenceId,
              });
        const refillState: HermesShrineRefillState | undefined =
          deliverySource === undefined
            ? undefined
            : Object.freeze({
                firstRushedInitialGeneration: firstRushedInitialGenerationByShrine.has(shrineKey),
                refillAssessments: hermesShrineTravelDealRefills.get(shrineKey),
                refillSupported: hermesShrineTravelDealRefillValid.get(shrineKey),
              });
        const derivedSite =
          event.siteKey === undefined || room === undefined
            ? undefined
            : room.acquisitionSites[event.siteKey]?.address;
        const derivedCapability =
          derivedSite === undefined || event.entryKey === undefined
            ? undefined
            : attestDerivedAcquisitionEntryCandidateCapability(
                accumulator.derivedAcquisitionEntryFrontiers(
                  semanticAddressKey(createAcquisitionEntryAddress(derivedSite, event.entryKey)),
                ),
              );
        const transition = applyAcquisitionPointReachedTransition({
          catalog,
          snapshot,
          event,
          room,
          declaration:
            room === undefined
              ? undefined
              : routeRoomDeclaration(catalog.rooms.byKey[room.gameName], room.origin.routeKey),
          roomView: views.get(semanticAddressKey(event.origin)),
          sourceBranches: branches,
          authoredSeaStarDuplicateSiteKeys: Object.freeze([...authoredSeaStarDuplicateSiteKeys]),
          purgingPoolAssessment: purgingPoolAssessments.get(shrineKey),
          hermesShrineRefillState: refillState,
          ...(derivedCapability === undefined
            ? {}
            : { derivedAcquisitionEntryCapability: derivedCapability }),
        });
        branches = transition.branches;
        accumulator.mergeEmissions([
          settledFindings(transition.findings),
          { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
          { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
          { kind: 'timelineFacts', facts: transition.timelineFacts },
          ...(room === undefined
            ? []
            : [
                {
                  kind: 'traitChildSettlements' as const,
                  checkpoints: transition.traitChildSettlements,
                  occurrenceOwner: room.origin,
                },
              ]),
        ]);
        if (transition.authoredSiteSettlement !== undefined && room !== undefined)
          accumulator.mergeEmissions(
            siteSettlementEmissions(transition.authoredSiteSettlement, room.origin),
          );
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
        const wellRoom = rooms.get(semanticAddressKey(event.origin));
        const wellOrigin = wellRoom?.kind === 'authored' ? wellRoom.origin : undefined;
        const transition = applyWellPurchaseTransition({
          catalog,
          snapshot,
          event,
          room: wellRoom,
          branches,
          refillGenerationSupported:
            wellOrigin !== undefined &&
            wellRefillRealizations.has(
              semanticAddressKey(
                createTravelDealRefillRealizationAddress(
                  createBiomeAddress(wellOrigin.routeKey, wellOrigin.biomeKey),
                  wellOrigin.occurrenceId,
                ),
              ),
            ),
        });
        branches = transition.branches;
        accumulator.mergeEmissions([
          settledFindings(transition.findings),
          { kind: 'timelineFacts', facts: transition.timelineFacts },
        ]);
        if (transition.candidateContexts.length > 0 && wellRoom?.kind === 'authored') {
          const key = semanticAddressKey(event.origin);
          const existing = stygianWellAssessments.get(key);
          stygianWellAssessments.set(
            key,
            Object.freeze({
              origin: wellRoom.origin,
              assessments: Object.freeze([
                ...(existing?.assessments ?? []),
                ...transition.candidateContexts,
              ]),
            }),
          );
        }
        if (transition.refillRealization !== undefined)
          wellRefillRealizations.set(
            semanticAddressKey(transition.refillRealization.owner),
            transition.refillRealization,
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
          resourceFindings,
        );
        if (exited.runStateCheckpoint !== undefined)
          captureRunState(
            exited.runStateCheckpoint.owner,
            exited.runStateCheckpoint.room,
            exited.runStateCheckpoint.view,
          );
        branches = exited.branches;
        accumulator.mergeEmissions([mergedFindings(exited.findingRegions)]);
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
    if (event.origin?.kind === 'hubRoom') {
      if (
        event.kind === 'roomExited' ||
        (event.kind === 'roomRestored' && event.restoreKind === 'hub')
      )
        recordHubDeparture(event.origin, event.sequence, false);
      else if (event.kind === 'fountainUsed')
        recordHubDeparture(event.origin, event.sequence, true);
    }
    reachHistorySequence(event.sequence);
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

  // A boss-door store is not an outgoing batch — the source room owns no exit
  // decision — so it never reaches the outgoing-generation assessment. It is
  // reached here at that room's exit boundary, before the boss and everything
  // the boss leads to: unauthored it is the required input at that position,
  // authored it raises `baseRewardStoreUnavailable` against the same controller
  // as an ordinary batch and the selector reads real support.
  for (const link of snapshot.fixedRoomLinks ?? []) {
    const door = link.bossDoorRewardStore;
    if (door === undefined) continue;
    const sourceViews = views.get(semanticAddressKey(link.source.origin));
    const view = sourceViews?.exit ?? sourceViews?.postCommit;
    if (view === undefined) continue;
    if (door.storeKey === undefined) {
      // Identical to the completeness pass's copy so the two collapse by
      // finding identity once both reach the published findings.
      accumulator.mergeEmissions([
        {
          kind: 'findings',
          rule: 'add',
          entries: [
            {
              finding: bossDoorRewardStoreMissingFinding(door.origin, link.target.gameName),
              atomicRegion: ownerRegion(door.origin),
              chronology: { kind: 'history', sequence: view.sequence, boundary: 'at' },
            },
          ],
        },
      ]);
      continue;
    }
    const support = assessAuthoredBossDoorRewardStore(
      layout,
      door.origin,
      door.storeKey,
      view,
      view.sequence + 1,
    );
    accumulator.mergeEmissions([
      { kind: 'storeSupport', entries: [support] },
      ...(support.selectedPossible
        ? []
        : [
            {
              kind: 'findings' as const,
              rule: 'add' as const,
              entries: [
                {
                  finding: rewardFinding('baseRewardStoreUnavailable', support.origin, {
                    authoredStoreKey: support.authoredStoreKey,
                    enteredStoreCount: support.enteredStoreCount,
                    enteredMetaStoreCount: support.enteredMetaStoreCount,
                    currentMetaRatio: support.currentMetaRatio,
                    metaSelectionValue: support.metaSelectionValue,
                    supportStoreKeys: support.supportStoreKeys,
                  }),
                  atomicRegion: ownerRegion(support.origin),
                  chronology: {
                    kind: 'history' as const,
                    sequence: view.sequence,
                    boundary: 'at' as const,
                  },
                },
              ],
            },
          ]),
    ]);
  }

  accumulator.mergeEmissions(blankFrontierTargetHistory());
  const accumulation = accumulator.finish();
  const immutableFindingRegions = accumulation.findingRegions;
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
    catalog,
  );
  const traitCandidateContexts = new Map(traitProducts.candidateContexts);
  for (const [key, contexts] of accumulation.reachedTraitOfferCandidateContexts) {
    if (!traitCandidateContexts.has(key))
      traitCandidateContexts.set(key, Object.freeze([...contexts]));
  }
  for (const [childKey, checkpoint] of accumulation.traitChildSettlements) {
    if (checkpoint.candidateContexts.length === 0) continue;
    const key =
      checkpoint.address.kind === 'traitAcquisitionTarget' ||
      checkpoint.address.kind === 'allTogetherSet'
        ? semanticAddressKey(checkpoint.address.trait)
        : childKey;
    traitCandidateContexts.set(
      key,
      Object.freeze([...(traitCandidateContexts.get(key) ?? []), ...checkpoint.candidateContexts]),
    );
  }
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...accumulation.runStateSnapshots].sort((left, right) => {
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
    [...accumulation.traitChildSettlements].map(([key, checkpoint]) =>
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
  const publishedHermesShrineAssessments = Object.freeze(
    [...hermesShrineAssessments.values()].map(({ origin, assessments }) => {
      const travelDealRefills = hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
      return Object.freeze({
        origin,
        assessments: Object.freeze(
          assessments.map((assessment, index) =>
            travelDealRefills?.[index] === undefined
              ? assessment
              : Object.freeze({ ...assessment, travelDealRefill: travelDealRefills[index] }),
          ),
        ),
      });
    }),
  );
  const simulation: BiomeRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    ...(accumulation.echoKeepsakeReplayOutcome === undefined
      ? {}
      : { volatileEchoKeepsakeReplay: accumulation.echoKeepsakeReplayOutcome }),
    timelineFacts: accumulation.timelineFacts,
    wellRefillRealizations: Object.freeze([...wellRefillRealizations.values()]),
    bossArcanaOutcomes: accumulation.bossArcanaOutcomes,
    storeSupport: accumulation.storeSupport,
    targetHistory: accumulation.targetHistory,
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    hubDepartures: accumulation.hubDepartures,
    purgingPoolAssessments: Object.freeze([...purgingPoolAssessments.values()]),
    hermesShrineAssessments: publishedHermesShrineAssessments,
    stygianWellAssessments: Object.freeze([...stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        branches
          .flatMap((branch) => Object.values(branch.state.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.sourceKey,
                Object.freeze({
                  sourceKey: delivery.sourceKey,
                  sourceOrigin: delivery.sourceOrigin,
                  rewardType: delivery.rewardType,
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
    figLeafPhaseCandidates: accumulation.figLeafPhaseCandidates,
    gorgonPhaseCandidates: accumulation.gorgonPhaseCandidates,
    nemesisRandomEventCandidates: accumulation.nemesisRandomEventCandidates,
    steadyGrowthOutcomes: Object.freeze(
      [...accumulation.steadyGrowthCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = accumulation.steadyGrowthOutcomeAddresses.get(key);
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
    transcendentEmbryoOutcomes: Object.freeze(
      [...accumulation.transcendentEmbryoCandidateContexts.entries()].flatMap(
        ([key, thresholds]) => {
          const address = accumulation.transcendentEmbryoOutcomeAddresses.get(key);
          const first = thresholds[0];
          if (address === undefined || first === undefined) return [];
          return [
            Object.freeze({
              address,
              sourceBlessingKey: first.source.markedBlessingKey,
              phaseKey: address.phaseKey,
              transformationRarities: Object.freeze(
                thresholds.map((threshold) => threshold.source.rarity),
              ),
              progressBefore: Object.freeze(
                thresholds.map((threshold) => threshold.source.progress),
              ),
            }),
          ];
        },
      ),
    ),
    derivedAcquisitionEntries: Object.freeze(
      [...accumulation.derivedAcquisitionEntryContexts.values()].flatMap((frontiers) => {
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
    producerArtifacts: createRewardProducerCandidateArtifacts(accumulation.producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(shipLifecycleContexts),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContexts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(
      accumulation.judgmentArcanaContexts,
    ),
    figurineArcanaArtifacts: createFigurineArcanaCandidateArtifacts(
      accumulation.figurineArcanaContexts,
    ),
    keepsakeSelectionArtifacts: createKeepsakeSelectionCandidateArtifacts(
      accumulation.keepsakeSelectionContexts,
    ),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      accumulation.keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      accumulation.acquisitionConversionContexts,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      accumulation.derivedAcquisitionEntryContexts,
    ),
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      accumulation.steadyGrowthCandidateContexts,
    ),
    transcendentEmbryoArtifacts: createTranscendentEmbryoCandidateArtifacts(
      catalog,
      accumulation.transcendentEmbryoCandidateContexts,
    ),
    fountainRarityArtifacts: createFountainRarityCandidateArtifacts(
      accumulation.fountainRarityCandidateContexts,
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
        publishedHermesShrineAssessments.map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
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
