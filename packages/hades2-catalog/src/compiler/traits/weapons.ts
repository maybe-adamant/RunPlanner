import type { CatalogCollection, WeaponDeclaration } from '@run-planner/engine/catalog-schema';

import type { RawTraitCatalogInput, RawWeaponDeclaration } from '../../declarations/traits/types';
import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
} from '../common';
import { fail } from '../errors';

export function normalizeWeapons(
  raw: RawTraitCatalogInput['weapons'],
): CatalogCollection<WeaponDeclaration> {
  const declarations = requireArray(raw, 'weapons').map(
    (value, index) => requireObject(value, `weapons[${index}]`) as unknown as RawWeaponDeclaration,
  );
  const values = declarations.map((weapon, index) => {
    const path = `weapons[${index}]`;
    const aspectKeys = freezeUniqueStrings(
      requireArray(weapon.aspectKeys, `${path}.aspectKeys`) as readonly string[],
      `${path}.aspectKeys`,
    );
    if (aspectKeys.length !== 4) fail(`${path}.aspectKeys`, 'must declare four aspects');
    const defaultAspectKey = requireNonEmpty(weapon.defaultAspectKey, `${path}.defaultAspectKey`);
    if (!aspectKeys.includes(defaultAspectKey))
      fail(`${path}.defaultAspectKey`, 'must belong to aspectKeys');
    return Object.freeze({
      key: requireNonEmpty(weapon.key, `${path}.key`),
      label: requireNonEmpty(weapon.label, `${path}.label`),
      aspectKeys,
      defaultAspectKey,
    });
  });
  return createCollection(values, 'weapons', (weapon) => weapon.key);
}
