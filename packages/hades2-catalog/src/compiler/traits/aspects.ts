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
    const maxStatBonus =
      aspect.maxStatBonus === undefined
        ? undefined
        : normalizeAspectMaxStatBonus(aspect.maxStatBonus, `${path}.maxStatBonus`);
    return Object.freeze({
      key: requireNonEmpty(aspect.key, `${path}.key`),
      label: requireNonEmpty(aspect.label, `${path}.label`),
      weaponKey,
      ...(startingTrait === undefined ? {} : { startingTrait }),
      ...(traitOfferLevelBonus === undefined ? {} : { traitOfferLevelBonus }),
      ...(maxStatBonus === undefined ? {} : { maxStatBonus }),
    });
  });
  return createCollection(values, 'aspects', (aspect) => aspect.key);
}

function normalizeAspectMaxStatBonus(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['maxStatBonus']> {
  const value = requireObject(raw, path);
  const keys = ['stat', 'amount', 'upgradedAmount'];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    fail(path, 'must contain exactly stat, amount, and upgradedAmount');
  if (value.stat !== 'maxHealth' && value.stat !== 'maxMana')
    fail(`${path}.stat`, 'must be maxHealth or maxMana');
  const amount = value.amount;
  const upgradedAmount = value.upgradedAmount;
  if (typeof amount !== 'number' || !(amount > 0)) fail(`${path}.amount`, 'must be positive');
  if (typeof upgradedAmount !== 'number' || !(upgradedAmount > amount))
    fail(`${path}.upgradedAmount`, 'must exceed amount');
  return Object.freeze({
    stat: value.stat,
    amount,
    upgradedAmount,
  });
}

function normalizeAspectTraitOfferLevelBonus(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['traitOfferLevelBonus']> {
  const value = requireObject(raw, path);
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !Object.hasOwn(value, 'maximumBonus') ||
    !Object.hasOwn(value, 'upgradedMaximumBonus')
  )
    fail(path, 'must contain exactly maximumBonus and upgradedMaximumBonus');
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
