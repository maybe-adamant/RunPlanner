import {
  semanticAddressKey,
  type BiomeAddress,
  type LevelResolutionAddress,
  type TraitOfferAddress,
  type TargetAddress,
  type BossCompletionArcanaAddress,
} from '../authored-project/addresses';
import type { Catalog } from '../catalog-schema';
import type { AuthoredLevelResolution, AuthoredTraitOffer } from '../authored-project/traits';
import { optionIndex, type TraitOptionKey } from '../authored-project/traits';
import type { RoomTargetCandidateContext } from './generation/model';
import {
  createEmptyRewardProducerCandidateArtifacts,
  type RewardProducerCandidateArtifacts,
} from './rewards/producer-frontiers';
import {
  createEmptyRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
} from './rewards/lifecycle-artifacts';
import type { EncounterCandidateArtifacts } from './encounters';
import { circeResolutionDomain } from './arcana-fear';
import {
  assessTraitOffer,
  assessTraitOfferComposition,
  assessTraitReplacementComposition,
  assessSelectedTargetedAcquisition,
  targetedAcquisitionTargetKeys,
  type TraitOfferBranchAssessment,
  type TraitOfferCandidateContext,
  type TraitOfferContext,
  evaluateReachedLevelResolution,
  pomEligibleTargetKeys,
  type TraitHistoryState,
} from './traits';

function emptyEncounterCandidateArtifacts(): EncounterCandidateArtifacts {
  return Object.freeze({ at: () => undefined, statusAt: () => undefined, roomAt: () => undefined });
}

/**
 * The room-target capability produced while one biome is evaluated.
 *
 * Its backing index is deliberately private: downstream composition may carry
 * this product, but only the room-target evaluator can ask it for a context.
 */
export interface RoomTargetCandidateArtifacts {
  readonly at: (target: TargetAddress) => RoomTargetCandidateContext | undefined;
}

/**
 * Exact trait-offer contact retained by one biome reward evaluation. The
 * pre-offer histories and resolved contexts are intentionally reachable only
 * through this capability; they are not part of the public simulation data.
 */
export interface TraitOfferCandidateCapability {
  readonly evaluateOffer: (value: AuthoredTraitOffer) => readonly TraitOfferBranchAssessment[];
  readonly targetedAcquisitionTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly {
    readonly sourceSupported: boolean;
    readonly targetTraitKeys: readonly string[];
  }[];
  /** Exact selected-Circe pre-effect domains; no consumer receives Arcana/Fear state. */
  readonly circeResolution: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly {
    readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
    readonly requiredCount: number;
    readonly arcanaKeys: readonly string[];
    readonly vowKeys: readonly string[];
    readonly outerAvailable: boolean;
  }[];
}

export interface TraitOfferCandidateArtifacts {
  readonly at: (address: TraitOfferAddress) => TraitOfferCandidateCapability | undefined;
}

export interface LevelResolutionCandidateBranch {
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
  readonly levelCount: number;
  /** Defined only for a declaration-owned visible Pom choice. */
  readonly requiredOfferCount?: number;
  /** Exact pre-acquisition target domain for this simulation branch. */
  readonly eligibleTargetTraitKeys: readonly string[];
}

export interface LevelResolutionCandidateEvaluation {
  /** Stable index into the capability's branch-correlated surfaces. */
  readonly branchIndex: number;
  readonly supported: boolean;
  readonly findings: readonly string[];
}

export interface LevelResolutionCandidateCapability {
  readonly branches: readonly LevelResolutionCandidateBranch[];
  readonly evaluate: (
    value: AuthoredLevelResolution,
  ) => readonly LevelResolutionCandidateEvaluation[];
}

export interface LevelResolutionCandidateArtifacts {
  readonly at: (address: LevelResolutionAddress) => LevelResolutionCandidateCapability | undefined;
}

/** Atomic exact-set support captured immediately before one Boss completion effect. */
export interface BossCompletionArcanaCandidateCapability {
  readonly inactiveArcanaKeys: readonly string[];
  readonly requiredCount: number;
}
export interface BossCompletionArcanaCandidateArtifacts {
  readonly at: (
    address: BossCompletionArcanaAddress,
  ) => BossCompletionArcanaCandidateCapability | undefined;
}
export function createBossCompletionArcanaCandidateArtifacts(
  contexts: ReadonlyMap<string, BossCompletionArcanaCandidateCapability>,
): BossCompletionArcanaCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: BossCompletionArcanaAddress) => privateContexts.get(semanticAddressKey(address)),
  });
}

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
  readonly roomLifecycles: RoomLifecycleCandidateArtifacts;
  readonly encounters: EncounterCandidateArtifacts;
  readonly traitOffers: TraitOfferCandidateArtifacts;
  readonly levelResolutions: LevelResolutionCandidateArtifacts;
  readonly bossCompletionArcana: BossCompletionArcanaCandidateArtifacts;
}

/** Candidate capabilities produced by the exact project simulation execution. */
export interface ProjectCandidateArtifacts {
  readonly biomeAt: (biome: BiomeAddress) => BiomeCandidateArtifacts | undefined;
}

export class CandidateArtifactContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CandidateArtifactContractError';
  }
}

export function createRoomTargetCandidateArtifacts(
  contexts: ReadonlyMap<string, RoomTargetCandidateContext>,
): RoomTargetCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (target: TargetAddress) => privateContexts.get(semanticAddressKey(target)),
  });
}

/** Candidate-authored conditions replace the persisted offer facts captured at this frontier. */
function traitOfferCandidateContext(
  context: TraitOfferContext,
  value: AuthoredTraitOffer,
): TraitOfferContext {
  return value.deathDefianceConditionMet === undefined
    ? context
    : Object.freeze({
        ...context,
        deathDefianceConditionMet: value.deathDefianceConditionMet,
      });
}

export function createBiomeCandidateArtifacts(
  origin: BiomeAddress,
  roomTargets: RoomTargetCandidateArtifacts,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  encounters: EncounterCandidateArtifacts = emptyEncounterCandidateArtifacts(),
  traitOffers: TraitOfferCandidateArtifacts = createEmptyTraitOfferCandidateArtifacts(),
  levelResolutions: LevelResolutionCandidateArtifacts = createEmptyLevelResolutionCandidateArtifacts(),
  bossCompletionArcana: BossCompletionArcanaCandidateArtifacts = createBossCompletionArcanaCandidateArtifacts(
    new Map(),
  ),
): BiomeCandidateArtifacts {
  return Object.freeze({
    origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
    levelResolutions,
    bossCompletionArcana,
  });
}

export function createLevelResolutionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    readonly {
      readonly address: LevelResolutionAddress;
      readonly before: TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >,
): LevelResolutionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: LevelResolutionAddress) => {
      const branches = privateContexts.get(semanticAddressKey(address));
      if (branches === undefined) return undefined;
      const surfaces = Object.freeze(
        branches.map((branch) =>
          Object.freeze({
            effectKind: branch.effectKind,
            ...(branch.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
            levelCount: branch.levelCount,
            ...(branch.effectKind === 'choice'
              ? { requiredOfferCount: Math.min(3, branch.before.upgradableTraitCount) }
              : {}),
            eligibleTargetTraitKeys: pomEligibleTargetKeys(catalog, branch.before),
          }),
        ),
      );
      return Object.freeze({
        branches: surfaces,
        evaluate: (value: AuthoredLevelResolution) =>
          Object.freeze(
            branches.map((branch, branchIndex) => {
              const evaluation = evaluateReachedLevelResolution(
                catalog,
                branch.address,
                value,
                branch.levelCount,
                branch.before,
                0,
                branch.effectKind,
                branch.emptyTargetAllowed ?? false,
              );
              return Object.freeze({
                branchIndex,
                supported: evaluation.findings.length === 0,
                findings: evaluation.findings,
              });
            }),
          ),
      });
    },
  });
}

export function createEmptyLevelResolutionCandidateArtifacts(): LevelResolutionCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export function createTraitOfferCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly TraitOfferCandidateContext[]>,
): TraitOfferCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: TraitOfferAddress) => {
      const branchContexts = privateContexts.get(semanticAddressKey(address));
      if (branchContexts === undefined) return undefined;
      return Object.freeze({
        evaluateOffer: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const candidateContext = traitOfferCandidateContext(context.context, value);
              return Object.freeze({
                assessments: assessTraitOffer(catalog, value, context.before, candidateContext),
                composition: assessTraitOfferComposition(catalog, value, context.before),
                replacementComposition: assessTraitReplacementComposition(
                  catalog,
                  value,
                  context.before,
                  candidateContext,
                ),
                targetedAcquisition: assessSelectedTargetedAcquisition(
                  catalog,
                  value,
                  context.before,
                ),
              });
            }),
          ),
        targetedAcquisitionTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.map((context) => {
              const option = value.options[optionIndex(optionKey)];
              if (option === undefined) {
                return Object.freeze({
                  sourceSupported: false,
                  targetTraitKeys: Object.freeze([]),
                });
              }
              const sourceAssessment = assessTraitOffer(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(context.context, value),
              )[optionIndex(optionKey)];
              return Object.freeze({
                sourceSupported: sourceAssessment?.legal ?? false,
                targetTraitKeys: targetedAcquisitionTargetKeys(
                  catalog,
                  option.traitKey,
                  context.before,
                ),
              });
            }),
          ),
        circeResolution: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.flatMap<{
              readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
              readonly requiredCount: number;
              readonly arcanaKeys: readonly string[];
              readonly vowKeys: readonly string[];
              readonly outerAvailable: boolean;
            }>((context) => {
              const option = value.options[optionIndex(optionKey)];
              const effect =
                option === undefined
                  ? undefined
                  : catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (effect?.kind !== 'circe' || context.arcanaFear === undefined) return [];
              return [circeResolutionDomain(catalog, context.arcanaFear, effect.effect)];
            }),
          ),
      });
    },
  });
}

export function createEmptyTraitOfferCandidateArtifacts(): TraitOfferCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export function createEmptyBiomeCandidateArtifacts(origin: BiomeAddress): BiomeCandidateArtifacts {
  return createBiomeCandidateArtifacts(
    origin,
    createRoomTargetCandidateArtifacts(new Map()),
    createEmptyRewardProducerCandidateArtifacts(),
    createEmptyRoomLifecycleCandidateArtifacts(),
    emptyEncounterCandidateArtifacts(),
    createEmptyTraitOfferCandidateArtifacts(),
    createEmptyLevelResolutionCandidateArtifacts(),
  );
}

export function createProjectCandidateArtifacts(
  biomes: readonly BiomeCandidateArtifacts[],
): ProjectCandidateArtifacts {
  const privateBiomes = new Map<string, BiomeCandidateArtifacts>();
  for (const biome of biomes) {
    const key = semanticAddressKey(biome.origin);
    if (privateBiomes.has(key)) {
      throw new CandidateArtifactContractError(`duplicate candidate artifacts for ${key}`);
    }
    privateBiomes.set(key, biome);
  }
  return Object.freeze({
    biomeAt: (biome: BiomeAddress) => privateBiomes.get(semanticAddressKey(biome)),
  });
}
