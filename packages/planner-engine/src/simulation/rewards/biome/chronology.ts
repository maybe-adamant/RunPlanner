import type { Catalog } from '../../../catalog-schema';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createTargetAddress,
  semanticAddressKey,
  type HubRoomAddress,
  type SemanticAddress,
  type TargetAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/acquisition/sea-star';
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
import { reachSimulationHistory } from '../../state/transitions';
import { applyFountainUsedTransition } from './lifecycle-transitions/fountain-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import { applyEchoKeepsakeReplayTransition } from './lifecycle-transitions/echo-keepsake-replay';
import {
  createChronologyAccumulator,
  generationFindings,
  lifecycleFindings,
  settledFindings,
  type ChronologyEmission,
} from './chronology-accumulator';
import {
  chronologySeamHandlers,
  createChronologyWalkState,
  withBranches,
  withKeyed,
  type ChronologySeamStep,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-seams';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';
import { rewardFindingChronologyForRoom } from './finding-chronology';
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
import { mergeEquivalentRewardBranches, type RewardBranchState } from '../branch-primitives';
import { rewardFinding } from '../findings';
import { assessAuthoredBossDoorRewardStore } from './reward-store-support';
import { createArcanaFearState } from '../../arcana-fear';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

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
  const { layout, rooms, views, additionalContinuations } = prepared;
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
  const accumulator = createChronologyAccumulator(rooms);

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
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const hubDecisionOwnerBySource = new Map(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => [semanticAddressKey(decision.source.origin), decision.origin]),
  );
  let walk: ChronologyWalkState = createChronologyWalkState(
    initializeRewardBranches(
      initialBranches,
      initialBranches === undefined ? createArcanaFearState(catalog, routeLoadout) : undefined,
      catalog,
      routeLoadout.startingKeepsakeKey,
      routeLoadout.keepsakeEquipResults,
      snapshot.routeKey,
      routeLoadout,
      { routePosition, historyView: history.biomeStart },
    ),
  );
  const walkContext: ChronologyWalkContext = Object.freeze({
    catalog,
    snapshot,
    rooms,
    views,
    routeLoadout,
    enteredBiomeCount,
    fullRunBiomeCount,
    routePosition,
    resourcePlacements,
    resourceFindings,
    authoredSeaStarDuplicateSiteKeys,
    history,
    prepared,
    hubTakeoverSources,
    hubRestoringSources,
    hubDecisionOwnerBySource,
    frontierSource,
    accumulated: accumulator,
  });
  const echoReplay = applyEchoKeepsakeReplayTransition(
    catalog,
    snapshot,
    routePosition,
    routeLoadout,
    walk.branches,
    history.events[0]?.sequence ?? 0,
  );
  walk = withBranches(walk, echoReplay.branches);
  accumulator.mergeEmissions([
    {
      kind: 'keepsakeEquipResultCandidates',
      candidates: echoReplay.keepsakeEquipResultCandidates,
    },
    lifecycleFindings(echoReplay.findings),
    { kind: 'timelineFacts', facts: echoReplay.timelineFacts },
    { kind: 'echoKeepsakeReplayOutcome', outcome: echoReplay.outcome },
  ]);
  // A Hub interval ends at its departure: Hub exit or a visit's return, then any fountain use.
  const recordHubDeparture = (origin: HubRoomAddress, sequence: number, replace: boolean) => {
    const room = rooms.get(semanticAddressKey(origin));
    const view = history.viewsBySequence[sequence];
    if (room?.kind !== 'hub' || view === undefined || walk.branches.length === 0) return;
    const hub = createHubDecisionAddress(
      createBiomeAddress(origin.routeKey, origin.biomeKey),
      origin.hubKey,
    );
    const departure = runStateAt(hub, room, view)(walk.branches);
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
      walk.hermesShrineAssessments.get(semanticAddressKey(source.origin))?.assessments,
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
    checkpointBranches: readonly RewardBranchState[] = walk.branches,
  ): void {
    const ownerKey = semanticAddressKey(owner);
    if (accumulator.hasRunStateSnapshot(ownerKey) || walk.branches.length === 0) return;
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
    checkpointBranches: readonly RewardBranchState[] = walk.branches,
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

  function reachHistorySequence(sequence: number): void {
    const view = history.viewsBySequence[sequence];
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(`No history view for event ${sequence}`);
    }
    walk = withBranches(
      walk,
      Object.freeze(
        walk.branches.map((branch) =>
          Object.freeze({
            ...branch,
            state: reachSimulationHistory(branch.state, routePosition, view),
          }),
        ),
      ),
    );
  }

  function applySeamStep(step: ChronologySeamStep): void {
    if (step.leadingEmissions !== undefined) accumulator.mergeEmissions(step.leadingEmissions);
    const checkpoint = step.runStateCheckpoint;
    if (checkpoint !== undefined)
      captureRunState(
        checkpoint.owner,
        checkpoint.room,
        checkpoint.view,
        checkpoint.branches ?? walk.branches,
      );
    const target = step.targetHistoryCheckpoint;
    if (target !== undefined)
      accumulator.mergeEmissions(
        targetSlotHistory(target.origin, target.historySequence, target.branches),
      );
    walk = step.state;
    accumulator.mergeEmissions(step.emissions);
  }

  historyEvents: for (const event of history.events) {
    if (walk.branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'encounterStarted':
        applySeamStep(chronologySeamHandlers.encounterStarted(walkContext, walk, event));
        break;
      case 'roomEntered': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const entered = applyRoomEnteredTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          chaosGateSourceOccurrenceIds,
          ixionGeneratedChaosSourceOccurrenceIds,
          walk.branches,
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
              walk.hermesShrineAssessments.has(semanticAddressKey(room.origin)),
            stygianWell:
              room?.kind === 'authored' &&
              walk.stygianWellAssessments.has(semanticAddressKey(room.origin)),
          }),
        );
        walk = withBranches(walk, entered.branches);
        accumulator.mergeEmissions([
          lifecycleFindings(entered.findings),
          {
            kind: 'derivedAcquisitionEntryFrontiers',
            frontiers: entered.derivedAcquisitionEntryFrontiers,
          },
        ]);
        if (entered.hermesShrineAssessment !== undefined)
          walk = Object.freeze({
            ...walk,
            hermesShrineAssessments: new Map(walk.hermesShrineAssessments).set(
              semanticAddressKey(entered.hermesShrineAssessment.origin),
              entered.hermesShrineAssessment,
            ),
          });
        if (entered.stygianWellAssessment !== undefined)
          walk = Object.freeze({
            ...walk,
            stygianWellAssessments: new Map(walk.stygianWellAssessments).set(
              semanticAddressKey(entered.stygianWellAssessment.origin),
              entered.stygianWellAssessment,
            ),
          });
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
          walk.branches,
        );
        accumulator.mergeEmissions([lifecycleFindings(transition.findings)]);
        walk = withBranches(walk, transition.branches);
        break;
      }
      case 'keepsakeRackUsed':
        applySeamStep(chronologySeamHandlers.keepsakeRackUsed(walkContext, walk, event));
        break;
      case 'erisInteracted':
        applySeamStep(chronologySeamHandlers.erisInteracted(walkContext, walk, event));
        break;
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
          walk.branches,
          room?.kind === 'authored' ? room : undefined,
        );
        walk = withBranches(walk, transition.branches);
        if (transition.purgingPoolAssessment !== undefined)
          walk = Object.freeze({
            ...walk,
            purgingPoolAssessments: withKeyed(
              walk.purgingPoolAssessments,
              transition.purgingPoolAssessment.key,
              transition.purgingPoolAssessment.value,
            ),
          });
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
      case 'roomCreated':
        applySeamStep(chronologySeamHandlers.roomCreated(walkContext, walk, event));
        break;
      case 'targetGenerationCompleted':
        applySeamStep(chronologySeamHandlers.targetGenerationCompleted(walkContext, walk, event));
        break;
      case 'outgoingGenerationCheckpoint':
        applySeamStep(
          chronologySeamHandlers.outgoingGenerationCheckpoint(walkContext, walk, event),
        );
        break;
      case 'offerPointMaterialized': {
        const roomKey = semanticAddressKey(event.origin);
        const transition = applyOfferPointMaterializedTransition({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          lifecycle: prepared.lifecycle,
          branches: walk.branches,
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
        walk = withBranches(walk, transition.branches);
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
          branches: walk.branches,
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
        walk = withBranches(walk, settlement.branches);
        break;
      }
      case 'bossDefeated':
        applySeamStep(chronologySeamHandlers.bossDefeated(walkContext, walk, event));
        break;
      case 'encounterInteractionReached':
        applySeamStep(chronologySeamHandlers.encounterInteractionReached(walkContext, walk, event));
        break;
      case 'encounterCompleted':
        applySeamStep(chronologySeamHandlers.encounterCompleted(walkContext, walk, event));
        break;
      case 'encounterEndEffectsApplied':
        applySeamStep(chronologySeamHandlers.encounterEndEffectsApplied(walkContext, walk, event));
        if (walk.halted) {
          reachHistorySequence(event.sequence);
          break historyEvents;
        }
        break;
      case 'hermesShrineDeliveriesScheduled':
        applySeamStep(
          chronologySeamHandlers.hermesShrineDeliveriesScheduled(walkContext, walk, event),
        );
        break;
      case 'acquisitionPointReached':
        applySeamStep(chronologySeamHandlers.acquisitionPointReached(walkContext, walk, event));
        break;
      case 'wellPurchase':
        applySeamStep(chronologySeamHandlers.wellPurchase(walkContext, walk, event));
        break;
      case 'roomExited':
        applySeamStep(chronologySeamHandlers.roomExited(walkContext, walk, event));
        break;
      default:
        walk = withBranches(walk, advanceRewardBranches(walk.branches, event.sequence));
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
    walk.branches,
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
    [...walk.hermesShrineAssessments.values()].map(({ origin, assessments }) => {
      const travelDealRefills = walk.hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
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
    validity: immutableFindings.length === 0 && walk.branches.length > 0 ? 'valid' : 'invalid',
    ...(accumulation.echoKeepsakeReplayOutcome === undefined
      ? {}
      : { volatileEchoKeepsakeReplay: accumulation.echoKeepsakeReplayOutcome }),
    timelineFacts: accumulation.timelineFacts,
    wellRefillRealizations: Object.freeze([...walk.wellRefillRealizations.values()]),
    bossArcanaOutcomes: accumulation.bossArcanaOutcomes,
    storeSupport: accumulation.storeSupport,
    targetHistory: accumulation.targetHistory,
    branches: Object.freeze(walk.branches.map(publicRewardBranch)),
    findings: immutableFindings,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    hubDepartures: accumulation.hubDepartures,
    purgingPoolAssessments: Object.freeze([...walk.purgingPoolAssessments.values()]),
    hermesShrineAssessments: publishedHermesShrineAssessments,
    stygianWellAssessments: Object.freeze([...walk.stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        walk.branches
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
        [...walk.purgingPoolAssessments.values()].map(({ origin, assessments }) => [
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
        [...walk.stygianWellAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    traitChildSettlementCheckpoints,
    findingRegions: Object.freeze(immutableFindingRegions),
  });
}
