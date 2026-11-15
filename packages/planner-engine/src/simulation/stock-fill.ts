import {
  createBiomeAddress,
  createAcquisitionSiteAddress,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  type ShopOfferAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import {
  INITIAL_ROLL_KEY,
  PURGING_POOL_REFRESH_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  purgingPoolRerollPins,
  purgingPoolRerolls,
  stygianWellGenerationKey,
  stygianWellGenerationTwistResultKey,
  stygianWellRerollPins,
  stygianWellRerolls,
} from '../authored-project/feature-rolls';
import { roomActionKey } from '../authored-project/room-actions/state';
import { stableChoice } from '../authored-project/stable-hash';
import { shopOfferOptionValues, TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../authored-project/shop';
import { infernalContractPedestalOptionValues } from '../authored-project/infernal-contract-pedestal';
import type { ShopOptionSelection } from '../reward-kernel/model';
import type { Catalog } from '../catalog-schema';
import type { ProjectCommand } from '../authored-project/commands/types';
import {
  hermesShrineInitialGenerationKey,
  type HermesShrineGenerationKey,
  type ProjectDocument,
  type RoomOccurrence,
  type StygianWellGenerationKey,
} from '../authored-project/model';
import type {
  BiomeCandidateArtifacts,
  ProjectCandidateArtifacts,
} from './evaluation/candidate-artifacts';

/**
 * One blank stock slot the walk reached and the command that stocks it. Its
 * key is the slot's semantic identity, which also seeds its draw.
 */
export interface StockFill {
  readonly key: string;
  readonly owner: SemanticAddress;
  readonly command: ProjectCommand;
}

/**
 * A stable legal draw: the value a slot's identity scores highest among its
 * legal values that no stored value or earlier claim of the same group holds.
 */
function draw(identity: string, legal: readonly string[], claimed: ReadonlySet<string>) {
  return stableChoice(
    identity,
    legal.filter((value) => !claimed.has(value)),
  );
}

/**
 * A profile's options no automatic draw takes, by `key` or `rewardType`: those
 * the game offers only on a live hero condition the planner does not model.
 */
function undrawnOptions(
  catalog: Catalog,
  profileKey: string,
  by: 'key' | 'rewardType',
): ReadonlySet<string> {
  return new Set(
    (catalog.rewards.shops.byKey[profileKey]?.groups.values ?? []).flatMap((group) =>
      group.options.values.flatMap((option) =>
        option.unmodeledOfferCondition === undefined ? [] : [option[by]],
      ),
    ),
  );
}

function rooms(project: ProjectDocument) {
  return project.route.biomes.flatMap((plan) =>
    (plan.topology?.occurrences ?? []).map((occurrence) => ({
      biome: createBiomeAddress(project.route.routeKey, plan.biomeKey),
      occurrence,
      owner: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, plan.biomeKey),
        occurrence.occurrenceId,
      ),
    })),
  );
}

/**
 * The Well's blank reached slots: the first roll in roll order with any (the
 * initial roll, then each reroll's restock), so each later roll is drawn
 * against what the evaluation shows before it, then its Travel Deal restock
 * and each bought Fateful Twist's result. Slots of one roll claim in slot
 * order, past every value the roll already holds; a reroll's last drawn slot
 * also avoids repeating everything on show before it, which the game's ban
 * rules out.
 */
function stygianWellFills(
  catalog: Catalog,
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  const well = occurrence.stygianWell;
  const capability = artifacts.stygianWells.at(owner);
  if (well === undefined || capability === undefined || !capability.present) return [];
  const fills: StockFill[] = [];
  const undrawn = undrawnOptions(catalog, 'RoomShop', 'key');
  const drawable = (legal: readonly string[]) => legal.filter((itemKey) => !undrawn.has(itemKey));
  const identity = (generationKey: string) =>
    `${occurrence.occurrenceId}|stygianWell|${generationKey}`;
  const feature = (generationKey: StygianWellGenerationKey) =>
    createRoomFeatureAddress(owner, { kind: 'stygianWellOffer', generationKey });
  const push = (generationKey: StygianWellGenerationKey, command: ProjectCommand) =>
    fills.push(
      Object.freeze<StockFill>({
        key: semanticAddressKey(feature(generationKey)),
        owner: feature(generationKey),
        command,
      }),
    );
  // Initial roll.
  const initialClaimed = new Set(
    STYGIAN_WELL_SLOT_KEYS.flatMap((slotKey) => well.offerKeyBySlot[slotKey] ?? []),
  );
  for (const slotKey of STYGIAN_WELL_SLOT_KEYS) {
    if (well.offerKeyBySlot[slotKey] !== null) continue;
    const generationKey = stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey);
    const itemKey = draw(
      identity(generationKey),
      drawable(capability.candidateItemKeysBySlot[slotKey]),
      initialClaimed,
    );
    if (itemKey === undefined) continue;
    initialClaimed.add(itemKey);
    push(generationKey, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: owner,
      slotKey,
      itemKey,
    });
  }
  // Each reached reroll's restock, once every roll before it is stocked.
  for (const reroll of stygianWellRerolls(occurrence.roomActions.order)) {
    if (fills.length > 0) break;
    const roll = capability.rolls[reroll.rerollId];
    if (roll === undefined) continue;
    const pins = stygianWellRerollPins(well, reroll.rerollId);
    const claimed = new Set(roll.offeredSlotKeys.flatMap((slotKey) => pins[slotKey] ?? []));
    const blank = roll.offeredSlotKeys.filter((slotKey) => pins[slotKey] === undefined);
    blank.forEach((slotKey, index) => {
      const generationKey = stygianWellGenerationKey(reroll.rerollId, slotKey);
      // The roll may not hold every item on show before it: its last draw avoids the one left.
      const unclaimedShown = roll.shownItemKeys.filter((shown) => !claimed.has(shown));
      const banned =
        index === blank.length - 1 && unclaimedShown.length === 1
          ? new Set([...claimed, ...unclaimedShown])
          : claimed;
      const itemKey = draw(
        identity(generationKey),
        drawable(roll.candidateItemKeysBySlot[slotKey]),
        banned,
      );
      if (itemKey === undefined) return;
      claimed.add(itemKey);
      push(generationKey, {
        kind: 'ReplaceStygianWellRollOffer',
        action: createRoomActionAddress(
          createBiomeAddress(owner.routeKey, owner.biomeKey),
          owner.occurrenceId,
          roomActionKey({ kind: 'rerollStygianWell', rerollId: reroll.rerollId }),
        ),
        slotKey,
        itemKey,
      });
    });
  }
  // The Travel Deal restock of the room's first purchase.
  const refill = capability.travelDealRefill;
  if (
    refill !== undefined &&
    (well.travelDealRefillKey === undefined || well.travelDealRefillKey === null)
  ) {
    const itemKey = draw(
      identity(`travelDealRefill|${refill.sourceGenerationKey}`),
      drawable(refill.candidateItemKeys),
      new Set(),
    );
    if (itemKey !== undefined)
      push('travelDealRefill', {
        kind: 'ReplaceStygianWellTravelDealRefill',
        occurrence: owner,
        itemKey,
      });
  }
  // Each bought Fateful Twist's result.
  for (const [generationKey, legal] of Object.entries(
    capability.twistCandidateItemKeysByGeneration,
  ) as [StygianWellGenerationKey, readonly string[]][]) {
    const result = stygianWellGenerationTwistResultKey(occurrence, generationKey);
    if (result !== undefined && result !== null) continue;
    const itemKey = draw(identity(`twist|${generationKey}`), drawable(legal), new Set());
    if (itemKey === undefined) continue;
    const twist = createRoomFeatureAddress(owner, { kind: 'stygianWellTwist', generationKey });
    fills.push(
      Object.freeze<StockFill>({
        key: semanticAddressKey(twist),
        owner: twist,
        command: {
          kind: 'ReplaceStygianWellTwistResult',
          occurrence: owner,
          generationKey,
          itemKey,
        },
      }),
    );
  }
  return fills;
}

const SHRINE_SLOT_KEYS = ['first', 'secondLeft', 'secondRight'] as const;

/**
 * The Shrine's blank reached slots: its three initial items, the two second
 * slots claiming distinct items of their shared group, then the Travel Deal
 * restock of its first rush.
 */
function hermesShrineFills(
  catalog: Catalog,
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  const shrine = occurrence.hermesShrine;
  const capability = artifacts.hermesShrines.at(owner);
  if (shrine === undefined || capability === undefined || !capability.present) return [];
  const fills: StockFill[] = [];
  const undrawn = undrawnOptions(catalog, 'SurfaceShop', 'rewardType');
  const drawable = (legal: readonly string[]) =>
    legal.filter((rewardType) => !undrawn.has(rewardType));
  const identity = (generationKey: string) =>
    `${occurrence.occurrenceId}|hermesShrine|${generationKey}`;
  const push = (generationKey: HermesShrineGenerationKey, command: ProjectCommand) => {
    const feature = createRoomFeatureAddress(owner, { kind: 'hermesShrineOffer', generationKey });
    fills.push(
      Object.freeze<StockFill>({ key: semanticAddressKey(feature), owner: feature, command }),
    );
  };
  const claimed = new Set(
    (['secondLeft', 'secondRight'] as const).flatMap(
      (slotKey) => shrine.offerBySlot[slotKey]?.rewardType ?? [],
    ),
  );
  for (const slotKey of SHRINE_SLOT_KEYS) {
    if (shrine.offerBySlot[slotKey] !== null) continue;
    const generationKey = hermesShrineInitialGenerationKey(slotKey);
    const rewardType = draw(
      identity(generationKey),
      drawable(capability.candidateRewardTypesBySlot[slotKey]),
      slotKey === 'first' ? new Set() : claimed,
    );
    if (rewardType === undefined) continue;
    if (slotKey !== 'first') claimed.add(rewardType);
    push(generationKey, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: owner,
      slotKey,
      value: { rewardType },
    });
  }
  const refill = capability.travelDealRefill;
  if (refill !== undefined && (shrine.travelDealRefill?.offer ?? null) === null) {
    const rewardType = draw(
      identity(`travelDealRefill|${refill.sourceGenerationKey}`),
      drawable(refill.candidateRewardTypes),
      new Set(),
    );
    if (rewardType !== undefined)
      push('travelDealRefill', {
        kind: 'ReplaceHermesShrineTravelDealRefill',
        occurrence: owner,
        value: { rewardType },
      });
  }
  return fills;
}

const POOL_SLOT_KEYS = ['left', 'middle', 'right'] as const;
type PoolSlotKey = (typeof POOL_SLOT_KEYS)[number];

/** One reached Pool list: its stored slots, how the walk judges them and its sold slots. */
interface PoolList {
  /** The entry list, the regenerated one or a reroll's id. */
  readonly listKey: string;
  readonly stored: Readonly<Partial<Record<PoolSlotKey, string | null>>>;
  readonly offeredSlotKeys: readonly PoolSlotKey[];
  readonly eligibleTraitKeys: readonly string[];
  /** Listed boons no longer held or eligible where the list is judged. */
  readonly staleSlotKeys: readonly PoolSlotKey[];
  readonly shownTraitKeys?: readonly string[];
  readonly sold: ReadonlySet<PoolSlotKey>;
}

/**
 * The Pool's reached lists in the order the game shows them: the entry list,
 * the list the Pool regenerates when the fountain use makes the entry list
 * stale, and each reroll's list. A list's sales name its slots as sold.
 */
function purgingPoolLists(
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): PoolList[] {
  const pool = occurrence.purgingPool;
  const capability = artifacts.purgingPools.at(owner);
  if (pool === undefined || capability === undefined) return [];
  const soldFrom = (rollKey: string) =>
    new Set(
      occurrence.roomActions.order.flatMap((reference) =>
        reference.kind === 'sellPurgingPoolTrait' &&
        (reference.rollKey ?? INITIAL_ROLL_KEY) === rollKey
          ? [reference.slotKey]
          : [],
      ),
    );
  const entry = capability.assessment;
  const lists: PoolList[] = [
    {
      listKey: INITIAL_ROLL_KEY,
      stored: pool.traitKeyBySlot,
      offeredSlotKeys: entry.offeredSlotKeys,
      eligibleTraitKeys: entry.eligibleTraitKeys,
      staleSlotKeys: entry.findings.flatMap((finding) =>
        finding.code === 'purgingPoolTraitUnavailable' ? [finding.slotKey] : [],
      ),
      // With a refresh stored, the initial list's sales sell from it.
      sold: pool.refreshTraitKeyBySlot !== undefined ? new Set() : soldFrom(INITIAL_ROLL_KEY),
    },
  ];
  if (capability.refresh !== undefined)
    lists.push({
      ...capability.refresh,
      listKey: PURGING_POOL_REFRESH_ROLL_KEY,
      stored: pool.refreshTraitKeyBySlot ?? {},
      sold: soldFrom(INITIAL_ROLL_KEY),
    });
  for (const reroll of purgingPoolRerolls(occurrence.roomActions.order)) {
    const roll = capability.rolls[reroll.rerollId];
    if (roll === undefined) continue;
    lists.push({
      ...roll,
      listKey: reroll.rerollId,
      stored: purgingPoolRerollPins(pool, reroll.rerollId),
      sold: soldFrom(reroll.rerollId),
    });
  }
  return lists;
}

function poolValueKey(
  owner: OccurrenceAddress,
  listKey: string,
  slotKey: PoolSlotKey,
  traitKey: string,
) {
  return `${semanticAddressKey(owner)}|${listKey}|${slotKey}|${traitKey}`;
}

/** Whether the walk judged a Pool list value, by owner, list, slot and value, valid before the edit. */
export type PoolValuesBefore = (value: string) => boolean;

/**
 * Every stored Pool list value the evaluated walk does not judge stale, those
 * in lists it does not reach included: the values an edit can make stale.
 */
export function currentPoolListValues(
  project: ProjectDocument,
  artifacts: ProjectCandidateArtifacts,
): PoolValuesBefore {
  const values = new Set<string>();
  const stale = new Set<string>();
  for (const { biome, owner, occurrence } of rooms(project)) {
    const pool = occurrence.purgingPool;
    if (pool === undefined) continue;
    const stored: [string, Readonly<Partial<Record<PoolSlotKey, string | null>>>][] = [
      [INITIAL_ROLL_KEY, pool.traitKeyBySlot],
      [PURGING_POOL_REFRESH_ROLL_KEY, pool.refreshTraitKeyBySlot ?? {}],
      ...purgingPoolRerolls(occurrence.roomActions.order).map(
        (reroll): [string, Readonly<Partial<Record<PoolSlotKey, string>>>] => [
          reroll.rerollId,
          purgingPoolRerollPins(pool, reroll.rerollId),
        ],
      ),
    ];
    for (const [listKey, slots] of stored)
      for (const slotKey of POOL_SLOT_KEYS) {
        const traitKey = slots[slotKey] ?? null;
        if (traitKey !== null) values.add(poolValueKey(owner, listKey, slotKey, traitKey));
      }
    const biomeArtifacts = artifacts.biomeAt(biome);
    if (biomeArtifacts === undefined) continue;
    for (const list of purgingPoolLists(biomeArtifacts, owner, occurrence))
      for (const slotKey of list.staleSlotKeys) {
        const traitKey = list.stored[slotKey] ?? null;
        if (traitKey !== null) stale.add(poolValueKey(owner, list.listKey, slotKey, traitKey));
      }
  }
  return (value) => values.has(value) && !stale.has(value);
}

/**
 * One Pool list's slots to stock: each blank shown slot, or, when the edit
 * made an unsold listed boon stale, every unsold slot redrawn as the game
 * regenerates the list. Sold slots keep their trait, and the shown slots claim
 * distinct traits in slot order.
 */
function poolListDraws(
  identity: (slotKey: PoolSlotKey) => string,
  list: PoolList,
  madeStale: (slotKey: PoolSlotKey) => boolean,
): { readonly slotKey: PoolSlotKey; readonly traitKey: string | null }[] {
  const { stored, sold } = list;
  const stale = list.staleSlotKeys.some((slotKey) => !sold.has(slotKey) && madeStale(slotKey));
  const redrawn = list.offeredSlotKeys.filter(
    (slotKey) => !sold.has(slotKey) && (stale || (stored[slotKey] ?? null) === null),
  );
  const claimed = new Set(
    list.offeredSlotKeys.flatMap((slotKey) =>
      redrawn.includes(slotKey) ? [] : (stored[slotKey] ?? []),
    ),
  );
  const draws: { slotKey: PoolSlotKey; traitKey: string | null }[] = [];
  // A regenerated list shows fewer slots when fewer traits are eligible: the rest go blank.
  if (stale)
    for (const slotKey of POOL_SLOT_KEYS)
      if (
        !sold.has(slotKey) &&
        !list.offeredSlotKeys.includes(slotKey) &&
        (stored[slotKey] ?? null) !== null
      )
        draws.push({ slotKey, traitKey: null });
  redrawn.forEach((slotKey, index) => {
    // A reroll that leaves eligible traits unshown may not repeat everything on show before it.
    const unclaimedShown = (list.shownTraitKeys ?? []).filter((shown) => !claimed.has(shown));
    const banned =
      index === redrawn.length - 1 && unclaimedShown.length === 1
        ? new Set([...claimed, ...unclaimedShown])
        : claimed;
    const traitKey = draw(identity(slotKey), list.eligibleTraitKeys, banned);
    if (traitKey === undefined) return;
    claimed.add(traitKey);
    if (stored[slotKey] !== traitKey) draws.push({ slotKey, traitKey });
  });
  return draws;
}

/**
 * The Pool's first list in show order with slots to stock, so each later list
 * is drawn against what the evaluation shows before it. The regenerated list
 * is cleared when the fountain use no longer makes the entry list stale.
 * A list value is redrawn only when the edit made it stale: one valid before
 * the edit, unchanged and stale now.
 */
function purgingPoolFills(
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
  validBefore: PoolValuesBefore,
): StockFill[] {
  const pool = occurrence.purgingPool;
  const capability = artifacts.purgingPools.at(owner);
  if (pool === undefined || capability === undefined) return [];
  const feature = (rollKey: string | undefined, slotKey: PoolSlotKey) =>
    createRoomFeatureAddress(owner, {
      kind: 'purgingPoolOffer',
      slotKey,
      ...(rollKey === undefined ? {} : { rollKey }),
    });
  const fill = (rollKey: string | undefined, slotKey: PoolSlotKey, command: ProjectCommand) =>
    Object.freeze<StockFill>({
      key: semanticAddressKey(feature(rollKey, slotKey)),
      owner: feature(rollKey, slotKey),
      command,
    });
  const stock = (listKey: string, slotKey: PoolSlotKey, traitKey: string | null): StockFill => {
    if (listKey === INITIAL_ROLL_KEY)
      return fill(undefined, slotKey, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: owner,
        slotKey,
        traitKey,
      });
    if (listKey === PURGING_POOL_REFRESH_ROLL_KEY)
      return fill(listKey, slotKey, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: owner,
        slotKey,
        traitKey,
        list: 'refresh',
      });
    return fill(listKey, slotKey, {
      kind: 'ReplacePurgingPoolRollSlot',
      action: createRoomActionAddress(
        createBiomeAddress(owner.routeKey, owner.biomeKey),
        owner.occurrenceId,
        roomActionKey({ kind: 'rerollPurgingPool', rerollId: listKey }),
      ),
      slotKey,
      traitKey,
    });
  };
  const lists = purgingPoolLists(artifacts, owner, occurrence);
  for (const [index, list] of lists.entries()) {
    const draws = poolListDraws(
      (slotKey) => `${occurrence.occurrenceId}|purgingPool|${list.listKey}:${slotKey}`,
      list,
      (slotKey) => {
        const traitKey = list.stored[slotKey] ?? null;
        return (
          traitKey !== null && validBefore(poolValueKey(owner, list.listKey, slotKey, traitKey))
        );
      },
    );
    if (draws.length > 0)
      return draws.map(({ slotKey, traitKey }) => stock(list.listKey, slotKey, traitKey));
    // The fountain use no longer makes the entry list stale: no list is regenerated.
    if (
      index === 0 &&
      capability.refresh === undefined &&
      capability.fountainJudged &&
      pool.refreshTraitKeyBySlot !== undefined
    )
      return (Object.keys(pool.refreshTraitKeyBySlot) as PoolSlotKey[]).map((slotKey) =>
        stock(PURGING_POOL_REFRESH_ROLL_KEY, slotKey, null),
      );
  }
  return [];
}

/** A Shop item's stable identity among the values its slot can stock. */
function shopValueKey(value: ShopOptionSelection): string {
  return `${value.optionKey}|${JSON.stringify(value.offer)}`;
}

/**
 * The World Shop's first blank reached slot with a legal value, in slot
 * order: each draw needs the joint inventory its stocked peers leave, so a
 * Shop stocks one slot per pass. A validly empty slot stays empty. Then the
 * Travel Deal restock of its triggering purchase, from the source slot's
 * group.
 */
function worldShopFills(
  catalog: Catalog,
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (shop === undefined) return [];
  const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
  const profile = catalog.rewards.shops.byKey[shop.profileKey];
  const undrawn = undrawnOptions(catalog, shop.profileKey, 'key');
  const draw = (offer: ShopOfferAddress, valuesSlotKey: string): StockFill | undefined => {
    const producer = artifacts.rewardProducers.at(offer);
    const evaluate = producer?.evaluateShopOption;
    if (evaluate === undefined) return undefined;
    const legal = shopOfferOptionValues(catalog, shop.profileKey, valuesSlotKey).filter(
      (value) => !undrawn.has(value.optionKey) && evaluate(offer, value).supported,
    );
    const key = stableChoice(
      `${occurrence.occurrenceId}|worldShop|${offer.offerKey}`,
      legal.map(shopValueKey),
    );
    const value = legal.find((candidate) => shopValueKey(candidate) === key);
    if (value === undefined) return undefined;
    return Object.freeze<StockFill>({
      key: semanticAddressKey(offer),
      owner: offer,
      command: { kind: 'ReplaceShopOfferOption', offer, value },
    });
  };
  for (const slot of profile?.slots.values ?? []) {
    if ((shop.offers[slot.key]?.reward ?? null) !== null) continue;
    const offer = createShopOfferAddress(biome, owner.occurrenceId, slot.key);
    const standing = artifacts.rewardProducers.at(offer)?.shopSlotAssessment?.(offer);
    if (standing !== 'incomplete') continue;
    // A slot with no legal value stays blank with its finding; later slots still stock.
    const fill = draw(offer, slot.key);
    if (fill !== undefined) return [fill];
  }
  const refill = artifacts.derivedAcquisitionEntries
    .entriesAt(createAcquisitionSiteAddress(owner, 'roomExit'))
    .find((entry) => entry.address.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)?.capability;
  if (
    refill?.kind !== 'travelDealRefill' ||
    refill.sourceOfferKey === undefined ||
    (shop.travelDealRefill?.reward ?? null) !== null
  )
    return [];
  const fill = draw(
    createShopOfferAddress(biome, owner.occurrenceId, TRAVEL_DEAL_REFILL_ENTRY_KEY),
    refill.sourceOfferKey,
  );
  return fill === undefined ? [] : [fill];
}

/**
 * The Contract pedestal's blank item once the walk spawns it, with the Contract
 * held: a draw over the options its one slot admits there.
 */
function infernalContractPedestalFills(
  catalog: Catalog,
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  if (occurrence.infernalContractPedestal?.reward !== null) return [];
  const pedestal = createInfernalContractPedestalAddress(
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    owner.occurrenceId,
  );
  const evaluate = artifacts.rewardProducers.at(pedestal)?.evaluateShopOption;
  if (evaluate === undefined) return [];
  const legal = infernalContractPedestalOptionValues(catalog, occurrence.gameName).filter(
    (value) => evaluate(pedestal, value).supported,
  );
  const key = stableChoice(
    `${occurrence.occurrenceId}|infernalContractPedestal`,
    legal.map(shopValueKey),
  );
  const value = legal.find((candidate) => shopValueKey(candidate) === key);
  if (value === undefined) return [];
  return [
    Object.freeze<StockFill>({
      key: semanticAddressKey(pedestal),
      owner: pedestal,
      command: { kind: 'ReplaceInfernalContractPedestalOption', pedestal, value },
    }),
  ];
}

/**
 * Every blank stock slot the evaluated walk reached, with the command that
 * stocks it by a stable legal draw: Stygian Wells first, then Hermes Shrines,
 * Purging Pools and World Shops, each room in route order. A Pool list is
 * also redrawn when a value the walk judged valid before the edit is now
 * stale. Contract pedestals stock once nothing else does, as their draw sees
 * the Shop their room stocked first.
 */
export function stockFills(
  catalog: Catalog,
  project: ProjectDocument,
  artifacts: ProjectCandidateArtifacts,
  poolValuesBefore: PoolValuesBefore,
): readonly StockFill[] {
  const reached = rooms(project).flatMap(({ biome, owner, occurrence }) => {
    const biomeArtifacts = artifacts.biomeAt(biome);
    return biomeArtifacts === undefined ? [] : [{ artifacts: biomeArtifacts, owner, occurrence }];
  });
  const fills = [
    (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
      stygianWellFills(catalog, room, owner, occurrence),
    (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
      hermesShrineFills(catalog, room, owner, occurrence),
    (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
      purgingPoolFills(room, owner, occurrence, poolValuesBefore),
    (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
      worldShopFills(catalog, room, owner, occurrence),
  ].flatMap((fillsOf) =>
    reached.flatMap((room) => fillsOf(room.artifacts, room.owner, room.occurrence)),
  );
  return Object.freeze(
    fills.length > 0
      ? fills
      : reached.flatMap((room) =>
          infernalContractPedestalFills(catalog, room.artifacts, room.owner, room.occurrence),
        ),
  );
}
