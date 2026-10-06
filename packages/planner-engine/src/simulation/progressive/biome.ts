import type { Catalog } from '../../catalog-schema';
import { sharedRewardLookups } from '../state/reward-lookups';
import { isRequiredMissingInputFinding, type SemanticFinding } from '../model';
import { roomActionKey } from '../../authored-project/room-actions/key';
import {
  createBiomeAddress,
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomePlan,
  RouteLoadout,
  ResourcePlacements,
} from '../../authored-project/model';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { evaluateBiomeRoomGenerationAssemblyInternal } from '../generation/biome';
import { evaluateHubDecisionGenerationInternal } from '../generation/hub';
import {
  createBiomeCandidateArtifacts,
  type BiomeCandidateArtifacts,
} from '../evaluation/candidate-artifacts';
import {
  type AcquisitionConversionCandidateArtifacts,
  type DerivedAcquisitionEntryCandidateArtifacts,
} from '../rewards/acquisition/artifacts';
import {
  type FigurineArcanaCandidateArtifacts,
  type FountainRarityCandidateArtifacts,
  type KeepsakeEquipResultCandidateArtifacts,
  type KeepsakeSelectionCandidateArtifacts,
  type TranscendentEmbryoCandidateArtifacts,
} from '../keepsakes/candidate-artifacts';
import { type HermesShrineCandidateArtifacts } from '../commerce/hermes-shrine';
import { type JudgmentArcanaCandidateArtifacts } from '../arcana-fear';
import type { SteadyGrowthCandidateArtifacts } from '../candidates/steady-growth';
import { type StygianWellCandidateArtifacts } from '../commerce/stygian-well';
import {
  composeBiomeHistoryPrefixWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type FigLeafLifecycleState,
} from '../history';
import type { MaterializedBiomePrefix } from '../materialization';
import { evaluateEncounterCandidatesInternal } from '../encounters/candidates';
import type { EncounterEntryVowRanks } from '../arcana-fear';
import {
  structurallyActiveEncounterRooms,
  type EncounterStructuralSnapshot,
} from '../encounters/structural';
import { materializeBiomePrefix } from '../materialization';
import { assessmentRepairOwner, findingRegion, type FindingRegionEntry } from '../finding-regions';
import { createAssessmentIssue } from '../assessment-issue';
import { evaluateBiomeRewardsAssemblyInternal } from '../rewards/biome';
import type { BiomeRewardSimulation, RewardBranch } from '../rewards';
import type { RewardProducerCandidateArtifacts } from '../rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from '../rewards/lifecycle-artifacts';
import { attestFigLeafBranchState, attestGorgonBranchState } from '../keepsakes/encounter-effects';
import { initialFigLeafState } from '../keepsakes/state';
import { attestPendingHermesSpellDrop } from '../commerce/hermes-shrine';
import { attestTalentDropsClosed } from '../hex-progress';
import { attestEffectiveShadowRank } from '../arcana-fear';
import {
  firstUnsupportedFinding,
  findingsAtRegion,
  findingLocation,
  mergedFindings,
  type ProgressiveBiomeSelectedProducts,
} from './finding-location';
import { publishSelectedCut } from './selected-cut';
import type {
  BiomeGenerationValidation,
  ProgressiveBiomeEvaluation,
  ProgressiveBiomeEvaluationAssembly,
} from './products';

export interface ProgressiveSeed {
  readonly history: CanonicalBiomeHistory;
  readonly rewardBranches: readonly RewardBranch[];
  /** Run-persistent Hub offer inventory, captured at prior biome completion. */
}

export interface ProgressiveBiomeContext {
  /** Exact position from the authored route context. */
  readonly routePosition: ResolvedRoutePosition;
  readonly forcedChaosOccurrenceKeys?: ReadonlySet<string>;
  readonly loadout: RouteLoadout;
  /** Direct biome evaluators supply the explicit empty record; route simulation supplies its owned record. */
  readonly resourcePlacements: ResourcePlacements;
  readonly resourceFindings?: readonly import('../model').SemanticFinding[];
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
  return initialFigLeafState(catalog, context.loadout.startingKeepsakeKey);
}

function pendingHermesSpellDropLifecycleState(context: ProgressiveBiomeContext): boolean {
  return context.seed === undefined
    ? false
    : attestPendingHermesSpellDrop(context.seed.rewardBranches);
}

function talentDropClosureLifecycleState(context: ProgressiveBiomeContext): boolean {
  return context.seed === undefined ? false : attestTalentDropsClosed(context.seed.rewardBranches);
}

/** Classify only the exact active action that stopped lifecycle execution. */
function lifecycleBlockFindings(
  blockedAt: SemanticAddress,
  snapshot: EncounterStructuralSnapshot,
): readonly SemanticFinding[] {
  for (const room of structurallyActiveEncounterRooms(snapshot)) {
    const row = room.roomActionRoster.rows.find((candidate) =>
      blockedAt.kind === 'roomAction'
        ? room.origin.kind === 'occurrence' &&
          room.origin.occurrenceId === blockedAt.occurrenceId &&
          candidate.key === blockedAt.actionKey
        : semanticAddressKey(candidate.owner) === semanticAddressKey(blockedAt),
    );
    if (row === undefined || row.stale) continue;
    const reasons = room.roomActionRoster.issues.flatMap((issue): SemanticFinding[] =>
      roomActionKey(issue.reference) === row.key &&
      (issue.kind === 'dependency' || issue.kind === 'window')
        ? [
            Object.freeze({
              code: 'roomActionOrderUnavailable',
              severity: 'error',
              phase: 'encounterResolution',
              origin: blockedAt,
              evidence: Object.freeze({
                reason: issue.kind,
                detail: issue.detail,
                ...(issue.kind === 'dependency'
                  ? {
                      dependencyKind: issue.dependency.kind,
                      checkpointUnavailable: issue.checkpointUnavailable === true,
                    }
                  : {}),
              }),
            }),
          ]
        : [],
    );
    if (reasons.length > 0) return Object.freeze(reasons);
    break;
  }
  return Object.freeze([
    Object.freeze({
      code: 'roomActionPlacementRequired',
      severity: 'error',
      phase: 'completeness',
      origin: blockedAt,
      evidence: Object.freeze({}),
    }),
  ]);
}

interface ProgressiveGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

interface ProgressiveProducts {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly rewardsThrough: ProgressiveBiomeSelectedProducts['rewardsThrough'];
}

function generation(
  catalog: Catalog,
  productPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  history: BiomeHistoryPrefix,
  routePosition: ResolvedRoutePosition,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  traitOffers: import('../candidates/trait-offer/capability').TraitOfferCandidateArtifacts,
  levelResolutions: import('../candidates/trait-offer/capability').LevelResolutionCandidateArtifacts,
  judgmentArcana: JudgmentArcanaCandidateArtifacts,
  figurineArcana: FigurineArcanaCandidateArtifacts,
  keepsakeSelections: KeepsakeSelectionCandidateArtifacts,
  keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts,
  acquisitionConversions: AcquisitionConversionCandidateArtifacts,
  derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts,
  steadyGrowth: SteadyGrowthCandidateArtifacts,
  hermesShrines: HermesShrineCandidateArtifacts,
  stygianWells: StygianWellCandidateArtifacts,
  transcendentEmbryo: TranscendentEmbryoCandidateArtifacts,
  fountainRarity: FountainRarityCandidateArtifacts,
  encounterEntryVowRanks: ReadonlyMap<string, EncounterEntryVowRanks>,
  forcedChaosOccurrenceKeys?: ReadonlySet<string>,
  carriedRewardLookups?: Readonly<Record<string, readonly string[]>>,
): ProgressiveGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssemblyInternal(
    catalog,
    productPrefix,
    history,
    routePosition.ordinal,
    rewards.targetHistory,
    forcedChaosOccurrenceKeys,
    carriedRewardLookups,
  );
  const hub = evaluateHubDecisionGenerationInternal(catalog, productPrefix, history);
  const encounters = evaluateEncounterCandidatesInternal(
    catalog,
    structurallyActiveEncounterRooms(productPrefix),
    new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room.preparation])),
    routePosition,
    rewards.figLeafPhaseCandidates,
    attestGorgonBranchState(rewards.branches),
    rewards.gorgonPhaseCandidates,
    rewards.nemesisRandomEventCandidates,
    history.events,
    history.rooms,
    encounterEntryVowRanks,
    rewards.targetHistory,
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
    resolvedGenerated: encounters.resolvedGenerated,
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
      judgmentArcana,
      keepsakeSelections,
      keepsakeEquipResults,
      acquisitionConversions,
      derivedAcquisitionEntries,
      steadyGrowth,
      undefined,
      hermesShrines,
      stygianWells,
      fountainRarity,
      figurineArcana,
      transcendentEmbryo,
      ordinary.chaos,
      ordinary.zagreusContracts,
    ),
    findingRegions: Object.freeze([
      ...ordinary.findingRegions,
      ...hub.findingRegions,
      ...encounters.findingRegions,
    ]),
  });
}

function products(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  context: ProgressiveBiomeContext,
): ProgressiveProducts {
  const lifecycleFigLeafState = figLeafLifecycleState(catalog, context);
  const lifecyclePendingSpellDrop = pendingHermesSpellDropLifecycleState(context);
  const lifecycleAllSpellInvested = talentDropClosureLifecycleState(context);
  const composed = composeBiomeHistoryPrefixWithEncounterValidation(
    catalog,
    prefix,
    context.routePosition,
    context.seed?.history.afterTransition,
    lifecycleFigLeafState,
    lifecyclePendingSpellDrop,
    lifecycleAllSpellInvested,
    attestEffectiveShadowRank(context.loadout, context.seed?.rewardBranches),
  );
  if (composed === null) {
    throw new Error(`${prefix.biomeKey} materialized prefix has no composable history`);
  }
  const history = composed.history;
  // A stopped lifecycle blocks at its room action, after the last composed event.
  const lifecycleFindings =
    composed.blockedAt === undefined
      ? Object.freeze([])
      : lifecycleBlockFindings(composed.blockedAt, prefix);
  const lastSequence = history.events.at(-1)?.sequence;
  const lifecycleStop =
    lastSequence === undefined
      ? undefined
      : Object.freeze({
          kind: 'history' as const,
          sequence: lastSequence,
          boundary: 'after' as const,
        });
  const rewards = evaluateBiomeRewardsAssemblyInternal(
    catalog,
    prefix,
    history,
    context.routePosition,
    context.loadout,
    context.seed?.rewardBranches,
    context.resourcePlacements,
    context.resourceFindings,
  );
  const roomGeneration = generation(
    catalog,
    prefix,
    history,
    context.routePosition,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    rewards.traitOfferArtifacts,
    rewards.levelResolutionArtifacts,
    rewards.judgmentArcanaArtifacts,
    rewards.figurineArcanaArtifacts,
    rewards.keepsakeSelectionArtifacts,
    rewards.keepsakeEquipResultArtifacts,
    rewards.acquisitionConversionArtifacts,
    rewards.derivedAcquisitionEntryArtifacts,
    rewards.steadyGrowthArtifacts,
    rewards.hermesShrineArtifacts,
    rewards.stygianWellArtifacts,
    rewards.transcendentEmbryoArtifacts,
    rewards.fountainRarityArtifacts,
    rewards.encounterEntryVowRanks,
    context.forcedChaosOccurrenceKeys,
    context.seed === undefined
      ? undefined
      : sharedRewardLookups(context.seed.rewardBranches.map((branch) => branch.state)),
  );
  return Object.freeze({
    evaluation: Object.freeze({
      history,
      rewards: rewards.simulation,
      roomGeneration: roomGeneration.validation,
      findings: lifecycleFindings,
    }),
    candidateArtifacts: roomGeneration.candidateArtifacts,
    findingRegions: Object.freeze([
      ...lifecycleFindings.map((finding) => findingRegion(finding, undefined, lifecycleStop)),
      ...roomGeneration.findingRegions,
      ...rewards.findingRegions,
    ]),
    rewardsThrough: rewards.through,
  });
}

/** The complete selected attempt, with its first block located but not yet published. */
export function evaluateSelectedProgressiveBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluation | null {
  return (
    evaluateSelectedProgressiveBiomeAssembly(catalog, biome, plan, context)?.evaluation ?? null
  );
}

export function evaluateSelectedProgressiveBiomeAssembly(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(
    catalog,
    biome,
    context.routePosition,
    plan,
    context.loadout,
  );
  if (initial?.entryRoom === undefined) return null;
  const materializedPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, materializedPrefix, context);
  const locatedBlock = firstUnsupportedFinding(materializedPrefix, evaluated.findingRegions);
  return Object.freeze({
    evaluation: Object.freeze({
      materializedPrefix,
      ...evaluated.evaluation,
      findings: mergedFindings(evaluated.evaluation),
      ...(locatedBlock === undefined ? {} : { blockedAt: locatedBlock.finding.origin }),
      ...(locatedBlock === undefined
        ? {}
        : {
            blockedKind: isRequiredMissingInputFinding(locatedBlock.finding)
              ? ('incomplete' as const)
              : ('invalid' as const),
            blockedRegionKey: locatedBlock.regionKey,
            blockedLocation: findingLocation(locatedBlock),
            issue: createAssessmentIssue(
              locatedBlock.repairOwner ?? assessmentRepairOwner(locatedBlock.finding.origin),
              locatedBlock.regionKey,
              [
                locatedBlock.finding,
                ...findingsAtRegion(
                  materializedPrefix,
                  evaluated.findingRegions,
                  locatedBlock.regionKey,
                ),
              ],
            ),
          }),
    }),
    candidateArtifacts: evaluated.candidateArtifacts,
  });
}

/**
 * Evaluates the maximum materializable authored prefix, then publishes it
 * through the first unsupported semantic owner's chronology cut, so no
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
  const initial = materializeBiomePrefix(
    catalog,
    biome,
    context.routePosition,
    plan,
    context.loadout,
  );
  if (initial?.entryRoom === undefined) return null;
  const authoredPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, authoredPrefix, context);
  const unsupported = firstUnsupportedFinding(authoredPrefix, evaluated.findingRegions);
  if (unsupported !== undefined) {
    return publishSelectedCut(
      catalog,
      authoredPrefix,
      Object.freeze({
        history: evaluated.evaluation.history,
        roomGeneration: evaluated.evaluation.roomGeneration,
        rewards: evaluated.evaluation.rewards,
        candidateArtifacts: evaluated.candidateArtifacts,
        findingRegions: evaluated.findingRegions,
        rewardsThrough: evaluated.rewardsThrough,
      }),
      unsupported,
    );
  }
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluated.evaluation,
      materializedPrefix: authoredPrefix,
      findings: mergedFindings(evaluated.evaluation),
    }),
    candidateArtifacts: evaluated.candidateArtifacts,
  });
}

/**
 * Publishes a complete-invalid canonical attempt's already selected products
 * through its first block. Nothing is replayed.
 */
export function evaluateProgressiveBiomeAssemblyFromSelectedProducts(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
  selectedProducts: ProgressiveBiomeSelectedProducts,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(
    catalog,
    biome,
    context.routePosition,
    plan,
    context.loadout,
  );
  if (initial?.entryRoom === undefined) return null;
  const authoredPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const unsupported = firstUnsupportedFinding(authoredPrefix, selectedProducts.findingRegions);
  if (unsupported === undefined) {
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
  return publishSelectedCut(catalog, authoredPrefix, selectedProducts, unsupported);
}
