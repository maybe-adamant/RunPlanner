import {
  semanticAddressKey,
  type BiomeAddress,
  type TargetAddress,
} from '../authored-project/addresses';
import type { RoomTargetCandidateContext } from './generation/model';
import {
  createEmptyRewardProducerCandidateArtifacts,
  type RewardProducerCandidateArtifacts,
} from './rewards/producer-frontiers';

/**
 * The room-target capability produced while one biome is evaluated.
 *
 * Its backing index is deliberately private: downstream composition may carry
 * this product, but only the room-target evaluator can ask it for a context.
 */
export interface RoomTargetCandidateArtifacts {
  readonly at: (target: TargetAddress) => RoomTargetCandidateContext | undefined;
}

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
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

export function createBiomeCandidateArtifacts(
  origin: BiomeAddress,
  roomTargets: RoomTargetCandidateArtifacts,
  rewardProducers: RewardProducerCandidateArtifacts,
): BiomeCandidateArtifacts {
  return Object.freeze({ origin, roomTargets, rewardProducers });
}

export function createEmptyBiomeCandidateArtifacts(origin: BiomeAddress): BiomeCandidateArtifacts {
  return createBiomeCandidateArtifacts(
    origin,
    createRoomTargetCandidateArtifacts(new Map()),
    createEmptyRewardProducerCandidateArtifacts(),
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
