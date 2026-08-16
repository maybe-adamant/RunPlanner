import type { Catalog } from '../catalog-schema';
import type { ResolvedRewardOffer } from '../reward-kernel/model';

/**
 * Every authored reward owns an explicit disposition for every declared
 * acquisition role. This is persisted state rather than a settlement-time
 * default: commands and codecs can consequently distinguish an incomplete
 * or malformed document from an intentional normal acquisition.
 */
export function createDefaultDispositionByAcquisitionRole(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): import('./model').AuthoredRewardState['dispositionByAcquisitionRole'] {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) throw new Error(`unknown reward type ${offer.rewardType}`);
  return Object.freeze(
    Object.fromEntries(
      declaration.acquisitionRoles.values.map((role) => [
        role.key,
        Object.freeze({ kind: 'normal' as const }),
      ]),
    ),
  );
}
