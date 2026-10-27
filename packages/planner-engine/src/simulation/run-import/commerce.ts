import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  semanticAddressKey,
  shopOfferOptionValues,
  type HermesShrineGenerationKey,
  type HermesShrineSlotKey,
  type OccurrenceId,
  type ProjectCommand,
  type RoomActionReference,
  type RoomOccurrence,
  type SemanticAddress,
  type StygianWellGenerationKey,
  type StygianWellSlotKey,
} from '../../authored-project';
import { hermesShrineInitialSlotKey } from '../../authored-project/model';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
  type ShopOptionSelection,
} from '../../reward-kernel';
import type {
  RunRecordRoom,
  RunRecordStockOption,
  RunRecordStore,
  RunRecordStoreKind,
} from '../../run-record/model';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';
import { insertRoomAction, removeRoomAction, roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import type { RunImportArea } from './report';
import { isQuestionFinding } from './areas';
import { authoredOccurrence, occurrenceIdOf } from './occurrences';

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

/** The occurrence's record visit that holds a store of this kind. */
function storeVisit(
  context: RunImportContext,
  occurrenceId: string,
  kind: RunRecordStoreKind,
): StoreVisit | undefined {
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const room = context.record.rooms[roomIndex]!;
    if (room.store?.kind === kind) return { roomIndex, room, store: room.store };
  }
  return undefined;
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
  if (origin.kind === 'roomFeature') {
    if (reason.code === 'hermesShrineInventoryMissing') return answerShrineOffers(context, origin);
    if (reason.code === 'stygianWellMissing') return answerWellOffers(context, origin);
    if (
      reason.code === 'stygianWellTravelDealRefillUnavailable' &&
      reason.evidence['reason'] === 'refillMissing'
    )
      return answerUnboughtWellRefill(context, origin);
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
  const profile =
    shop === undefined ? undefined : context.catalog.rewards.shops.byKey[shop.profileKey];
  const position = profile?.slots.values.findIndex((slot) => slot.key === offer.offerKey) ?? -1;
  const visit = storeVisit(context, offer.occurrenceId, 'worldShop');
  const stock = visit?.store.stock.find((option) => option.slot === position + 1);
  if (occurrence === undefined || shop === undefined || stock === undefined) return false;
  const values = shopOfferOptionValues(
    context.catalog,
    occurrence.gameName,
    shop.profileKey,
    offer.offerKey,
  ).filter((value) => stockMatches(context, shop.profileKey, offer.offerKey, stock, value));
  const resolvedByAcquisition = (value: ShopOptionSelection) =>
    context.catalog.rewards.rewardTypes.byKey[value.offer.rewardType]?.sourceResolution?.kind ===
    'acquisitionRole';
  for (const value of values) {
    const evaluation = context.candidates().evaluate({ kind: 'shopOfferOption', offer, value });
    if (
      evaluation.kind !== 'shopOffer' ||
      !evaluation.result.supported ||
      !evaluation.result.findings.every(isQuestionFinding)
    )
      continue;
    const command: ProjectCommand = { kind: 'ReplaceShopOfferOption', offer, value };
    if (!context.applyValid(command)) continue;
    // A boon whose god the stock does not name takes the first eligible one.
    if (
      stock.lootName === undefined &&
      value.offer.payload !== undefined &&
      !resolvedByAcquisition(value)
    )
      context.note({
        area: 'shop',
        reason: 'notInRecord',
        address: offer,
        applied: command,
        record: record(visit!.roomIndex),
      });
    return true;
  }
  context.refuse();
  return false;
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
  const ordered = [
    ...values.filter((value) => boon(value) !== undefined && named(boon(value)!)),
    ...values.filter((value) => !(boon(value) !== undefined && named(boon(value)!))),
  ];
  for (const value of ordered) {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'acquisitionEntryOffer', entry, value });
    if (
      evaluation.kind !== 'acquisitionEntryOffer' ||
      !evaluation.result.supported ||
      !evaluation.result.findings.every(isQuestionFinding)
    )
      continue;
    const command: ProjectCommand = { kind: 'ReplaceAcquisitionEntryOffer', entry, value };
    if (!context.applyValid(command)) continue;
    // Several reward types, or a god no room record names, are the first eligible guess.
    if (rewardTypes.length > 1 || (boon(value) !== undefined && !named(boon(value)!)))
      context.note({
        area: 'reward',
        reason: 'notInRecord',
        address: entry,
        applied: command,
        ...(visits.length === 0 ? {} : { record: record(visits[0]!) }),
      });
    return true;
  }
  context.refuse();
  return false;
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

/**
 * A Travel Deal restock nobody bought leaves no name in the save; it takes the
 * first item the engine admits, reported as the unread refill area.
 */
function answerUnboughtWellRefill(
  context: RunImportContext,
  feature: Origin<'roomFeature'>,
): boolean {
  const address = createOccurrenceAddress(
    createBiomeAddress(feature.routeKey, feature.biomeKey),
    feature.occurrenceId,
  );
  const visit = storeVisit(context, feature.occurrenceId, 'well');
  if (visit === undefined || (visit.store.unstockedPurchases?.length ?? 0) > 0) return false;
  const candidates =
    stygianWellCandidateForProjectEvaluationAssembly(context.assembly(), address)?.travelDealRefill
      ?.candidateItemKeys ?? [];
  for (const itemKey of candidates) {
    const command: ProjectCommand = {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: address,
      itemKey,
    };
    if (!context.applyValid(command)) continue;
    context.note({
      area: 'well',
      reason: 'unsupportedArea',
      address: feature,
      applied: command,
      record: record(visit.roomIndex),
    });
    return true;
  }
  return false;
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
    importShopPurchases(context, biomeKey, occurrence);
    importShrine(context, biomeKey, occurrence);
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
  context.used.add(used);
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  if (visit.store.purchases === undefined) {
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: createOccurrenceAddress(biome, occurrence.occurrenceId),
      record: record(visit.roomIndex),
    });
    return;
  }
  for (const purchase of visit.store.purchases) {
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
}

/** The pickup a purchased item spawns, by its record use name. */
function collected(context: RunImportContext, room: RunRecordRoom, rewardType: string): boolean {
  const roles = context.catalog.rewards.rewardTypes.byKey[rewardType]?.acquisitionRoles.values;
  const names = [
    rewardType,
    ...(roles ?? []).flatMap((role) =>
      role.resolution.kind === 'fixed' ? [role.resolution.acquisition.gameName] : [],
    ),
  ];
  return names.some((name) => (room.uses[name] ?? 0) > 0);
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
 * One Shrine purchase: its delay, then its rush. A rushed item's delay only
 * prices it and is not saved; a delayed one's delay names its delivery room.
 */
function importShrinePurchase(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  visit: StoreVisit,
  purchase: NonNullable<RunRecordStore['purchases']>[number],
): void {
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const address = createOccurrenceAddress(biome, occurrenceId as OccurrenceId);
  const slotKey: HermesShrineSlotKey | undefined = shrineSlots(context)[purchase.slot - 1];
  if (slotKey === undefined) {
    context.note({ area: 'shop', reason: 'refused', address, record: record(visit.roomIndex) });
    return;
  }
  const generationKey: HermesShrineGenerationKey = `initial:${slotKey}`;
  const feature = createRoomFeatureAddress(address, { kind: 'hermesShrineOffer', generationKey });
  const delays = purchase.delay === undefined ? [2, 3, 4, 5, 6, 7, 8] : [purchase.delay];
  let applied: ProjectCommand | undefined;
  for (const delay of delays) {
    const command: ProjectCommand = {
      kind: 'SetHermesShrinePurchase',
      occurrence: address,
      generationKey,
      purchase: { delay: delay as 2 | 3 | 4 | 5 | 6 | 7 | 8 },
    };
    if (context.applyValid(command)) {
      applied = command;
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
        rushed: false,
      }),
    ],
    { kind: 'SetHermesShrinePurchase', occurrence: address, generationKey, purchase: null },
    { area: 'shop', reason: 'refused', address: feature, record: record(visit.roomIndex) },
  );
  if (purchase.delay === undefined)
    context.note({
      area: 'shop',
      reason: 'notInRecord',
      address: feature,
      applied,
      record: record(visit.roomIndex),
    });
  if (purchase.delivery !== 'rushed') return;
  const reference: RoomActionReference = {
    kind: 'purchaseHermesShrineOffer',
    generationKey,
    rushed: false,
  };
  if (
    !context.applyValid({
      kind: 'SetHermesShrinePurchaseRush',
      action: roomActionAddress(context, biomeKey, occurrenceId, reference),
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
  // A rushed item left on the floor is not picked up.
  const rewardType = visit.store.stock.find((option) => option.slot === purchase.slot)?.name;
  if (rewardType !== undefined && !collected(context, visit.room, rewardType)) {
    const occurrence = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId);
    const pickup = occurrence?.roomActions.order.find(
      (entry) =>
        entry.kind === 'interactAcquisitionEntry' &&
        entry.siteKey === 'hermesShrineDelivery' &&
        entry.entryKey === hermesShrineDeliveryEntryKey(address, generationKey),
    );
    if (pickup !== undefined && !removeRoomAction(context, biomeKey, occurrenceId, pickup))
      context.note({
        area: 'shop',
        reason: 'refused',
        address: feature,
        record: record(visit.roomIndex),
      });
  }
}

function importWell(context: RunImportContext, biomeKey: string, occurrence: RoomOccurrence) {
  const visit = storeVisit(context, occurrence.occurrenceId, 'well');
  // A room whose map has no Well anchor rolls Well stock that no Well offers.
  if (
    visit === undefined ||
    context.catalog.rooms.byKey[occurrence.gameName]?.roomShop === undefined
  )
    return;
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
    if (
      opened &&
      !context.applyValid({
        kind: 'SetStygianWellInteraction',
        occurrence: address,
        interacted: true,
      })
    )
      noteOnce(context, `${presence}:refused`, 'well', 'refused', feature, visit.roomIndex);
    return;
  }
  const well = authoredOccurrence(
    context.assembly().project,
    biomeKey,
    occurrence.occurrenceId,
  )?.stygianWell;
  const used = `wellPurchases:${occurrence.occurrenceId}`;
  if (
    well?.interacted !== true ||
    context.used.has(used) ||
    wellSlots(context).some((slotKey) => well.offerKeyBySlot[slotKey] === null)
  )
    return;
  context.used.add(used);
  if (visit.store.purchases === undefined) {
    context.note({ area: 'well', reason: 'notInRecord', address, record: record(visit.roomIndex) });
    return;
  }
  for (const purchase of visit.store.purchases) {
    const slotKey: StygianWellSlotKey | undefined = wellSlots(context)[purchase.slot - 1];
    if (slotKey === undefined) {
      context.note({ area: 'well', reason: 'refused', address, record: record(visit.roomIndex) });
      continue;
    }
    const generationKey = `initial:${slotKey}` as const;
    const feature = createRoomFeatureAddress(address, { kind: 'stygianWellOffer', generationKey });
    if (
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
      continue;
    }
    retractWellPurchase(context, biomeKey, address, generationKey, visit.roomIndex);
    importTwist(context, address, visit, generationKey, well.offerKeyBySlot[slotKey]);
  }
  // Travel Deal restocks one slot after the first purchase; its item is the one bought unstocked.
  const [refill, ...extra] = visit.store.unstockedPurchases ?? [];
  if (refill === undefined) return;
  const feature = createRoomFeatureAddress(address, {
    kind: 'stygianWellOffer',
    generationKey: 'travelDealRefill',
  });
  if (
    !context.applyValid({
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: address,
      itemKey: refill,
    }) ||
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
  // One restock per Well: a second unstocked purchase has no generation to own it.
  for (let count = 0; count < extra.length; count++)
    context.note({
      area: 'well',
      reason: 'refused',
      address: feature,
      record: record(visit.roomIndex),
    });
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
  generationKey:
    'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill',
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
  if (command === undefined || results.length > 1 || !context.applyValid(command))
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
    if (
      !context.applyValid({
        kind: 'SetPurgingPoolInteraction',
        occurrence: address,
        interacted: true,
      })
    ) {
      context.used.add(`${used}:slots`);
      context.note({
        area: 'pool',
        reason: 'refused',
        address: createRoomFeatureAddress(address, { kind: 'purgingPoolInventory' }),
        record: record(roomIndex),
      });
    }
    return;
  }
  // The list is authored once the Pool's own frontier is reached.
  const capability = purgingPoolCandidateForProjectEvaluationAssembly(context.assembly(), address);
  if (capability === undefined) return;
  context.used.add(`${used}:slots`);
  // Every listed trait and each sold slot's pick are claimed once across the list.
  const claimed = new Set(pool.slots.map((entry) => entry.name));
  for (const [index, slotKey] of POOL_SLOTS.entries()) {
    const slot = index + 1;
    const feature = createRoomFeatureAddress(address, { kind: 'purgingPoolOffer', slotKey });
    let traitKey = pool.slots.find((entry) => entry.slot === slot)?.name;
    let ambiguous = false;
    if (traitKey === undefined && pool.soldSlots.includes(slot)) {
      const eligible = new Set(capability.candidateTraitKeysBySlot[slotKey]);
      const sold = room.traits.removed.filter((name) => eligible.has(name) && !claimed.has(name));
      traitKey = sold[0];
      ambiguous = sold.length > 1;
      if (traitKey === undefined) {
        // A sale the room's lost traits do not explain keeps the first eligible unclaimed trait.
        const fallback = capability.candidateTraitKeysBySlot[slotKey].find(
          (key) => !claimed.has(key),
        );
        const command: ProjectCommand | undefined =
          fallback === undefined
            ? undefined
            : { kind: 'ReplacePurgingPoolSlot', occurrence: address, slotKey, traitKey: fallback };
        const applied = command !== undefined && context.applyValid(command);
        if (applied) claimed.add(fallback!);
        context.note({
          area: 'pool',
          reason: 'refused',
          address: feature,
          ...(applied ? { applied: command } : {}),
          record: record(roomIndex),
        });
        if (
          applied &&
          !insertRoomAction(context, biomeKey, occurrence.occurrenceId, {
            kind: 'sellPurgingPoolTrait',
            slotKey,
          })
        )
          context.note({
            area: 'pool',
            reason: 'refused',
            address: feature,
            record: record(roomIndex),
          });
        continue;
      }
      claimed.add(traitKey);
    }
    if (traitKey === undefined) continue;
    const command: ProjectCommand = {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: address,
      slotKey,
      traitKey,
    };
    if (!context.applyValid(command)) {
      // A refused trait yields to the first one the Pool admits there.
      const taken = new Set(
        Object.values(
          authoredOccurrence(context.assembly().project, biomeKey, occurrence.occurrenceId)
            ?.purgingPool?.traitKeyBySlot ?? {},
        ),
      );
      const fallback = (
        purgingPoolCandidateForProjectEvaluationAssembly(context.assembly(), address)
          ?.candidateTraitKeysBySlot[slotKey] ?? []
      )
        .filter((key) => !taken.has(key))
        .map((key): ProjectCommand => ({
          kind: 'ReplacePurgingPoolSlot',
          occurrence: address,
          slotKey,
          traitKey: key,
        }))
        .find((candidate) => context.applyValid(candidate));
      context.note({
        area: 'pool',
        reason: 'refused',
        address: feature,
        ...(fallback === undefined ? {} : { applied: fallback }),
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
    if (
      pool.soldSlots.includes(slot) &&
      !insertRoomAction(context, biomeKey, occurrence.occurrenceId, {
        kind: 'sellPurgingPoolTrait',
        slotKey,
      })
    )
      context.note({
        area: 'pool',
        reason: 'refused',
        address: feature,
        record: record(roomIndex),
      });
  }
}
