import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  infernalContractPedestalOptionValues,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  parseHermesShrineDeliveryEntryKey,
  semanticAddressKey,
  shopOfferOptionValues,
  type HermesShrineDelay,
  type HermesShrineGenerationKey,
  type HermesShrineSlotKey,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  roomActionKey,
  type RoomActionReference,
  type RoomOccurrence,
  type SemanticAddress,
  type ShopState,
  type StygianWellGenerationKey,
  type StygianWellSlotKey,
  hermesShrineInitialSlotKey,
  INITIAL_ROLL_KEY,
  parseStygianWellGenerationKey,
  purgingPoolRerolls,
  stygianWellGenerationKey,
  stygianWellPurchasedGenerationKeys,
  stygianWellRerolls,
} from '@run-planner/engine/authored-project';
import {
  locallyValidRewardOffers,
  purchaseInteractionName,
  type ResolvedRewardOffer,
  type ShopOptionSelection,
} from '@run-planner/engine/reward-kernel';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import type {
  RunRecordRoom,
  RunRecordStockOption,
  RunRecordStore,
  RunRecordStoreKind,
} from './run-record/model';
import { collectedPast, insertRoomAction, placeLiveRoomAction, roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import type { RunImportArea } from './report';
import { isQuestionFinding } from './areas';
import { authoredOccurrence, occurrenceIdOf } from './occurrences';
import { authorAcceptedAnswer, shopOfferAnswers } from './open-questions';
import { applyFeatureRerolls } from './rerolls';
import { pickupUseCount } from './vocabulary';

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

/** A store profile's slots in stock order, as the catalog declares them. */
const profileSlots = <T extends string>(context: RunImportContext, profileKey: string) =>
  (context.catalog.rewards.shops.byKey[profileKey]?.slots.values.map((slot) => slot.key) ??
    []) as unknown as readonly T[];
const shrineSlots = (context: RunImportContext) =>
  profileSlots<HermesShrineSlotKey>(context, 'SurfaceShop');
const wellSlots = (context: RunImportContext) =>
  profileSlots<StygianWellSlotKey>(context, 'RoomShop');
/** The Pool's realized list is the authored model's three slots, in sale-slot order. */
const POOL_SLOTS = ['left', 'middle', 'right'] as const;

interface StoreVisit {
  readonly roomIndex: number;
  readonly room: RunRecordRoom;
  readonly store: RunRecordStore;
}

/** The occurrence's record visit that holds an offered store of this kind. */
function storeVisit(
  context: RunImportContext,
  occurrenceId: string,
  kind: RunRecordStoreKind,
): StoreVisit | undefined {
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const room = context.record.rooms[roomIndex]!;
    if (room.store?.kind !== kind) continue;
    return offeredStore(context, room, room.store, roomIndex)
      ? { roomIndex, room, store: room.store }
      : undefined;
  }
  return undefined;
}

/** The record use and reroll name of a store's own screen. */
const STORE_SCREEN = { well: 'WellShop', hermesShrine: 'SurfaceShop', worldShop: undefined };

/**
 * Every room rolls Well and Shrine stock with no anchor check (RunLogic.lua
 * 630-636), so stock the player never touched may never have spawned: it is
 * ignored where the catalog declares no host for its kind or the settled save
 * shows no spawned object. Any use of stock on a room that cannot host it is
 * a break in the catalog's host declarations, and the plan stops there.
 */
function offeredStore(
  context: RunImportContext,
  room: RunRecordRoom,
  store: RunRecordStore,
  roomIndex: number,
): boolean {
  const declaration = context.catalog.rooms.byKey[room.name];
  const hosted =
    store.kind === 'well'
      ? declaration?.roomShop !== undefined
      : store.kind === 'hermesShrine'
        ? declaration?.surfaceShop !== undefined
        : true;
  const screen = STORE_SCREEN[store.kind];
  const used =
    (store.purchases?.length ?? 0) > 0 ||
    (store.unstockedPurchases?.length ?? 0) > 0 ||
    (store.purchaseCount ?? 0) > 0 ||
    (screen !== undefined &&
      ((room.uses[screen] ?? 0) > 0 || (room.spentRerolls?.[screen] ?? 0) > 0));
  if (!hosted && used)
    context.halt({
      area: store.kind === 'well' ? 'well' : 'shop',
      code: 'stockOnNonHost',
      record: record(roomIndex),
    });
  return hosted && (used || store.spawned !== false);
}

/** Every entered occurrence that changed since the last sweep, in plan order. */
function pendingOccurrences(
  context: RunImportContext,
): readonly { readonly biomeKey: string; readonly occurrence: RoomOccurrence }[] {
  return context
    .assembly()
    .project.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? [])
        .filter((occurrence) => context.pending(occurrence.occurrenceId))
        .map((occurrence) => ({ biomeKey: biome.biomeKey, occurrence })),
    );
}

const record = (roomIndex: number) => ({ roomIndex, visit: 0 });

/** Answers Shop, Shrine and Well inventory and the Anvil of Fates result from the record. */
export function answerCommerce(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  if (origin.kind === 'shopOffer') return answerShopOffer(context, origin, reason);
  if (origin.kind === 'infernalContractPedestal' && shopOfferCodes.has(reason.code))
    return answerContractPedestal(context, origin);
  if (origin.kind === 'roomFeature') {
    if (reason.code === 'hermesShrineInventoryMissing') return answerShrineOffers(context, origin);
    if (reason.code === 'hermesShrineTravelDealRefillMissing')
      return answerShrineRefill(context, origin);
    if (reason.code === 'stygianWellMissing') return answerWellOffers(context, origin);
    return false;
  }
  if (origin.kind === 'acquisitionEntry' && reason.code === 'rewardMissing')
    return answerAcquisitionEntry(context, origin);
  if (
    origin.kind === 'acquisitionRole' &&
    reason.code === 'rewardMissing' &&
    reason.evidence['pickupEffect'] === 'anvilOfFates'
  )
    return answerAnvil(context, origin);
  return false;
}

const shopOfferCodes: ReadonlySet<string> = new Set([
  'rewardMissing',
  'shopOfferUnavailable',
  'rewardBagEntryUnavailable',
  'rewardSourceUnavailable',
  'rewardPayloadInvalid',
]);

/** Whether a Shop option is the record's stock item: its name, boost and boon god. */
function stockMatches(
  context: RunImportContext,
  profileKey: string,
  offerKey: string,
  stock: RunRecordStockOption,
  value: ShopOptionSelection,
): boolean {
  const profile = context.catalog.rewards.shops.byKey[profileKey];
  const option =
    profile?.groups.byKey[profile.slots.byKey[offerKey]?.groupKey ?? '']?.options.byKey[
      value.optionKey
    ];
  if (option === undefined) return false;
  if (stock.name !== option.key && stock.name !== option.rewardType) return false;
  if ((stock.boosted === true) !== (option.boonRarityOverride !== undefined)) return false;
  const payload = value.offer.payload;
  if (stock.lootName !== undefined)
    return payload?.kind === 'BoonSource' && payload.source === stock.lootName;
  return true;
}

/** Whether the offer's god is named by its acquisition, as a blind box's is, not by the offer. */
function resolvesByAcquisition(context: RunImportContext, offer: { readonly rewardType: string }) {
  return (
    context.catalog.rewards.rewardTypes.byKey[offer.rewardType]?.sourceResolution?.kind ===
    'acquisitionRole'
  );
}

function answerShopOffer(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
  reason: SemanticFinding,
): boolean {
  if (!shopOfferCodes.has(reason.code)) return false;
  const occurrence = authoredOccurrence(
    context.assembly().project,
    offer.biomeKey,
    offer.occurrenceId,
  );
  const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (occurrence === undefined || shop === undefined) return false;
  if (offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)
    return answerTravelDealRefill(context, offer, occurrence, shop);
  if (restockShopSlot(context, offer, shop) === true) return true;
  context.refuse();
  return false;
}

/**
 * Stocks a Shop slot with the record's item, over whatever the slot holds:
 * settlement stocks a reached Shop with its own draws, and a recorded item
 * always replaces them. Undefined when the record holds no item for the slot.
 */
function restockShopSlot(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
  shop: ShopState,
): boolean | undefined {
  const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
  const position = profile?.slots.values.findIndex((slot) => slot.key === offer.offerKey) ?? -1;
  const visit = storeVisit(context, offer.occurrenceId, 'worldShop');
  const stock = visit?.store.stock.find((option) => option.slot === position + 1);
  if (visit === undefined || stock === undefined) return undefined;
  const matches = shopOfferOptionValues(context.catalog, shop.profileKey, offer.offerKey).filter(
    (value) => stockMatches(context, shop.profileKey, offer.offerKey, stock, value),
  );
  const values = matches.filter((value) => shopOptionSupported(context, offer, value));
  const at = record(visit.roomIndex);
  const holds = (value: ShopOptionSelection) => holdsShopOption(context, offer, value);
  // The one recorded item a peer's draw rules out: the peer's own recorded item replaces that draw.
  if (values.length === 0 && matches.length === 1)
    return (
      holds(matches[0]!) ||
      context.apply({ kind: 'ReplaceShopOfferOption', offer, value: matches[0]! })
    );
  // A boon whose god the stock does not name is any god the room's next entry save accepts.
  const godOpen = (value: ShopOptionSelection) =>
    stock.lootName === undefined &&
    value.offer.payload !== undefined &&
    !resolvesByAcquisition(context, value.offer);
  const commands = values.map((value): ProjectCommand => ({
    kind: 'ReplaceShopOfferOption',
    offer,
    value,
  }));
  if (values.length > 1 && values.some(godOpen)) {
    const answer = authorAcceptedAnswer(
      context,
      visit.roomIndex,
      commands.map((command) => [command]),
      { area: 'shop', address: offer },
    );
    if (answer === undefined) {
      context.halt({ area: 'shop', code: 'stockGodUnaccepted', address: offer, record: at });
      return false;
    }
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: offer,
      applied: answer.commands[0]!,
      ...(answer.alternatives.length === 0 ? {} : { alternatives: answer.alternatives }),
      record: at,
    });
    return true;
  }
  return values.some(holds) || commands.some((command) => context.applyValid(command));
}

/** Whether the slot already holds the option, as settlement's draw or an earlier answer. */
function holdsShopOption(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
  value: ShopOptionSelection,
): boolean {
  const project = context.assembly().project;
  try {
    return (
      applyProjectCommand(project, context.catalog, {
        kind: 'ReplaceShopOfferOption',
        offer,
        value,
      }) === project
    );
  } catch {
    return false;
  }
}

/** Whether the engine supports a Shop option there, leaving at most open questions. */
function shopOptionSupported(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
  value: ShopOptionSelection,
): boolean {
  const evaluation = context.candidates().evaluate({ kind: 'shopOfferOption', offer, value });
  return (
    evaluation.kind === 'shopOffer' &&
    evaluation.result.supported &&
    evaluation.result.findings.every(isQuestionFinding)
  );
}

/**
 * The Travel Deal refill's item is never saved; a bought one is the stock
 * option whose interaction the room used beyond its bought stock and its
 * blind boxes' screens (a boon's god, whose screen follows). Its name is
 * inferred, so it is an assumption.
 * An unbought refill leaves no use and stays unanswered.
 */
function answerTravelDealRefill(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
  occurrence: RoomOccurrence,
  shop: ShopState,
): boolean {
  const visit = storeVisit(context, occurrence.occurrenceId, 'worldShop');
  const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
  if (visit === undefined || profile === undefined) return false;
  const optionOf = (slotKey: string, optionKey: string) =>
    profile.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? '']?.options.byKey[optionKey];
  const unexplained = new Map(Object.entries(visit.room.uses));
  let hiddenGods = 0;
  for (const purchase of visit.store.purchases ?? []) {
    const slotKey = profile.slots.values[purchase.slot - 1]?.key;
    const bought = slotKey === undefined ? undefined : shop.offers[slotKey];
    const option =
      slotKey === undefined || bought?.optionKey == null
        ? undefined
        : optionOf(slotKey, bought.optionKey);
    const name =
      option === undefined || bought?.reward == null
        ? undefined
        : purchaseInteractionName(option, bought.reward.offer);
    if (name !== undefined) unexplained.set(name, (unexplained.get(name) ?? 0) - 1);
    if (bought?.reward != null && resolvesByAcquisition(context, bought.reward.offer))
      hiddenGods += 1;
  }
  // A bought blind box's god is not saved: it opens on the god its pickup was
  // answered with, or else the room's first boon screen, ahead of the refill
  // its purchase made room for.
  for (const site of Object.values(occurrence.acquisitionSites ?? {}))
    for (const state of Object.values(site?.pickupEntries ?? {})) {
      const payload = state?.offer.payload;
      if (hiddenGods === 0 || payload?.kind !== 'BoonSource') continue;
      // Only a blind box hides its god behind a `hiddenSource` role.
      if (state?.dispositionByAcquisitionRole['hiddenSource'] === undefined) continue;
      const left = unexplained.get(payload.source) ?? 0;
      if (left <= 0) continue;
      unexplained.set(payload.source, left - 1);
      hiddenGods -= 1;
    }
  for (const screen of visit.room.traitScreens) {
    if (hiddenGods === 0) break;
    const left = unexplained.get(screen.giver) ?? 0;
    if (left <= 0) continue;
    unexplained.set(screen.giver, left - 1);
    hiddenGods -= 1;
  }
  const seen = new Set<string>();
  const values = profile.slots.values.flatMap((slot) =>
    shopOfferOptionValues(context.catalog, shop.profileKey, slot.key).filter((value) => {
      const name = purchaseInteractionName(optionOf(slot.key, value.optionKey)!, value.offer);
      const key = JSON.stringify(value);
      if (name === undefined || (unexplained.get(name) ?? 0) <= 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
  for (const value of values) {
    const evaluation = context.candidates().evaluate({ kind: 'shopOfferOption', offer, value });
    if (
      evaluation.kind !== 'shopOffer' ||
      !evaluation.result.supported ||
      !evaluation.result.findings.every(isQuestionFinding)
    )
      continue;
    const command: ProjectCommand = { kind: 'ReplaceShopOfferOption', offer, value };
    const biomeKey = offer.biomeKey;
    const refill: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    };
    if (
      !context.transaction(
        () =>
          (holdsShopOption(context, offer, value) || context.apply(command)) &&
          insertRoomAction(context, biomeKey, occurrence.occurrenceId, refill),
      )
    )
      continue;
    placeRefillByStamp(context, biomeKey, occurrence.occurrenceId, visit.room, refill);
    context.note({
      area: 'shop',
      reason: 'assumption',
      address: offer,
      applied: command,
      record: record(visit.roomIndex),
    });
    return true;
  }
  return false;
}

/**
 * A bought refill is an ordinary purchase once restocked: it goes before the
 * first later purchase whose stamp follows its own, kept where it was when the
 * engine refuses the move.
 */
function placeRefillByStamp(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  room: RunRecordRoom,
  refill: RoomActionReference,
): void {
  const occurrence = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId);
  const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (occurrence === undefined || shop === undefined) return;
  const order = occurrence.roomActions.order;
  const purchases = order.flatMap((action) =>
    action.kind === 'interactShopOffer' ? [action.offerKey] : [],
  );
  const stampOf = purchaseStamps(context, shop, room, [...purchases, TRAVEL_DEAL_REFILL_ENTRY_KEY]);
  const own = stampOf(TRAVEL_DEAL_REFILL_ENTRY_KEY);
  const from = order.findIndex((action) => roomActionKey(action) === roomActionKey(refill));
  if (own === undefined || from < 0) return;
  // The refill restocks after the first purchase, so it never precedes it.
  const first = order.findIndex((action) => action.kind === 'interactShopOffer');
  const toIndex = order.findIndex(
    (action, index) =>
      index > first &&
      action.kind === 'interactShopOffer' &&
      (stampOf(action.offerKey) ?? -Infinity) > own,
  );
  if (toIndex < 0 || toIndex > from) return;
  context.applyValid({
    kind: 'MoveRoomAction',
    action: roomActionAddress(context, biomeKey, occurrenceId, refill),
    toIndex,
  });
}

/**
 * The Contract pedestal's item is the one pedestal option its room used beyond
 * the stock it bought, in either Preboss form; collecting it is that use. An
 * uncollected pedestal leaves no trace in the record.
 */
function answerContractPedestal(
  context: RunImportContext,
  pedestal: Origin<'infernalContractPedestal'>,
): boolean {
  const occurrence = authoredOccurrence(
    context.assembly().project,
    pedestal.biomeKey,
    pedestal.occurrenceId,
  );
  const roomIndex = context.occurrences.visitsOf(pedestal.occurrenceId)[0];
  if (occurrence === undefined || roomIndex === undefined) return false;
  const room = context.record.rooms[roomIndex]!;
  const bought = new Map<string, number>();
  if (room.store?.kind === 'worldShop')
    for (const purchase of room.store.purchases ?? []) {
      const stock = room.store.stock.find((option) => option.slot === purchase.slot);
      if (stock !== undefined) bought.set(stock.name, (bought.get(stock.name) ?? 0) + 1);
    }
  const values = infernalContractPedestalOptionValues(context.catalog, occurrence.gameName);
  const unexplained = [...new Set(values.map((value) => value.offer.rewardType))].filter(
    (type) => (room.uses[type] ?? 0) > (bought.get(type) ?? 0),
  );
  if (unexplained.length !== 1) return false;
  for (const value of values) {
    if (value.offer.rewardType !== unexplained[0]) continue;
    const command: ProjectCommand = {
      kind: 'ReplaceInfernalContractPedestalOption',
      pedestal,
      value,
    };
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'infernalContractPedestalOption', pedestal, value });
    if (
      evaluation.kind !== 'infernalContractPedestal' ||
      !evaluation.result.supported ||
      !evaluation.result.findings.every(isQuestionFinding) ||
      !context.applyValid(command)
    )
      continue;
    if (
      !context.applyValid({
        kind: 'SetInfernalContractPedestalCollected',
        pedestal,
        collected: true,
      })
    )
      context.note({
        area: 'shop',
        reason: 'refused',
        address: pedestal,
        record: record(roomIndex),
      });
    return true;
  }
  context.refuse();
  return false;
}

/** The Shrine's recorded option for each slot, by its slot's group. */
function recordedShrineStock(context: RunImportContext, visit: StoreVisit) {
  const profile = context.catalog.rewards.shops.byKey['SurfaceShop'];
  return shrineSlots(context).map((slotKey, index) => {
    const stock = visit.store.stock.find((option) => option.slot === index + 1);
    const option = profile?.groups.byKey[
      profile.slots.byKey[slotKey]?.groupKey ?? ''
    ]?.options.values.find(
      (candidate) => candidate.key === stock?.name || candidate.rewardType === stock?.name,
    );
    return { slotKey, rewardType: option?.rewardType };
  });
}

/** Writes each recorded Shrine item over the item its slot was stocked with, in one edit. */
function restockShrine(
  context: RunImportContext,
  address: OccurrenceAddress,
  visit: StoreVisit,
  shrine: NonNullable<RoomOccurrence['hermesShrine']>,
): void {
  const restock = recordedShrineStock(context, visit).filter(
    ({ slotKey, rewardType }) =>
      rewardType !== undefined && shrine.offerBySlot[slotKey]?.rewardType !== rewardType,
  );
  if (
    restock.length > 0 &&
    !context.transaction(() =>
      restock.every(({ slotKey, rewardType }) =>
        context.apply({
          kind: 'ReplaceHermesShrineOffer',
          occurrence: address,
          slotKey,
          value: { rewardType: rewardType! },
        }),
      ),
    )
  )
    context.note({
      area: 'shop',
      reason: 'refused',
      address: createRoomFeatureAddress(address, { kind: 'hermesShrinePresence' }),
      record: record(visit.roomIndex),
    });
}

/** The Shrine's recorded stock, each authored into its slot in stock order. */
function answerShrineOffers(context: RunImportContext, feature: Origin<'roomFeature'>): boolean {
  const visit = storeVisit(context, feature.occurrenceId, 'hermesShrine');
  const occurrence = authoredOccurrence(
    context.assembly().project,
    feature.biomeKey,
    feature.occurrenceId,
  );
  if (visit === undefined || occurrence === undefined) return false;
  const profile = context.catalog.rewards.shops.byKey['SurfaceShop'];
  const address = createOccurrenceAddress(
    createBiomeAddress(feature.routeKey, feature.biomeKey),
    feature.occurrenceId,
  );
  let answered = false;
  for (const [index, slotKey] of shrineSlots(context).entries()) {
    if (occurrence.hermesShrine?.offerBySlot[slotKey] != null) continue;
    const stock = visit.store.stock.find((option) => option.slot === index + 1);
    const option = profile?.groups.byKey[
      profile.slots.byKey[slotKey]?.groupKey ?? ''
    ]?.options.values.find(
      (candidate) => candidate.key === stock?.name || candidate.rewardType === stock?.name,
    );
    if (option === undefined) continue;
    const command: ProjectCommand = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: address,
      slotKey,
      value: { rewardType: option.rewardType },
    };
    if (context.applyValid(command)) answered = true;
  }
  if (!answered) context.refuse();
  return answered;
}

/**
 * The Shrine's Travel Deal refill is the option its first rush left in the
 * rushed slot, with that option's delayed purchase: answered when the plan asks
 * for it, or written over the item the rush's edit stocked.
 */
function answerShrineRefill(context: RunImportContext, feature: Origin<'roomFeature'>): boolean {
  if (restockShrineRefill(context, feature.biomeKey, feature.occurrenceId)) return true;
  context.refuse();
  return false;
}

function restockShrineRefill(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
): boolean {
  const visit = storeVisit(context, occurrenceId, 'hermesShrine');
  const refill = visit?.store.refill;
  const used = `shrineRefill:${occurrenceId}`;
  if (visit === undefined || refill === undefined || context.used.has(used)) return false;
  const option = context.catalog.rewards.shops.byKey['SurfaceShop']?.groups.values
    .flatMap((group) => group.options.values)
    .find(
      (candidate) =>
        candidate.key === refill.option.name || candidate.rewardType === refill.option.name,
    );
  const address = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const stocked = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)
    ?.hermesShrine?.travelDealRefill?.offer;
  if (
    option === undefined ||
    (stocked?.rewardType !== option.rewardType &&
      !context.applyValid({
        kind: 'ReplaceHermesShrineTravelDealRefill',
        occurrence: address,
        value: { rewardType: option.rewardType },
      }))
  )
    return false;
  context.used.add(used);
  if (refill.purchase !== undefined)
    importShrinePurchase(
      context,
      biomeKey,
      occurrenceId,
      visit,
      refill.purchase,
      'travelDealRefill',
    );
  return true;
}

function roomShopItems(context: RunImportContext): ReadonlySet<string> {
  return new Set(
    context.catalog.rewards.shops.byKey['RoomShop']?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
}

/** The Well's recorded stock, each authored into its slot in stock order. */
function answerWellOffers(context: RunImportContext, feature: Origin<'roomFeature'>): boolean {
  const visit = storeVisit(context, feature.occurrenceId, 'well');
  const occurrence = authoredOccurrence(
    context.assembly().project,
    feature.biomeKey,
    feature.occurrenceId,
  );
  const well = occurrence?.stygianWell;
  if (visit === undefined || well === undefined) return false;
  const known = new Set(
    context.catalog.rewards.shops.byKey['RoomShop']?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
  const address = createOccurrenceAddress(
    createBiomeAddress(feature.routeKey, feature.biomeKey),
    feature.occurrenceId,
  );
  let answered = false;
  for (const [index, slotKey] of wellSlots(context).entries()) {
    if (well.offerKeyBySlot[slotKey] !== null) continue;
    const stock = visit.store.stock.find((option) => option.slot === index + 1);
    if (stock === undefined || !known.has(stock.name)) continue;
    if (
      context.applyValid({
        kind: 'ReplaceStygianWellOffer',
        occurrence: address,
        slotKey,
        itemKey: stock.name,
      })
    )
      answered = true;
  }
  if (!answered) context.refuse();
  return answered;
}

/** A Shrine delivery's item, from the Shrine slot its entry names. */
function shrineDeliveryRewardTypes(
  context: RunImportContext,
  entry: Origin<'acquisitionEntry'>,
): readonly string[] | undefined {
  const parsed = parseHermesShrineDeliveryEntryKey(entry.entryKey);
  if (parsed === undefined) return undefined;
  const shrine = authoredOccurrence(
    context.assembly().project,
    parsed.biomeKey,
    parsed.sourceOccurrenceId,
  )?.hermesShrine;
  const slotKey = hermesShrineInitialSlotKey(parsed.generationKey);
  const rewardType =
    slotKey === undefined
      ? shrine?.travelDealRefill?.offer?.rewardType
      : shrine?.offerBySlot[slotKey]?.rewardType;
  return rewardType === undefined ? undefined : [rewardType];
}

/**
 * The givers of the host's recorded screens no answer has taken yet, in the
 * order of their first such screen, less the hidden gods its other pickups
 * already opened on and whose screens are still to be answered (two boxes in
 * one room open on two screens' gods), and less the screens its bought boons
 * of a named god still need.
 */
function unclaimedScreenGivers(
  context: RunImportContext,
  entry: Origin<'acquisitionEntry'>,
  visits: readonly number[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const answered = new Map<string, number>();
  const bought = new Map<string, number>();
  for (const roomIndex of visits) {
    const room = context.record.rooms[roomIndex]!;
    for (const [position, screen] of room.traitScreens.entries()) {
      const tally = context.used.has(`screen:${roomIndex}:${position}`) ? answered : counts;
      tally.set(screen.giver, (tally.get(screen.giver) ?? 0) + 1);
    }
    if (room.store?.kind !== 'worldShop') continue;
    for (const purchase of room.store.purchases ?? []) {
      const god = room.store.stock.find((option) => option.slot === purchase.slot)?.lootName;
      if (god !== undefined) bought.set(god, (bought.get(god) ?? 0) + 1);
    }
  }
  // A bought boon whose screen is not answered yet takes one of its god's.
  for (const [god, count] of bought)
    if (counts.has(god))
      counts.set(god, counts.get(god)! - Math.max(0, count - (answered.get(god) ?? 0)));
  const hostId = occurrenceIdOf(entry);
  const host =
    hostId === undefined
      ? undefined
      : authoredOccurrence(context.assembly().project, entry.biomeKey, hostId);
  for (const site of Object.values(host?.acquisitionSites ?? {}))
    for (const [entryKey, state] of Object.entries(site?.pickupEntries ?? {})) {
      if (entryKey === entry.entryKey) continue;
      const payload = state?.offer.payload;
      if (payload?.kind !== 'BoonSource') continue;
      // A box whose god's screen is answered already took it from the counts.
      if (state?.traitOffersByAcquisitionRole['hiddenSource'] != null) continue;
      counts.set(payload.source, (counts.get(payload.source) ?? 0) - 1);
    }
  return counts;
}

/**
 * A derived pickup's payload, such as a Shrine delivery or a Mystery Boon's
 * hidden god: its reward type, and for a boon the god whose loot its room's
 * uses or screens name.
 */
function answerAcquisitionEntry(
  context: RunImportContext,
  entry: Origin<'acquisitionEntry'>,
): boolean {
  const derived = derivedAcquisitionEntriesForProjectEvaluationAssembly(
    context.assembly(),
    entry.site,
  ).find((candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(entry));
  const hostId = occurrenceIdOf(entry);
  const rewardTypes = derived?.rewardTypes ?? shrineDeliveryRewardTypes(context, entry);
  if (rewardTypes === undefined || hostId === undefined) return false;
  const visits = context.occurrences.visitsOf(hostId);
  const rooms = visits.map((index) => context.record.rooms[index]!);
  const named = (source: string) =>
    rooms.some(
      (room) =>
        (room.uses[source] ?? 0) > 0 || room.traitScreens.some((screen) => screen.giver === source),
    );
  const boon = (value: ResolvedRewardOffer) =>
    value.payload?.kind === 'BoonSource' ? value.payload.source : undefined;
  const values = rewardTypes.flatMap((rewardType) =>
    locallyValidRewardOffers(context.catalog.rewards, rewardType),
  );
  const unclaimed = unclaimedScreenGivers(context, entry, visits);
  // A box opens on the giver of the earliest screen still unclaimed, in the record's order.
  const screenOrder = [...unclaimed.keys()];
  const ordered = [
    ...values
      .filter((value) => (unclaimed.get(boon(value) ?? '') ?? 0) > 0)
      .sort((left, right) => screenOrder.indexOf(boon(left)!) - screenOrder.indexOf(boon(right)!)),
    ...values.filter(
      (value) =>
        (unclaimed.get(boon(value) ?? '') ?? 0) <= 0 &&
        boon(value) !== undefined &&
        named(boon(value)!),
    ),
    ...values.filter((value) => !(boon(value) !== undefined && named(boon(value)!))),
  ];
  const supported = ordered.filter((value) => {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'acquisitionEntryOffer', entry, value });
    return (
      evaluation.kind === 'acquisitionEntryOffer' &&
      evaluation.result.supported &&
      evaluation.result.findings.every(isQuestionFinding)
    );
  });
  const commands = supported.map((value): ProjectCommand => ({
    kind: 'ReplaceAcquisitionEntryOffer',
    entry,
    value,
  }));
  // One reward type with a god the record names, or none, is the record's answer.
  const recorded = (value: ResolvedRewardOffer) =>
    rewardTypes.length === 1 && (boon(value) === undefined || named(boon(value)!));
  for (const [index, value] of supported.entries()) {
    if (!recorded(value)) break;
    if (context.applyValid(commands[index]!)) return true;
  }
  const guessed = commands.filter((_command, index) => !recorded(supported[index]!));
  // Several reward types, or a god no room record names: what the next entry save accepts.
  const roomIndex = visits[0];
  const answer =
    roomIndex === undefined || guessed.length === 0
      ? undefined
      : authorAcceptedAnswer(
          context,
          roomIndex,
          guessed.map((command) => [command]),
          { area: 'reward', address: entry },
        );
  if (answer === undefined) {
    if (supported.length === 0) context.refuse();
    return false;
  }
  context.note({
    area: 'reward',
    reason: 'notInRecord',
    address: entry,
    applied: answer.commands[0]!,
    ...(answer.alternatives.length === 0 ? {} : { alternatives: answer.alternatives }),
    record: record(roomIndex!),
  });
  return true;
}

/** A purchase's own pickup effect, such as the Anvil of Fates result, answered with it. */
function answerPurchaseEffects(context: RunImportContext, offer: Origin<'shopOffer'>): boolean {
  for (const finding of context.assembly().evaluation.findings)
    if (
      finding.origin.kind === 'acquisitionRole' &&
      finding.code === 'rewardMissing' &&
      finding.evidence['pickupEffect'] === 'anvilOfFates' &&
      semanticAddressKey(finding.origin.owner) === semanticAddressKey(offer)
    )
      return answerAnvil(context, finding.origin);
  return true;
}

const isHammer = (context: RunImportContext, traitKey: string) =>
  context.catalog.traitGivers.byKey['WeaponUpgrade']?.traitKeys.includes(traitKey) === true;

/** The Anvil of Fates result is the Hammer its room lost and the two it gained. */
function answerAnvil(context: RunImportContext, acquisition: Origin<'acquisitionRole'>): boolean {
  const occurrenceId = occurrenceIdOf(acquisition);
  if (occurrenceId === undefined) return false;
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const traits = context.record.rooms[roomIndex]!.traits;
    const added = traits.acquired
      .map((trait) => trait.name)
      .filter((name) => isHammer(context, name));
    const removed = traits.removed.filter((name) => isHammer(context, name));
    if (added.length !== 2 || removed.length > 1) continue;
    if (
      context.applyValid({
        kind: 'ReplaceAnvilResult',
        acquisition,
        value: {
          kind: 'anvilOfFates',
          removedTraitKey: removed[0] ?? null,
          addedTraitKeys: [added[0]!, added[1]!],
        },
      })
    )
      return true;
    context.refuse();
    return false;
  }
  return false;
}

/**
 * Store presence, purchases and Pool sales: optional authorship the route
 * never asks for, authored once its room is entered and its inventory known.
 */
export function importCommerce(context: RunImportContext): void {
  for (const { biomeKey, occurrence } of pendingOccurrences(context)) {
    importShopStock(context, biomeKey, occurrence);
    // Purchases and the refill read the stock the record just wrote.
    const current = () =>
      authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId) ??
      occurrence;
    importShopPurchases(context, biomeKey, current());
    importShopRefill(context, biomeKey, current());
    importShrine(context, biomeKey, occurrence);
    pickUpRushedItems(context, biomeKey, occurrence);
    importWell(context, biomeKey, occurrence);
    importPool(context, biomeKey, occurrence);
  }
}

/** Notes a record answer the engine refused, once per key. */
function noteOnce(
  context: RunImportContext,
  key: string,
  area: RunImportArea,
  reason: 'refused' | 'notInRecord' | 'assumption',
  address: SemanticAddress,
  roomIndex: number,
  applied?: ProjectCommand,
): void {
  if (context.used.has(key)) return;
  context.used.add(key);
  context.note({
    area,
    reason,
    address,
    ...(applied === undefined ? {} : { applied }),
    record: record(roomIndex),
  });
}

/**
 * A reached Shop's recorded stock, once its settlement has stocked every slot:
 * each recorded item replaces the slot's draw, and an unrecorded slot takes the
 * value its room's next entry save accepts, its draw kept when none is.
 */
function importShopStock(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
): void {
  const used = `shopStock:${occurrence.occurrenceId}`;
  const visit = storeVisit(context, occurrence.occurrenceId, 'worldShop');
  const initial = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  const slots = context.catalog.rewards.shops.byKey[initial?.profileKey ?? '']?.slots.values;
  if (context.used.has(used) || initial === undefined || visit === undefined || slots === undefined)
    return;
  if (slots.some((slot) => (initial.offers[slot.key]?.reward ?? null) === null)) return;
  context.used.add(used);
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  for (const slot of slots) {
    const current = authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrence.occurrenceId,
    );
    const shop = current?.state.kind === 'shop' ? current.state.shop : undefined;
    if (shop === undefined) return;
    const offer = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
    const restocked = restockShopSlot(context, offer, shop);
    if (restocked === false)
      context.note({
        area: 'shop',
        reason: 'refused',
        address: offer,
        record: record(visit.roomIndex),
      });
    if (restocked !== undefined) continue;
    const answer = authorAcceptedAnswer(
      context,
      visit.roomIndex,
      shopOfferAnswers(context, offer),
      {
        area: 'shop',
        address: offer,
      },
    );
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: offer,
      ...(answer === undefined ? {} : { applied: answer.commands[0]! }),
      ...(answer === undefined || answer.alternatives.length === 0
        ? {}
        : { alternatives: answer.alternatives }),
      record: record(visit.roomIndex),
    });
  }
}

function importShopPurchases(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
): void {
  const used = `shopPurchases:${occurrence.occurrenceId}`;
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  const visit = storeVisit(context, occurrence.occurrenceId, 'worldShop');
  if (context.used.has(used) || shop === undefined || visit === undefined) return;
  const slots = context.catalog.rewards.shops.byKey[shop.profileKey]?.slots.values ?? [];
  // Purchases wait for the profile's whole inventory.
  if (slots.some((slot) => (shop.offers[slot.key]?.reward ?? null) === null)) return;
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  if (visit.store.purchases === undefined) {
    context.used.add(used);
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: createOccurrenceAddress(biome, occurrence.occurrenceId),
      record: record(visit.roomIndex),
    });
    return;
  }
  const purchases = purchaseOrder(context, shop, visit.room, visit.store.purchases);
  const placed = (offerKey: string) =>
    authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrence.occurrenceId,
    )?.roomActions.order.some(
      (action) => action.kind === 'interactShopOffer' && action.offerKey === offerKey,
    ) === true;
  for (const [index, purchase] of purchases.entries()) {
    const bought = `${used}:${index}`;
    if (context.used.has(bought)) continue;
    // The item a purchase restocked comes before the next purchase, which waits for what it spawns.
    if (
      index > 0 &&
      importShopRefill(
        context,
        biomeKey,
        authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId) ??
          occurrence,
      )
    )
      return;
    // The record's next purchase follows what the one before it spawned, so it waits until
    // the walk passes that purchase and its required items are collected.
    const previous = index === 0 ? undefined : slots[purchases[index - 1]!.slot - 1]?.key;
    if (
      previous !== undefined &&
      placed(previous) &&
      !collectedPast(context, biomeKey, occurrence.occurrenceId, {
        kind: 'interactShopOffer',
        offerKey: previous,
      })
    )
      return;
    context.used.add(bought);
    const offerKey = slots[purchase.slot - 1]?.key;
    const offer =
      offerKey === undefined
        ? undefined
        : createShopOfferAddress(biome, occurrence.occurrenceId, offerKey);
    if (
      offer !== undefined &&
      context.transaction(
        () =>
          context.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true }) &&
          answerPurchaseEffects(context, offer),
      )
    ) {
      context.retractable(
        [
          offer,
          roomActionAddress(context, biomeKey, occurrence.occurrenceId, {
            kind: 'interactShopOffer',
            offerKey: offer.offerKey,
          }),
        ],
        { kind: 'ReplaceShopPurchaseParticipation', offer, purchased: false },
        { area: 'shop', reason: 'refused', address: offer, record: record(visit.roomIndex) },
      );
      continue;
    }
    context.note({
      area: 'shop',
      reason: 'refused',
      address: offer ?? createOccurrenceAddress(biome, occurrence.occurrenceId),
      record: record(visit.roomIndex),
    });
  }
  context.used.add(used);
}

/**
 * Settlement stocks the Travel Deal item once the walk reaches the purchase
 * that restocks it; a bought one is the record's, imported before the next
 * recorded purchase. True when it was imported now.
 */
function importShopRefill(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
): boolean {
  const used = `shopRefill:${occurrence.occurrenceId}`;
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (
    context.used.has(used) ||
    shop === undefined ||
    (shop.travelDealRefill?.reward ?? null) === null
  )
    return false;
  context.used.add(used);
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const offer = createShopOfferAddress(
    biome,
    occurrence.occurrenceId,
    TRAVEL_DEAL_REFILL_ENTRY_KEY,
  );
  // An unbought item leaves no trace: the refill keeps settlement's draw.
  if (!answerTravelDealRefill(context, offer, occurrence, shop)) {
    const visit = storeVisit(context, occurrence.occurrenceId, 'worldShop');
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: offer,
      ...(visit === undefined ? {} : { record: record(visit.roomIndex) }),
    });
  }
  return true;
}

/** Each giver's stamped screen picks in a room, earliest first: an acquired trait, or the one a level-up raised. */
function giverStamps(room: RunRecordRoom): ReadonlyMap<string, readonly number[]> {
  const stamps = new Map<string, number[]>();
  for (const screen of room.traitScreens) {
    const chosen = screen.options.find((option) => option.chosen)?.name;
    const time = [...room.traits.acquired, ...room.traits.upgraded].find(
      (trait) => trait.name === chosen,
    )?.worldTime;
    if (time !== undefined) stamps.set(screen.giver, [...(stamps.get(screen.giver) ?? []), time]);
  }
  for (const times of stamps.values()) times.sort((left, right) => left - right);
  return stamps;
}

/**
 * The stamp of each bought Shop item, by slot key: its giver's earliest
 * stamp, and for a blind box the earliest stamp the named purchases leave,
 * each taking one of its giver's screens (its god's screen). Undefined for
 * an item no screen stamps.
 */
function purchaseStamps(
  context: RunImportContext,
  shop: ShopState,
  room: RunRecordRoom,
  slotKeys: readonly string[],
): (slotKey: string) => number | undefined {
  const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
  const stamps = giverStamps(room);
  const bought = (slotKey: string) => {
    const state =
      slotKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ? shop.travelDealRefill : shop.offers[slotKey];
    const groupKey =
      slotKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? undefined
        : profile?.slots.byKey[slotKey]?.groupKey;
    const option =
      state?.optionKey == null || profile === undefined
        ? undefined
        : groupKey !== undefined
          ? profile.groups.byKey[groupKey]?.options.byKey[state.optionKey]
          : profile.groups.values
              .map((group) => group.options.byKey[state.optionKey!])
              .find((entry) => entry !== undefined);
    return option === undefined || state?.reward == null
      ? undefined
      : {
          name: purchaseInteractionName(option, state.reward.offer),
          hidden: resolvesByAcquisition(context, state.reward.offer),
        };
  };
  const named = new Map<string, number>();
  for (const slotKey of slotKeys) {
    const name = bought(slotKey)?.name;
    if (name !== undefined) named.set(name, (named.get(name) ?? 0) + 1);
  }
  const hidden = Math.min(
    ...[...stamps].flatMap(([giver, times]) => times.slice(named.get(giver) ?? 0)),
  );
  return (slotKey) => {
    const item = bought(slotKey);
    const stamp = item?.name === undefined ? undefined : stamps.get(item.name)?.[0];
    return stamp ?? (item?.hidden === true && Number.isFinite(hidden) ? hidden : undefined);
  };
}

/**
 * The record keeps purchases in slot order; a purchase a screen stamps goes
 * in stamp order, so Echo's duplicate follows the first purchase and a
 * Travel Deal refill can be placed between them. Unstamped purchases keep
 * their positions.
 */
function purchaseOrder<Purchase extends { readonly slot: number }>(
  context: RunImportContext,
  shop: ShopState,
  room: RunRecordRoom,
  purchases: readonly Purchase[],
): readonly Purchase[] {
  const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
  if (profile === undefined) return purchases;
  const slotKey = (purchase: Purchase) => profile.slots.values[purchase.slot - 1]?.key ?? '';
  const stampOf = purchaseStamps(context, shop, room, purchases.map(slotKey));
  const stamp = (purchase: Purchase) => stampOf(slotKey(purchase));
  const timed = purchases.flatMap((purchase, index) =>
    stamp(purchase) === undefined ? [] : [index],
  );
  const sorted = timed
    .map((index) => purchases[index]!)
    .sort((left, right) => stamp(left)! - stamp(right)!);
  const ordered = [...purchases];
  timed.forEach((position, index) => (ordered[position] = sorted[index]!));
  return ordered;
}

/** The pickup a purchased item spawns, by its record use name. */
function collected(context: RunImportContext, room: RunRecordRoom, rewardType: string): boolean {
  return pickupUseCount(context.catalog, room, rewardType) > 0;
}

function importShrine(context: RunImportContext, biomeKey: string, occurrence: RoomOccurrence) {
  const visit = storeVisit(context, occurrence.occurrenceId, 'hermesShrine');
  if (visit === undefined) return;
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const address = createOccurrenceAddress(biome, occurrence.occurrenceId);
  const presence = `shrinePresence:${occurrence.occurrenceId}`;
  if (!context.used.has(presence)) {
    context.used.add(presence);
    const surfaceShop = context.catalog.rooms.byKey[occurrence.gameName]?.surfaceShop;
    if (
      surfaceShop?.forced !== true &&
      occurrence.hermesShrine === undefined &&
      !context.applyValid({ kind: 'SetHermesShrinePresence', occurrence: address, present: true })
    )
      context.note({
        area: 'shop',
        reason: 'refused',
        address: createRoomFeatureAddress(address, { kind: 'hermesShrinePresence' }),
        record: record(visit.roomIndex),
      });
    return;
  }
  const shrine = authoredOccurrence(
    context.assembly().project,
    biomeKey,
    occurrence.occurrenceId,
  )?.hermesShrine;
  // The edit that reached the Shrine stocked it; the record's items replace the draws.
  const stockKey = `shrineStock:${occurrence.occurrenceId}`;
  if (shrine !== undefined && !context.used.has(stockKey)) {
    context.used.add(stockKey);
    restockShrine(context, address, visit, shrine);
    return;
  }
  const used = `shrinePurchases:${occurrence.occurrenceId}`;
  if (
    shrine === undefined ||
    context.used.has(used) ||
    shrineSlots(context).some((slotKey) => shrine.offerBySlot[slotKey] === null)
  )
    return;
  context.used.add(used);
  if (visit.store.purchases === undefined) {
    context.note({ area: 'shop', reason: 'notInRecord', address, record: record(visit.roomIndex) });
    return;
  }
  for (const purchase of visit.store.purchases)
    importShrinePurchase(context, biomeKey, occurrence.occurrenceId, visit, purchase);
}

/**
 * One Shrine purchase, of a stock slot or of the Travel Deal refill: its delay,
 * then its rush. A rushed item's delay only prices it and is not saved, so it
 * keeps its default; a delayed one's delay names its delivery room.
 */
function importShrinePurchase(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  visit: StoreVisit,
  purchase: NonNullable<RunRecordStore['purchases']>[number],
  refill?: 'travelDealRefill',
): void {
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const address = createOccurrenceAddress(biome, occurrenceId as OccurrenceId);
  const slotKey: HermesShrineSlotKey | undefined = shrineSlots(context)[purchase.slot - 1];
  const generationKey: HermesShrineGenerationKey | undefined =
    refill ?? (slotKey === undefined ? undefined : `initial:${slotKey}`);
  if (generationKey === undefined) {
    context.note({ area: 'shop', reason: 'refused', address, record: record(visit.roomIndex) });
    return;
  }
  const feature = createRoomFeatureAddress(address, { kind: 'hermesShrineOffer', generationKey });
  const stockedOffer = () => {
    const stocked = authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrenceId,
    )?.hermesShrine;
    return generationKey === 'travelDealRefill'
      ? stocked?.travelDealRefill?.offer
      : stocked?.offerBySlot[slotKey!];
  };
  const rushed = purchase.delivery === 'rushed';
  const unknown = [2, 3, 4, 5, 6, 7, 8];
  const kept = rushed ? stockedOffer()?.delay : undefined;
  const delays =
    purchase.delay !== undefined
      ? [purchase.delay]
      : kept === undefined
        ? unknown
        : [kept, ...unknown.filter((delay) => delay !== kept)];
  const purchaseCommand: ProjectCommand = {
    kind: 'SetHermesShrinePurchase',
    occurrence: address,
    generationKey,
    purchased: true,
  };
  let applied: ProjectCommand | undefined;
  // The delay belongs to the stocked item; a rushed one's only prices it.
  for (const delay of delays) {
    const delayCommand: ProjectCommand = {
      kind: 'SetHermesShrineOfferDelay',
      occurrence: address,
      generationKey,
      delay: delay as HermesShrineDelay,
    };
    const current = stockedOffer();
    if (
      context.transaction(
        () =>
          (current?.delay === delay || context.apply(delayCommand)) &&
          context.apply(purchaseCommand),
      )
    ) {
      applied = delayCommand;
      break;
    }
  }
  if (applied === undefined) {
    context.note({
      area: 'shop',
      reason: 'refused',
      address: feature,
      record: record(visit.roomIndex),
    });
    return;
  }
  context.retractable(
    [
      feature,
      roomActionAddress(context, biomeKey, occurrenceId, {
        kind: 'purchaseHermesShrineOffer',
        generationKey,
      }),
    ],
    { kind: 'SetHermesShrinePurchase', occurrence: address, generationKey, purchased: false },
    { area: 'shop', reason: 'refused', address: feature, record: record(visit.roomIndex) },
  );
  if (purchase.delay === undefined && !rushed)
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: feature,
      applied,
      record: record(visit.roomIndex),
    });
  if (purchase.delivery !== 'rushed') return;
  if (
    !context.applyValid({
      kind: 'SetHermesShrineRush',
      occurrence: address,
      generationKey,
      rushed: true,
    })
  ) {
    context.note({
      area: 'shop',
      reason: 'refused',
      address: feature,
      record: record(visit.roomIndex),
    });
    return;
  }
  // A rushed item left on the floor is not picked up; a collected one is, once it lies live.
  const rewardType = visit.store.stock.find((option) => option.slot === purchase.slot)?.name;
  if (rewardType !== undefined && collected(context, visit.room, rewardType))
    context.used.add(rushedPickupKey(occurrenceId, generationKey));
  // The rush that restocked its slot stocked the refill with its edit; the record's item replaces it.
  const shrine = authoredOccurrence(
    context.assembly().project,
    biomeKey,
    occurrenceId,
  )?.hermesShrine;
  if (refill === undefined && (shrine?.travelDealRefill?.offer ?? null) !== null)
    restockShrineRefill(context, biomeKey, occurrenceId);
}

const rushedPickupKey = (occurrenceId: string, generationKey: string) =>
  `rushedPickup:${occurrenceId}:${generationKey}`;

/**
 * Picks up each collected rushed item of a Shrine room where the live room
 * offers it: it spawns as its rush settles, which can wait on a Travel Deal
 * refill the walk answers later.
 */
function pickUpRushedItems(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
): void {
  const address = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrence.occurrenceId,
  );
  for (const row of occurrence.roomActions.order) {
    if (
      row.kind !== 'rushHermesShrineOffer' ||
      !context.used.has(rushedPickupKey(occurrence.occurrenceId, row.generationKey))
    )
      continue;
    placeLiveRoomAction(context, biomeKey, occurrence.occurrenceId, {
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: hermesShrineDeliveryEntryKey(address, row.generationKey),
    });
  }
}

function importWell(context: RunImportContext, biomeKey: string, occurrence: RoomOccurrence) {
  const visit = storeVisit(context, occurrence.occurrenceId, 'well');
  if (visit === undefined) return;
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const address = createOccurrenceAddress(biome, occurrence.occurrenceId);
  const presence = `wellPresence:${occurrence.occurrenceId}`;
  if (!context.used.has(presence)) {
    context.used.add(presence);
    const feature = createRoomFeatureAddress(address, { kind: 'stygianWellPresence' });
    if (
      occurrence.stygianWell === undefined &&
      !context.applyValid({ kind: 'AddStygianWell', occurrence: address })
    ) {
      noteOnce(context, `${presence}:refused`, 'well', 'refused', feature, visit.roomIndex);
      return;
    }
    // Only a Well the player opened has its stock and purchases to author.
    const opened = (visit.room.uses['WellShop'] ?? 0) > 0;
    if (
      !opened &&
      ((visit.store.purchases?.length ?? 0) > 0 ||
        (visit.store.unstockedPurchases?.length ?? 0) > 0)
    )
      context.note({
        area: 'well',
        reason: 'notInRecord',
        address: feature,
        record: record(visit.roomIndex),
      });
    if (!opened) return;
    // An opened Well's recorded opening stock is its initial roll. The edit that
    // added the Well stocked every slot; each recorded item replaces its draw, and
    // an unrecorded slot is drawn again past them.
    context.used.add(`wellOpened:${occurrence.occurrenceId}`);
    const known = roomShopItems(context);
    const recorded = wellSlots(context).map((slotKey, index) => {
      const stock = visit.store.stock.find((option) => option.slot === index + 1);
      return {
        slotKey,
        itemKey: stock === undefined || !known.has(stock.name) ? null : stock.name,
      };
    });
    const stocked = authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrence.occurrenceId,
    )?.stygianWell?.offerKeyBySlot;
    const items = new Set(recorded.flatMap((slot) => slot.itemKey ?? []));
    const restock = [
      ...recorded.filter(
        (slot) => slot.itemKey !== null && stocked?.[slot.slotKey] !== slot.itemKey,
      ),
      // An unrecorded slot whose draw repeats a recorded item is drawn again.
      ...recorded.filter(
        (slot) => slot.itemKey === null && items.has(stocked?.[slot.slotKey] ?? ''),
      ),
    ];
    if (
      restock.length > 0 &&
      !context.transaction(() =>
        restock.every(({ slotKey, itemKey }) =>
          context.apply({ kind: 'ReplaceStygianWellOffer', occurrence: address, slotKey, itemKey }),
        ),
      )
    )
      for (const { slotKey } of recorded.filter((slot) => slot.itemKey !== null))
        context.note({
          area: 'well',
          reason: 'refused',
          address: createRoomFeatureAddress(address, {
            kind: 'stygianWellOffer',
            generationKey: stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey),
          }),
          record: record(visit.roomIndex),
        });
    applyFeatureRerolls(context, visit.roomIndex, 'well', feature, () => ({
      kind: 'InsertStygianWellReroll',
      occurrence: address,
      index: actionCount(context, biomeKey, occurrence.occurrenceId),
    }));
    return;
  }
  const well = authoredOccurrence(
    context.assembly().project,
    biomeKey,
    occurrence.occurrenceId,
  )?.stygianWell;
  const used = `wellPurchases:${occurrence.occurrenceId}`;
  if (
    well === undefined ||
    !context.used.has(`wellOpened:${occurrence.occurrenceId}`) ||
    context.used.has(used) ||
    wellSlots(context).some((slotKey) => well.offerKeyBySlot[slotKey] === null)
  )
    return;
  context.used.add(used);
  if (visit.store.purchases === undefined) {
    context.note({ area: 'well', reason: 'notInRecord', address, record: record(visit.roomIndex) });
    return;
  }
  // The record keeps no roll order: with rerolls, every purchase is placed on the last roll.
  const lastRoll = stygianWellRerolls(
    authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId)?.roomActions
      .order ?? [],
  ).at(-1);
  const rollKey = lastRoll?.rerollId ?? INITIAL_ROLL_KEY;
  // A roll's edit stocked its slots; a recorded item replaces a different draw.
  const pin = (slotKey: StygianWellSlotKey, itemKey: string) =>
    lastRoll === undefined ||
    authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId)?.stygianWell
      ?.rerollOfferKeyBySlot?.[lastRoll.rerollId]?.[slotKey] === itemKey ||
    context.applyValid({
      kind: 'ReplaceStygianWellRollOffer',
      action: roomActionAddress(context, biomeKey, occurrence.occurrenceId, lastRoll),
      slotKey,
      itemKey,
    });
  const purchase = (slotKey: StygianWellSlotKey, itemKey: string) => {
    const generationKey = stygianWellGenerationKey(rollKey, slotKey);
    const feature = createRoomFeatureAddress(address, { kind: 'stygianWellOffer', generationKey });
    if (
      !pin(slotKey, itemKey) ||
      !context.applyValid({
        kind: 'SetStygianWellPurchase',
        occurrence: address,
        generationKey,
        purchased: true,
      })
    ) {
      context.note({
        area: 'well',
        reason: 'refused',
        address: feature,
        record: record(visit.roomIndex),
      });
      return false;
    }
    retractWellPurchase(context, biomeKey, address, generationKey, visit.roomIndex);
    importTwist(context, address, visit, generationKey, itemKey);
    if (lastRoll !== undefined)
      noteOnce(
        context,
        `wellRolls:${occurrence.occurrenceId}`,
        'well',
        'assumption',
        createRoomFeatureAddress(address, { kind: 'stygianWellInventory' }),
        visit.roomIndex,
      );
    return true;
  };
  for (const recorded of visit.store.purchases) {
    const slotKey: StygianWellSlotKey | undefined = wellSlots(context)[recorded.slot - 1];
    const itemKey = slotKey === undefined ? undefined : (well.offerKeyBySlot[slotKey] ?? undefined);
    if (slotKey === undefined || itemKey === undefined) {
      context.note({ area: 'well', reason: 'refused', address, record: record(visit.roomIndex) });
      continue;
    }
    purchase(slotKey, itemKey);
  }
  // Travel Deal restocks one slot after the first purchase; its item is the one bought unstocked.
  const [refill, ...extra] = visit.store.unstockedPurchases ?? [];
  if (refill === undefined) return;
  const feature = createRoomFeatureAddress(address, {
    kind: 'stygianWellOffer',
    generationKey: 'travelDealRefill',
  });
  // The first purchase's edit stocked the refill; the recorded item replaces a different draw.
  const stockedRefill = authoredOccurrence(
    context.assembly().project,
    biomeKey,
    occurrence.occurrenceId,
  )?.stygianWell?.travelDealRefillKey;
  if (
    (stockedRefill !== refill &&
      !context.applyValid({
        kind: 'ReplaceStygianWellTravelDealRefill',
        occurrence: address,
        itemKey: refill,
      })) ||
    !context.applyValid({
      kind: 'SetStygianWellPurchase',
      occurrence: address,
      generationKey: 'travelDealRefill',
      purchased: true,
    })
  )
    context.note({
      area: 'well',
      reason: 'refused',
      address: feature,
      record: record(visit.roomIndex),
    });
  else {
    retractWellPurchase(context, biomeKey, address, 'travelDealRefill', visit.roomIndex);
    importTwist(context, address, visit, 'travelDealRefill', refill);
  }
  // One restock per Well: another unstocked purchase came from a reroll, so it
  // takes a free slot of its group on the last roll; without one it is unowned.
  for (const itemKey of extra) {
    const taken = new Set(
      stygianWellPurchasedGenerationKeys(
        authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId)
          ?.roomActions.order ?? [],
      ).flatMap((key) => {
        const parsed = parseStygianWellGenerationKey(key);
        return parsed?.rollKey === rollKey ? [parsed.slotKey] : [];
      }),
    );
    const slotKey =
      lastRoll === undefined
        ? undefined
        : wellSlots(context).find(
            (candidate) => !taken.has(candidate) && wellSlotHolds(context, candidate, itemKey),
          );
    if (slotKey === undefined || !purchase(slotKey, itemKey))
      context.note({
        area: 'well',
        reason: 'refused',
        address: feature,
        record: record(visit.roomIndex),
      });
  }
}

/** Whether the item belongs to the RoomShop group a slot draws from. */
function wellSlotHolds(
  context: RunImportContext,
  slotKey: StygianWellSlotKey,
  itemKey: string,
): boolean {
  const profile = context.catalog.rewards.shops.byKey['RoomShop'];
  const groupKey = profile?.slots.values.find((slot) => slot.key === slotKey)?.groupKey;
  return (
    groupKey !== undefined &&
    profile?.groups.byKey[groupKey]?.options.values.some((option) => option.key === itemKey) ===
      true
  );
}

/** The number of actions an occurrence orders, where an appended action goes. */
function actionCount(context: RunImportContext, biomeKey: string, occurrenceId: string): number {
  return (
    authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)?.roomActions.order
      .length ?? 0
  );
}

function retractWellPurchase(
  context: RunImportContext,
  biomeKey: string,
  address: ReturnType<typeof createOccurrenceAddress>,
  generationKey: StygianWellGenerationKey,
  roomIndex: number,
): void {
  const feature = createRoomFeatureAddress(address, { kind: 'stygianWellOffer', generationKey });
  context.retractable(
    [
      feature,
      roomActionAddress(context, biomeKey, address.occurrenceId, {
        kind: 'purchaseStygianWellOffer',
        generationKey,
      }),
    ],
    { kind: 'SetStygianWellPurchase', occurrence: address, generationKey, purchased: false },
    { area: 'well', reason: 'refused', address: feature, record: record(roomIndex) },
  );
}

/** A Fateful Twist's result is the one Twist item its room gained. */
function importTwist(
  context: RunImportContext,
  address: ReturnType<typeof createOccurrenceAddress>,
  visit: StoreVisit,
  generationKey: StygianWellGenerationKey,
  itemKey: string | null,
): void {
  if (itemKey !== 'RandomStoreItem') return;
  const grant = context.catalog.rewards.shops.byKey['RoomShop']?.groups.values
    .flatMap((group) => group.options.values)
    .find((option) => option.key === 'RandomStoreItem')?.stygianWell?.grant;
  const pool = grant?.kind === 'twist' ? grant.pool : [];
  const gained = new Set([
    ...visit.room.traits.acquired.map((trait) => trait.name),
    ...Object.keys(visit.room.uses),
  ]);
  const results = pool.filter((key) => gained.has(key));
  const feature = createRoomFeatureAddress(address, { kind: 'stygianWellTwist', generationKey });
  const command: ProjectCommand | undefined =
    results[0] === undefined
      ? undefined
      : {
          kind: 'ReplaceStygianWellTwistResult',
          occurrence: address,
          generationKey,
          itemKey: results[0],
        };
  // The purchase's edit stocked a result; the recorded one replaces a different draw.
  const stocked = authoredOccurrence(
    context.assembly().project,
    address.biomeKey,
    address.occurrenceId,
  )?.stygianWell?.twistResultKeyByGeneration?.[generationKey];
  if (
    command === undefined ||
    results.length > 1 ||
    (stocked !== results[0] && !context.applyValid(command))
  )
    context.note({
      area: 'well',
      reason: command === undefined || results.length > 1 ? 'notInRecord' : 'refused',
      address: feature,
      record: record(visit.roomIndex),
    });
}

/**
 * The Pool's realized list is its remaining slots plus the sold ones; a sold
 * slot's trait is the one eligible trait its room lost.
 */
function importPool(context: RunImportContext, biomeKey: string, occurrence: RoomOccurrence) {
  const used = `pool:${occurrence.occurrenceId}`;
  if (context.used.has(`${used}:slots`) || occurrence.purgingPool === undefined) return;
  const roomIndex = context.occurrences
    .visitsOf(occurrence.occurrenceId)
    .find((index) => context.record.rooms[index]!.pool !== undefined);
  if (roomIndex === undefined) return;
  const room = context.record.rooms[roomIndex]!;
  const pool = room.pool!;
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const address = createOccurrenceAddress(biome, occurrence.occurrenceId);
  if (!context.used.has(used)) {
    context.used.add(used);
    if ((room.uses['SellTraitShop'] ?? 0) === 0 && pool.sales === 0) {
      context.used.add(`${used}:slots`);
      return;
    }
    applyFeatureRerolls(
      context,
      roomIndex,
      'pool',
      createRoomFeatureAddress(address, { kind: 'purgingPoolInventory' }),
      () => ({
        kind: 'InsertPurgingPoolReroll',
        occurrence: address,
        index: actionCount(context, biomeKey, occurrence.occurrenceId),
      }),
    );
    return;
  }
  // The list is authored once the Pool's own frontier is reached.
  const capability = purgingPoolCandidateForProjectEvaluationAssembly(context.assembly(), address);
  if (capability === undefined) return;
  context.used.add(`${used}:slots`);
  // Every listed trait and each sold slot's pick are claimed once across the list.
  const claimed = new Set(pool.slots.map((entry) => entry.name));
  // The record keeps only the list left on leaving: with rerolls it is assumed
  // to be both the initial list and the last roll's, which every sale names.
  const lastRoll = purgingPoolRerolls(occurrence.roomActions.order).at(-1);
  const sell = (slotKey: (typeof POOL_SLOTS)[number]): boolean => {
    if (lastRoll === undefined)
      return insertRoomAction(context, biomeKey, occurrence.occurrenceId, {
        kind: 'sellPurgingPoolTrait',
        slotKey,
      });
    const traitKey = authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrence.occurrenceId,
    )?.purgingPool?.traitKeyBySlot[slotKey];
    const sale = Object.freeze({
      kind: 'sellPurgingPoolTrait' as const,
      slotKey,
      rollKey: lastRoll.rerollId,
    });
    const sold =
      traitKey !== null &&
      traitKey !== undefined &&
      context.applyValid({
        kind: 'ReplacePurgingPoolRollSlot',
        action: roomActionAddress(context, biomeKey, occurrence.occurrenceId, lastRoll),
        slotKey,
        traitKey,
      }) &&
      context.applyValid({
        kind: 'InsertRoomAction',
        action: roomActionAddress(context, biomeKey, occurrence.occurrenceId, sale),
        reference: sale,
        index: actionCount(context, biomeKey, occurrence.occurrenceId),
      });
    if (sold)
      noteOnce(
        context,
        `poolRolls:${occurrence.occurrenceId}`,
        'pool',
        'assumption',
        createRoomFeatureAddress(address, { kind: 'purgingPoolInventory' }),
        roomIndex,
      );
    return sold;
  };
  // The record's list is the one on show at opening: the regenerated one when
  // the fountain use made the entry list stale.
  const list = capability.refresh === undefined ? {} : { list: 'refresh' as const };
  const listed = (): Readonly<Partial<Record<string, string | null>>> => {
    const stocked = authoredOccurrence(
      context.assembly().project,
      biomeKey,
      occurrence.occurrenceId,
    )?.purgingPool;
    return capability.refresh === undefined
      ? (stocked?.traitKeyBySlot ?? {})
      : (stocked?.refreshTraitKeyBySlot ?? {});
  };
  const recorded: {
    readonly slotKey: (typeof POOL_SLOTS)[number];
    readonly slot: number;
    readonly traitKey: string;
    readonly ambiguous: boolean;
  }[] = [];
  for (const [index, slotKey] of POOL_SLOTS.entries()) {
    const slot = index + 1;
    const feature = createRoomFeatureAddress(address, { kind: 'purgingPoolOffer', slotKey });
    let traitKey = pool.slots.find((entry) => entry.slot === slot)?.name;
    let ambiguous = false;
    if (traitKey === undefined && pool.soldSlots.includes(slot)) {
      // Every trait the list on show could hold, whatever the slots were stocked with.
      const eligible = new Set(
        capability.refresh?.eligibleTraitKeys ?? capability.assessment.eligibleTraitKeys,
      );
      const sold = room.traits.removed.filter((name) => eligible.has(name) && !claimed.has(name));
      traitKey = sold[0];
      ambiguous = sold.length > 1;
      // A Pool room grants no trait, so every sale shows among the room's lost
      // traits; a sale they do not explain leaves its slot open and stops the plan.
      if (traitKey === undefined) {
        context.halt({
          area: 'pool',
          code: 'unexplainedSale',
          address: feature,
          record: record(roomIndex),
        });
        continue;
      }
      claimed.add(traitKey);
    }
    if (traitKey !== undefined) recorded.push({ slotKey, slot, traitKey, ambiguous });
  }
  const replace = (slotKey: (typeof POOL_SLOTS)[number], traitKey: string | null) =>
    context.apply({
      kind: 'ReplacePurgingPoolSlot',
      occurrence: address,
      slotKey,
      traitKey,
      ...list,
    });
  // The edit that reached the list stocked every slot: the recorded traits replace their
  // slots' draws together, then a draw repeating one of them is drawn again past them.
  const writtenTogether = context.transaction(
    () =>
      recorded.every(
        ({ slotKey, traitKey }) => listed()[slotKey] === traitKey || replace(slotKey, traitKey),
      ) &&
      POOL_SLOTS.every(
        (slotKey) =>
          recorded.some((entry) => entry.slotKey === slotKey) ||
          !recorded.some((entry) => entry.traitKey === listed()[slotKey]) ||
          replace(slotKey, null),
      ),
  );
  for (const { slotKey, slot, traitKey, ambiguous } of recorded) {
    const feature = createRoomFeatureAddress(address, { kind: 'purgingPoolOffer', slotKey });
    const command: ProjectCommand = {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: address,
      slotKey,
      traitKey,
      ...list,
    };
    // Apart, each recorded trait still replaces its draw where the engine admits it.
    const written = (): boolean => {
      for (const other of POOL_SLOTS)
        if (other !== slotKey && listed()[other] === traitKey && !replace(other, null))
          return false;
      return listed()[slotKey] === traitKey || context.apply(command);
    };
    if (!writtenTogether && !context.transaction(written)) {
      // A refused trait leaves its slot open; a sale from it cannot be authored.
      context.note({
        area: 'pool',
        reason: 'refused',
        address: feature,
        record: record(roomIndex),
      });
      if (pool.soldSlots.includes(slot))
        context.halt({
          area: 'pool',
          code: 'refusedSale',
          address: feature,
          record: record(roomIndex),
        });
      continue;
    }
    if (ambiguous)
      context.note({
        area: 'pool',
        reason: 'assumption',
        address: feature,
        applied: command,
        record: record(roomIndex),
      });
    if (pool.soldSlots.includes(slot) && !sell(slotKey))
      context.note({
        area: 'pool',
        reason: 'refused',
        address: feature,
        record: record(roomIndex),
      });
  }
}
