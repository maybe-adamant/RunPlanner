import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type { OccurrenceAddress, SemanticAddress } from '../../../authored-project/addresses';
import type { SimulationState } from '../../state/model';

/** What was bought, as each venue prices it. */
export type PurchasePriceVenue =
  | {
      readonly kind: 'stygianWell';
      readonly itemKey: string;
      /** The roll the item was stocked in; the Travel Deal refill's is the roll it restocked. */
      readonly rollKey: string;
      /** A bought Fateful Twist's result, when the reached state granted it. */
      readonly twistResultKey?: string;
    }
  | {
      readonly kind: 'hermesShrine';
      readonly itemKey: string;
      readonly delay: number;
      readonly rushed: boolean;
    }
  | { readonly kind: 'worldShop'; readonly profileKey: string; readonly itemKey: string }
  /** The Contract pedestal item and the Echo duplicate cost nothing. */
  | { readonly kind: 'free' };

/**
 * The price inputs one branch held when a purchase settled: facts only, never
 * a price. Travel Deal is recorded only on the room's first paid purchase,
 * the one it discounts.
 */
export interface PurchasePriceContext {
  readonly venue: PurchasePriceVenue;
  readonly firstPaidPurchase: boolean;
  readonly vowRank: number;
  /** Well items held whose trait multiplies shop prices (Ferry Voucher), one per instance. */
  readonly activeVoucherItemKeys: readonly string[];
  readonly travelDealRarity?: TraitRarity;
}

/**
 * Why a reached purchase has no price: the authored plan leaves what it buys
 * unresolved (reported by its own finding), or an engine contract failed.
 */
export type PurchasePriceUnpriced =
  | { readonly kind: 'itemUnresolved' }
  | { readonly kind: 'contractFailure'; readonly detail: string };

/**
 * One reached purchase with its price context at the reached state, absent
 * when it is unpriced. An owner is absent only when no action row settles the
 * purchase, a contract failure.
 */
export interface PurchasePriceContextPublication {
  /** The walked history event the purchase settles at. */
  readonly sequence: number;
  readonly owner?: SemanticAddress;
  readonly room: OccurrenceAddress;
  readonly context?: PurchasePriceContext;
  readonly unpriced?: PurchasePriceUnpriced;
}

/** The Vow whose ranks multiply shop prices. */
export function shopPriceVowKey(catalog: Catalog): string | undefined {
  return catalog.fearVows.values.find((vow) => vow.effect?.kind === 'shopPriceMultiplier')?.key;
}

/** The trait whose held rarity discounts the room's first purchase. */
export function travelDealTraitKey(catalog: Catalog): string | undefined {
  return catalog.traits.values.find(
    (trait) => trait.selectedDisposition?.kind === 'worldShopRestock',
  )?.key;
}

/** Whether a Well item's grant multiplies shop prices while held. */
export function wellVoucherMultiplier(catalog: Catalog, itemKey: string): number | undefined {
  const option = catalog.rewards.shops.byKey.RoomShop?.groups.values
    .flatMap((group) => group.options.values)
    .find((candidate) => candidate.key === itemKey);
  const grant = option?.stygianWell?.grant;
  return grant?.kind === 'timedTrait' ? grant.priceMultiplier : undefined;
}

function branchContext(
  catalog: Catalog,
  state: SimulationState,
  venue: PurchasePriceVenue,
  firstPaidPurchase: boolean,
): PurchasePriceContext {
  const vowKey = shopPriceVowKey(catalog);
  const travelDealKey = travelDealTraitKey(catalog);
  const travelDeal =
    firstPaidPurchase && travelDealKey !== undefined
      ? state.traitHistory.equippedTraits[travelDealKey]
      : undefined;
  return Object.freeze({
    venue,
    firstPaidPurchase,
    vowRank: vowKey === undefined ? 0 : (state.arcanaFear.fear.effectiveRanks[vowKey] ?? 0),
    activeVoucherItemKeys: Object.freeze(
      state.stygianWell.timedInstances
        .filter((instance) => wellVoucherMultiplier(catalog, instance.itemKey) !== undefined)
        .map((instance) => instance.itemKey)
        .sort(),
    ),
    ...(travelDeal?.rarity === undefined ? {} : { travelDealRarity: travelDeal.rarity }),
  });
}

/** Reads one purchase's price context from the reached state before it settles. */
export function purchasePriceContextPublication(inputs: {
  readonly catalog: Catalog;
  readonly sequence: number;
  readonly owner?: SemanticAddress;
  readonly room: OccurrenceAddress;
  readonly firstPaidPurchase: boolean;
  readonly state: SimulationState;
  readonly venue?: PurchasePriceVenue;
  readonly unpriced?: PurchasePriceUnpriced;
}): PurchasePriceContextPublication {
  const venue = inputs.venue;
  const context =
    venue === undefined
      ? undefined
      : branchContext(inputs.catalog, inputs.state, venue, inputs.firstPaidPurchase);
  return Object.freeze({
    sequence: inputs.sequence,
    ...(inputs.owner === undefined ? {} : { owner: inputs.owner }),
    room: inputs.room,
    ...(context === undefined ? {} : { context }),
    ...(inputs.unpriced === undefined ? {} : { unpriced: Object.freeze(inputs.unpriced) }),
  });
}
