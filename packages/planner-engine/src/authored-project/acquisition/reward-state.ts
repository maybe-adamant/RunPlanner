import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import { pickupEffectForOffer } from '../../reward-kernel/history';

/**
 * Every authored reward owns an explicit disposition for every declared
 * acquisition role. This is persisted state rather than settlement-time
 * inference: commands and codecs can consequently distinguish an incomplete
 * or malformed document from an intentional normal acquisition.
 */
export function createNormalDispositionByAcquisitionRole(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): import('../model').AuthoredRewardState['dispositionByAcquisitionRole'] {
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

/** Whether this reward's payload becomes concrete only when its acquisition begins. */
export function rewardSourceResolvesAtAcquisition(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): boolean {
  return (
    catalog.rewards.rewardTypes.byKey[offer.rewardType]?.sourceResolution?.kind ===
    'acquisitionRole'
  );
}

/** The unauthored Anvil result at the role whose concrete acquisition declares it, if any. */
export function createUnresolvedAnvilResults(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): import('../model').AnvilResultsByAcquisitionRole | undefined {
  if (rewardSourceResolvesAtAcquisition(catalog, offer)) return undefined;
  const pickupEffect = pickupEffectForOffer(catalog.rewards, offer);
  return pickupEffect?.effect.kind === 'anvilOfFates'
    ? Object.freeze({ [pickupEffect.role]: null })
    : undefined;
}
