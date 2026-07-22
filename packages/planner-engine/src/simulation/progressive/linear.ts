import {
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { LinearBiomePlan } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import { evaluateLinearRoomGeneration, type LinearRoomGenerationValidation } from '../generation';
import {
  composeLinearHistoryPrefix,
  type CanonicalLinearHistory,
  type LinearBiomeHistoryPrefix,
} from '../history';
import {
  materializeLinearBiomePrefix,
  type CanonicalBatch,
  type MaterializedLinearBiomePrefix,
  type MaterializedLinearFrontierGeneration,
} from '../materialization';
import type { SemanticFinding } from '../model';
import type { RewardGenerationFindingCode } from '../model';
import {
  evaluateLinearRewards,
  type LinearRewardBranch,
  type LinearRewardSimulation,
} from '../rewards';

interface LinearPrefixProducts {
  readonly history: LinearBiomeHistoryPrefix;
  readonly rewards: LinearRewardSimulation;
  readonly roomGeneration: LinearRoomGenerationValidation;
}

export interface ProgressiveLinearEvaluation extends LinearPrefixProducts {
  readonly materializedPrefix: MaterializedLinearBiomePrefix;
  readonly blockedAt?: SemanticAddress;
}

interface LinearPrefixSeed {
  readonly history: CanonicalLinearHistory;
  readonly rewardBranches: readonly LinearRewardBranch[];
}

function evaluateProducts(
  catalog: Catalog,
  prefix: MaterializedLinearBiomePrefix,
  enteredBiomeCount: number,
  seed?: LinearPrefixSeed,
): LinearPrefixProducts {
  const history = composeLinearHistoryPrefix(catalog, prefix, seed?.history);
  const rewards = evaluateLinearRewards(
    catalog,
    prefix,
    history,
    enteredBiomeCount,
    seed?.rewardBranches,
  );
  return Object.freeze({
    history,
    rewards,
    roomGeneration: evaluateLinearRoomGeneration(
      catalog,
      prefix,
      history,
      enteredBiomeCount,
      rewards.targetHistory,
    ),
  });
}

function addressOccurrenceId(origin: SemanticAddress): string | undefined {
  return 'occurrenceId' in origin ? origin.occurrenceId : undefined;
}

function generationOwnsFinding(
  generation: CanonicalBatch | MaterializedLinearFrontierGeneration,
  finding: SemanticFinding,
): boolean {
  const originKey = semanticAddressKey(finding.origin);
  if (
    semanticAddressKey(generation.origin) === originKey ||
    semanticAddressKey(generation.pickedOrigin) === originKey ||
    (generation.rewardStore !== undefined &&
      semanticAddressKey(generation.rewardStore.origin) === originKey)
  ) {
    return true;
  }
  const occurrenceId = addressOccurrenceId(finding.origin);
  return generation.targets.some(
    (target) =>
      semanticAddressKey(target.origin) === originKey ||
      (occurrenceId !== undefined && target.room.occurrenceId === occurrenceId),
  );
}

function rewardFindingPoint(
  code: RewardGenerationFindingCode,
  origin: SemanticAddress,
): 'generation' | 'lifecycle' {
  switch (code) {
    case 'rewardAcquisitionUnavailable':
    case 'shopOfferUnavailable':
    case 'shopPurchaseUnavailable':
      return 'lifecycle';
    case 'baseRewardStoreUnavailable':
    case 'rewardBagEntryUnavailable':
    case 'rewardBagSupportEmpty':
    case 'rewardPayloadInvalid':
    case 'rewardSourceUnavailable':
      return origin.kind === 'fixedEntryReward' ||
        origin.kind === 'occurrence' ||
        origin.kind === 'rewardWheelOffer' ||
        origin.kind === 'shopOffer' ||
        origin.kind === 'shopPurchase'
        ? 'lifecycle'
        : 'generation';
  }
}

interface LocatedPrefixFinding {
  readonly finding: SemanticFinding;
  readonly generationIndex: number;
  readonly point: 'generation' | 'lifecycle';
  readonly order: number;
}

function locateFinding(
  prefix: MaterializedLinearBiomePrefix,
  finding: SemanticFinding,
): LocatedPrefixFinding | undefined {
  const generations: readonly (CanonicalBatch | MaterializedLinearFrontierGeneration)[] = [
    ...prefix.batches,
    ...(prefix.frontierGeneration === undefined ? [] : [prefix.frontierGeneration]),
  ];
  const occurrenceId = addressOccurrenceId(finding.origin);
  const entryOwnsFinding =
    occurrenceId !== undefined &&
    prefix.entryRooms.some(
      (room) => room.kind === 'authored' && room.occurrenceId === occurrenceId,
    );
  const point =
    finding.phase === 'rewardGeneration' && entryOwnsFinding
      ? 'lifecycle'
      : finding.phase === 'rewardGeneration'
        ? rewardFindingPoint(finding.code as RewardGenerationFindingCode, finding.origin)
        : 'generation';
  if (point === 'lifecycle') {
    if (occurrenceId === undefined) {
      return Object.freeze({ finding, generationIndex: -1, point: 'lifecycle', order: 0 });
    }
    const generationIndex = prefix.batches.findIndex((batch) =>
      batch.targets.some((target) => target.picked && target.room.occurrenceId === occurrenceId),
    );
    return generationIndex < 0
      ? Object.freeze({ finding, generationIndex: -1, point: 'lifecycle', order: 0 })
      : Object.freeze({
          finding,
          generationIndex,
          point: 'lifecycle',
          order: generationIndex * 2 + 1,
        });
  }
  const generationIndex = generations.findIndex((generation) =>
    generationOwnsFinding(generation, finding),
  );
  return generationIndex < 0
    ? undefined
    : Object.freeze({
        finding,
        generationIndex,
        point: 'generation',
        order: generationIndex * 2,
      });
}

function firstUnsupportedFinding(
  prefix: MaterializedLinearBiomePrefix,
  products: LinearPrefixProducts,
): LocatedPrefixFinding | undefined {
  return [...products.roomGeneration.findings, ...products.rewards.findings]
    .map((finding) => locateFinding(prefix, finding))
    .filter((located): located is LocatedPrefixFinding => located !== undefined)
    .sort((left, right) => left.order - right.order)[0];
}

function unenteredTarget(target: MaterializedLinearFrontierGeneration['targets'][number]) {
  const room = { ...target.room };
  delete room.entryState;
  return Object.freeze({
    ...target,
    room: Object.freeze({ ...room, entered: false }),
  });
}

function frontierFromBatch(batch: CanonicalBatch): MaterializedLinearFrontierGeneration {
  return Object.freeze({
    kind: 'batch',
    origin: batch.origin,
    parent: batch.parent,
    rewardStore: batch.rewardStore,
    batchState: batch.batchState,
    targets: Object.freeze(batch.targets.map(unenteredTarget)),
    pickedExitIndex: batch.pickedExitIndex,
    pickedOrigin: batch.pickedOrigin,
  });
}

function clampPrefix(
  prefix: MaterializedLinearBiomePrefix,
  located: LocatedPrefixFinding,
): MaterializedLinearBiomePrefix {
  if (located.point === 'lifecycle') {
    return Object.freeze({
      kind: prefix.kind,
      routeKey: prefix.routeKey,
      biomeKey: prefix.biomeKey,
      entryRooms: prefix.entryRooms,
      batches: Object.freeze(prefix.batches.slice(0, located.generationIndex + 1)),
      biomeState: prefix.biomeState,
    });
  }
  const generation =
    located.generationIndex < prefix.batches.length
      ? frontierFromBatch(prefix.batches[located.generationIndex]!)
      : prefix.frontierGeneration;
  if (generation === undefined) {
    return prefix;
  }
  return Object.freeze({
    ...prefix,
    batches: Object.freeze(prefix.batches.slice(0, located.generationIndex)),
    frontierGeneration: generation,
  });
}

export function evaluateProgressiveLinearBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
  enteredBiomeCount: number,
  seed?: LinearPrefixSeed,
): ProgressiveLinearEvaluation | null {
  let materializedPrefix = materializeLinearBiomePrefix(catalog, biome, plan);
  if (materializedPrefix === null) {
    return null;
  }
  let products = evaluateProducts(catalog, materializedPrefix, enteredBiomeCount, seed);
  const unsupported = firstUnsupportedFinding(materializedPrefix, products);
  if (unsupported !== undefined) {
    materializedPrefix = clampPrefix(materializedPrefix, unsupported);
    products = evaluateProducts(catalog, materializedPrefix, enteredBiomeCount, seed);
  }
  return Object.freeze({
    materializedPrefix,
    ...products,
    ...(unsupported === undefined ? {} : { blockedAt: unsupported.finding.origin }),
  });
}
