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
    const traitOfferLevelRoll =
      aspect.traitOfferLevelRoll === undefined
        ? undefined
        : normalizeAspectTraitOfferLevelRoll(
            aspect.traitOfferLevelRoll,
            `${path}.traitOfferLevelRoll`,
          );
    return Object.freeze({
      key: requireNonEmpty(aspect.key, `${path}.key`),
      label: requireNonEmpty(aspect.label, `${path}.label`),
      weaponKey,
      ...(startingTrait === undefined ? {} : { startingTrait }),
      ...(traitOfferLevelRoll === undefined ? {} : { traitOfferLevelRoll }),
    });
  });
  return createCollection(values, 'aspects', (aspect) => aspect.key);
}

function normalizeAspectTraitOfferLevelRoll(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['traitOfferLevelRoll']> {
  const value = requireObject(raw, path);
  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !Object.hasOwn(value, 'maximumRoll') ||
    !Object.hasOwn(value, 'upgradedMaximumRoll') ||
    !Object.hasOwn(value, 'upgradeTraitKey')
  )
    fail(path, 'must contain exactly maximumRoll, upgradedMaximumRoll, and upgradeTraitKey');
  const maximumRoll = requireNonNegativeInteger(value.maximumRoll as number, `${path}.maximumRoll`);
  const upgradedMaximumRoll = requireNonNegativeInteger(
    value.upgradedMaximumRoll as number,
    `${path}.upgradedMaximumRoll`,
  );
  if (upgradedMaximumRoll <= maximumRoll)
    fail(`${path}.upgradedMaximumRoll`, 'must exceed maximumRoll');
  return Object.freeze({
    maximumRoll,
    upgradedMaximumRoll,
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
