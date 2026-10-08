import type { CatalogCollection, FamiliarDeclaration } from '@run-planner/engine/catalog-schema';

import type { RawFamiliarDeclaration } from '../declarations';
import { createCollection, requireNonEmpty, requireObject, requirePositiveInteger } from './common';
import { fail } from './errors';

export function normalizeFamiliars(
  raw: readonly RawFamiliarDeclaration[],
): CatalogCollection<FamiliarDeclaration> {
  const values = raw.map((familiar, index): FamiliarDeclaration => {
    const path = `familiars[${index}]`;
    const record = requireObject(familiar, path);
    const extra = Object.keys(record).find(
      (key) => !['key', 'label', 'matureStatUpgradeCount', 'maxStatPerStack'].includes(key),
    );
    if (extra !== undefined) fail(`${path}.${extra}`, 'is not supported');
    const effect = familiar.maxStatPerStack;
    if (effect !== undefined) {
      const effectRecord = requireObject(effect, `${path}.maxStatPerStack`);
      if (Object.keys(effectRecord).length !== 2)
        fail(`${path}.maxStatPerStack`, 'requires only stat and amount');
      if (effect.stat !== 'maxHealth' && effect.stat !== 'maxMana')
        fail(`${path}.maxStatPerStack.stat`, 'must be maxHealth or maxMana');
      requirePositiveInteger(effect.amount, `${path}.maxStatPerStack.amount`);
    }
    return Object.freeze({
      key: requireNonEmpty(familiar.key, `${path}.key`),
      label: requireNonEmpty(familiar.label, `${path}.label`),
      matureStatUpgradeCount: requirePositiveInteger(
        familiar.matureStatUpgradeCount,
        `${path}.matureStatUpgradeCount`,
      ),
      ...(effect === undefined
        ? {}
        : { maxStatPerStack: Object.freeze({ stat: effect.stat, amount: effect.amount }) }),
    });
  });
  return createCollection(values, 'familiars', (familiar) => familiar.key);
}

export function normalizeDefaultFamiliarKey(
  key: string,
  familiars: CatalogCollection<FamiliarDeclaration>,
): string {
  if (familiars.byKey[key] === undefined)
    fail('defaultFamiliarKey', `unknown familiar ${String(key)}`);
  return key;
}
