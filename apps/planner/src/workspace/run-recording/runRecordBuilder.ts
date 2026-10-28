import {
  decodeRunRecord,
  RUN_RECORD_VERSION,
  type RunRecord,
  type RunRecordCage,
  type RunRecordConversions,
  type RunRecordEncounter,
  type RunRecordFields,
  type RunRecordLoadout,
  type RunRecordOptionalReward,
  type RunRecordOutcome,
  type RunRecordPool,
  type RunRecordPurchase,
  type RunRecordHeldTrait,
  type RunRecordRoom,
  type RunRecordRoomEntry,
  type RunRecordSpell,
  type RunRecordStartingTrait,
  type RunRecordStore,
  type RunRecordTraitAcquisition,
  type RunRecordTraitGrade,
  type RunRecordTraitUpgrade,
  type RunRecordWheel,
} from '@run-planner/engine/run-record';

import type {
  SaveCheckpoint,
  SavedEncounter,
  SavedRoom,
  SavedRunState,
  SavedSpell,
  SavedStoreOption,
  SavedTrait,
} from './saveCheckpoint';
import { traitWorldTime } from './traitWorldTime';

export class RunRecordBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunRecordBuildError';
  }
}

type Counts = Readonly<Record<string, number>>;

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

function nonEmpty<T extends object>(value: T): T | undefined {
  return Object.keys(value).length === 0 ? undefined : value;
}

/** The value when it is an integer of at least `minimum`; otherwise unobserved. */
function whole(value: number | undefined, minimum = 0): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= minimum ? value : undefined;
}

function wholeCounts(counts: Counts): Counts {
  return Object.fromEntries(
    Object.entries(counts).filter(([, count]) => whole(count, 1) !== undefined),
  );
}

/** Positive per-key gains from `before` to `after`. */
function gains(before: Counts, after: Counts): Counts {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(after)) {
    const gained = value - (before[key] ?? 0);
    if (gained > 0) result[key] = gained;
  }
  return wholeCounts(result);
}

/** Gain of a run-wide counter across a room. */
function gain(before: number, after: number): number | undefined {
  return whole(after - before, 1);
}

/** Multiset removals per store from `before` to `after`. */
function storeRemovals(
  before: SaveCheckpoint,
  after: SaveCheckpoint,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const [store, names] of Object.entries(before.run.rewardStores)) {
    const left = new Map<string, number>();
    for (const name of names) left.set(name, (left.get(name) ?? 0) + 1);
    for (const name of after.run.rewardStores[store] ?? [])
      left.set(name, (left.get(name) ?? 0) - 1);
    const removed = new Map([...left].filter(([, count]) => count > 0));
    if (removed.size > 0) result.set(store, removed);
  }
  return result;
}

function take(bag: Map<string, number> | undefined, name: string): boolean {
  const count = bag?.get(name) ?? 0;
  if (bag === undefined || count === 0) return false;
  if (count === 1) bag.delete(name);
  else bag.set(name, count - 1);
  return true;
}

function recordEncounter(
  phase: SavedEncounter,
  settled: SavedEncounter | undefined,
): RunRecordEncounter {
  const waves = phase.waves.map((wave) =>
    Object.freeze({
      ...optional('difficulty', wave.difficulty),
      spawns: Object.freeze(
        wave.spawns.map((spawn) =>
          Object.freeze({
            enemy: spawn.name,
            ...optional('count', whole(spawn.totalCount)),
            ...optional('generated', spawn.generated ? (true as const) : undefined),
            ...optional(
              'miniBossShrine',
              spawn.requiredMiniBossShrine ? (true as const) : undefined,
            ),
            ...optional('infinite', spawn.infiniteSpawns ? (true as const) : undefined),
          }),
        ),
      ),
    }),
  );
  // Fangs perks and a Fig Leaf skip are decided when the encounter starts, after the room is entered.
  const started = settled ?? phase;
  return Object.freeze({
    name: phase.name,
    ...optional('difficulty', phase.difficulty),
    ...optional('waves', waves.length > 0 ? waves : undefined),
    ...optional('blacklist', phase.blacklist.length > 0 ? phase.blacklist : undefined),
    ...optional('fangs', nonEmpty(started.eliteAttributes)),
    ...optional('skipped', started.spawnsSkipped ? (true as const) : undefined),
  });
}

function phases(room: SavedRoom): readonly SavedEncounter[] {
  if (room.encounters.length > 0) return room.encounters;
  return room.encounter === undefined ? [] : [room.encounter];
}

function stockOption(option: SavedStoreOption) {
  return Object.freeze({
    slot: option.slot,
    name: option.name,
    ...optional('type', option.type),
    ...optional('lootName', option.lootName),
    ...optional('baseCost', whole(option.baseCost)),
    ...optional('boosted', option.boosted ? (true as const) : undefined),
  });
}

function sameOption(stocked: SavedStoreOption, left: SavedStoreOption): boolean {
  return (
    stocked.name === left.name &&
    stocked.lootName === left.lootName &&
    stocked.type === left.type &&
    stocked.baseCost === left.baseCost
  );
}

/**
 * Stock slots still holding their option when the room was left. A bought option
 * leaves its slot empty and the others keep their positions; any disagreement
 * leaves the purchases unknown.
 */
function remainingSlots(
  stock: readonly SavedStoreOption[],
  departed: readonly SavedStoreOption[],
): Map<number, SavedStoreOption> | undefined {
  const bySlot = new Map(stock.map((option) => [option.slot, option]));
  const remaining = new Map<number, SavedStoreOption>();
  for (const left of departed) {
    const stocked = bySlot.get(left.slot);
    if (stocked === undefined || remaining.has(left.slot) || !sameOption(stocked, left))
      return undefined;
    remaining.set(left.slot, left);
  }
  return remaining;
}

interface RoomSaves {
  readonly index: number;
  readonly entry: SaveCheckpoint;
  readonly postReward?: SaveCheckpoint;
  /** The next room's entry save, or the hub save after the last room. */
  readonly closing?: SaveCheckpoint;
  /** The unstripped departure record of this visit. */
  readonly departure?: SavedRoom;
}

/** Folds the ordered checkpoints of one run, and its hub save when it ended, into a run record. */
export function buildRunRecord(
  checkpoints: readonly SaveCheckpoint[],
  end?: SaveCheckpoint,
): RunRecord {
  const first = checkpoints[0];
  if (first === undefined || first.kind !== 'entry' || first.history.length !== 0)
    throw new RunRecordBuildError('a run starts with an entry save and an empty room history');
  if (checkpoints.some((checkpoint) => checkpoint.kind === 'hub'))
    throw new RunRecordBuildError('run checkpoints must be room saves');
  if (end !== undefined && (end.kind !== 'hub' || !end.run.heroDead))
    throw new RunRecordBuildError('a run ends with a hub save of the dead hero');
  if ([...checkpoints, ...(end ? [end] : [])].some((save) => save.runCount !== first.runCount))
    throw new RunRecordBuildError('checkpoints belong to different runs');

  // A rewritten checkpoint of the same depth supersedes the earlier write.
  const entries: SaveCheckpoint[] = [];
  const postRewards: (SaveCheckpoint | undefined)[] = [];
  for (const checkpoint of checkpoints) {
    const index = checkpoint.history.length;
    if (checkpoint.kind === 'entry') entries[index] = checkpoint;
    else postRewards[index] = checkpoint;
  }
  const roomCount = end?.history.length ?? entries.length;
  if (entries.length !== roomCount || postRewards.length > roomCount)
    throw new RunRecordBuildError('the hub save disagrees with the room saves');
  for (let index = 0; index < roomCount; index += 1)
    if (entries[index] === undefined)
      throw new RunRecordBuildError(`room ${index} has no entry save`);

  const saves: RoomSaves[] = Array.from({ length: roomCount }, (_, index) => {
    const entry = entries[index]!;
    const closing = entries[index + 1] ?? (index === roomCount - 1 ? end : undefined);
    const departure = closing?.departure;
    if (closing !== undefined && departure?.name !== entry.currentRoom.name)
      throw new RunRecordBuildError(`room ${index} departure does not match its entry`);
    return {
      index,
      entry,
      ...optional('postReward', postRewards[index]),
      ...optional('closing', closing),
      ...optional('departure', departure),
    };
  });

  const last = end ?? checkpoints[checkpoints.length - 1]!;
  const traitRooms = traitChanges(saves, roomCount);
  const rooms = saves.map((room) => buildRoom(room, saves, last, traitRooms[room.index]!));
  return decodeRunRecord({
    recordVersion: RUN_RECORD_VERSION,
    run: { runCount: first.runCount, startedAt: first.timestamp },
    route: {
      biomes: last.run.biomeVisitOrder,
      dream: last.run.dream,
      ...optional(
        'maxClockworkNonGoalRewards',
        whole(
          [...checkpoints, ...(end ? [end] : [])].find(
            (save) => save.run.maxClockworkNonGoalRewards !== undefined,
          )?.run.maxClockworkNonGoalRewards,
          1,
        ),
      ),
    },
    outcome: outcome(end, rooms[rooms.length - 1]!.name),
    loadout: loadout(first),
    rooms,
  });
}

function outcome(end: SaveCheckpoint | undefined, endingRoom: string): RunRecordOutcome {
  if (end === undefined) return { kind: 'abandoned', endingRoom };
  const runResult = whole(end.run.runResult);
  if (runResult === undefined) throw new RunRecordBuildError('the hub save carries no run result');
  return {
    kind: end.run.cleared ? 'victory' : 'death',
    endingRoom,
    runResult,
    ...optional('killedBy', end.run.killedBy),
  };
}

function loadout(first: SaveCheckpoint): RunRecordLoadout {
  const hero = first.hero;
  const weapon = first.profile.primaryWeapon;
  if (weapon === undefined || hero === undefined)
    throw new RunRecordBuildError('the run start save carries no loadout');
  const trait = (slot: string): SavedTrait | undefined => {
    const name = hero.slotted[slot];
    return name === undefined ? undefined : hero.traits.find((entry) => entry.name === name);
  };
  const ranked = (slot: string) => {
    const name = hero.slotted[slot];
    if (name === undefined) return undefined;
    return { name, ...optional('rarity', trait(slot)?.rarity) };
  };
  const familiarName = first.profile.equippedFamiliar;
  return {
    weapon,
    ...optional('aspect', ranked('Aspect')),
    ...optional(
      'familiar',
      familiarName === undefined
        ? undefined
        : {
            name: familiarName,
            ...optional('trait', hero.slotted.Familiar),
            ...optional('level', whole(trait('Familiar')?.stackNum, 1)),
          },
    ),
    ...optional('keepsake', ranked('Keepsake')),
    arcana: Object.entries(first.profile.arcana)
      .filter(([, level]) => whole(level, 1) !== undefined)
      .map(([name, level]) => ({ name, level }))
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
    vows: Object.fromEntries(
      Object.entries(first.profile.shrineUpgrades).filter(([, rank]) => whole(rank) !== undefined),
    ),
    startingGold: first.profile.money,
    startingTraits: startingTraits(first, hero.traits, hero.slotted),
  };
}

/**
 * The first save's traits the loadout fields do not describe. The slotted
 * aspect, keepsake and familiar, the familiar's `Familiar*` traits and the
 * Arcana's `*MetaUpgrade` traits are the loadout itself.
 */
function startingTraits(
  first: SaveCheckpoint,
  traits: readonly SavedTrait[],
  slotted: Readonly<Record<string, string>>,
): RunRecordStartingTrait[] {
  const described = new Set(
    ['Aspect', 'Keepsake', 'Familiar'].flatMap((slot) => slotted[slot] ?? []),
  );
  return traits
    .filter(
      (trait) =>
        !described.has(trait.name) &&
        !trait.name.startsWith('Familiar') &&
        !/MetaUpgrade$/i.test(trait.name),
    )
    .map((trait) => ({
      name: trait.name,
      ...grade(trait),
      ...optional(
        'worldTime',
        trait.id === undefined ? undefined : traitWorldTime(trait.id, 0, first.worldTime, 1),
      ),
    }));
}

interface TraitRoom {
  acquired: RunRecordTraitAcquisition[];
  removed: string[];
  upgraded: RunRecordTraitUpgrade[];
}

function grade(trait: SavedTrait): RunRecordTraitGrade {
  return {
    ...optional('rarity', trait.rarity),
    ...optional('level', whole(trait.stackNum, 1)),
  };
}

/**
 * Attributes each trait id gained or lost between consecutive build-carrying
 * saves to the room that save closes, stamping gains with their world time. A
 * trait replaced by the same trait at another rarity or level is an upgrade.
 */
function traitChanges(saves: readonly RoomSaves[], roomCount: number): readonly TraitRoom[] {
  const rooms: TraitRoom[] = Array.from({ length: roomCount }, () => ({
    acquired: [],
    removed: [],
    upgraded: [],
  }));
  const sequence: { save: SaveCheckpoint; room: number }[] = [];
  for (const room of saves) {
    sequence.push({ save: room.entry, room: room.index - 1 });
    if (room.postReward !== undefined) sequence.push({ save: room.postReward, room: room.index });
  }
  let previous = sequence[0]!.save;
  for (const { save, room } of sequence.slice(1)) {
    const before = previous.hero?.traits ?? [];
    const after = save.hero?.traits;
    if (after === undefined) continue;
    // A relaunch restarts `_worldTime` from zero.
    const since = save.worldTime < previous.worldTime ? 0 : previous.worldTime;
    previous = save;
    const target = rooms[room];
    if (target === undefined) continue;
    const beforeIds = new Set(before.map((entry) => entry.id));
    const afterIds = new Set(after.map((entry) => entry.id));
    const lost = before.filter((trait) => trait.id !== undefined && !afterIds.has(trait.id));
    for (const trait of after) {
      if (trait.id === undefined || beforeIds.has(trait.id)) continue;
      const time = traitWorldTime(trait.id, since, save.worldTime, room + 1);
      const to = grade(trait);
      const replaced = lost.findIndex(
        (old) => old.name === trait.name && JSON.stringify(grade(old)) !== JSON.stringify(to),
      );
      if (replaced >= 0) {
        const [old] = lost.splice(replaced, 1);
        target.upgraded.push({
          name: trait.name,
          from: grade(old!),
          to,
          ...optional('worldTime', time),
        });
        continue;
      }
      target.acquired.push({
        name: trait.name,
        ...to,
        ...optional('worldTime', time),
        ...optional('remainingUses', whole(trait.remainingUses)),
        ...optional('savedValues', trait.savedValues),
      });
    }
    for (const trait of lost) target.removed.push(trait.name);
  }
  return rooms;
}

function buildRoom(
  room: RoomSaves,
  saves: readonly RoomSaves[],
  last: SaveCheckpoint,
  traits: TraitRoom,
): RunRecordRoom {
  const entered = room.entry.currentRoom;
  const settled = room.departure ?? room.postReward?.currentRoom ?? entered;
  const closing = room.closing ?? room.postReward ?? room.entry;
  const before = room.entry.run;
  const after = closing.run;

  // A revisited room object (N Hub, a combat room re-entered from its side room)
  // keeps one UseRecord, Kills table, reward and finished encounter across its visits.
  const revisit = (settled.timesVisited ?? entered.timesVisited ?? 0) > 1;
  const previousVisit = revisit
    ? [...saves.slice(0, room.index)]
        .reverse()
        .find((visit) => visit.departure?.name === entered.name)?.departure
    : undefined;
  const uses = previousVisit
    ? gains(previousVisit.useRecord, settled.useRecord)
    : wholeCounts(settled.useRecord);
  const kills = previousVisit
    ? gains(previousVisit.kills, settled.kills)
    : wholeCounts(settled.kills);

  const settledPhases = phases(settled);
  // A revisit generates no new waves for an encounter it finished earlier.
  const enteredPhases = revisit
    ? phases(entered).filter((phase) => phase.waves.length > 0)
    : phases(entered);
  const encounters = enteredPhases.map((phase) => {
    const index = phases(entered).indexOf(phase);
    return recordEncounter(
      phase,
      settledPhases[index]?.name === phase.name ? settledPhases[index] : undefined,
    );
  });
  const combatThisVisit = !revisit || encounters.length > 0;

  const roomReward = nonEmpty({
    ...optional('type', settled.chosenRewardType),
    ...optional('lootName', settled.forceLootName),
    ...optional('store', settled.rewardStoreName),
  });
  const collectedReward =
    roomReward !== undefined &&
    [roomReward.type, roomReward.lootName].some((name) => name !== undefined && uses[name]);
  const reward = revisit && !collectedReward ? undefined : roomReward;

  const untakenCages = untakenDoorCageRewards(room, settled);
  const doors = settled.exitDoors.flatMap((door) => {
    if (whole(door.door) === undefined) return [];
    const offer = settled.offeredRewards[String(door.door)];
    return [
      {
        door: door.door,
        room: door.room,
        ...optional(
          'cageRewards',
          untakenCages?.door === door.door ? untakenCages.rewards : undefined,
        ),
        ...optional(
          'reward',
          offer === undefined
            ? undefined
            : {
                type: offer.type,
                ...optional('lootName', offer.lootName),
                ...optional('lootNames', offer.lootNames),
              },
        ),
      },
    ];
  });
  const predetermined = (
    settled.predeterminedDoors.length > 0 ? settled.predeterminedDoors : entered.predeterminedDoors
  ).filter((door) => whole(door.door) !== undefined);
  // A loot screen's depth is the room history length when it opened: this visit's index.
  const screens = last.run.lootChoices
    .filter((choice) => choice.depth === room.index)
    .map((choice) => ({
      giver: choice.giver,
      options: choice.options,
      ...optional(
        'replaced',
        choice.traitToReplace === undefined
          ? undefined
          : { name: choice.traitToReplace, ...optional('rarity', choice.oldRarity) },
      ),
    }));

  const traitsBefore = room.entry.hero;
  const traitsAfter = [room.closing, room.postReward].find(
    (save) => save !== undefined && save.kind !== 'hub' && save.hero !== undefined,
  )?.hero;
  const startKeepsake = traitsBefore?.slotted.Keepsake;
  const endKeepsake = traitsAfter?.slotted.Keepsake;
  const keepsakeSwap =
    endKeepsake !== undefined && endKeepsake !== startKeepsake
      ? { ...optional('from', startKeepsake), to: endKeepsake }
      : undefined;
  const timePieceUses = (traitsList: readonly SavedTrait[] | undefined) =>
    traitsList?.find((trait) => trait.name === 'GoldifyKeepsake')?.boonConversionUses;
  const timePieceBefore = timePieceUses(traitsBefore?.traits);
  const timePieceAfter = timePieceUses(traitsAfter?.traits);
  const conversions: RunRecordConversions | undefined = nonEmpty({
    ...optional('artificer', gain(before.metaConversionUses, after.metaConversionUses)),
    ...optional(
      'timePiece',
      timePieceBefore !== undefined && timePieceAfter !== undefined
        ? gain(timePieceAfter, timePieceBefore)
        : undefined,
    ),
  });
  // The Forfeit skip count restarts in each biome.
  const forfeitSkips =
    after.biomeBoonSkipCount >= before.biomeBoonSkipCount
      ? gain(before.biomeBoonSkipCount, after.biomeBoonSkipCount)
      : whole(after.biomeBoonSkipCount, 1);

  return {
    name: entered.name,
    ...optional('reward', reward),
    doors,
    ...optional('predeterminedDoors', predetermined.length > 0 ? predetermined : undefined),
    ...optional('exit', saves[room.index + 1]?.entry.currentRoom.name),
    encounters,
    uses,
    ...optional('kills', nonEmpty(kills)),
    traitScreens: screens,
    traits: { acquired: traits.acquired, removed: traits.removed, upgraded: traits.upgraded },
    ...optional('store', store(room, entered)),
    ...optional('pool', pool(room, before.traitsSold, after.traitsSold)),
    ...optional('wheels', combatThisVisit ? wheels(room, settled, uses) : undefined),
    ...optional('fields', combatThisVisit ? fields(room, entered, settled) : undefined),
    ...optional('forfeitSkips', forfeitSkips),
    ...optional('conversions', conversions),
    ...optional('keepsakeSwap', keepsakeSwap),
    ...optional('npcInteractions', nonEmpty(gains(before.npcInteractions, after.npcInteractions))),
    ...optional('bannedTraits', bannedTraits(before.bannedTraits, after.bannedTraits)),
    ...optional('spell', spellChange(traitsBefore?.spell, traitsAfter?.spell)),
    ...optional('toolElements', toolElements(before, after)),
    ...optional('grantedArcana', grantedArcana(room)),
    ...optional('rerolls', doorRerolls(room, settled, previousVisit)),
    ...optional(
      'spentRerolls',
      nonEmpty(
        previousVisit
          ? gains(previousVisit.spentRerolls ?? {}, settled.spentRerolls ?? {})
          : wholeCounts(settled.spentRerolls ?? {}),
      ),
    ),
    ...optional(
      'doubleRewards',
      gain(before.poseidonDoubleRewardCount, after.poseidonDoubleRewardCount),
    ),
    ...optional(
      'olympusEagleSpawn',
      combatThisVisit && settled.olympusEagleSpawn ? (true as const) : undefined,
    ),
    entry: roomEntry(room.entry, saves[room.index - 1]?.entry),
  };
}

/** Entry counts by name of each reward store. */
function storeCounts(save: SaveCheckpoint): Map<string, Counts> {
  return new Map(
    Object.entries(save.run.rewardStores).map(([store, names]) => {
      const counts: Record<string, number> = {};
      for (const name of names) counts[name] = (counts[name] ?? 0) + 1;
      return [store, counts];
    }),
  );
}

function sameCounts(left: Counts | undefined, right: Counts): boolean {
  if (left === undefined) return false;
  const keys = Object.keys(right);
  return keys.length === Object.keys(left).length && keys.every((key) => left[key] === right[key]);
}

/** Held traits by name, each its first instance: the one the game's trait queries resolve. */
function heldTraits(save: SaveCheckpoint): Map<string, RunRecordHeldTrait> {
  const traits = new Map<string, RunRecordHeldTrait>();
  for (const trait of save.hero?.traits ?? [])
    if (!traits.has(trait.name))
      traits.set(trait.name, {
        ...optional('rarity', trait.rarity),
        ...optional('level', whole(trait.stackNum, 1)),
        ...optional('remainingUses', whole(trait.remainingUses)),
        ...optional('boonConversionUses', whole(trait.boonConversionUses)),
      });
  return traits;
}

/**
 * The run state of a room's entry save. Traits and stores repeat only where
 * they differ from the previous room's entry save, so the first room holds
 * every one.
 */
function roomEntry(save: SaveCheckpoint, previous: SaveCheckpoint | undefined): RunRecordRoomEntry {
  const hero = save.hero;
  const held = heldTraits(save);
  const heldBefore = previous === undefined ? undefined : heldTraits(previous);
  const traits = Object.fromEntries(
    [...held].filter(
      ([name, row]) => JSON.stringify(heldBefore?.get(name)) !== JSON.stringify(row),
    ),
  );
  const lostTraits = [...(heldBefore?.keys() ?? [])].filter((name) => !held.has(name)).sort();
  const before = previous === undefined ? undefined : storeCounts(previous);
  const stores = Object.fromEntries(
    [...storeCounts(save)].filter(([store, counts]) => !sameCounts(before?.get(store), counts)),
  );
  const invested = Object.entries(hero?.spell?.talents ?? {})
    .filter(([, talent]) => talent.invested)
    .map(([node]) => node)
    .sort();
  return {
    ...optional('traits', nonEmpty(traits)),
    ...optional('lostTraits', lostTraits.length > 0 ? lostTraits : undefined),
    ...optional('keepsake', hero?.slotted.Keepsake),
    ...optional('elements', nonEmpty(wholeCounts(hero?.elements ?? {}))),
    ...optional('rewardStores', nonEmpty(stores)),
    ...optional(
      'bannedTraits',
      save.run.bannedTraits.length > 0 ? [...save.run.bannedTraits].sort() : undefined,
    ),
    ...optional('metaConversionUses', whole(save.run.metaConversionUses, 1)),
    ...optional('wellShopPurchases', nonEmpty(wholeCounts(save.run.wellShopPurchases))),
    ...optional('biomeBoonSkipCount', whole(save.run.biomeBoonSkipCount, 1)),
    ...optional('numRerolls', whole(save.run.numRerolls, 1)),
    ...optional('investedTalents', invested.length > 0 ? invested : undefined),
  };
}

/** The last room save of a visit: its PostReward or entry save when the hub save closes it. */
function lastRoomSave(room: RoomSaves): SaveCheckpoint {
  return room.closing !== undefined && room.closing.kind !== 'hub'
    ? room.closing
    : (room.postReward ?? room.entry);
}

/**
 * Arcana cards drawn into `TemporaryMetaUpgrades` within the room's bracket, in
 * the order their traits joined `Hero.Traits` (each card's `SourceName`).
 */
function grantedArcana(room: RoomSaves): string[] | undefined {
  const last = lastRoomSave(room);
  const held = new Set(room.entry.run.temporaryMetaUpgrades);
  const drawn = new Set(last.run.temporaryMetaUpgrades.filter((card) => !held.has(card)));
  if (drawn.size === 0) return undefined;
  const ordered: string[] = [];
  for (const trait of last.hero?.traits ?? [])
    if (trait.sourceName !== undefined && drawn.delete(trait.sourceName))
      ordered.push(trait.sourceName);
  return [...ordered, ...[...drawn].sort()];
}

/**
 * Door, ship-wheel and Fields cage rerolls (`AttemptReroll`) spend one
 * `NumRerolls` each; screen rerolls (`AttemptPanelReroll`) mark the room's
 * `SpentRerolls`, the n-th reroll of one screen costing n. The room's door
 * rerolls are what its `NumRerolls` falls spent beyond its screen rerolls; a
 * gain in the same room hides spends, which the importer's pool check finds.
 */
function doorRerolls(
  room: RoomSaves,
  settled: SavedRoom,
  previousVisit: SavedRoom | undefined,
): number | undefined {
  const checkpoints = [room.entry, room.postReward, room.closing].filter(
    (save): save is SaveCheckpoint => save !== undefined && save.kind !== 'hub',
  );
  let spent = 0;
  for (const [index, end] of checkpoints.entries()) {
    const start = checkpoints[index - 1];
    if (start?.run.numRerolls === undefined || end.run.numRerolls === undefined) continue;
    spent += Math.max(0, start.run.numRerolls - end.run.numRerolls);
  }
  // A revisited room keeps its screen counts, so this visit spent only their growth.
  const cost = (counts: Counts | undefined) =>
    Object.values(counts ?? {}).reduce((total, count) => total + (count * (count + 1)) / 2, 0);
  const screens = cost(settled.spentRerolls) - cost(previousVisit?.spentRerolls);
  return whole(spent - screens, 1);
}

/** Gathering tools whose element first spawned within the room's bracket. */
function toolElements(before: SavedRunState, after: SavedRunState): string[] | undefined {
  const tools = Object.keys(gains(before.toolElementsSpawned, after.toolElementsSpawned)).sort();
  return tools.length === 0 ? undefined : tools;
}

/** Names Vow of Denial banned within the room's bracket. */
function bannedTraits(before: readonly string[], after: readonly string[]): string[] | undefined {
  const known = new Set(before);
  const added = after.filter((name) => !known.has(name));
  return added.length === 0 ? undefined : added;
}

/** The Spell and its talents when the room picked it or invested a talent. */
function spellChange(
  before: SavedSpell | undefined,
  after: SavedSpell | undefined,
): RunRecordSpell | undefined {
  if (after === undefined || JSON.stringify(before) === JSON.stringify(after)) return undefined;
  return { name: after.name, ...optional('layout', after.layout), talents: after.talents };
}

/**
 * Fields cage rewards are rolled from the reward stores when the doors are
 * created, between this room's last save and the next room's entry. What the
 * stores lost there, less the entered room's own rolls and the doors' offers,
 * belongs to the one door that offers nothing and was not taken. A refilled
 * store or a second such door leaves them unattributed.
 */
function untakenDoorCageRewards(
  room: RoomSaves,
  settled: SavedRoom,
): { readonly door: number; readonly rewards: string[] } | undefined {
  const start = room.postReward ?? room.entry;
  const end = room.closing;
  if (end === undefined || end.kind === 'hub') return undefined;
  if (storeRemovals(end, start).size > 0) return undefined;
  const removed = storeRemovals(start, end);
  const next = end.currentRoom;
  const taken = settled.exitDoors.filter((door) => door.room === next.name);
  if (taken.length !== 1) return undefined;
  // The entered room's own roll once: its cages, else its reward; the other doors' offers.
  for (const cage of next.cages)
    for (const bag of removed.values()) if (take(bag, cage.rewardType)) break;
  if (next.cages.length === 0 && next.chosenRewardType !== undefined)
    take(removed.get(next.rewardStoreName ?? ''), next.chosenRewardType);
  for (const door of settled.exitDoors) {
    const offer = settled.offeredRewards[String(door.door)];
    if (door === taken[0] || offer === undefined) continue;
    for (const bag of removed.values()) if (take(bag, offer.type)) break;
  }
  const rewards = [...removed.values()]
    .flatMap((bag) =>
      [...bag].flatMap(([name, count]) => Array.from({ length: count }, () => name)),
    )
    .sort();
  const untaken = settled.exitDoors.filter(
    (door) => settled.offeredRewards[String(door.door)] === undefined && door !== taken[0],
  );
  if (rewards.length === 0 || untaken.length !== 1) return undefined;
  return { door: untaken[0]!.door, rewards };
}

function store(room: RoomSaves, entered: SavedRoom): RunRecordStore | undefined {
  const stock = entered.store;
  if (stock === undefined || stock.length === 0) return undefined;
  // A Shop room keeps its own stock even where a Well also rolled.
  const kind = entered.surfaceShop
    ? 'hermesShrine'
    : entered.wellShop && entered.chosenRewardType !== 'Shop'
      ? 'well'
      : 'worldShop';
  const base = { kind, stock: stock.map(stockOption) } as const;
  const closing = room.closing;
  if (kind === 'well') {
    if (closing === undefined) return base;
    return {
      ...base,
      ...wellPurchases(
        stock,
        gains(room.entry.run.wellShopPurchases, closing.run.wellShopPurchases),
      ),
    };
  }
  const departed = room.departure?.store;
  // The first rush under Travel Deal restocks its slot (`HandleSurfaceShopAction`,
  // SurfaceShopLogic.lua:450-474): a slot left holding another option was rushed.
  const restocked =
    kind === 'hermesShrine'
      ? departed?.find((left) => {
          const stocked = stock.find((option) => option.slot === left.slot);
          return stocked !== undefined && !sameOption(stocked, left);
        })
      : undefined;
  const remaining =
    departed === undefined
      ? undefined
      : remainingSlots(
          stock,
          departed.filter((left) => left !== restocked),
        );
  if (remaining === undefined) return base;
  if (kind === 'worldShop')
    return {
      ...base,
      purchases: stock
        .filter((option) => !remaining.has(option.slot))
        .map((option) => ({ slot: option.slot })),
    };
  // A delayed Hermes Shrine purchase stays in stock marked purchased; a rushed one is delivered.
  const purchases: RunRecordPurchase[] = stock.flatMap((option): RunRecordPurchase[] => {
    const left = remaining.get(option.slot);
    if (left === undefined) return [{ slot: option.slot, delivery: 'rushed' }];
    if (!left.purchased) return [];
    return [
      {
        slot: option.slot,
        delivery: 'delayed',
        ...optional('delay', whole(left.roomDelay, 1)),
      } as RunRecordPurchase,
    ];
  });
  return {
    ...base,
    purchases,
    ...optional(
      'purchaseCount',
      closing === undefined
        ? undefined
        : whole(closing.run.surfaceShopPurchases - room.entry.run.surfaceShopPurchases),
    ),
    ...optional(
      'refill',
      restocked === undefined
        ? undefined
        : {
            option: stockOption(restocked),
            ...optional(
              'purchase',
              restocked.purchased
                ? ({
                    slot: restocked.slot,
                    delivery: 'delayed',
                    ...optional('delay', whole(restocked.roomDelay, 1)),
                  } as RunRecordPurchase)
                : undefined,
            ),
          },
    ),
  };
}

/**
 * Stygian Well purchases are counted by item name. A name the opening stock does
 * not hold was bought from a restock; a stocked name bought fewer times than it
 * is offered cannot be placed.
 */
function wellPurchases(
  stock: readonly SavedStoreOption[],
  bought: Counts,
): Pick<RunRecordStore, 'purchases' | 'unstockedPurchases'> {
  const purchases: RunRecordPurchase[] = [];
  const unstocked: string[] = [];
  let placed = true;
  for (const [name, count] of Object.entries(bought)) {
    const slots = stock.filter((option) => option.name === name).map((option) => option.slot);
    if (slots.length === 0) unstocked.push(...Array.from({ length: count }, () => name));
    else if (slots.length === count) purchases.push(...slots.map((slot) => ({ slot })));
    else placed = false;
  }
  return {
    ...optional(
      'purchases',
      placed ? purchases.sort((left, right) => left.slot - right.slot) : undefined,
    ),
    ...optional('unstockedPurchases', unstocked.length > 0 ? unstocked.sort() : undefined),
  };
}

function pool(room: RoomSaves, soldBefore: number, soldAfter: number): RunRecordPool | undefined {
  const offered = room.departure?.sellOptions;
  if (offered === undefined || !room.entry.currentRoom.sellShop) return undefined;
  const sales = whole(soldAfter - soldBefore) ?? 0;
  const present = new Set(offered.map((slot) => slot.slot));
  const highest = Math.max(0, ...present);
  // A sold option leaves its slot empty; a sold last slot leaves no gap.
  const soldSlots: number[] = [];
  for (let slot = 1; slot <= highest; slot += 1) if (!present.has(slot)) soldSlots.push(slot);
  if (soldSlots.length > sales) return undefined;
  for (let next = highest + 1; soldSlots.length < sales; next += 1) soldSlots.push(next);
  return {
    slots: offered.map((slot) => ({
      slot: slot.slot,
      name: slot.name,
      ...optional('rarity', slot.rarity),
      ...optional('value', whole(slot.value)),
    })),
    soldSlots,
    sales,
  };
}

/**
 * Thessaly ship wheels. Every rolled offer leaves its store, picked or not; an
 * Artificer conversion adds one RunProgress roll that the room then collects.
 */
function wheels(
  room: RoomSaves,
  settled: SavedRoom,
  uses: Counts,
): readonly RunRecordWheel[] | undefined {
  const setups = settled.encounters.filter(
    (phase) => phase.rewardStoreName !== undefined && phase.roomRewardOverride !== undefined,
  );
  if (setups.length === 0) return undefined;
  const single = uses.ShipsSteeringWheel ?? 0;
  const left = uses.ShipsSteeringWheelLeft ?? 0;
  const right = uses.ShipsSteeringWheelRight ?? 0;
  let offers: 1 | 2 | undefined;
  let side: 'left' | 'right' | undefined;
  if (single + left + right === setups.length) {
    if (single === setups.length) offers = 1;
    else if (single === 0) {
      offers = 2;
      if (right === 0) side = 'left';
      else if (left === 0) side = 'right';
    }
  }
  const unpicked = new Map<number, string>();
  const postReward = room.postReward;
  if (offers === 2 && postReward !== undefined) {
    const removed = storeRemovals(room.entry, postReward);
    for (const setup of setups)
      take(removed.get(setup.rewardStoreName!), setup.roomRewardOverride!);
    const conversions = postReward.run.metaConversionUses - room.entry.run.metaConversionUses;
    const runProgress = removed.get('RunProgress');
    const collected = [...(runProgress ?? new Map<string, number>()).keys()].filter(
      (name) => (uses[name] ?? 0) > 0,
    );
    const separable = conversions === 0 || collected.length === conversions;
    if (separable) for (const name of collected.slice(0, conversions)) take(runProgress, name);
    setups.forEach((setup, index) => {
      const store = setup.rewardStoreName!;
      if (store === 'RunProgress' && !separable) return;
      if (setups.filter((other) => other.rewardStoreName === store).length !== 1) return;
      const rest = removed.get(store);
      if (rest === undefined || rest.size !== 1) return;
      const [name, count] = [...rest][0]!;
      if (count === 1) unpicked.set(index, name);
    });
  }
  return setups.map((setup, index) => {
    const lastSetup = index === setups.length - 1;
    return {
      store: setup.rewardStoreName!,
      picked: {
        type: setup.roomRewardOverride!,
        // The last wheel's boon god is the room's forced loot; earlier gods match the room's screens.
        ...optional(
          'lootName',
          lastSetup && setup.roomRewardOverride === 'Boon' ? settled.forceLootName : undefined,
        ),
      },
      ...optional('offers', offers),
      ...optional('side', side),
      ...optional('unpicked', unpicked.has(index) ? { type: unpicked.get(index)! } : undefined),
    } as RunRecordWheel;
  });
}

function fields(
  room: RoomSaves,
  entered: SavedRoom,
  settled: SavedRoom,
): RunRecordFields | undefined {
  if (entered.cages.length === 0) return undefined;
  const cageSource = settled.cages.length > 0 ? settled.cages : entered.cages;
  const cages: RunRecordCage[] = cageSource.map((cage) => {
    const points = cage.encounter.eligibleSpawnPoints;
    return {
      reward: { type: cage.rewardType, ...optional('lootName', cage.lootName) },
      encounter: recordEncounter(cage.encounter, cage.encounter),
      ...optional('openedAt', cage.encounter.startTime),
      ...optional(
        'spawnPointIds',
        points?.every((point) => whole(point) !== undefined) ? points : undefined,
      ),
    };
  });
  const opened = cages.every((cage) => cage.openedAt !== undefined);
  if (opened) cages.sort((left, right) => left.openedAt! - right.openedAt!);
  // Uncollected optional rewards stay listed with their point; picking one up drops it.
  const listed = (rewards: SavedEncounter['rewardsToRestore'] | undefined) =>
    rewards?.filter((entry) => entry.objectId !== '' && whole(entry.point) !== undefined);
  const atPostReward = room.postReward
    ? listed(room.postReward.currentRoom.encounter?.rewardsToRestore ?? [])
    : undefined;
  const atDeparture = room.departure
    ? listed(room.departure.encounter?.rewardsToRestore ?? [])
    : undefined;
  let optionalRewards: RunRecordOptionalReward[];
  if (atPostReward !== undefined && atDeparture !== undefined)
    optionalRewards = [
      ...atPostReward
        .filter((entry) => !atDeparture.some((left) => left.objectId === entry.objectId))
        .map((entry) => ({ reward: entry.reward, point: entry.point, collected: true })),
      ...atDeparture.map((entry) => ({
        reward: entry.reward,
        point: entry.point,
        collected: false,
      })),
    ];
  else
    optionalRewards = (atDeparture ?? atPostReward ?? []).map((entry) => ({
      reward: entry.reward,
      point: entry.point,
    }));
  return {
    ...optional('entryPoint', whole(settled.heroStartPoint)),
    cageOrder: opened ? 'opening' : 'unknown',
    cages,
    optionalRewards,
  };
}
