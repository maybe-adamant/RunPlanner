import type { Catalog } from '../catalog-schema';
import type { AuthoredFountainRarityResult } from './model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from './validation';

export function decodeFountainRarityResult(
  value: unknown,
  catalog: Catalog,
  path: string,
): AuthoredFountainRarityResult {
  const result = expectRecord(value, path);
  expectExactKeys(result, ['targetTraitKey'], path);
  const targetTraitKey = expectString(result.targetTraitKey, `${path}.targetTraitKey`);
  if (catalog.traits.byKey[targetTraitKey] === undefined)
    failProjectDocument(`${path}.targetTraitKey`, `unknown trait ${targetTraitKey}`);
  return Object.freeze({ targetTraitKey });
}
