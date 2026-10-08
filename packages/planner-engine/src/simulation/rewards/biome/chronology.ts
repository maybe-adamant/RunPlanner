import { physicalExitKey } from '../../../authored-project/topology/query';
import type { Catalog } from '../../../catalog-schema';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import {
  createBiomeAddress,
  createRoomRunStateCheckpointAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/acquisition/sea-star';
import type { CanonicalDecision } from '../../materialization/model';
import { ownerRegion, type HistoryFindingChronology } from '../../finding-regions';
import { bossDoorRewardStoreMissingFinding } from '../../completeness';
import type { RewardBranch } from '../model';
import { createRunStateDerivationCache } from '../run-state';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { prepareRewardEvaluationInputs } from './prepared-inputs';
import { applyEchoKeepsakeReplayTransition } from './lifecycle-transitions/echo-keepsake-replay';
import {
  createChronologyAccumulator,
  lifecycleFindings,
  type ChronologyAccumulator,
  type ChronologyEmission,
} from './chronology-accumulator';
import { publishChronology } from './chronology-publication';
import type { HistoryEvent } from '../../history';
import { walkHistoryEvent } from './chronology-seams';
import { captureRunState, targetSlotHistory } from './chronology-run-state';
import { applyRoomEntryEffects } from './lifecycle-transitions/room-entered';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import {
  createChronologyWalkState,
  withBranches,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-walk';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import { type BiomeRewardEvaluationAssembly } from './publication';

import { initializeRewardBranches } from '../branch-lifecycle';
import { rewardFinding } from '../findings';
import { assessAuthoredBossDoorRewardStore } from './reward-store-support';
import { createArcanaFearState } from '../../arcana-fear';

/** The fixed inputs of one biome walk, derived once from the prepared snapshot. */
function createWalkContext(
  inputs: Pick<
    ChronologyWalkContext,
    | 'catalog'
    | 'snapshot'
    | 'history'
    | 'routePosition'
    | 'routeLoadout'
    | 'resourcePlacements'
    | 'resourceFindings'
    | 'prepared'
    | 'accumulated'
  >,
): ChronologyWalkContext {
  const { snapshot, routePosition, prepared } = inputs;
  const { rooms, views, additionalContinuations } = prepared;
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
  ]);
  const frontierSource =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? semanticAddressKey(snapshot.frontier.parent.origin)
      : undefined;
  const hubDecisionOwnerBySource = new Map(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => [semanticAddressKey(decision.source.origin), decision.origin]),
  );
  return Object.freeze({
    ...inputs,
    rooms,
    views,
    enteredBiomeCount: routePosition.ordinal,
    fullRunBiomeCount: routePosition.itineraryBiomeKeys.length,
    authoredSeaStarDuplicateSiteKeys,
    hubTakeoverSources,
    hubRestoringSources,
    hubDecisionOwnerBySource,
    frontierSource,
    chaosGateSourceOccurrenceIds,
    ixionGeneratedChaosSourceOccurrenceIds,
    runStateDerivationCache: createRunStateDerivationCache(),
  });
}

/** Echo replays its captured keepsake at the biome start, before the first event. */
function replayEchoKeepsake(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  walk: ChronologyWalkState,
): ChronologyWalkState {
  const { catalog, snapshot, routePosition, routeLoadout, history } = context;
  const echoReplay = applyEchoKeepsakeReplayTransition(
    catalog,
    snapshot,
    routePosition,
    routeLoadout,
    walk.branches,
    history.events[0]?.sequence ?? 0,
  );
  accumulator.mergeEmissions([
    {
      kind: 'keepsakeEquipResultCandidates',
      candidates: echoReplay.keepsakeEquipResultCandidates,
    },
    lifecycleFindings(echoReplay.findings),
    { kind: 'timelineFacts', facts: echoReplay.timelineFacts },
    { kind: 'echoKeepsakeReplayOutcome', outcome: echoReplay.outcome },
  ]);
  return withBranches(walk, echoReplay.branches);
}

/** A prefix's blank exit decision records history for its next unauthored target slot. */
function blankFrontierTargetHistory(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  walk: ChronologyWalkState,
): readonly ChronologyEmission[] {
  const { catalog, snapshot, rooms, history } = context;
  const { layout } = context.prepared;
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
      ? semanticAddressKey(frontier.parent.origin) === semanticAddressKey(snapshot.entryRoom.origin)
        ? Object.freeze([layout.progression.entry.exitKey])
        : Object.freeze([])
      : Object.freeze(
          [...declaration.exits]
            .sort((left, right) => left.index - right.index)
            .map((exit) => physicalExitKey(exit.index)),
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
    : targetSlotHistory(context, origin, historySequence, walk.branches);
}

/**
 * An entered room whose Overview product no branch supports stops the walk
 * with an empty cohort; its entry Run State is the prepared cohort with the
 * room's entry effects, without the unsettled product.
 */
function captureFailedOverviewEntry(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  walk: ChronologyWalkState,
): void {
  const cohort = walk.overviewCohort;
  if (walk.branches.length > 0 || cohort === undefined || cohort.branches.length === 0) return;
  const room = context.rooms.get(cohort.roomKey);
  const entry = context.views.get(cohort.roomKey)?.entry;
  const entered = context.history.events.find(
    (event): event is Extract<HistoryEvent, { readonly kind: 'roomEntered' }> =>
      event.kind === 'roomEntered' && semanticAddressKey(event.origin) === cohort.roomKey,
  );
  if (
    room?.kind !== 'authored' ||
    room.lifecycleProfileKey === 'ShipCombatRoom' ||
    entry === undefined ||
    entered === undefined
  )
    return;
  const effects = applyRoomEntryEffects(
    context.catalog,
    entered,
    room,
    context.chaosGateSourceOccurrenceIds,
    context.ixionGeneratedChaosSourceOccurrenceIds,
    cohort.branches,
    rewardFindingChronologyForRoom(
      context.snapshot,
      room.origin,
      entered.sequence,
      'localRoomLifecycle',
    ),
    context.routePosition,
  );
  captureRunState(context, withBranches(walk, effects.branches), accumulator, {
    owner: createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' }),
    room,
    view: entry,
  });
}

/**
 * After the last event: the Hub frontier's Run State, every boss-door store,
 * then the blank exit-decision frontier's target history.
 */
function finalizeWalk(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  walk: ChronologyWalkState,
): void {
  const { snapshot, rooms, history, views } = context;
  const { layout } = context.prepared;
  captureFailedOverviewEntry(context, accumulator, walk);
  if (
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.parent.origin.kind === 'hubRoom'
  ) {
    const source = rooms.get(semanticAddressKey(snapshot.frontier.parent.origin));
    if (source?.kind === 'hub') {
      const current = 'current' in history ? history.current : history.afterTransition;
      captureRunState(context, walk, accumulator, {
        owner: snapshot.frontier.origin,
        room: source,
        view: current,
      });
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

  accumulator.mergeEmissions(blankFrontierTargetHistory(context, accumulator, walk));
}

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
  const prepared = prepareRewardEvaluationInputs(catalog, snapshot, history);
  const accumulator = createChronologyAccumulator(prepared.rooms);
  const context = createWalkContext({
    catalog,
    snapshot,
    history,
    routePosition,
    routeLoadout,
    resourcePlacements,
    resourceFindings,
    prepared,
    accumulated: accumulator,
  });
  let walk = replayEchoKeepsake(
    context,
    accumulator,
    createChronologyWalkState(
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
    ),
  );
  const steps: WalkStep[] = [];
  for (const event of history.events) {
    if (walk.branches.length === 0) break;
    steps.push({
      sequence: event.sequence,
      received: walk,
      emissionCount: accumulator.emissionCount(),
    });
    walk = walkHistoryEvent(context, accumulator, walk, event);
    if (walk.halted) break;
  }
  finalizeWalk(context, accumulator, walk);
  // A cut through the last walked event also reaches what the walk settles after it.
  const walked: WalkStep = Object.freeze({
    sequence: Number.POSITIVE_INFINITY,
    received: walk,
    emissionCount: accumulator.emissionCount(),
  });
  const through = (
    cut: HistoryFindingChronology,
    blockedAt?: SemanticAddress,
  ): BiomeRewardEvaluationAssembly => {
    const { received, emissionCount, settled } = walkThrough(steps, walked, cut);
    const replay = createChronologyAccumulator(prepared.rooms);
    replay.mergeEmissions(accumulator.emissionsThrough(emissionCount));
    const accumulation = replay.finish();
    // A blocked trait child keeps its exact pre-effect checkpoint as the reached state.
    const child =
      settled || blockedAt === undefined
        ? undefined
        : accumulation.traitChildSettlements.get(semanticAddressKey(blockedAt));
    return publishChronology(
      context,
      child === undefined ? received : withBranches(received, child.branches),
      accumulation,
      through,
      cut.boundary === 'before' ? cut.sequence - 1 : cut.sequence,
    );
  };
  return publishChronology(context, walk, accumulator.finish(), through);
}

/** The walk state an event received and how many emissions preceded its step. */
interface WalkStep {
  readonly sequence: number;
  readonly received: ChronologyWalkState;
  readonly emissionCount: number;
}

/**
 * The selected walk through a chronology cut. Unless the cut lies before it,
 * the cut event is the blocking contact: its emissions and the state it
 * settles are reached. A contact that leaves no branch, or the last event of a
 * walk that stopped before the cut, keeps the branches it received.
 */
function walkThrough(
  steps: readonly WalkStep[],
  walked: WalkStep,
  cut: HistoryFindingChronology,
): {
  readonly received: ChronologyWalkState;
  readonly emissionCount: number;
  /** Whether the reached state settled every branch it received. */
  readonly settled: boolean;
} {
  const index = steps.findIndex((step) => step.sequence >= cut.sequence);
  if (index < 0) {
    const settled = walked.received.branches.length > 0;
    const last = steps.at(-1);
    return {
      received:
        settled || last === undefined
          ? walked.received
          : withBranches(walked.received, last.received.branches),
      emissionCount: walked.emissionCount,
      settled,
    };
  }
  const step = steps[index]!;
  if (step.sequence > cut.sequence || cut.boundary === 'before') return { ...step, settled: true };
  const next = steps[index + 1] ?? walked;
  const settled = next.received.branches.length > 0;
  return {
    received: settled ? next.received : withBranches(next.received, step.received.branches),
    emissionCount: next.emissionCount,
    settled,
  };
}
