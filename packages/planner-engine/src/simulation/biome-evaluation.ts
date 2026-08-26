import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type BiomeAddress,
  type NemesisRandomEventAddress,
} from '../authored-project/addresses';
import type { AuthoredBiomePlan, ProjectDocument } from '../authored-project/model';
import { evaluateBiomeCompleteness } from './completeness';
import { evaluateBiomeRoomGenerationAssemblyInternal } from './generation/biome';
import { evaluateHubDecisionGenerationInternal } from './generation/hub';
import {
  createBiomeCandidateArtifacts,
  createEmptyBiomeCandidateArtifacts,
  type BiomeCandidateArtifacts,
} from './candidate-artifacts';
import { attestFigLeafBranchState, attestGorgonBranchState } from './keepsakes';
import { attestPendingHermesSpellDrop } from './hermes-shrine';
import { isAcquisitionAuthorshipMissingFinding } from './model';
import {
  composeBiomeHistoryWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type HistoryStateView,
  type FigLeafLifecycleState,
} from './history';
import {
  materializeBiome,
  type CanonicalAuthoredRoom,
  type CanonicalBiome,
  type MaterializedBiomePrefix,
} from './materialization';
import { evaluateEncounterCandidatesInternal } from './encounters/candidates';
import { structurallyActiveEncounterRooms } from './encounters/structural';
import type { EncounterCandidateBoundary } from './encounters/candidates';
import type { FindingRegionEntry } from './finding-regions';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyFromSelectedProducts,
  type ProgressiveBiomeContext,
} from './progressive/biome';
import type { BiomeGenerationValidation } from './progressive/products';
import { effectiveRouteResourcePlacements } from './resources';
import { evaluateBiomeRewardsAssemblyInternal } from './rewards/biome';
import type { BiomeRewardSimulation } from './rewards/model';
import {
  publishRunStateThroughCoverage,
  type RunStateOwner,
  type RunStateSnapshot,
} from './rewards/run-state';
import type { RewardProducerCandidateArtifacts } from './rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from './rewards/lifecycle-artifacts';
import type {
  LevelResolutionCandidateArtifacts,
  TraitOfferCandidateArtifacts,
} from './candidates/trait-offer-capability';
import type {
  BiomeEvaluationPoint,
  ProjectBiomeEvaluation,
  ProjectEvaluation,
} from './evaluation-products';
import { ProjectSimulationContractError } from './project-evaluation-assembly';

interface BiomeProjectEvaluationAssembly {
  readonly evaluation: ProjectBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

interface BiomeGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

/**
 * Materialized prefixes can expose structural Run State owners before the
 * assessment walk reaches them. Keep those owners explicit so consumers never
 * infer unavailable from a missing snapshot.
 */
function structurallyEligibleRunStateOwners(
  prefix: MaterializedBiomePrefix,
): readonly RunStateOwner[] {
  // Canonical decisions are the outer biome chronology. A Hub remains one
  // decision regardless of how many visits and local rooms it contains.
  const owners: RunStateOwner[] = prefix.decisions.map((decision) => decision.origin);
  if (prefix.frontier?.kind === 'hubBoard' || prefix.frontier?.kind === 'exitDecision') {
    owners.push(prefix.frontier.origin);
  }
  const enteredRooms: CanonicalAuthoredRoom[] = [];
  const appendRoom = (room: CanonicalAuthoredRoom): void => {
    if (!room.entered) return;
    if (
      enteredRooms.some(
        (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
      )
    )
      return;
    enteredRooms.push(room);
  };
  if (prefix.entryRoom !== undefined) appendRoom(prefix.entryRoom);
  for (const decision of prefix.decisions) {
    if (decision.kind === 'batch') {
      for (const target of decision.targets) appendRoom(target.room);
      for (const additional of decision.additional) appendRoom(additional.room);
      continue;
    }
    for (const visit of decision.visits) {
      appendRoom(visit.target.room);
      for (const local of visit.enteredLocalRooms) appendRoom(local);
    }
  }
  const activeHubVisit =
    prefix.frontier?.kind === 'hubVisit' && 'phase' in prefix.frontier
      ? prefix.frontier
      : undefined;
  if (activeHubVisit !== undefined) {
    appendRoom(activeHubVisit.target.room);
    for (const local of activeHubVisit.enteredLocalRooms) appendRoom(local);
  }
  for (const room of prefix.automaticRooms ?? []) appendRoom(room);
  for (const room of enteredRooms) {
    if (room.lifecycleProfileKey === 'ShipCombatRoom') {
      for (const phase of room.encounterPhases) {
        owners.push(
          createRoomRunStateCheckpointAddress(room.origin, {
            kind: 'beforeEncounterStart',
            phaseKey: phase.slotKey,
          }),
        );
      }
    } else {
      owners.push(createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' }));
    }
    owners.push(createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' }));
  }
  return Object.freeze(owners);
}

function reconcileRunStateAvailability(
  rewards: BiomeRewardSimulation,
  covered: readonly RunStateSnapshot[],
  owners: readonly RunStateOwner[],
): BiomeRewardSimulation {
  const publication = publishRunStateThroughCoverage(rewards.runStateSnapshots, covered, owners);
  return Object.freeze({
    ...rewards,
    runStateSnapshots: publication.snapshots,
    runStateAvailability: publication.availability,
  });
}

function encounterPreparationViews(
  history: CanonicalBiomeHistory | BiomeHistoryPrefix,
): ReadonlyMap<string, HistoryStateView> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room.preparation]));
}

function generation(
  catalog: Catalog,
  snapshot:
    CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom }),
  history: CanonicalBiomeHistory | BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  traitOffers: TraitOfferCandidateArtifacts,
  levelResolutions: LevelResolutionCandidateArtifacts,
  encounterBoundary?: EncounterCandidateBoundary,
): BiomeGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const hub = evaluateHubDecisionGenerationInternal(catalog, snapshot, history);
  const gorgonStatus = (() => {
    try {
      return attestGorgonBranchState(rewards.branches);
    } catch (error) {
      throw new ProjectSimulationContractError(
        error instanceof Error ? error.message : 'Gorgon branch frontier is divergent',
      );
    }
  })();
  const encounters = evaluateEncounterCandidatesInternal(
    catalog,
    structurallyActiveEncounterRooms(snapshot),
    encounterPreparationViews(history),
    encounterBoundary,
    rewards.figLeafPhaseCandidates,
    gorgonStatus,
    rewards.gorgonPhaseCandidates,
    rewards.nemesisRandomEventCandidates,
  );
  const encounterArtifacts = encounters.artifacts;
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
      createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
      encounterArtifacts,
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

export function materializedBiomePrefixCoveragePoint(
  prefix: MaterializedBiomePrefix,
): BiomeEvaluationPoint {
  if (prefix.frontier?.kind === 'exitDecision') {
    const lastTarget = prefix.frontier.targets.at(-1);
    return lastTarget === undefined
      ? Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' })
      : Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
  }
  if (prefix.frontier?.kind === 'hubBoard' || prefix.frontier?.kind === 'hubVisit') {
    if (prefix.frontier.kind === 'hubVisit' && 'phase' in prefix.frontier) {
      if (prefix.frontier.phase === 'targetLifecycle') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'beforeTargetGeneration',
        });
      }
      if (prefix.frontier.phase === 'sideGeneration') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'afterTargetGeneration',
        });
      }
      const lastLocal = prefix.frontier.enteredLocalRooms.at(-1);
      return Object.freeze({
        owner: lastLocal?.origin ?? prefix.frontier.origin,
        checkpoint: 'afterRoomLifecycle',
      });
    }
    const hub = [...prefix.decisions].reverse().find((decision) => decision.kind === 'hub');
    if (hub?.kind === 'hub') {
      const lastVisit = hub.visits.at(-1);
      if (lastVisit !== undefined) {
        const lastLocal = lastVisit.enteredLocalRooms.at(-1);
        return Object.freeze({
          owner: lastLocal?.origin ?? lastVisit.origin,
          checkpoint: 'afterRoomLifecycle',
        });
      }
      const lastTarget = hub.board.targets.at(-1);
      if (lastTarget !== undefined) {
        return Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
      }
    }
    return Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' });
  }
  const last = prefix.decisions.at(-1);
  if (last === undefined) {
    if (prefix.entryRoom === undefined) {
      throw new ProjectSimulationContractError(`${prefix.biomeKey} has no prefix coverage owner`);
    }
    return Object.freeze({ owner: prefix.entryRoom.origin, checkpoint: 'beforeTargetGeneration' });
  }
  if (last.kind === 'batch') {
    return Object.freeze({ owner: last.selectedOrigin, checkpoint: 'afterTargetGeneration' });
  }
  return Object.freeze({ owner: last.origin, checkpoint: 'afterTargetGeneration' });
}

export function evaluateBiome(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProjectBiomeEvaluation {
  return evaluateBiomeAssembly(catalog, routeKey, plan, context).evaluation;
}

/**
 * Replay one configured biome from the exact predecessor frontier already
 * attested by the selected project evaluation. Candidate families can change
 * the biome's authored plan without replaying unrelated routes or biomes.
 */
export function replayProjectBiomeFromEvaluatedPredecessor(
  catalog: Catalog,
  project: ProjectDocument,
  selected: ProjectEvaluation,
  biome: BiomeAddress,
): ProjectBiomeEvaluation {
  const route = project.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  const selectedRoute = selected.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  const biomeIndex = route?.biomes.findIndex((candidate) => candidate.biomeKey === biome.biomeKey);
  if (
    route === undefined ||
    selectedRoute === undefined ||
    biomeIndex === undefined ||
    biomeIndex < 0
  ) {
    throw new ProjectSimulationContractError(
      `${biome.routeKey}/${biome.biomeKey} has no configured candidate replay context`,
    );
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    throw new ProjectSimulationContractError(`${biome.biomeKey} candidate replay lost its plan`);
  }
  const previous = selectedRoute.biomes[biomeIndex - 1];
  if (
    previous !== undefined &&
    (previous.authoring !== 'complete' || previous.validity !== 'valid')
  ) {
    throw new ProjectSimulationContractError(
      `${biome.biomeKey} candidate replay predecessor is not complete and valid`,
    );
  }
  return evaluateBiome(catalog, route.routeKey, plan, {
    enteredBiomeCount: biomeIndex + 1,
    loadout: route.loadout,
    resourcePlacements: effectiveRouteResourcePlacements(catalog, route),
    ...(previous === undefined
      ? {}
      : {
          seed: Object.freeze({
            history: previous.history,
            rewardBranches: previous.rewards.branches,
          }),
        }),
  });
}

export function evaluateBiomeAssembly(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): BiomeProjectEvaluationAssembly {
  const origin = createBiomeAddress(routeKey, plan.biomeKey);
  const completeness = evaluateBiomeCompleteness(catalog, origin, plan);
  if (completeness.completion === 'incomplete') {
    const progressive = evaluateProgressiveBiomeAssembly(catalog, origin, plan, context);
    if (progressive === null) {
      return Object.freeze({
        evaluation: Object.freeze({
          biomeKey: plan.biomeKey,
          origin,
          authoring: 'incomplete',
          frontier: completeness.frontier,
          coverage: Object.freeze({ kind: 'none', reason: 'notEvaluated' }),
          findings: completeness.findings,
        }),
        candidateArtifacts: createEmptyBiomeCandidateArtifacts(origin),
      });
    }
    const blockedAt = progressive.evaluation.blockedAt;
    const unresolvedEntryReward =
      progressive.evaluation.materializedPrefix.entryRoom?.unresolvedIncomingReward;
    const entryAuthorshipBlocked =
      blockedAt !== undefined &&
      unresolvedEntryReward !== undefined &&
      semanticAddressKey(blockedAt) === semanticAddressKey(unresolvedEntryReward.origin) &&
      progressive.evaluation.findings.some(
        (finding) =>
          semanticAddressKey(finding.origin) === semanticAddressKey(blockedAt) &&
          isAcquisitionAuthorshipMissingFinding(finding),
      );
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'incomplete',
        frontier: completeness.frontier,
        ...(blockedAt === undefined || entryAuthorshipBlocked
          ? {}
          : { validity: 'invalid' as const }),
        coverage: Object.freeze({
          kind: 'prefix',
          through: materializedBiomePrefixCoveragePoint(
            progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix,
          ),
          ...(blockedAt === undefined ? {} : { blockedAt }),
        }),
        materializedPrefix: progressive.evaluation.materializedPrefix,
        ...(progressive.evaluation.assessmentPrefix === undefined
          ? {}
          : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
        history: progressive.evaluation.history,
        roomGeneration: progressive.evaluation.roomGeneration,
        rewards: reconcileRunStateAvailability(
          progressive.evaluation.rewards,
          progressive.evaluation.rewards.runStateSnapshots,
          structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
        ),
        findings:
          blockedAt === undefined || entryAuthorshipBlocked
            ? Object.freeze([...completeness.findings, ...progressive.evaluation.findings])
            : progressive.evaluation.findings,
      }),
      candidateArtifacts: progressive.candidateArtifacts,
    });
  }
  const snapshot = materializeBiome(
    catalog,
    origin,
    completeness,
    context.loadout,
    plan.completionOccurrences,
    plan.echoKeepsakeReplayResults,
  );
  const seed: HistoryStateView | undefined = context.seed?.history.afterTransition;
  const startingKeepsake = catalog.keepsakes.byKey[context.loadout.startingKeepsakeKey];
  const startingFigLeaf = startingKeepsake?.effect;
  let figLeafState: FigLeafLifecycleState | undefined;
  let pendingSpellDrop: boolean;
  try {
    figLeafState =
      context.seed === undefined
        ? startingFigLeaf?.kind === 'figLeaf' && startingKeepsake !== undefined
          ? {
              remainingUses: startingFigLeaf.biomeUsesByRank[startingKeepsake.rank],
              activatedThisBiome: false,
            }
          : undefined
        : (() => {
            const state = attestFigLeafBranchState(context.seed.rewardBranches);
            return state === undefined
              ? undefined
              : { remainingUses: state.remainingUses, activatedThisBiome: false };
          })();
    pendingSpellDrop =
      context.seed === undefined
        ? false
        : attestPendingHermesSpellDrop(context.seed.rewardBranches);
  } catch (error) {
    throw new ProjectSimulationContractError(
      error instanceof Error ? error.message : 'Fig Leaf branch frontier is divergent',
    );
  }
  const composed = composeBiomeHistoryWithEncounterValidation(
    catalog,
    snapshot,
    seed,
    figLeafState,
    pendingSpellDrop,
  );
  if (composed.kind !== 'complete') {
    const progressive = evaluateProgressiveBiomeAssembly(catalog, origin, plan, context);
    if (progressive === null) {
      throw new ProjectSimulationContractError(
        `${plan.biomeKey} lifecycle block has no materialized progressive prefix`,
      );
    }
    const blockedAt =
      progressive.evaluation.blockedAt ??
      (composed.kind === 'blocked' ? composed.block.blockedAt : composed.blockedAt);
    if (blockedAt === undefined) {
      throw new ProjectSimulationContractError(
        `${plan.biomeKey} lifecycle block has no semantic repair owner`,
      );
    }
    const assessmentPrefix =
      progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix;
    const reconciledRewards = reconcileRunStateAvailability(
      progressive.evaluation.rewards,
      progressive.evaluation.rewards.runStateSnapshots,
      structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
    );
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'complete',
        coverage: Object.freeze({
          kind: 'prefix',
          through: materializedBiomePrefixCoveragePoint(assessmentPrefix),
          blockedAt,
        }),
        validity: 'invalid',
        materializedPrefix: progressive.evaluation.materializedPrefix,
        ...(progressive.evaluation.assessmentPrefix === undefined
          ? {}
          : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
        history: progressive.evaluation.history,
        roomGeneration: progressive.evaluation.roomGeneration,
        rewards: reconciledRewards,
        findings: progressive.evaluation.findings,
      }),
      candidateArtifacts: progressive.candidateArtifacts,
    });
  }
  const history = composed.history;
  const rewards = evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    context.enteredBiomeCount,
    context.loadout,
    context.seed?.rewardBranches,
    context.resourcePlacements,
  );
  const roomGeneration = generation(
    catalog,
    snapshot,
    history,
    context.enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    rewards.traitOfferArtifacts,
    rewards.levelResolutionArtifacts,
  );
  const nemesisByOwner = new Map(
    rewards.simulation.nemesisRandomEventCandidates.map((candidate) => [
      semanticAddressKey(candidate.origin),
      candidate,
    ]),
  );
  // Reward simulation reaches the actual interaction frontier, while
  // encounter preparation owns the rest of the encounter capability. Compose
  // the one narrow event surface here without exposing either artifact map.
  const encounterArtifacts = Object.freeze({
    ...roomGeneration.candidateArtifacts.encounters,
    nemesisAt: (event: NemesisRandomEventAddress) => nemesisByOwner.get(semanticAddressKey(event)),
  });
  const findings = Object.freeze([
    ...roomGeneration.validation.findings,
    ...rewards.simulation.findings,
  ]);
  if (roomGeneration.validation.validity === 'valid' && rewards.simulation.validity === 'valid') {
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'complete',
        coverage: Object.freeze({ kind: 'complete' }),
        validity: 'valid',
        snapshot,
        history,
        roomGeneration: roomGeneration.validation,
        rewards: rewards.simulation,
        findings,
      }),
      candidateArtifacts: createBiomeCandidateArtifacts(
        roomGeneration.candidateArtifacts.origin,
        roomGeneration.candidateArtifacts.roomTargets,
        roomGeneration.candidateArtifacts.rewardProducers,
        roomGeneration.candidateArtifacts.roomLifecycles,
        encounterArtifacts,
        roomGeneration.candidateArtifacts.traitOffers,
        roomGeneration.candidateArtifacts.levelResolutions,
        rewards.judgmentArcanaArtifacts,
        rewards.keepsakeSelectionArtifacts,
        rewards.keepsakeEquipResultArtifacts,
        rewards.acquisitionConversionArtifacts,
        rewards.derivedAcquisitionEntryArtifacts,
        rewards.steadyGrowthArtifacts,
        rewards.purgingPoolArtifacts,
        rewards.hermesShrineArtifacts,
        rewards.stygianWellArtifacts,
        rewards.fountainRarityArtifacts,
        rewards.figurineArcanaArtifacts,
      ),
    });
  }
  const selectedFindingRegions = Object.freeze([
    ...roomGeneration.findingRegions,
    ...rewards.findingRegions,
  ]);
  const progressive = evaluateProgressiveBiomeAssemblyFromSelectedProducts(
    catalog,
    origin,
    plan,
    context,
    Object.freeze({
      rewards: rewards.simulation,
      candidateArtifacts: createBiomeCandidateArtifacts(
        roomGeneration.candidateArtifacts.origin,
        roomGeneration.candidateArtifacts.roomTargets,
        roomGeneration.candidateArtifacts.rewardProducers,
        roomGeneration.candidateArtifacts.roomLifecycles,
        encounterArtifacts,
        roomGeneration.candidateArtifacts.traitOffers,
        roomGeneration.candidateArtifacts.levelResolutions,
        rewards.judgmentArcanaArtifacts,
        rewards.keepsakeSelectionArtifacts,
        rewards.keepsakeEquipResultArtifacts,
        rewards.acquisitionConversionArtifacts,
        rewards.derivedAcquisitionEntryArtifacts,
        rewards.steadyGrowthArtifacts,
        rewards.purgingPoolArtifacts,
        rewards.hermesShrineArtifacts,
        rewards.stygianWellArtifacts,
        rewards.fountainRarityArtifacts,
        rewards.figurineArcanaArtifacts,
      ),
      history: Object.freeze({
        routeKey: history.routeKey,
        biomeKey: history.biomeKey,
        events: history.events,
        ledgers: history.ledgers,
        rooms: history.rooms,
        current: history.afterTransition,
      }),
      roomGeneration: roomGeneration.validation,
      findingRegions: selectedFindingRegions,
      traitChildSettlementCheckpoints: rewards.traitChildSettlementCheckpoints,
    }),
  );
  if (progressive === null) {
    throw new ProjectSimulationContractError(
      `${plan.biomeKey} invalid complete biome has no materialized progressive prefix`,
    );
  }
  const assessmentPrefix =
    progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix;
  const reconciledRewards = reconcileRunStateAvailability(
    progressive.evaluation.rewards,
    progressive.evaluation.rewards.runStateSnapshots,
    structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
  );
  return Object.freeze({
    evaluation: Object.freeze({
      biomeKey: plan.biomeKey,
      origin,
      authoring: 'complete',
      coverage: Object.freeze({
        kind: 'prefix',
        through: materializedBiomePrefixCoveragePoint(assessmentPrefix),
        ...(progressive.evaluation.blockedAt === undefined
          ? {}
          : { blockedAt: progressive.evaluation.blockedAt }),
      }),
      validity: 'invalid',
      materializedPrefix: progressive.evaluation.materializedPrefix,
      ...(progressive.evaluation.assessmentPrefix === undefined
        ? {}
        : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
      history: progressive.evaluation.history,
      roomGeneration: progressive.evaluation.roomGeneration,
      rewards: reconciledRewards,
      findings: progressive.evaluation.findings,
    }),
    candidateArtifacts: progressive.candidateArtifacts,
  });
}
