import type { Catalog, RoomDeclaration } from '../catalog-schema';
import type { ShopOptionSelection, ShopProfileDeclaration } from '../reward-kernel/model';
import { locallyValidRewardOffers } from '../reward-kernel';
import type { InfernalContractPedestalState, RoomOccurrence } from './model';

/** The pedestal item's one generation slot and acquisition entry key. */
export const INFERNAL_CONTRACT_ENTRY_KEY = 'infernalContractReward' as const;
/** Occurrence-local site holding a pedestal item's acquisition-resolved source. */
export const INFERNAL_CONTRACT_PEDESTAL_SITE_KEY = 'infernalContractPedestal' as const;

/** Whether this Preboss declares a pedestal destination, whatever its reward form. */
export function roomHasInfernalContractPedestal(room: RoomDeclaration | undefined): boolean {
  return room?.infernalContractReward !== undefined;
}

export function createDefaultInfernalContractPedestal(): InfernalContractPedestalState {
  return Object.freeze({ optionKey: null, reward: null });
}

/** The native single-slot pool the pedestal draws from. */
export function infernalContractPedestalProfile(
  catalog: Catalog,
  roomGameName: string,
): ShopProfileDeclaration | undefined {
  const profileKey =
    catalog.rooms.byKey[roomGameName]?.infernalContractReward?.generationProfileKey;
  return profileKey === undefined ? undefined : catalog.rewards.shops.byKey[profileKey];
}

/** Every declared option and locally valid offer the pedestal can author. */
export function infernalContractPedestalOptionValues(
  catalog: Catalog,
  roomGameName: string,
): readonly ShopOptionSelection[] {
  const profile = infernalContractPedestalProfile(catalog, roomGameName);
  const slot = profile?.slots.byKey[INFERNAL_CONTRACT_ENTRY_KEY];
  const group = slot === undefined ? undefined : profile?.groups.byKey[slot.groupKey];
  if (group === undefined) return Object.freeze([]);
  return Object.freeze(
    group.options.values.flatMap((option) =>
      locallyValidRewardOffers(catalog.rewards, option.rewardType).map((offer) =>
        Object.freeze({ optionKey: option.key, offer }),
      ),
    ),
  );
}

export function infernalContractPedestalCollected(occurrence: RoomOccurrence): boolean {
  return occurrence.roomActions.order.some(
    (reference) => reference.kind === 'interactInfernalContractPedestal',
  );
}
