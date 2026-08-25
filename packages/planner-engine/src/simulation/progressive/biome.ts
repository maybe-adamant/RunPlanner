import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomePlan,
  RouteLoadout,
  ResourcePlacements,
} from '../../authored-project/model';
import { evaluateBiomeRoomGenerationAssemblyInternal } from '../generation/biome';
import { evaluateHubDecisionGenerationInternal } from '../generation/hub';
import {
  createBiomeCandidateArtifacts,
  type AcquisitionConversionCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type DerivedAcquisitionEntryCandidateArtifacts,
  type JudgmentArcanaCandidateArtifacts,
  type KeepsakeEquipResultCandidateArtifacts,
  type KeepsakeSelectionCandidateArtifacts,
} from '../candidate-artifacts';
import {
  composeBiomeHistoryPrefixWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type EncounterHistoryBlock,
  type FigLeafLifecycleState,
} from '../history';
import type { MaterializedBiomePrefix } from '../materialization';
import { evaluateEncounterCandidatesInternal } from '../encounters/candidates';
import { structurallyActiveEncounterRooms } from '../encounters/structural';
import type { EncounterCandidateBoundary } from '../encounters/candidates';
import { materializeBiomePrefix } from '../materialization';
import { ownerRegion, type FindingRegionEntry } from '../finding-regions';
import {
  evaluateBiomeRewardsAssemblyInternal,
  type TraitChildSettlementCheckpoints,
} from '../rewards/biome';
import type { BiomeRewardSimulation, RewardBranch } from '../rewards';
import type { RewardProducerCandidateArtifacts } from '../rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from '../rewards/lifecycle-artifacts';
import { attestFigLeafBranchState, attestGorgonBranchState } from '../keepsakes';
import { attestPendingHermesSpellDrop } from '../hermes-shrine';
import {
  compareLocatedFindings,
  encounterBlockChronology,
  encounterBlockFinding,
  firstUnsupportedFinding,
  isProgressiveBlockingFinding,
  locateFinding,
  mergedFindings,
  type ProgressiveBiomeSelectedProducts,
} from './finding-location';
import { encounterBlockProductPrefix } from './prefix';
import { clampSelectedProducts } from './clamp';
import type {
  BiomeGenerationValidation,
  ProgressiveBiomeEvaluation,
  ProgressiveBiomeEvaluationAssembly,
} from './products';

export interface ProgressiveSeed {
  readonly history: CanonicalBiomeHistory;
  readonly rewardBranches: readonly RewardBranch[];
}

export interface ProgressiveBiomeContext {
  readonly enteredBiomeCount: number;
  /** A Postboss rack is reached only when this configured route continues. */
  readonly loadout: RouteLoadout;
  /** Direct biome evaluators supply the explicit empty record; route simulation supplies its owned record. */
  readonly resourcePlacements: ResourcePlacements;
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

function pendingHermesSpellDropLifecycleState(context: ProgressiveBiomeContext): boolean {
  return context.seed === undefined
    ? false
    : attestPendingHermesSpellDrop(context.seed.rewardBranches);
}

interface ProgressiveGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

interface ProgressiveProducts {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly encounterBlock?: EncounterHistoryBlock;
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
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
  traitOffers: import('../candidates/trait-offer-capability').TraitOfferCandidateArtifacts,
  levelResolutions: import('../candidates/trait-offer-capability').LevelResolutionCandidateArtifacts,
  judgmentArcana: JudgmentArcanaCandidateArtifacts,
  keepsakeSelections: KeepsakeSelectionCandidateArtifacts,
  keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts,
  acquisitionConversions: AcquisitionConversionCandidateArtifacts,
  derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts,
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
    rewards.nemesisRandomEventCandidates,
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
      judgmentArcana,
      keepsakeSelections,
      keepsakeEquipResults,
      acquisitionConversions,
      derivedAcquisitionEntries,
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
  const composed = composeBiomeHistoryPrefixWithEncounterValidation(
    catalog,
    prefix,
    context.seed?.history.afterTransition,
    lifecycleFigLeafState,
    lifecyclePendingSpellDrop,
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
    context.resourcePlacements,
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
    rewards.judgmentArcanaArtifacts,
    rewards.keepsakeSelectionArtifacts,
    rewards.keepsakeEquipResultArtifacts,
    rewards.acquisitionConversionArtifacts,
    rewards.derivedAcquisitionEntryArtifacts,
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
  const materializedPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
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
  const authoredPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
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
      authoredPrefix,
      (prefix) => products(catalog, prefix, context),
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
      evaluated.candidateArtifacts.judgmentArcana,
      evaluated.candidateArtifacts.keepsakeSelections,
      evaluated.candidateArtifacts.keepsakeEquipResults,
      evaluated.candidateArtifacts.acquisitionConversions,
      evaluated.candidateArtifacts.derivedAcquisitionEntries,
      evaluated.candidateArtifacts.steadyGrowth,
      evaluated.candidateArtifacts.purgingPools,
      evaluated.candidateArtifacts.hermesShrines,
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
  const authoredPrefix = Object.freeze({
    ...initial,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : { echoKeepsakeReplayResults: plan.echoKeepsakeReplayResults }),
  }) as MaterializedBiomePrefix & {
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
  return clampSelectedProducts(
    authoredPrefix,
    (prefix) => products(catalog, prefix, context),
    selectedProducts,
    unsupported,
  );
}
