import {
  createBiomeAddress,
  createAcquisitionSiteAddress,
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
 * The Well's blank reached slots in roll order: the initial roll, then each
 * reroll's restock, its Travel Deal restock and each bought Fateful Twist's
 * result. Slots of one roll claim in slot order, past every value the roll
 * already holds; a reroll's last drawn slot also avoids repeating everything
 * on show before it, which the game's ban rules out.
 */
function stygianWellFills(
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  const well = occurrence.stygianWell;
  const capability = artifacts.stygianWells.at(owner);
  if (well === undefined || capability === undefined || !capability.present) return [];
  const fills: StockFill[] = [];
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
      capability.candidateItemKeysBySlot[slotKey],
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
  // Each reached reroll's restock.
  for (const reroll of stygianWellRerolls(occurrence.roomActions.order)) {
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
      const itemKey = draw(identity(generationKey), roll.candidateItemKeysBySlot[slotKey], banned);
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
      refill.candidateItemKeys,
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
    const itemKey = draw(identity(`twist|${generationKey}`), legal, new Set());
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
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
): StockFill[] {
  const shrine = occurrence.hermesShrine;
  const capability = artifacts.hermesShrines.at(owner);
  if (shrine === undefined || capability === undefined || !capability.present) return [];
  const fills: StockFill[] = [];
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
      capability.candidateRewardTypesBySlot[slotKey],
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
      refill.candidateRewardTypes,
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

/**
 * One Pool list's slots to stock: each blank shown slot, or, when a listed
 * boon is no longer held or eligible where the list is judged and the list is
 * not kept, every unsold slot redrawn as the game regenerates the list. Sold
 * slots keep their trait, and the shown slots claim distinct traits in slot
 * order.
 */
function poolListDraws(
  identity: (slotKey: PoolSlotKey) => string,
  stored: Readonly<Partial<Record<PoolSlotKey, string | null>>>,
  list: {
    readonly offeredSlotKeys: readonly PoolSlotKey[];
    readonly eligibleTraitKeys: readonly string[];
    readonly staleSlotKeys: readonly PoolSlotKey[];
    readonly shownTraitKeys?: readonly string[];
  },
  sold: ReadonlySet<PoolSlotKey>,
  kept: boolean,
): { readonly slotKey: PoolSlotKey; readonly traitKey: string | null }[] {
  const stale = !kept && list.staleSlotKeys.some((slotKey) => !sold.has(slotKey));
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
 * The Pool's lists to stock: the entry list, the list the Pool regenerates
 * when the fountain use makes the entry list stale (cleared when it no longer
 * does), and each reroll's list. A list's sales name its slots as sold.
 */
function purgingPoolFills(
  artifacts: BiomeCandidateArtifacts,
  owner: OccurrenceAddress,
  occurrence: RoomOccurrence,
  keepsPoolList: KeptPoolLists,
): StockFill[] {
  const pool = occurrence.purgingPool;
  const capability = artifacts.purgingPools.at(owner);
  if (pool === undefined || capability === undefined) return [];
  const fills: StockFill[] = [];
  const soldFrom = (rollKey: string) =>
    new Set(
      occurrence.roomActions.order.flatMap((reference) =>
        reference.kind === 'sellPurgingPoolTrait' &&
        (reference.rollKey ?? INITIAL_ROLL_KEY) === rollKey
          ? [reference.slotKey]
          : [],
      ),
    );
  const push = (rollKey: string | undefined, slotKey: PoolSlotKey, command: ProjectCommand) => {
    const feature = createRoomFeatureAddress(owner, {
      kind: 'purgingPoolOffer',
      slotKey,
      ...(rollKey === undefined ? {} : { rollKey }),
    });
    fills.push(
      Object.freeze<StockFill>({ key: semanticAddressKey(feature), owner: feature, command }),
    );
  };
  const identity = (list: string) => (slotKey: PoolSlotKey) =>
    `${occurrence.occurrenceId}|purgingPool|${list}:${slotKey}`;
  const refreshed = pool.refreshTraitKeyBySlot !== undefined;
  const entry = capability.assessment;
  for (const { slotKey, traitKey } of poolListDraws(
    identity(INITIAL_ROLL_KEY),
    pool.traitKeyBySlot,
    {
      offeredSlotKeys: entry.offeredSlotKeys,
      eligibleTraitKeys: entry.eligibleTraitKeys,
      staleSlotKeys: entry.findings.flatMap((finding) =>
        finding.code === 'purgingPoolTraitUnavailable' ? [finding.slotKey] : [],
      ),
    },
    // With a refresh stored, the initial list's sales sell from it.
    refreshed ? new Set() : soldFrom(INITIAL_ROLL_KEY),
    keepsPoolList(owner, INITIAL_ROLL_KEY),
  ))
    push(undefined, slotKey, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: owner,
      slotKey,
      traitKey,
    });
  if (capability.refresh !== undefined)
    for (const { slotKey, traitKey } of poolListDraws(
      identity(PURGING_POOL_REFRESH_ROLL_KEY),
      pool.refreshTraitKeyBySlot ?? {},
      capability.refresh,
      soldFrom(INITIAL_ROLL_KEY),
      keepsPoolList(owner, PURGING_POOL_REFRESH_ROLL_KEY),
    ))
      push(PURGING_POOL_REFRESH_ROLL_KEY, slotKey, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: owner,
        slotKey,
        traitKey,
        list: 'refresh',
      });
  else if (capability.fountainJudged && refreshed)
    // The fountain use no longer makes the entry list stale: no list is regenerated.
    for (const slotKey of Object.keys(pool.refreshTraitKeyBySlot!) as PoolSlotKey[])
      push(PURGING_POOL_REFRESH_ROLL_KEY, slotKey, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: owner,
        slotKey,
        traitKey: null,
        list: 'refresh',
      });
  for (const reroll of purgingPoolRerolls(occurrence.roomActions.order)) {
    const roll = capability.rolls[reroll.rerollId];
    if (roll === undefined) continue;
    for (const { slotKey, traitKey } of poolListDraws(
      identity(reroll.rerollId),
      purgingPoolRerollPins(pool, reroll.rerollId),
      roll,
      soldFrom(reroll.rerollId),
      keepsPoolList(owner, reroll.rerollId),
    ))
      push(reroll.rerollId, slotKey, {
        kind: 'ReplacePurgingPoolRollSlot',
        action: createRoomActionAddress(
          createBiomeAddress(owner.routeKey, owner.biomeKey),
          owner.occurrenceId,
          roomActionKey({ kind: 'rerollPurgingPool', rerollId: reroll.rerollId }),
        ),
        slotKey,
        traitKey,
      });
  }
  return fills;
}

/** A Shop item's stable identity among the values its slot can stock. */
function shopValueKey(value: ShopOptionSelection): string {
  return `${value.optionKey}|${JSON.stringify(value.offer)}`;
}

/**
 * The World Shop's first blank reached slot, in slot order: each draw needs
 * the joint inventory its stocked peers leave, so a Shop stocks one slot per
 * pass. A validly empty slot stays empty. Then the Travel Deal restock of its
 * triggering purchase, from the source slot's group.
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
  const draw = (offer: ShopOfferAddress, valuesSlotKey: string): StockFill | undefined => {
    const producer = artifacts.rewardProducers.at(offer);
    const evaluate = producer?.evaluateShopOption;
    if (evaluate === undefined) return undefined;
    const legal = shopOfferOptionValues(catalog, shop.profileKey, valuesSlotKey).filter(
      (value) => evaluate(offer, value).supported,
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
    const fill = draw(offer, slot.key);
    return fill === undefined ? [] : [fill];
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
 * Whether a stale Pool list keeps its values instead of being redrawn: a list
 * whose own value the edit set, so it raises its finding instead.
 */
export type KeptPoolLists = (occurrence: OccurrenceAddress, list: string) => boolean;

/**
 * Every blank stock slot the evaluated walk reached, with the command that
 * stocks it by a stable legal draw: Stygian Wells first, then Hermes Shrines,
 * Purging Pools and World Shops, each room in route order.
 */
export function stockFills(
  catalog: Catalog,
  project: ProjectDocument,
  artifacts: ProjectCandidateArtifacts,
  keepsPoolList: KeptPoolLists,
): readonly StockFill[] {
  const reached = rooms(project).flatMap(({ biome, owner, occurrence }) => {
    const biomeArtifacts = artifacts.biomeAt(biome);
    return biomeArtifacts === undefined ? [] : [{ artifacts: biomeArtifacts, owner, occurrence }];
  });
  return Object.freeze(
    [
      stygianWellFills,
      hermesShrineFills,
      (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
        purgingPoolFills(room, owner, occurrence, keepsPoolList),
      (room: BiomeCandidateArtifacts, owner: OccurrenceAddress, occurrence: RoomOccurrence) =>
        worldShopFills(catalog, room, owner, occurrence),
    ].flatMap((fillsOf) =>
      reached.flatMap((room) => fillsOf(room.artifacts, room.owner, room.occurrence)),
    ),
  );
}
