import type { OccurrenceAddress } from '../../authored-project/addresses';
import type { Catalog, KeepsakeRank } from '../../catalog-schema';
import { createRewardBagState } from '../../reward-kernel';
import { artificerStatus } from '../arcana-fear';
import { keepsakeRankForEquip } from '../keepsakes/state';
import { deriveMaxStatGrants, deriveMaxStats } from '../max-stats';
import type { SimulationState } from '../state/model';
import { aspectIsPerfect, familiarStackMultiplier } from '../traits/equipment-upgrades';
import { hasActiveChaosSemanticTag } from '../traits/offers';
import type {
  StartBiomeRecords,
  StartHeldKeepsake,
  StartInstallation,
  StartInstallationFamily,
  StartInstallationResult,
  StartInstalledTrait,
  StartPoint,
  StartRewardStores,
  StartRoomHistoryRecord,
} from './model';

export interface StartInstallationInputs {
  readonly startPoint: StartPoint;
  readonly startOccurrence?: OccurrenceAddress;
  readonly startRoomGameName: string;
  /** Every reached branch at the start point, all at one history view and route position. */
  readonly states: readonly SimulationState[];
  readonly roomHistory: readonly StartRoomHistoryRecord[];
  readonly visitedBiomeKeys: readonly string[];
}

/** Key-order-independent identity for comparing one family across branches. */
function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
    .join(',')}}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** An unordered collection in content order, so equal sets agree across branches. */
function sorted<T>(items: readonly T[], key: (item: T) => string = stable): readonly T[] {
  return Object.freeze(
    items
      .map((item) => ({ item, order: `${key(item)}\u0000${stable(item)}` }))
      .sort((left, right) => compareText(left.order, right.order))
      .map(({ item }) => item),
  );
}

function traits(state: SimulationState): readonly StartInstalledTrait[] {
  const { equippedTraits, equippedSlots, events } = state.traitHistory;
  const slotByTrait = new Map(
    Object.entries(equippedSlots).map(([slotKey, trait]) => [trait.traitKey, slotKey]),
  );
  const runStartGrants = new Set(
    events.flatMap((event) =>
      event.kind === 'directTraitGrant' && event.acquisitionPoint === 'routeStart'
        ? [event.traitKey]
        : [],
    ),
  );
  return sorted(
    Object.values(equippedTraits).map((equipped) => {
      // Offer provenance is planner evidence; the game installs the instance.
      const { giverKey, providerKind, sourceRole, acquisitionIdentity, ...installed } = equipped;
      void giverKey;
      void providerKind;
      void sourceRole;
      void acquisitionIdentity;
      const slotKey = slotByTrait.get(equipped.traitKey);
      return Object.freeze({
        ...installed,
        ...(slotKey === undefined ? {} : { slotKey }),
        ...(runStartGrants.has(equipped.traitKey) ? { grantedByRunStart: true as const } : {}),
      });
    }),
    (trait) => trait.traitKey,
  );
}

function chaos(state: SimulationState): StartInstallation['chaos'] {
  const history = state.traitHistory;
  const embryoIdentities = new Set(
    history.events.flatMap((event) =>
      event.kind === 'directChaosBlessing' ? [event.acquisitionIdentity] : [],
    ),
  );
  return Object.freeze({
    active: sorted(
      history.activeChaosCurses.map((curse) =>
        Object.freeze({
          curseKey: curse.curseKey,
          duration: curse.duration,
          remaining: curse.remaining,
          clock: curse.clock,
          curseValues: curse.curseValues,
          blessingKey: curse.blessingKey,
          rarity: curse.rarity,
          blessingValues: curse.blessingValues,
        }),
      ),
      (curse) => curse.curseKey,
    ),
    matured: sorted(
      history.maturedChaosBlessings.map((blessing) =>
        Object.freeze({
          blessingKey: blessing.blessingKey,
          rarity: blessing.rarity,
          blessingValues: blessing.blessingValues,
          fromChaosKeepsake: embryoIdentities.has(blessing.acquisitionIdentity),
        }),
      ),
      (blessing) => blessing.blessingKey,
    ),
  });
}

function equipment(catalog: Catalog, state: SimulationState): StartInstallation['equipment'] {
  return Object.freeze({
    weaponKey: state.equipment.weaponKey,
    aspectKey: state.equipment.aspectKey,
    aspectPerfect: aspectIsPerfect(catalog, state.traitHistory),
    familiarKey: state.equipment.familiarKey,
    familiarStackMultiplier: familiarStackMultiplier(catalog, state.traitHistory),
  });
}

function keepsakeKeyWithEffect(catalog: Catalog, kind: string): string {
  const key = catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)?.key;
  if (key === undefined) throw new Error(`no keepsake declares ${kind}`);
  return key;
}

const KEEPSAKE_RANKS: readonly KeepsakeRank[] = ['Common', 'Rare', 'Epic', 'Heroic'];

/**
 * Native `UnequipKeepsake` keeps Permanent keepsakes held unslotted; Echo's
 * biome-start replay equips a Common copy only while the keepsake is not held
 * (`RoomLogic.lua:1218-1242`), and a spent unslotted Figurine is removed.
 */
function heldKeepsakes(catalog: Catalog, state: SimulationState): readonly StartHeldKeepsake[] {
  const value = state.keepsakes;
  const rows = new Map<string, StartHeldKeepsake>();
  const hold = (key: string, rank: KeepsakeRank, slotted: boolean) => {
    if (!rows.has(key)) rows.set(key, Object.freeze({ key, rank, slotted }));
  };
  if (value.currentKey !== null)
    hold(
      value.currentKey,
      keepsakeRankForEquip(catalog, value.currentKey, state.traitHistory),
      true,
    );
  if (value.discordantBell !== undefined)
    hold(keepsakeKeyWithEffect(catalog, 'discordantBell'), value.discordantBell.rank, false);
  if (value.jeweledPom !== undefined) {
    const key = keepsakeKeyWithEffect(catalog, 'jeweledPom');
    const effect = catalog.keepsakes.byKey[key]!.effect;
    const levels = value.jeweledPom.levels;
    const rank =
      effect?.kind === 'jeweledPom'
        ? KEEPSAKE_RANKS.find(
            (entry) => effect.subsequentEligibleTraitLevelsByRank[entry] === levels,
          )
        : undefined;
    if (rank === undefined) throw new Error(`Jeweled Pom has no rank for ${levels} levels`);
    hold(key, rank, false);
  }
  for (const retained of value.retained ?? []) hold(retained.key, retained.rank, false);
  const gift = state.traitHistory.equippedTraits.EchoRepeatKeepsakeBoon;
  const captured = gift?.echoRepeatedKeepsakeKey;
  if (captured !== undefined && (gift?.echoKeepsakeReplayCount ?? 0) > 0) {
    const spentFigurine =
      catalog.keepsakes.byKey[captured]?.effect?.kind === 'crystalFigurine' &&
      !(value.figurine?.origin === 'echo' && value.figurine.status === 'pending');
    if (!spentFigurine) hold(captured, 'Common', false);
  }
  return sorted([...rows.values()], (row) => row.key);
}

function keepsake(catalog: Catalog, state: SimulationState): StartInstallation['keepsake'] {
  const value = state.keepsakes;
  return Object.freeze({
    currentKey: value.currentKey,
    usedKeys: Object.freeze(value.history.map((entry) => entry.key)),
    removedKeys: value.removedKeys,
    held: heldKeepsakes(catalog, state),
    fatedStatus: value.fatedStatus,
    olympianSources: sorted(
      value.olympianSources.map((source) =>
        Object.freeze({
          keepsakeKey: source.keepsakeKey,
          providerKey: source.providerKey,
          origin: source.origin,
          remainingForceUses: source.remainingForceUses,
          remainingRarificationUses: source.remainingRarificationUses,
          maximumSourceRarityLevel: source.maximumSourceRarityLevel,
        }),
      ),
    ),
    ...(value.jeweledPom === undefined
      ? {}
      : {
          jeweledPom: Object.freeze({
            grantedTraitKey: value.jeweledPom.grantedTraitKey,
            active: value.jeweledPom.active,
            levels: value.jeweledPom.levels,
          }),
        }),
    experimentalHammers: sorted(
      value.experimentalHammers.map(({ traitKey, remainingUses, active }) =>
        Object.freeze({ traitKey, remainingUses, active }),
      ),
    ),
    ...(value.callingCard === undefined ? {} : { callingCard: value.callingCard }),
    ...(value.timePiece === undefined ? {} : { timePiece: value.timePiece }),
    ...(value.figLeaf === undefined ? {} : { figLeafRemainingUses: value.figLeaf.remainingUses }),
    ...(value.gorgon === undefined ? {} : { gorgon: value.gorgon }),
    ...(value.phial === undefined ? {} : { phial: value.phial }),
    ...(value.figurine === undefined ? {} : { figurine: value.figurine }),
    ...(value.stone === undefined ? {} : { stone: value.stone }),
    ...(value.transcendentEmbryo === undefined
      ? {}
      : {
          transcendentEmbryo: Object.freeze({
            origin: value.transcendentEmbryo.origin,
            rarity: value.transcendentEmbryo.rarity,
            progress: value.transcendentEmbryo.progress,
            markedBlessingKey: value.transcendentEmbryo.markedBlessingKey,
            markedBlessingValues: value.transcendentEmbryo.markedBlessingValues,
          }),
        }),
    ...(value.discordantBell === undefined ? {} : { discordantBell: value.discordantBell }),
    ...(value.lionFang === undefined ? {} : { lionFang: value.lionFang }),
    ...(value.maxHealthCap === undefined ? {} : { maxHealthCap: value.maxHealthCap }),
  });
}

function arcana(catalog: Catalog, state: SimulationState): StartInstallation['arcana'] {
  const status = artificerStatus(catalog, state.arcanaFear);
  return Object.freeze({
    active: sorted(state.arcanaFear.arcana.active, (card) => card.key),
    roomEntryGrowth: state.arcanaFear.arcana.roomEntryGrowth ?? Object.freeze({}),
    ...(status === undefined
      ? {}
      : {
          artificer: Object.freeze({ usedCount: status.spent, remainingCount: status.remaining }),
        }),
    barrenActive: hasActiveChaosSemanticTag(state.traitHistory, 'Barren'),
  });
}

/** An Opening's states have already had the biome-start reset; a Preboss's are current. */
function biomeRecords(state: SimulationState, form: StartBiomeRecords['form']): StartBiomeRecords {
  return Object.freeze({
    form,
    biomeUseRecord: state.rewardHistory.biomeUseRecord,
    forfeitConsumed: state.arcanaFear.fear.forfeitConsumed,
    figLeafActivatedThisBiome: state.keepsakes.figLeaf?.activatedThisBiome === true,
  });
}

function counters(state: SimulationState, kind: StartPoint['kind']): StartInstallation['counters'] {
  const view = state.reached.historyView.ledgers.counters;
  const { lastDevotionDepth } = state.rewardHistory;
  return Object.freeze({
    roomHistoryOrdinal: view.roomHistoryOrdinal,
    routeEncounterDepth: view.routeEncounterDepth,
    biomeDepthCache: view.biomeDepthCache,
    biomeEncounterDepth: view.biomeEncounterDepth,
    ...(lastDevotionDepth === undefined ? {} : { lastDevotionDepth }),
    ...(kind === 'preboss' && view.clockworkGoalsRemaining !== undefined
      ? { clockwork: clockwork(view) }
      : {}),
  });
}

function clockwork(
  view: SimulationState['reached']['historyView']['ledgers']['counters'],
): NonNullable<StartInstallation['counters']['clockwork']> {
  const {
    clockworkGoalsRemaining: goalsRemaining,
    clockworkNonGoalRewardsAcquired: nonGoalRewardsAcquired,
    clockworkMaxNonGoalRewards: maxNonGoalRewards,
  } = view;
  if (
    goalsRemaining === undefined ||
    nonGoalRewardsAcquired === undefined ||
    maxNonGoalRewards === undefined
  )
    throw new Error('Clockwork counters are published together');
  return Object.freeze({ goalsRemaining, nonGoalRewardsAcquired, maxNonGoalRewards });
}

/** Well holdings without their planner provenance. */
function stygianWell(state: SimulationState): StartInstallation['stygianWell'] {
  const { timedInstances, ...counts } = state.stygianWell;
  return Object.freeze({
    ...counts,
    timedInstances: sorted(
      timedInstances.map(({ itemKey, traitKey, clock, remainingUses }) =>
        Object.freeze({ itemKey, traitKey, clock, remainingUses }),
      ),
      (instance) => instance.itemKey,
    ),
  });
}

/**
 * The maxima and the recorded grants the install adds as hidden traits. The
 * slotted keepsake's own max-Magick grant is its latest one; its native equip
 * re-creates it at the slotted rank.
 */
function maxStats(catalog: Catalog, state: SimulationState): StartInstallation['maxStats'] {
  const { maxHealth, maxMana } = deriveMaxStats(catalog, state);
  const grants = [...deriveMaxStatGrants(state)];
  const slotted = state.keepsakes.currentKey;
  const own = grants.findLastIndex(
    (grant) => grant.source.kind === 'keepsake' && grant.source.key === slotted,
  );
  if (own >= 0) {
    const effect = catalog.keepsakes.byKey[slotted!]?.effect;
    const rank = keepsakeRankForEquip(catalog, slotted!, state.traitHistory);
    if (effect?.kind !== 'maxManaGrant' || effect.maxManaByRank[rank] !== grants[own]!.maxMana)
      throw new Error(`${slotted} grant is not its ${rank} equip amount`);
    grants.splice(own, 1);
  }
  return Object.freeze({ maxHealth, maxMana, grants: sorted(grants) });
}

type StartFamilies = Pick<StartInstallation, StartInstallationFamily>;

function families(
  catalog: Catalog,
  state: SimulationState,
  kind: StartPoint['kind'],
): StartFamilies {
  const fear = state.arcanaFear.fear;
  return {
    equipment: equipment(catalog, state),
    traits: traits(state),
    chaos: chaos(state),
    keepsake: keepsake(catalog, state),
    arcana: arcana(catalog, state),
    fear: Object.freeze({
      configuredRanks: fear.configuredRanks,
      disabledVowKeys: sorted(fear.disabledVowKeys),
      effectiveRanks: fear.effectiveRanks,
    }),
    maxStats: maxStats(catalog, state),
    stygianWell: stygianWell(state),
    hermesDeliveries: sorted(
      Object.values(state.pendingHermesShrineDeliveries).map((delivery) =>
        Object.freeze({
          entryKey: delivery.entryKey,
          rewardType: delivery.rewardType,
          rushed: delivery.rushed,
          remainingUses: delivery.remainingUses,
        }),
      ),
      (delivery) => delivery.entryKey,
    ),
    hex: Object.freeze({
      ...(state.hexProgress.tree === undefined ? {} : { tree: state.hexProgress.tree }),
      ...(state.hexProgress.spellTraitKey === undefined
        ? {}
        : { spellTraitKey: state.hexProgress.spellTraitKey }),
      ...(state.hexProgress.godSentAdded === undefined
        ? {}
        : { godSentAdded: state.hexProgress.godSentAdded }),
      ...(state.hexProgress.talentDropsClosed === undefined
        ? {}
        : { talentDropsClosed: state.hexProgress.talentDropsClosed }),
      investedNodeKeys: state.hexProgress.investedNodeKeys,
      talentPoints: state.hexProgress.bankedPathPoints,
    }),
    rewardPriorities: state.rewardPriorities,
    runRecords: Object.freeze({
      useRecord: state.rewardHistory.useRecord,
      lootTypeHistory: state.rewardHistory.lootTypeHistory,
      consumableRecord: state.rewardHistory.consumableRecord,
    }),
    biomeRecords: biomeRecords(state, kind === 'opening' ? 'postReset' : 'current'),
    counters: counters(state, kind),
  };
}

const FAMILY_ORDER: readonly StartInstallationFamily[] = Object.freeze([
  'equipment',
  'traits',
  'chaos',
  'keepsake',
  'arcana',
  'fear',
  'maxStats',
  'stygianWell',
  'hermesDeliveries',
  'hex',
  'rewardPriorities',
  'runRecords',
  'biomeRecords',
  'counters',
]);

/** Reward stores exact across branches; a store no branch has drawn from stays native-fresh. */
function rewardStores(catalog: Catalog, states: readonly SimulationState[]): StartRewardStores {
  const routeKey = states[0]!.reached.routePosition.routeKey;
  const stores: StartRewardStores['stores'][number][] = [];
  for (const store of catalog.rewards.stores.values) {
    if (states.every((state) => state.bags[store.key] === undefined)) continue;
    const initial = createRewardBagState(store, routeKey).remainingEntryCounts;
    const counts = states.map((state) => state.bags[store.key]?.remainingEntryCounts ?? initial);
    const first = counts[0]!;
    if (counts.every((entry) => stable(entry) === stable(first)))
      stores.push(Object.freeze({ storeKey: store.key, remainingEntryCounts: first }));
  }
  return Object.freeze({ stores: Object.freeze(stores) });
}

/**
 * Projects one start point's installation from its reached branches. Every
 * run-wide family must agree across branches, or the start is unavailable.
 */
export function projectStartInstallation(
  catalog: Catalog,
  inputs: StartInstallationInputs,
): StartInstallationResult {
  const [firstState] = inputs.states;
  if (firstState === undefined)
    return Object.freeze({
      availability: 'unavailable',
      reason: Object.freeze({ kind: 'notReached' }),
    });
  for (const state of inputs.states) {
    if (
      state.reached.historyView !== firstState.reached.historyView ||
      state.reached.routePosition !== firstState.reached.routePosition
    )
      throw new Error('start branches were not reached at one exact view and route position');
  }
  const kind = inputs.startPoint.kind;
  const projected = inputs.states.map((state) => families(catalog, state, kind));
  const first = projected[0]!;
  const disagreeing = FAMILY_ORDER.filter((family) => {
    const identity = stable(first[family]);
    return projected.some((branch) => stable(branch[family]) !== identity);
  });
  if (disagreeing.length > 0)
    return Object.freeze({
      availability: 'unavailable',
      reason: Object.freeze({ kind: 'branchesDisagree', families: Object.freeze(disagreeing) }),
    });
  if (inputs.roomHistory.length !== first.counters.roomHistoryOrdinal)
    throw new Error(
      `start room history has ${inputs.roomHistory.length} records for ordinal ${first.counters.roomHistoryOrdinal}`,
    );
  const routePosition = firstState.reached.routePosition;
  return Object.freeze({
    availability: 'available',
    installation: Object.freeze({
      startPoint: inputs.startPoint,
      ...(inputs.startOccurrence === undefined ? {} : { startOccurrence: inputs.startOccurrence }),
      startRoomGameName: inputs.startRoomGameName,
      route: Object.freeze({
        routeKey: routePosition.routeKey,
        enteredBiomes: routePosition.ordinal,
        visitedBiomeKeys: inputs.visitedBiomeKeys,
      }),
      roomHistory: inputs.roomHistory,
      ...first,
      rewardStores: rewardStores(catalog, inputs.states),
    }),
  });
}
