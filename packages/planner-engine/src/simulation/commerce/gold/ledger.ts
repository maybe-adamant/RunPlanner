import type { Catalog } from '../../../catalog-schema';
import {
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { ShopOptionEntry } from '../../../reward-kernel';
import {
  shopPriceVowKey,
  travelDealTraitKey,
  wellVoucherMultiplier,
  type PurchasePriceContext,
  type PurchasePriceContextPublication,
  type PurchasePriceVenue,
} from './price-context';
import {
  baseCostSupport,
  priceAmount,
  roundGold,
  shopCostMultiplier,
  shrineOrderPrice,
  shrineRushPrice,
  sumGold,
  ZERO_GOLD,
  type GoldAmount,
} from './prices';

/** A gold query input broke an engine contract, such as branches disagreeing on a price. */
export class GoldLedgerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldLedgerContractError';
  }
}

/** One reached purchase's price, before the balance it is paid from. */
export interface GoldPurchaseQuote {
  readonly owner: SemanticAddress;
  readonly room: OccurrenceAddress;
  readonly venue: PurchasePriceVenue['kind'];
  /** The bought shop option; absent for a free item. */
  readonly itemKey?: string;
  readonly price: GoldAmount;
}

/** A room's reached purchases in settlement order and what they cost together. */
export interface GoldRoomQuote {
  readonly room: OccurrenceAddress;
  readonly purchases: readonly GoldPurchaseQuote[];
  readonly spending: GoldAmount;
}

/** A reached purchase's price, why the plan leaves it unpriced, or a contract failure. */
export type GoldPurchaseOutcome =
  | { readonly kind: 'priced'; readonly purchase: GoldPurchaseQuote }
  | { readonly kind: 'itemUnresolved' }
  | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };

/** A room's spending, or the first reason one of its purchases has no price. */
export type GoldRoomOutcome =
  | { readonly kind: 'priced'; readonly room: GoldRoomQuote }
  | { readonly kind: 'itemUnresolved' }
  | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };

/** One biome's reached purchases, by owner and by room. */
export interface BiomeGoldPrices {
  readonly purchases: ReadonlyMap<string, GoldPurchaseOutcome>;
  readonly rooms: ReadonlyMap<string, GoldRoomOutcome>;
}

function shopOption(
  catalog: Catalog,
  profileKey: string,
  itemKey: string,
): { readonly option: ShopOptionEntry; readonly profileKey: string } {
  const option = catalog.rewards.shops.byKey[profileKey]?.groups.values
    .flatMap((group) => group.options.values)
    .find((candidate) => candidate.key === itemKey);
  if (option?.cost === undefined)
    throw new GoldLedgerContractError(`${profileKey} ${itemKey} has no declared price`);
  return { option, profileKey };
}

interface Multipliers {
  readonly vow: number;
  readonly vouchers: number;
  readonly travelDealDiscount: number | undefined;
}

function multipliers(
  catalog: Catalog,
  context: PurchasePriceContext,
  voucherItemKeys: readonly string[] = context.activeVoucherItemKeys,
): Multipliers {
  const vowKey = shopPriceVowKey(catalog);
  const vowEffect = vowKey === undefined ? undefined : catalog.fearVows.byKey[vowKey]?.effect;
  const vow =
    context.vowRank === 0
      ? 1
      : vowEffect?.kind === 'shopPriceMultiplier'
        ? vowEffect.multiplierByRank[context.vowRank - 1]
        : undefined;
  if (vow === undefined)
    throw new GoldLedgerContractError(`Vow of Debt rank ${context.vowRank} has no multiplier`);
  const vouchers = voucherItemKeys.reduce((product, itemKey) => {
    const multiplier = wellVoucherMultiplier(catalog, itemKey);
    if (multiplier === undefined)
      throw new GoldLedgerContractError(`${itemKey} multiplies no shop price`);
    return product * multiplier;
  }, 1);
  let travelDealDiscount: number | undefined;
  if (context.firstPaidPurchase && context.travelDealRarity !== undefined) {
    const traitKey = travelDealTraitKey(catalog);
    const disposition =
      traitKey === undefined ? undefined : catalog.traits.byKey[traitKey]?.selectedDisposition;
    travelDealDiscount =
      disposition?.kind === 'worldShopRestock'
        ? disposition.discountByRarity[
            context.travelDealRarity as keyof typeof disposition.discountByRarity
          ]
        : undefined;
    if (travelDealDiscount === undefined)
      throw new GoldLedgerContractError(
        `Travel Deal ${context.travelDealRarity} has no first-purchase discount`,
      );
  }
  return { vow, vouchers, travelDealDiscount };
}

function multiplier(values: Multipliers, withTravelDeal = true): number {
  return shopCostMultiplier({
    vowMultiplier: values.vow,
    voucherMultiplier: values.vouchers,
    travelDealDiscount: withTravelDeal ? values.travelDealDiscount : undefined,
  });
}

/**
 * An open Well item when a Twist granted a price multiplier outside the
 * room's Travel Deal purchase: its rounded price is multiplied and rounded
 * again (`AwardRandomStoreItem`); a Travel Deal purchase reprices from base.
 */
interface TwistReprice {
  readonly rollKey: string;
  readonly itemKey: string;
}

function onlyContext(
  publication: PurchasePriceContextPublication & { readonly owner: SemanticAddress },
): PurchasePriceContext {
  const [context, ...others] = publication.contexts;
  if (context === undefined || others.length > 0)
    throw new GoldLedgerContractError(
      `${semanticAddressKey(publication.owner)} has ${publication.contexts.length} distinct price contexts across reached branches`,
    );
  return context;
}

/** The Twist reprice a settled Well purchase starts, if any. */
function twistRepriceAfter(
  catalog: Catalog,
  context: PurchasePriceContext,
): TwistReprice | undefined {
  const venue = context.venue;
  return venue.kind === 'stygianWell' &&
    venue.twistResultKey !== undefined &&
    wellVoucherMultiplier(catalog, venue.twistResultKey) !== undefined &&
    !(context.firstPaidPurchase && context.travelDealRarity !== undefined)
    ? Object.freeze({ rollKey: venue.rollKey, itemKey: venue.twistResultKey })
    : undefined;
}

function purchasePrice(
  catalog: Catalog,
  context: PurchasePriceContext,
  twist: TwistReprice | undefined,
): { readonly itemKey?: string; readonly price: GoldAmount } {
  const venue = context.venue;
  switch (venue.kind) {
    case 'free':
      return { price: ZERO_GOLD };
    case 'worldShop': {
      const { option } = shopOption(catalog, venue.profileKey, venue.itemKey);
      const m = multiplier(multipliers(catalog, context));
      return {
        itemKey: venue.itemKey,
        price: priceAmount(baseCostSupport(option.cost!), (base) => roundGold(base * m)),
      };
    }
    case 'stygianWell': {
      const { option } = shopOption(catalog, 'RoomShop', venue.itemKey);
      const support = baseCostSupport(option.cost!);
      const reprice =
        twist !== undefined &&
        twist.rollKey === venue.rollKey &&
        context.activeVoucherItemKeys.includes(twist.itemKey)
          ? twist
          : undefined;
      if (reprice === undefined) {
        const m = multiplier(multipliers(catalog, context));
        return {
          itemKey: venue.itemKey,
          price: priceAmount(support, (base) => roundGold(base * m)),
        };
      }
      const others = [...context.activeVoucherItemKeys];
      others.splice(others.indexOf(reprice.itemKey), 1);
      const before = multiplier(multipliers(catalog, context, others));
      const granted = wellVoucherMultiplier(catalog, reprice.itemKey)!;
      return {
        itemKey: venue.itemKey,
        price: priceAmount(support, (base) => roundGold(roundGold(base * before) * granted)),
      };
    }
    case 'hermesShrine': {
      const pricing = catalog.rewards.shops.byKey.SurfaceShop?.pricing;
      if (pricing?.kind !== 'delayedDelivery')
        throw new GoldLedgerContractError(
          'the Hermes Shrine profile is not priced by delivery delay',
        );
      const { option } = shopOption(catalog, 'SurfaceShop', venue.itemKey);
      const factors = pricing.delayPriceFactors;
      const delayFactor = factors[Math.min(venue.delay, factors.length) - 1];
      if (delayFactor === undefined)
        throw new GoldLedgerContractError(`Shrine delay ${venue.delay} has no price factor`);
      const values = multipliers(catalog, context);
      const first = multiplier(values);
      // The first purchase reprices the Shrine without Travel Deal before a rush is paid.
      const after = multiplier(values, false);
      return {
        itemKey: venue.itemKey,
        price: priceAmount(baseCostSupport(option.cost!), (base) =>
          venue.rushed
            ? shrineOrderPrice(base, first, delayFactor) +
              shrineRushPrice(base, after, delayFactor, pricing.rushPriceMultiplier)
            : shrineOrderPrice(base, first, delayFactor),
        ),
      };
    }
  }
}

const fault = (
  error: unknown,
): { readonly kind: 'fault'; readonly error: GoldLedgerContractError } =>
  Object.freeze({
    kind: 'fault',
    error:
      error instanceof GoldLedgerContractError
        ? error
        : new GoldLedgerContractError(error instanceof Error ? error.message : String(error)),
  });

/**
 * Prices one biome's reached purchases in settlement order. A contract failure
 * is kept on its own purchase and room; it never prices other purchases.
 */
export function biomeGoldPrices(
  catalog: Catalog,
  publications: readonly PurchasePriceContextPublication[],
): BiomeGoldPrices {
  const purchases = new Map<string, GoldPurchaseOutcome>();
  const byRoom = new Map<
    string,
    { readonly room: OccurrenceAddress; readonly outcomes: GoldPurchaseOutcome[] }
  >();
  // An unknown Twist reprice is one whose reached branches disagree.
  const twists = new Map<string, TwistReprice | 'unknown'>();
  for (const publication of publications) {
    const roomKey = semanticAddressKey(publication.room);
    const outcome = ((): GoldPurchaseOutcome => {
      const owner = publication.owner;
      if (publication.unpriced?.kind === 'contractFailure' || owner === undefined)
        return fault(
          new GoldLedgerContractError(
            publication.unpriced?.kind === 'contractFailure'
              ? publication.unpriced.detail
              : `a purchase in ${roomKey} has no owner`,
          ),
        );
      if (publication.unpriced?.kind === 'itemUnresolved')
        return Object.freeze({ kind: 'itemUnresolved' });
      try {
        const context = onlyContext({ ...publication, owner });
        const twist = twists.get(roomKey);
        if (twist === 'unknown' && context.venue.kind === 'stygianWell')
          throw new GoldLedgerContractError(
            `${semanticAddressKey(owner)} follows a Twist whose reached branches disagree`,
          );
        const priced = purchasePrice(catalog, context, twist === 'unknown' ? undefined : twist);
        return Object.freeze({
          kind: 'priced',
          purchase: Object.freeze({
            owner,
            room: publication.room,
            venue: context.venue.kind,
            ...(priced.itemKey === undefined ? {} : { itemKey: priced.itemKey }),
            price: priced.price,
          }),
        });
      } catch (error) {
        return fault(error);
      }
    })();
    if (publication.owner !== undefined)
      purchases.set(semanticAddressKey(publication.owner), outcome);
    const room = byRoom.get(roomKey) ?? { room: publication.room, outcomes: [] };
    room.outcomes.push(outcome);
    byRoom.set(roomKey, room);
    const reprices = new Set(
      publication.contexts.map((context) =>
        JSON.stringify(twistRepriceAfter(catalog, context) ?? null),
      ),
    );
    if (reprices.size > 1) twists.set(roomKey, 'unknown');
    else {
      const reprice =
        publication.contexts[0] && twistRepriceAfter(catalog, publication.contexts[0]);
      if (reprice !== undefined) twists.set(roomKey, reprice);
    }
  }
  return Object.freeze({
    purchases,
    rooms: new Map(
      [...byRoom].map(([key, { room, outcomes }]): [string, GoldRoomOutcome] => {
        const blocked =
          outcomes.find((outcome) => outcome.kind === 'fault') ??
          outcomes.find((outcome) => outcome.kind === 'itemUnresolved');
        if (blocked?.kind === 'fault' || blocked?.kind === 'itemUnresolved') return [key, blocked];
        const priced = outcomes.flatMap((outcome) =>
          outcome.kind === 'priced' ? [outcome.purchase] : [],
        );
        return [
          key,
          Object.freeze({
            kind: 'priced',
            room: Object.freeze({
              room,
              purchases: Object.freeze(priced),
              spending: sumGold(priced.map((purchase) => purchase.price)),
            }),
          }),
        ];
      }),
    ),
  });
}
