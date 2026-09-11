import type { AspectDeclaration, CatalogCollection } from '@run-planner/engine/catalog-schema';

import type { RawAspectDeclaration, RawTraitCatalogInput } from '../../declarations/traits/types';
import {
  createCollection,
  requireArray,
  requireNonEmpty,
  requireNonNegativeInteger,
  requireObject,
} from '../common';
import { fail } from '../errors';

export function normalizeAspects(
  raw: RawTraitCatalogInput['aspects'],
): CatalogCollection<AspectDeclaration> {
  const declarations = requireArray(raw, 'aspects').map(
    (value, index) => requireObject(value, `aspects[${index}]`) as unknown as RawAspectDeclaration,
  );
  const values = declarations.map((aspect, index) => {
    const path = `aspects[${index}]`;
    const weaponKey = requireNonEmpty(aspect.weaponKey, `${path}.weaponKey`);
    const startingTrait =
      aspect.startingTrait === undefined
        ? undefined
        : normalizeAspectStartingTrait(aspect.startingTrait, `${path}.startingTrait`);
    const traitOfferLevelBonus =
      aspect.traitOfferLevelBonus === undefined
        ? undefined
        : normalizeAspectTraitOfferLevelBonus(
            aspect.traitOfferLevelBonus,
            `${path}.traitOfferLevelBonus`,
          );
    return Object.freeze({
      key: requireNonEmpty(aspect.key, `${path}.key`),
      label: requireNonEmpty(aspect.label, `${path}.label`),
      weaponKey,
      ...(startingTrait === undefined ? {} : { startingTrait }),
      ...(traitOfferLevelBonus === undefined ? {} : { traitOfferLevelBonus }),
    });
  });
  return createCollection(values, 'aspects', (aspect) => aspect.key);
}

function normalizeAspectTraitOfferLevelBonus(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['traitOfferLevelBonus']> {
  const value = requireObject(raw, path);
  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !Object.hasOwn(value, 'maximumBonus') ||
    !Object.hasOwn(value, 'upgradedMaximumBonus') ||
    !Object.hasOwn(value, 'upgradeTraitKey')
  )
    fail(path, 'must contain exactly maximumBonus, upgradedMaximumBonus, and upgradeTraitKey');
  const maximumBonus = requireNonNegativeInteger(
    value.maximumBonus as number,
    `${path}.maximumBonus`,
  );
  const upgradedMaximumBonus = requireNonNegativeInteger(
    value.upgradedMaximumBonus as number,
    `${path}.upgradedMaximumBonus`,
  );
  if (upgradedMaximumBonus <= maximumBonus)
    fail(`${path}.upgradedMaximumBonus`, 'must exceed maximumBonus');
  return Object.freeze({
    maximumBonus,
    upgradedMaximumBonus,
    upgradeTraitKey: requireNonEmpty(value.upgradeTraitKey as string, `${path}.upgradeTraitKey`),
  });
}

function normalizeAspectStartingTrait(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['startingTrait']> {
  const value = requireObject(raw, path);
  const keys = Object.keys(value);
  if (keys.length !== 2 || !Object.hasOwn(value, 'traitKey') || !Object.hasOwn(value, 'giverKey')) {
    fail(path, 'must contain exactly traitKey and giverKey');
  }
  return Object.freeze({
    traitKey: requireNonEmpty(value.traitKey as string, `${path}.traitKey`),
    giverKey: requireNonEmpty(value.giverKey as string, `${path}.giverKey`),
  });
}
