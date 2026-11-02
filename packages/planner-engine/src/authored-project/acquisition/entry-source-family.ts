import type { Catalog } from '../../catalog-schema';
import { ERIS_GIFT_SITE_KEY } from './eris-gift';
import { parseArtificerReplacementEntryKey } from './artificer';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  parseEchoLastRewardPickupEntryKey,
  type SelectedPickupProducer,
} from './pickup-producers';
import { SEA_STAR_DUPLICATE_ENTRY_KEY, parseSeaStarDuplicateSiteKey } from './sea-star';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  parseHermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';
import { ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY, TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../shop';

/** What created a generated acquisition-entry pickup. */
export type AcquisitionEntrySourceFamily =
  /** A selected trait's own pickups, including a clocked producer's matured drops. */
  | { readonly kind: 'trait'; readonly traitKey: string }
  /**
   * Echo's replay of the room's last reward (`lastReward`) or Gold Gold Gold's
   * duplicate of a World Shop purchase (`doubleShop`).
   */
  | { readonly kind: 'echo'; readonly effect: 'lastReward' | 'doubleShop' }
  /** The Artificer's replacement of a converted reward. */
  | { readonly kind: 'artificer' }
  /** Sea Star's duplicate of an acquired reward. */
  | { readonly kind: 'seaStar' }
  /** The result a Nemesis random event leaves behind. */
  | { readonly kind: 'nemesisEvent' }
  /** The gift talking to Eris drops. */
  | { readonly kind: 'erisGift' }
  /** A Hermes Shrine item delivered to its host room. */
  | { readonly kind: 'hermesShrineDelivery' }
  /** The World Shop's Travel Deal restock. */
  | { readonly kind: 'shopTravelDealRefill' };

const ECHO_LAST_REWARD = Object.freeze({ kind: 'echo' as const, effect: 'lastReward' as const });
const ECHO_DOUBLE_SHOP = Object.freeze({ kind: 'echo' as const, effect: 'doubleShop' as const });
const ARTIFICER = Object.freeze({ kind: 'artificer' as const });
const SEA_STAR = Object.freeze({ kind: 'seaStar' as const });
const NEMESIS_EVENT = Object.freeze({ kind: 'nemesisEvent' as const });
const ERIS_GIFT = Object.freeze({ kind: 'erisGift' as const });
const HERMES_SHRINE_DELIVERY = Object.freeze({ kind: 'hermesShrineDelivery' as const });
const SHOP_TRAVEL_DEAL_REFILL = Object.freeze({ kind: 'shopTravelDealRefill' as const });

function traitFamily(traitKey: string): AcquisitionEntrySourceFamily {
  return Object.freeze({ kind: 'trait', traitKey });
}

/**
 * The trait declaring a clocked pickup. The entry names its source acquisition,
 * not its trait, so the declaration that owns the clocked pickup key names it.
 */
function clockedPickupTraitKey(catalog: Catalog, pickupKey: string): string | undefined {
  const traitKeys = catalog.traits.values.flatMap((trait) => {
    const disposition = trait.selectedDisposition;
    return disposition?.kind === 'producePickups' &&
      disposition.clock !== undefined &&
      disposition.pickups.some((pickup) => pickup.key === pickupKey)
      ? [trait.key]
      : [];
  });
  return traitKeys.length === 1 ? traitKeys[0] : undefined;
}

/**
 * The source family of one acquisition-entry pickup, given the selected
 * producer that owns it when there is one. Undefined only for an entry no
 * declared source owns.
 */
export function acquisitionEntrySourceFamily(
  catalog: Catalog,
  siteKey: string,
  entryKey: string,
  producer: SelectedPickupProducer | undefined,
): AcquisitionEntrySourceFamily | undefined {
  if (parseArtificerReplacementEntryKey(entryKey) !== undefined) return ARTIFICER;
  if (
    siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY &&
    parseHermesShrineDeliveryEntryKey(entryKey) !== undefined
  )
    return HERMES_SHRINE_DELIVERY;
  if (
    entryKey === SEA_STAR_DUPLICATE_ENTRY_KEY &&
    parseSeaStarDuplicateSiteKey(siteKey) !== undefined
  )
    return SEA_STAR;
  if (siteKey === 'roomExit') {
    if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) return SHOP_TRAVEL_DEAL_REFILL;
    if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) return ECHO_DOUBLE_SHOP;
    if (parseEchoLastRewardPickupEntryKey(entryKey) !== undefined) return ECHO_LAST_REWARD;
    const clocked = parseClockedTraitGeneratedPickupEntryKey(entryKey);
    if (clocked !== undefined) {
      const traitKey = clockedPickupTraitKey(catalog, clocked.pickupKey);
      return traitKey === undefined ? undefined : traitFamily(traitKey);
    }
  }
  if (producer === undefined) return undefined;
  switch (producer.source.kind) {
    case 'nemesisRandomEvent':
      return NEMESIS_EVENT;
    case 'roomAction':
      return producer.siteKey === ERIS_GIFT_SITE_KEY ? ERIS_GIFT : undefined;
    case 'traitOffer': {
      if (producer.traitKey === undefined) return undefined;
      const disposition = catalog.traits.byKey[producer.traitKey]?.selectedDisposition;
      return disposition?.kind === 'echo' ? ECHO_LAST_REWARD : traitFamily(producer.traitKey);
    }
  }
}
