import type { Catalog } from '../../../catalog-schema';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import {
  createBiomeAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/acquisition/sea-star';
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
import { createRunStateDerivationCache, publishRunStateThroughCoverage } from '../run-state';
import { createRoomLifecycleCandidateArtifacts } from '../lifecycle-artifacts';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { selectedTraitOfferProducts } from './selected-trait-products';
import { prepareRewardEvaluationInputs } from './prepared-inputs';
import { applyEchoKeepsakeReplayTransition } from './lifecycle-transitions/echo-keepsake-replay';
import {
  createChronologyAccumulator,
  lifecycleFindings,
  type ChronologyEmission,
} from './chronology-accumulator';
import { walkHistoryEvent } from './chronology-seams';
import { captureRunState, targetSlotHistory } from './chronology-run-state';
import {
  createChronologyWalkState,
  withBranches,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-walk';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import {
  publishBiomeRewardEvaluationAssembly,
  type BiomeRewardEvaluationAssembly,
  type TraitChildSettlementCheckpoints,
} from './publication';

import { createRewardProducerCandidateArtifacts } from '../producer-frontiers';
import { initializeRewardBranches, publicRewardBranch } from '../branch-lifecycle';
import { mergeEquivalentRewardBranches } from '../branch-primitives';
import { rewardFinding } from '../findings';
import { assessAuthoredBossDoorRewardStore } from './reward-store-support';
import { createArcanaFearState } from '../../arcana-fear';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

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
    chaosGateSourceOccurrenceIds,
    ixionGeneratedChaosSourceOccurrenceIds,
    runStateDerivationCache: createRunStateDerivationCache(),
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
      : targetSlotHistory(walkContext, origin, historySequence, walk.branches);
  }

  for (const event of history.events) {
    if (walk.branches.length === 0) break;
    walk = walkHistoryEvent(walkContext, accumulator, walk, event);
    if (walk.halted) break;
  }

  if (
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.parent.origin.kind === 'hubRoom'
  ) {
    const source = rooms.get(semanticAddressKey(snapshot.frontier.parent.origin));
    if (source?.kind === 'hub') {
      const current = 'current' in history ? history.current : history.afterTransition;
      captureRunState(walkContext, walk, accumulator, {
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
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(walk.shipLifecycleContexts),
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
