import type { CatalogCollection } from '@run-planner/engine/catalog-schema';

import { fail } from './errors';

export function requireNonEmpty(value: string, path: string): string {
  if (value.trim().length === 0) {
    fail(path, 'must not be empty');
  }

  return value;
}

export function requireNonNegativeInteger(value: number, path: string): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(path, 'must be a non-negative integer');
  }

  return value;
}

export function requirePositiveInteger(value: number, path: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    fail(path, 'must be a positive integer');
  }

  return value;
}

export function freezeUniqueStrings(values: readonly string[], path: string): readonly string[] {
  const seen = new Set<string>();
  const normalized = values.map((value, index) => {
    const itemPath = `${path}[${index}]`;
    requireNonEmpty(value, itemPath);
    if (seen.has(value)) {
      fail(itemPath, `duplicates ${value}`);
    }
    seen.add(value);
    return value;
  });

  return Object.freeze(normalized);
}

export function createCollection<T>(
  values: readonly T[],
  path: string,
  keyOf: (value: T) => string,
  keyField = 'key',
): CatalogCollection<T> {
  const byKey = Object.create(null) as Record<string, T>;

  for (const [index, value] of values.entries()) {
    const key = keyOf(value);
    requireNonEmpty(key, `${path}[${index}].${keyField}`);
    if (Object.hasOwn(byKey, key)) {
      fail(`${path}[${index}].${keyField}`, `duplicates ${key}`);
    }
    byKey[key] = value;
  }

  return Object.freeze({
    values: Object.freeze([...values]),
    byKey: Object.freeze(byKey),
  });
}
