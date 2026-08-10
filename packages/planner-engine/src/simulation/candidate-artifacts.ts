import {
  semanticAddressKey,
  type BiomeAddress,
  type TraitOfferAddress,
  type TargetAddress,
} from '../authored-project/addresses';
import type { Catalog } from '../catalog-schema';
import type { AuthoredTraitOffer } from '../authored-project/traits';
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
import {
  assessTraitOffer,
  assessTraitOfferComposition,
  assessTraitReplacementComposition,
  assessSelectedTargetedAcquisition,
  targetedAcquisitionTargetKeys,
  type TraitOfferBranchAssessment,
  type TraitOfferCandidateContext,
  type TraitOfferContext,
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
}

export interface TraitOfferCandidateArtifacts {
  readonly at: (address: TraitOfferAddress) => TraitOfferCandidateCapability | undefined;
}

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
  readonly roomLifecycles: RoomLifecycleCandidateArtifacts;
  readonly encounters: EncounterCandidateArtifacts;
  readonly traitOffers: TraitOfferCandidateArtifacts;
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
): BiomeCandidateArtifacts {
  return Object.freeze({
    origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
  });
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
