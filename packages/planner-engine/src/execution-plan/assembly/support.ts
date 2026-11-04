import { semanticAddressKey } from '../../authored-project/addresses';
import type { PublishedBiomeEvaluation } from '../../simulation/evaluation/evaluation-products';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { RewardBranch } from '../../simulation/rewards/model';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}

export function agreement<T>(values: readonly T[], label: string): T {
  const first = values[0];
  if (first === undefined || values.some((value) => stableJson(value) !== stableJson(first)))
    throw new CompilerError('executionCoverageMissing', `divergent ${label}`);
  return first;
}

/** A complete-valid biome's walk ends on its one reached state. */
export function completeFrontier(biome: PublishedBiomeEvaluation): RewardBranch {
  const frontier = biome.rewards.frontier;
  if (frontier === undefined)
    throw new CompilerError('executionCoverageMissing', `${biome.biomeKey} has no reached state`);
  return frontier;
}

export function executionRoomOwnerKey(room: CanonicalAuthoredRoom): string {
  return semanticAddressKey(room.origin);
}
