import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import { pickupEffectForOffer, resolveAcquisitionRole } from '../../reward-kernel/history';

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

/**
 * Roles whose concrete acquisition can open a writable Path screen: a Path of
 * Stars grant, or a Spell Drop that Aspect of Selene routes to the talent tree.
 */
export function hexActivationRoles(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): readonly string[] {
  if (rewardSourceResolvesAtAcquisition(catalog, offer)) return Object.freeze([]);
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) throw new Error(`unknown reward type ${offer.rewardType}`);
  return Object.freeze(
    declaration.acquisitionRoles.values
      .filter((role) => {
        const gameName = resolveAcquisitionRole(
          catalog.rewards,
          offer,
          role.key,
          'roomRewardPickup',
        ).acquisition.gameName;
        return (
          gameName === 'SpellDrop' ||
          catalog.rewards.acquisitions.byKey[gameName]?.pathPointGrant !== undefined
        );
      })
      .map((role) => role.key),
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
