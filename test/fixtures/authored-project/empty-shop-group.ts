import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import type { Catalog } from '@run-planner/engine/catalog-schema';

/** A requirement no reached route position satisfies. */
const unreachable = Object.freeze({
  kind: 'counterRange' as const,
  axis: 'biomeDepthCache' as const,
  range: Object.freeze({ min: 999 }),
});

/**
 * A test catalog whose room gives one declared Shop group zero eligible
 * options, standing in for a closed first-run profile without editing
 * production shop declarations.
 */
export function catalogWithEmptyShopGroup(
  base: Catalog,
  roomGameName: string,
  groupKey: string,
): Catalog {
  const room = base.rooms.byKey[roomGameName];
  const binding = room?.incomingReward;
  if (binding?.kind !== 'shop') throw new Error(`${roomGameName} is not a Shop room`);
  const profile = base.rewards.shops.byKey[binding.shopProfileKey];
  const group = profile?.groups.byKey[groupKey];
  if (profile === undefined || group === undefined)
    throw new Error(`${binding.shopProfileKey} has no group ${groupKey}`);
  const closed = group.options.values.map((option) => option.key);
  const shared = profile.groups.values.some(
    (other) =>
      other.key !== groupKey && other.options.values.some((option) => closed.includes(option.key)),
  );
  // Additional requirements are keyed by option key across the whole profile.
  if (shared) throw new Error(`${groupKey} shares option keys with another group`);
  return createCatalog({
    ...declarations,
    rooms: declarations.rooms.map((raw) =>
      raw.gameName !== roomGameName || raw.incomingReward?.kind !== 'shop'
        ? raw
        : {
            ...raw,
            incomingReward: {
              ...raw.incomingReward,
              additionalOptionRequirements: {
                ...(raw.incomingReward.additionalOptionRequirements ?? {}),
                ...Object.fromEntries(closed.map((key) => [key, unreachable])),
              },
            },
          },
    ),
  });
}
