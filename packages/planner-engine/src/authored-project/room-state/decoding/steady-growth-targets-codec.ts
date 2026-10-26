import type { Catalog } from '../../../catalog-schema';
import {
  isOutcomeCycleKey,
  traitOfferGivesSteadyGrowth,
  type AuthoredTraitOffer,
} from '../../traits/state';
import { expectNonBlankString, expectRecord, failProjectDocument } from '../../validation';

/** Sparse cycle-keyed targets, allowed only on an offer whose acquisition installs Steady Growth. */
export function decodeSteadyGrowthTargets(
  value: unknown,
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  path: string,
): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!traitOfferGivesSteadyGrowth(catalog, offer))
    failProjectDocument(path, 'is supported only by an offer that gives Steady Growth');
  const record = expectRecord(value, path);
  const targets: Record<string, string> = {};
  for (const [cycle, raw] of Object.entries(record)) {
    if (!isOutcomeCycleKey(cycle)) failProjectDocument(`${path}.${cycle}`, 'unknown cycle');
    const traitKey = expectNonBlankString(raw, `${path}.${cycle}`);
    if (catalog.traits.byKey[traitKey] === undefined)
      failProjectDocument(`${path}.${cycle}`, 'unknown trait');
    targets[cycle] = traitKey;
  }
  if (Object.keys(targets).length === 0) failProjectDocument(path, 'must not be empty');
  return Object.freeze(targets);
}
