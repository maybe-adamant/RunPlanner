import { semanticAddressKey } from '../../authored-project/addresses';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
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

export function executionRoomOwnerKey(room: CanonicalAuthoredRoom): string {
  return semanticAddressKey(room.origin);
}
