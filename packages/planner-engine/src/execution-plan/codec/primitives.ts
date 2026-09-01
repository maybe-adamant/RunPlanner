import type { ExecutionRunStateCount, ExecutionWellGenerationKey } from '../model';

export const MAX_ITEMS = 256;
export const MAX_STRING = 512;
export type Dict = Record<string, unknown>;

export class ExecutionPlanCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionPlanCodecError';
  }
}

export function fail(message: string): never {
  throw new ExecutionPlanCodecError(message);
}

export function object(value: unknown, label: string): Dict {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as Dict;
}

export function exact(
  record: Dict,
  required: readonly string[],
  optional: readonly string[] = [],
  label = 'value',
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record))
    if (!allowed.has(key)) fail(`${label} contains unknown field ${key}`);
  for (const key of required)
    if (!(key in record) || record[key] === undefined) fail(`${label}.${key} is required`);
}

export function stringValue(value: unknown, label: string, max = MAX_STRING): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max)
    fail(`${label} must be a bounded non-empty string`);
  return value;
}

export function wellGenerationKey(value: unknown, label: string): ExecutionWellGenerationKey {
  const parsed = stringValue(value, label);
  if (
    parsed !== 'initial:healing' &&
    parsed !== 'initial:secondLeft' &&
    parsed !== 'initial:secondRight' &&
    parsed !== 'travelDealRefill'
  )
    fail(`${label} is unsupported`);
  return parsed;
}

export function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
  return value;
}

export function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

export function integer(value: unknown, label: string, minimum = 0): number {
  const parsed = numberValue(value, label);
  if (!Number.isInteger(parsed) || parsed < minimum)
    fail(`${label} must be an integer >= ${minimum}`);
  return parsed;
}

export function array(value: unknown, label: string, max = MAX_ITEMS): readonly unknown[] {
  if (!Array.isArray(value) || value.length > max)
    fail(`${label} must be an array of at most ${max} items`);
  return value;
}

export function stringArray(value: unknown, label: string, max = MAX_ITEMS): readonly string[] {
  return array(value, label, max).map((entry, index) => stringValue(entry, `${label}[${index}]`));
}

export function numberRecord(value: unknown, label: string): Readonly<Record<string, number>> {
  const record = object(value, label);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    stringValue(key, `${label} key`);
    result[key] = numberValue(entry, `${label}.${key}`);
  }
  return Object.freeze(result);
}

export function count(value: unknown, label: string): ExecutionRunStateCount {
  const record = object(value, label);
  if (record.kind === 'exact') {
    exact(record, ['kind', 'count'], [], label);
    return Object.freeze({ kind: 'exact', count: integer(record.count, `${label}.count`) });
  }
  if (record.kind === 'range') {
    exact(record, ['kind', 'min', 'max'], [], label);
    const min = integer(record.min, `${label}.min`);
    const max = integer(record.max, `${label}.max`);
    if (max < min) fail(`${label}.max must be >= min`);
    return Object.freeze({ kind: 'range', min, max });
  }
  fail(`${label}.kind is unsupported`);
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Dict)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}

export function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of stableJson(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
