import type { Catalog } from '../../catalog-schema';
import type { AuthoredAllTogetherResult } from '../traits';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from '../validation';

/** Strict structural decoder for the one declaration-owned All Together map. */
export function decodeAllTogetherResult(
  value: unknown,
  catalog: Catalog,
  traitKey: string,
  path: string,
): AuthoredAllTogetherResult {
  const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'directTraitSets')
    failProjectDocument(path, 'is supported only by All Together');
  const record = expectRecord(value, path);
  const keys = disposition.sets.map((set) => set.key);
  expectExactKeys(record, keys, path);
  return Object.freeze(
    Object.fromEntries(
      disposition.sets.map((set) => {
        const raw = record[set.key];
        if (raw === null) return [set.key, null];
        const trait = expectString(raw, `${path}.${set.key}`);
        if (!set.traitKeys.includes(trait))
          failProjectDocument(
            `${path}.${set.key}`,
            `must be null or one of ${set.traitKeys.join(', ')}`,
          );
        return [set.key, trait];
      }),
    ),
  ) as AuthoredAllTogetherResult;
}
