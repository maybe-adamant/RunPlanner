import {
  parseStygianWellGenerationKey,
  stygianWellGenerationItemKey,
  stygianWellGenerationTwistResultKey,
} from '../../../authored-project/feature-rolls';
import { INFERNAL_CONTRACT_PEDESTAL_SITE_KEY } from '../../../authored-project/infernal-contract-pedestal';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../../authored-project/shop';
import {
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import {
  hermesShrineInitialSlotKey,
  type RoomActionReference,
} from '../../../authored-project/model';
import { featureRollWalkKey } from '../../commerce/feature-rolls';
import {
  purchasePriceContextPublication,
  type PurchasePriceUnpriced,
  type PurchasePriceVenue,
} from '../../commerce/gold/price-context';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { ChronologyWalkContext, ChronologyWalkState } from './chronology-walk';
import { wellOccurrenceView } from './encounter-acquisition/well-purchase';

/** What a settling purchase buys, or why it has no price. */
type PurchaseResolution =
  { readonly kind: 'priced'; readonly venue: PurchasePriceVenue } | PurchasePriceUnpriced;

const unresolvedItem: PurchaseResolution = Object.freeze({ kind: 'itemUnresolved' });
const contractFailure = (detail: string): PurchaseResolution =>
  Object.freeze({ kind: 'contractFailure', detail });
const priced = (venue: PurchasePriceVenue): PurchaseResolution =>
  Object.freeze({ kind: 'priced', venue: Object.freeze(venue) });

function rankedRow(
  room: CanonicalAuthoredRoom,
  matches: (reference: RoomActionReference) => boolean,
): SemanticAddress | undefined {
  return room.roomActionRoster.rows.find(
    (row) => !row.stale && row.rank !== null && matches(row.reference),
  )?.owner;
}

/**
 * Records one purchase's price context against the branches it settles from.
 * Every paid purchase sets the room's first-purchase flag, priced or not.
 */
function withPurchasePrice(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  inputs: {
    readonly sequence: number;
    readonly room: OccurrenceAddress;
    readonly paid: boolean;
    readonly owner: SemanticAddress | undefined;
    readonly resolution: PurchaseResolution;
  },
): ChronologyWalkState {
  if (state.branches.length === 0) return state;
  const roomKey = semanticAddressKey(inputs.room);
  const resolution =
    inputs.owner === undefined
      ? contractFailure(`a purchase in ${roomKey} has no ranked action row`)
      : inputs.resolution;
  const publication = purchasePriceContextPublication({
    catalog: context.catalog,
    ...(inputs.owner === undefined ? {} : { owner: inputs.owner }),
    room: inputs.room,
    firstPaidPurchase: inputs.paid && !state.paidPurchaseRooms.has(roomKey),
    states: state.branches.map((branch) => branch.state),
    ...(resolution.kind === 'priced'
      ? { venue: resolution.venue }
      : { unpriced: resolution as PurchasePriceUnpriced }),
  });
  const paidPurchaseRooms =
    !inputs.paid || state.paidPurchaseRooms.has(roomKey)
      ? state.paidPurchaseRooms
      : new Set([...state.paidPurchaseRooms, roomKey]);
  return Object.freeze({
    ...state,
    purchasePriceContexts: new Map(state.purchasePriceContexts).set(
      inputs.owner === undefined
        ? `${roomKey}#${inputs.sequence}`
        : semanticAddressKey(inputs.owner),
      publication,
    ),
    paidPurchaseRooms,
  });
}

function authoredRoom(
  context: ChronologyWalkContext,
  origin: SemanticAddress,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(semanticAddressKey(origin));
  return room?.kind === 'authored' ? room : undefined;
}

/** A Well purchase's price context, read before it settles. */
export function withWellPurchasePrice(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: Extract<HistoryEvent, { readonly kind: 'wellPurchase' }>,
): ChronologyWalkState {
  const room = authoredRoom(context, event.origin);
  if (room === undefined)
    return withPurchasePrice(context, state, {
      sequence: event.sequence,
      room: event.origin as OccurrenceAddress,
      paid: true,
      owner: undefined,
      resolution: contractFailure('a Well purchase has no authored room'),
    });
  const owner = rankedRow(
    room,
    (reference) =>
      reference.kind === 'purchaseStygianWellOffer' &&
      reference.generationKey === event.generationKey,
  );
  const resolution = ((): PurchaseResolution => {
    // A missing Well, an unpinned slot or an absent roll is the purchase's own finding.
    if (room.stygianWell === undefined) return unresolvedItem;
    const view = wellOccurrenceView(room);
    const itemKey = stygianWellGenerationItemKey(view, event.generationKey);
    if (itemKey === undefined || itemKey === null) return unresolvedItem;
    const walk = state.featureRolls.get(
      featureRollWalkKey(semanticAddressKey(room.origin), 'stygianWell'),
    );
    const rollKey =
      event.generationKey === 'travelDealRefill'
        ? walk?.feature === 'stygianWell'
          ? walk.refill?.rollKey
          : undefined
        : parseStygianWellGenerationKey(event.generationKey)?.rollKey;
    // A refill bought before any restock is refused with its own finding.
    if (rollKey === undefined) return unresolvedItem;
    const twistResultKey =
      itemKey === 'RandomStoreItem'
        ? stygianWellGenerationTwistResultKey(view, event.generationKey)
        : undefined;
    return priced({
      kind: 'stygianWell',
      itemKey,
      rollKey,
      ...(twistResultKey === undefined || twistResultKey === null ? {} : { twistResultKey }),
    });
  })();
  return withPurchasePrice(context, state, {
    sequence: event.sequence,
    room: room.origin,
    paid: true,
    owner,
    resolution,
  });
}

/** A Hermes Shrine purchase's price context, read before it settles. */
export function withHermesShrinePurchasePrice(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: Extract<HistoryEvent, { readonly kind: 'hermesShrinePurchaseReached' }>,
): ChronologyWalkState {
  const room = authoredRoom(context, event.origin);
  if (room === undefined)
    return withPurchasePrice(context, state, {
      sequence: event.sequence,
      room: event.origin as OccurrenceAddress,
      paid: true,
      owner: undefined,
      resolution: contractFailure('a Shrine purchase has no authored room'),
    });
  const owner = rankedRow(
    room,
    (reference) =>
      reference.kind === 'purchaseHermesShrineOffer' &&
      reference.generationKey === event.generationKey,
  );
  const resolution = ((): PurchaseResolution => {
    const shrine = room.hermesShrine;
    if (shrine === undefined) return unresolvedItem;
    const slotKey = hermesShrineInitialSlotKey(event.generationKey);
    if (event.generationKey !== 'travelDealRefill' && slotKey === undefined)
      return contractFailure(`Shrine generation ${event.generationKey} names no slot`);
    const offer =
      slotKey === undefined ? shrine.travelDealRefill?.offer : shrine.offerBySlot[slotKey];
    if (offer === undefined || offer === null) return unresolvedItem;
    const itemKey = context.catalog.rewards.shops.byKey.SurfaceShop?.groups.values
      .flatMap((group) => group.options.values)
      .find((option) => option.rewardType === offer.rewardType)?.key;
    return itemKey === undefined
      ? contractFailure(`the Shrine declares no option for ${offer.rewardType}`)
      : priced({ kind: 'hermesShrine', itemKey, delay: offer.delay, rushed: event.rushed });
  })();
  return withPurchasePrice(context, state, {
    sequence: event.sequence,
    room: room.origin,
    paid: true,
    owner,
    resolution,
  });
}

/**
 * A World Shop purchase, its Travel Deal refill, the Echo duplicate or the
 * Contract pedestal item, read before it settles; other points buy nothing.
 */
export function withAcquisitionPointPrice(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: Extract<HistoryEvent, { readonly kind: 'acquisitionPointReached' }>,
): ChronologyWalkState {
  const room = authoredRoom(context, event.origin);
  if (room === undefined) return state;
  const record = (
    paid: boolean,
    owner: SemanticAddress | undefined,
    resolution: PurchaseResolution,
  ) =>
    withPurchasePrice(context, state, {
      sequence: event.sequence,
      room: room.origin,
      paid,
      owner,
      resolution,
    });
  if (event.point === INFERNAL_CONTRACT_PEDESTAL_SITE_KEY)
    return record(
      false,
      rankedRow(room, (reference) => reference.kind === 'interactInfernalContractPedestal'),
      priced({ kind: 'free' }),
    );
  const shop = room.entryState;
  const worldShop = (optionKey: string | null | undefined): PurchaseResolution =>
    shop === undefined
      ? contractFailure(`${room.gameName} sells without a Shop`)
      : optionKey === undefined || optionKey === null
        ? unresolvedItem
        : priced({ kind: 'worldShop', profileKey: shop.profileKey, itemKey: optionKey });
  const offered = room.roomActionRoster.rows.find(
    (row) =>
      !row.stale &&
      row.rank !== null &&
      row.reference.kind === 'interactShopOffer' &&
      event.point === `shopOffer:${row.reference.offerKey}`,
  );
  if (offered?.reference.kind === 'interactShopOffer') {
    const offerKey = offered.reference.offerKey;
    return record(
      true,
      offered.owner,
      worldShop(shop?.offers.find((offer) => offer.offerKey === offerKey)?.optionKey),
    );
  }
  if (event.point.startsWith('shopOffer:'))
    return record(true, undefined, contractFailure(`${event.point} has no ranked action row`));
  if (event.siteKey !== 'roomExit') return state;
  const entryKey = event.entryKey;
  const owner = rankedRow(
    room,
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === 'roomExit' &&
      reference.entryKey === entryKey,
  );
  if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)
    return record(true, owner, worldShop(shop?.travelDealRefill?.optionKey));
  if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY)
    return record(false, owner, priced({ kind: 'free' }));
  return state;
}
