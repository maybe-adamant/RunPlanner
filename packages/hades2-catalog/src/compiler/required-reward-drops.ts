import type {
  CatalogCollection,
  RequiredRewardDropDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

export function normalizeRequiredRewardDrops(
  raw: readonly RequiredRewardDropDeclaration[],
): CatalogCollection<RequiredRewardDropDeclaration> {
  return createCollection(
    raw.map((drop, index) => {
      const path = `requiredRewardDrops[${index}]`;
      return Object.freeze({
        key: requireNonEmpty(drop.key, `${path}.key`),
        label: requireNonEmpty(drop.label, `${path}.label`),
        resourceKey: requireNonEmpty(drop.resourceKey, `${path}.resourceKey`),
        amount: requirePositiveInteger(drop.amount, `${path}.amount`),
        amountPerClearedBiome: requireNonNegativeInteger(
          drop.amountPerClearedBiome,
          `${path}.amountPerClearedBiome`,
        ),
      });
    }),
    'requiredRewardDrops',
    (drop) => drop.key,
  );
}

/** Every room's forced drop resolves to a declared drop. */
export function validateRoomRequiredRewardDrops(
  rooms: CatalogCollection<RoomDeclaration>,
  requiredRewardDrops: CatalogCollection<RequiredRewardDropDeclaration>,
): void {
  for (const room of rooms.values) {
    const dropKey = room.requiredReward?.dropKey;
    if (dropKey !== undefined && requiredRewardDrops.byKey[dropKey] === undefined)
      fail(
        `rooms.${room.gameName}.requiredReward.dropKey`,
        `unknown required reward drop ${dropKey}`,
      );
  }
}
