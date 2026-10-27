import {
  RUN_RECORD_VERSION,
  type RunRecord,
  type RunRecordCage,
  type RunRecordConversions,
  type RunRecordDoor,
  type RunRecordDoorReward,
  type RunRecordDoorTarget,
  type RunRecordEncounter,
  type RunRecordFields,
  type RunRecordKeepsakeSwap,
  type RunRecordLoadout,
  type RunRecordOutcome,
  type RunRecordPool,
  type RunRecordPurchase,
  type RunRecordRankedTrait,
  type RunRecordRoom,
  type RunRecordRoomReward,
  type RunRecordSpawn,
  type RunRecordSpell,
  type RunRecordStockOption,
  type RunRecordStore,
  type RunRecordTraitChanges,
  type RunRecordTraitGrade,
  type RunRecordTraitScreen,
  type RunRecordWave,
  type RunRecordWheel,
} from './model';

export class RunRecordCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunRecordCodecError';
  }
}

type Dict = Record<string, unknown>;

const MAX_ROOMS = 512;
const MAX_ITEMS = 256;
const MAX_STRING = 256;

function fail(message: string): never {
  throw new RunRecordCodecError(message);
}

function object(value: unknown, label: string): Dict {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as Dict;
}

function exact(
  record: Dict,
  required: readonly string[],
  optional: readonly string[],
  label: string,
) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record))
    if (!allowed.has(key)) fail(`${label} contains unknown field ${key}`);
  for (const key of required) if (record[key] === undefined) fail(`${label}.${key} is required`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING)
    fail(`${label} must be a bounded non-empty string`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  const parsed = finite(value, label);
  if (!Number.isInteger(parsed) || parsed < minimum)
    fail(`${label} must be an integer >= ${minimum}`);
  return parsed;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
  return value;
}

function flag(value: unknown, label: string): true {
  if (value !== true) fail(`${label} must be true when present`);
  return true;
}

function list<T>(
  value: unknown,
  label: string,
  item: (entry: unknown, label: string) => T,
  max = MAX_ITEMS,
): readonly T[] {
  if (!Array.isArray(value) || value.length > max)
    fail(`${label} must be an array of at most ${max} items`);
  return Object.freeze(value.map((entry, index) => item(entry, `${label}[${index}]`)));
}

function counts(value: unknown, label: string, minimum = 1): Readonly<Record<string, number>> {
  const record = object(value, label);
  const keys = Object.keys(record);
  if (keys.length > MAX_ITEMS) fail(`${label} has too many entries`);
  const result: Record<string, number> = {};
  for (const key of keys) {
    text(key, `${label} key`);
    result[key] = integer(record[key], `${label}.${key}`, minimum);
  }
  return Object.freeze(result);
}

function optional<T>(
  record: Dict,
  key: string,
  label: string,
  decode: (value: unknown, label: string) => T,
): { readonly [K in string]: T } {
  return record[key] === undefined ? {} : { [key]: decode(record[key], `${label}.${key}`) };
}

function rankedTrait(value: unknown, label: string): RunRecordRankedTrait {
  const record = object(value, label);
  exact(record, ['name'], ['rarity'], label);
  return Object.freeze({
    name: text(record.name, `${label}.name`),
    ...optional(record, 'rarity', label, text),
  });
}

function outcome(value: unknown): RunRecordOutcome {
  const label = 'run record.outcome';
  const record = object(value, label);
  exact(record, ['kind', 'endingRoom'], ['runResult', 'killedBy'], label);
  if (record.kind !== 'victory' && record.kind !== 'death' && record.kind !== 'abandoned')
    fail(`${label}.kind is unsupported`);
  if (record.kind === 'abandoned' && record.runResult !== undefined)
    fail(`${label}.runResult must be absent for an abandoned run`);
  if (record.kind !== 'abandoned' && record.runResult === undefined)
    fail(`${label}.runResult is required for a finished run`);
  return Object.freeze({
    kind: record.kind,
    endingRoom: text(record.endingRoom, `${label}.endingRoom`),
    ...optional(record, 'runResult', label, (entry, path) => integer(entry, path)),
    ...optional(record, 'killedBy', label, text),
  });
}

function loadout(value: unknown): RunRecordLoadout {
  const label = 'run record.loadout';
  const record = object(value, label);
  exact(
    record,
    ['weapon', 'arcana', 'vows', 'startingGold', 'startingTraits'],
    ['aspect', 'familiar', 'keepsake'],
    label,
  );
  const familiar =
    record.familiar === undefined
      ? {}
      : {
          familiar: (() => {
            const path = `${label}.familiar`;
            const row = object(record.familiar, path);
            exact(row, ['name'], ['trait', 'level'], path);
            return Object.freeze({
              name: text(row.name, `${path}.name`),
              ...optional(row, 'trait', path, text),
              ...optional(row, 'level', path, (entry, at) => integer(entry, at, 1)),
            });
          })(),
        };
  const seen = new Set<string>();
  const arcana = list(record.arcana, `${label}.arcana`, (entry, path) => {
    const row = object(entry, path);
    exact(row, ['name', 'level'], [], path);
    const name = text(row.name, `${path}.name`);
    if (seen.has(name)) fail(`${label}.arcana contains duplicate ${name}`);
    seen.add(name);
    return Object.freeze({ name, level: integer(row.level, `${path}.level`, 1) });
  });
  return Object.freeze({
    weapon: text(record.weapon, `${label}.weapon`),
    ...optional(record, 'aspect', label, rankedTrait),
    ...familiar,
    ...optional(record, 'keepsake', label, rankedTrait),
    arcana,
    vows: counts(record.vows, `${label}.vows`, 0),
    startingGold: integer(record.startingGold, `${label}.startingGold`),
    startingTraits: list(record.startingTraits, `${label}.startingTraits`, (entry, path) => {
      const row = object(entry, path);
      exact(row, ['name'], ['rarity', 'level', 'worldTime'], path);
      return Object.freeze({
        name: text(row.name, `${path}.name`),
        ...optional(row, 'rarity', path, text),
        ...optional(row, 'level', path, (item, at) => integer(item, at, 1)),
        ...optional(row, 'worldTime', path, worldTime),
      });
    }),
  }) as RunRecordLoadout;
}

function roomReward(value: unknown, label: string): RunRecordRoomReward {
  const record = object(value, label);
  exact(record, [], ['type', 'lootName', 'store'], label);
  if (Object.keys(record).length === 0) fail(`${label} must not be empty`);
  return Object.freeze({
    ...optional(record, 'type', label, text),
    ...optional(record, 'lootName', label, text),
    ...optional(record, 'store', label, text),
  });
}

function doorTarget(value: unknown, label: string): RunRecordDoorTarget {
  const record = object(value, label);
  exact(record, ['door', 'room'], [], label);
  return Object.freeze({
    door: integer(record.door, `${label}.door`),
    room: text(record.room, `${label}.room`),
  });
}

function doorReward(value: unknown, label: string): RunRecordDoorReward {
  const record = object(value, label);
  exact(record, ['type'], ['lootName', 'lootNames'], label);
  let lootNames: { lootNames?: readonly [string, string] } = {};
  if (record.lootNames !== undefined) {
    const names = list(record.lootNames, `${label}.lootNames`, text, 2);
    if (names.length !== 2) fail(`${label}.lootNames must hold two names`);
    lootNames = { lootNames: Object.freeze([names[0]!, names[1]!] as const) };
  }
  return Object.freeze({
    type: text(record.type, `${label}.type`),
    ...optional(record, 'lootName', label, text),
    ...lootNames,
  });
}

function door(value: unknown, label: string): RunRecordDoor {
  const record = object(value, label);
  exact(record, ['door', 'room'], ['reward', 'cageRewards'], label);
  return Object.freeze({
    ...doorTarget({ door: record.door, room: record.room }, label),
    ...optional(record, 'reward', label, doorReward),
    ...optional(record, 'cageRewards', label, (entry, path) => {
      const types = list(entry, path, text, 8);
      if (types.length === 0) fail(`${path} must not be empty`);
      return types;
    }),
  });
}

function spawn(value: unknown, label: string): RunRecordSpawn {
  const record = object(value, label);
  exact(record, ['enemy'], ['count', 'generated', 'miniBossShrine', 'infinite'], label);
  return Object.freeze({
    enemy: text(record.enemy, `${label}.enemy`),
    ...optional(record, 'count', label, (entry, path) => integer(entry, path)),
    ...optional(record, 'generated', label, flag),
    ...optional(record, 'miniBossShrine', label, flag),
    ...optional(record, 'infinite', label, flag),
  });
}

function wave(value: unknown, label: string): RunRecordWave {
  const record = object(value, label);
  exact(record, ['spawns'], ['difficulty'], label);
  return Object.freeze({
    ...optional(record, 'difficulty', label, finite),
    spawns: list(record.spawns, `${label}.spawns`, spawn),
  });
}

function fangs(value: unknown, label: string): Readonly<Record<string, readonly string[]>> {
  const record = object(value, label);
  const result: Record<string, readonly string[]> = {};
  for (const key of Object.keys(record)) {
    text(key, `${label} key`);
    result[key] = list(record[key], `${label}.${key}`, text, 16);
  }
  return Object.freeze(result);
}

function encounter(value: unknown, label: string): RunRecordEncounter {
  const record = object(value, label);
  exact(record, ['name'], ['difficulty', 'waves', 'blacklist', 'fangs'], label);
  return Object.freeze({
    name: text(record.name, `${label}.name`),
    ...optional(record, 'difficulty', label, finite),
    ...optional(record, 'waves', label, (entry, path) => list(entry, path, wave, 16)),
    ...optional(record, 'blacklist', label, (entry, path) => list(entry, path, text)),
    ...optional(record, 'fangs', label, fangs),
  });
}

function traitScreen(value: unknown, label: string): RunRecordTraitScreen {
  const record = object(value, label);
  exact(record, ['giver', 'options'], ['replaced'], label);
  return Object.freeze({
    giver: text(record.giver, `${label}.giver`),
    options: list(
      record.options,
      `${label}.options`,
      (entry, path) => {
        const row = object(entry, path);
        exact(row, ['name', 'chosen'], ['rarity'], path);
        return Object.freeze({
          name: text(row.name, `${path}.name`),
          ...optional(row, 'rarity', path, text),
          chosen: bool(row.chosen, `${path}.chosen`),
        });
      },
      8,
    ),
    ...optional(record, 'replaced', label, rankedTrait),
  });
}

function worldTime(value: unknown, label: string): number {
  const time = finite(value, label);
  if (time < 0) fail(`${label} must be non-negative`);
  return time;
}

function traitGrade(value: unknown, label: string): RunRecordTraitGrade {
  const record = object(value, label);
  exact(record, [], ['rarity', 'level'], label);
  return Object.freeze({
    ...optional(record, 'rarity', label, text),
    ...optional(record, 'level', label, (entry, at) => integer(entry, at, 1)),
  });
}

function traitChanges(value: unknown, label: string): RunRecordTraitChanges {
  const record = object(value, label);
  exact(record, ['acquired', 'removed', 'upgraded'], [], label);
  return Object.freeze({
    acquired: list(record.acquired, `${label}.acquired`, (entry, path) => {
      const row = object(entry, path);
      exact(row, ['name'], ['rarity', 'level', 'worldTime', 'remainingUses'], path);
      return Object.freeze({
        name: text(row.name, `${path}.name`),
        ...optional(row, 'rarity', path, text),
        ...optional(row, 'level', path, (item, at) => integer(item, at, 1)),
        ...optional(row, 'worldTime', path, worldTime),
        ...optional(row, 'remainingUses', path, (item, at) => integer(item, at, 0)),
      });
    }),
    removed: list(record.removed, `${label}.removed`, text),
    upgraded: list(record.upgraded, `${label}.upgraded`, (entry, path) => {
      const row = object(entry, path);
      exact(row, ['name', 'from', 'to'], ['worldTime'], path);
      return Object.freeze({
        name: text(row.name, `${path}.name`),
        from: traitGrade(row.from, `${path}.from`),
        to: traitGrade(row.to, `${path}.to`),
        ...optional(row, 'worldTime', path, worldTime),
      });
    }),
  });
}

function stockOption(value: unknown, label: string): RunRecordStockOption {
  const record = object(value, label);
  exact(record, ['slot', 'name'], ['type', 'lootName', 'baseCost', 'boosted'], label);
  return Object.freeze({
    slot: integer(record.slot, `${label}.slot`, 1),
    name: text(record.name, `${label}.name`),
    ...optional(record, 'type', label, text),
    ...optional(record, 'lootName', label, text),
    ...optional(record, 'baseCost', label, (entry, path) => integer(entry, path)),
    ...optional(record, 'boosted', label, flag),
  });
}

function purchase(value: unknown, label: string): RunRecordPurchase {
  const record = object(value, label);
  exact(record, ['slot'], ['delivery', 'delay'], label);
  if (
    record.delivery !== undefined &&
    record.delivery !== 'rushed' &&
    record.delivery !== 'delayed'
  )
    fail(`${label}.delivery is unsupported`);
  if (record.delay !== undefined && record.delivery !== 'delayed')
    fail(`${label}.delay belongs to a delayed delivery`);
  return Object.freeze({
    slot: integer(record.slot, `${label}.slot`, 1),
    ...(record.delivery === undefined ? {} : { delivery: record.delivery }),
    ...optional(record, 'delay', label, (entry, path) => integer(entry, path, 1)),
  });
}

function store(value: unknown, label: string): RunRecordStore {
  const record = object(value, label);
  exact(record, ['kind', 'stock'], ['purchases', 'unstockedPurchases', 'purchaseCount'], label);
  if (record.unstockedPurchases !== undefined && record.kind !== 'well')
    fail(`${label}.unstockedPurchases belongs to the Stygian Well`);
  if (record.kind !== 'worldShop' && record.kind !== 'hermesShrine' && record.kind !== 'well')
    fail(`${label}.kind is unsupported`);
  const stock = list(record.stock, `${label}.stock`, stockOption, 16);
  const slots = new Set(stock.map((entry) => entry.slot));
  if (slots.size !== stock.length) fail(`${label}.stock repeats a slot`);
  const purchases =
    record.purchases === undefined
      ? undefined
      : list(record.purchases, `${label}.purchases`, purchase, 16);
  const bought = new Set<number>();
  for (const entry of purchases ?? []) {
    if (!slots.has(entry.slot)) fail(`${label}.purchases names an unknown slot ${entry.slot}`);
    if (bought.has(entry.slot)) fail(`${label}.purchases repeats slot ${entry.slot}`);
    bought.add(entry.slot);
  }
  if (record.kind !== 'hermesShrine') {
    if (record.purchaseCount !== undefined || purchases?.some((entry) => entry.delivery))
      fail(`${label} delivery facts belong to the Hermes Shrine`);
  } else if (purchases?.some((entry) => entry.delivery === undefined))
    fail(`${label}.purchases needs a delivery at the Hermes Shrine`);
  return Object.freeze({
    kind: record.kind,
    stock,
    ...(purchases === undefined ? {} : { purchases }),
    ...optional(record, 'unstockedPurchases', label, (entry, path) => list(entry, path, text, 16)),
    ...optional(record, 'purchaseCount', label, (entry, path) => integer(entry, path)),
  });
}

function pool(value: unknown, label: string): RunRecordPool {
  const record = object(value, label);
  exact(record, ['slots', 'soldSlots', 'sales'], [], label);
  const slots = list(
    record.slots,
    `${label}.slots`,
    (entry, path) => {
      const row = object(entry, path);
      exact(row, ['slot', 'name'], ['rarity', 'value'], path);
      return Object.freeze({
        slot: integer(row.slot, `${path}.slot`, 1),
        name: text(row.name, `${path}.name`),
        ...optional(row, 'rarity', path, text),
        ...optional(row, 'value', path, (item, at) => integer(item, at)),
      });
    },
    8,
  );
  const soldSlots = list(
    record.soldSlots,
    `${label}.soldSlots`,
    (entry, path) => integer(entry, path, 1),
    8,
  );
  const sales = integer(record.sales, `${label}.sales`);
  const offered = new Set(slots.map((entry) => entry.slot));
  if (offered.size !== slots.length) fail(`${label}.slots repeats a slot`);
  if (new Set(soldSlots).size !== soldSlots.length) fail(`${label}.soldSlots repeats a slot`);
  if (soldSlots.some((slot) => offered.has(slot)))
    fail(`${label}.soldSlots names a slot still offered`);
  if (sales < soldSlots.length) fail(`${label}.sales must cover soldSlots`);
  return Object.freeze({ slots, soldSlots, sales });
}

function wheel(value: unknown, label: string): RunRecordWheel {
  const record = object(value, label);
  exact(record, ['store', 'picked'], ['offers', 'side', 'unpicked'], label);
  const picked = object(record.picked, `${label}.picked`);
  exact(picked, ['type'], ['lootName'], `${label}.picked`);
  if (record.offers !== undefined && record.offers !== 1 && record.offers !== 2)
    fail(`${label}.offers is unsupported`);
  if (record.side !== undefined && record.side !== 'left' && record.side !== 'right')
    fail(`${label}.side is unsupported`);
  if (record.side !== undefined && record.offers !== 2) fail(`${label}.side requires two offers`);
  if (record.unpicked !== undefined && record.offers !== 2)
    fail(`${label}.unpicked requires two offers`);
  return Object.freeze({
    store: text(record.store, `${label}.store`),
    picked: Object.freeze({
      type: text(picked.type, `${label}.picked.type`),
      ...optional(picked, 'lootName', `${label}.picked`, text),
    }),
    ...(record.offers === undefined ? {} : { offers: record.offers }),
    ...(record.side === undefined ? {} : { side: record.side }),
    ...optional(record, 'unpicked', label, (entry, path) => {
      const row = object(entry, path);
      exact(row, ['type'], [], path);
      return Object.freeze({ type: text(row.type, `${path}.type`) });
    }),
  }) as RunRecordWheel;
}

function cage(value: unknown, label: string): RunRecordCage {
  const record = object(value, label);
  exact(record, ['reward', 'encounter'], ['openedAt', 'spawnPointIds'], label);
  const reward = object(record.reward, `${label}.reward`);
  exact(reward, ['type'], ['lootName'], `${label}.reward`);
  return Object.freeze({
    reward: Object.freeze({
      type: text(reward.type, `${label}.reward.type`),
      ...optional(reward, 'lootName', `${label}.reward`, text),
    }),
    encounter: encounter(record.encounter, `${label}.encounter`),
    ...optional(record, 'openedAt', label, finite),
    ...optional(record, 'spawnPointIds', label, (entry, path) =>
      list(entry, path, (item, at) => integer(item, at)),
    ),
  });
}

function fields(value: unknown, label: string): RunRecordFields {
  const record = object(value, label);
  exact(record, ['cageOrder', 'cages', 'optionalRewards'], ['entryPoint'], label);
  if (record.cageOrder !== 'opening' && record.cageOrder !== 'unknown')
    fail(`${label}.cageOrder is unsupported`);
  const cages = list(record.cages, `${label}.cages`, cage, 8);
  if (record.cageOrder === 'opening') {
    const times = cages.map((entry) => entry.openedAt);
    if (times.some((time, index) => time === undefined || (index > 0 && time < times[index - 1]!)))
      fail(`${label}.cages must follow their opening times`);
  }
  return Object.freeze({
    ...optional(record, 'entryPoint', label, (entry, path) => integer(entry, path)),
    cageOrder: record.cageOrder,
    cages,
    optionalRewards: list(
      record.optionalRewards,
      `${label}.optionalRewards`,
      (entry, path) => {
        const row = object(entry, path);
        exact(row, ['reward', 'point'], ['collected'], path);
        return Object.freeze({
          reward: text(row.reward, `${path}.reward`),
          point: integer(row.point, `${path}.point`),
          ...optional(row, 'collected', path, bool),
        });
      },
      16,
    ),
  });
}

function conversions(value: unknown, label: string): RunRecordConversions {
  const record = object(value, label);
  exact(record, [], ['artificer', 'timePiece'], label);
  if (Object.keys(record).length === 0) fail(`${label} must not be empty`);
  const positive = (entry: unknown, path: string) => integer(entry, path, 1);
  return Object.freeze({
    ...optional(record, 'artificer', label, positive),
    ...optional(record, 'timePiece', label, positive),
  });
}

function keepsakeSwap(value: unknown, label: string): RunRecordKeepsakeSwap {
  const record = object(value, label);
  exact(record, ['to'], ['from'], label);
  return Object.freeze({
    ...optional(record, 'from', label, text),
    to: text(record.to, `${label}.to`),
  }) as RunRecordKeepsakeSwap;
}

function spell(value: unknown, label: string): RunRecordSpell {
  const record = object(value, label);
  exact(record, ['name', 'talents'], ['layout'], label);
  const talents = object(record.talents, `${label}.talents`);
  if (Object.keys(talents).length > MAX_ITEMS) fail(`${label}.talents is too large`);
  return Object.freeze({
    name: text(record.name, `${label}.name`),
    ...optional(record, 'layout', label, text),
    talents: Object.freeze(
      Object.fromEntries(
        Object.entries(talents).map(([key, entry]) => {
          const path = `${label}.talents.${key}`;
          if (!/^[1-9]\d*:[1-9]\d*$/.test(key)) fail(`${path} must be keyed depth:slot`);
          const talent = object(entry, path);
          exact(talent, ['name', 'invested'], [], path);
          return [
            key,
            Object.freeze({
              name: text(talent.name, `${path}.name`),
              invested: bool(talent.invested, `${path}.invested`),
            }),
          ];
        }),
      ),
    ),
  }) as RunRecordSpell;
}

const ROOM_REQUIRED = ['name', 'doors', 'encounters', 'uses', 'traitScreens', 'traits'] as const;
const ROOM_OPTIONAL = [
  'reward',
  'predeterminedDoors',
  'exit',
  'kills',
  'store',
  'pool',
  'wheels',
  'fields',
  'forfeitSkips',
  'conversions',
  'keepsakeSwap',
  'npcInteractions',
  'bannedTraits',
  'spell',
] as const;

function room(value: unknown, label: string): RunRecordRoom {
  const record = object(value, label);
  exact(record, ROOM_REQUIRED, ROOM_OPTIONAL, label);
  return Object.freeze({
    name: text(record.name, `${label}.name`),
    ...optional(record, 'reward', label, roomReward),
    doors: list(record.doors, `${label}.doors`, door, 64),
    ...optional(record, 'predeterminedDoors', label, (entry, path) =>
      list(entry, path, doorTarget, 64),
    ),
    ...optional(record, 'exit', label, text),
    encounters: list(record.encounters, `${label}.encounters`, encounter, 8),
    uses: counts(record.uses, `${label}.uses`),
    ...optional(record, 'kills', label, (entry, path) => counts(entry, path)),
    traitScreens: list(record.traitScreens, `${label}.traitScreens`, traitScreen, 16),
    traits: traitChanges(record.traits, `${label}.traits`),
    ...optional(record, 'store', label, store),
    ...optional(record, 'pool', label, pool),
    ...optional(record, 'wheels', label, (entry, path) => list(entry, path, wheel, 4)),
    ...optional(record, 'fields', label, fields),
    ...optional(record, 'forfeitSkips', label, (entry, path) => integer(entry, path, 1)),
    ...optional(record, 'conversions', label, conversions),
    ...optional(record, 'keepsakeSwap', label, keepsakeSwap),
    ...optional(record, 'npcInteractions', label, (entry, path) => counts(entry, path)),
    ...optional(record, 'bannedTraits', label, (entry, path) => {
      const names = list(entry, path, text, MAX_ITEMS);
      if (names.length === 0) fail(`${path} must not be empty`);
      return names;
    }),
    ...optional(record, 'spell', label, spell),
  }) as RunRecordRoom;
}

export function decodeRunRecord(value: unknown): RunRecord {
  const record = object(value, 'run record');
  exact(record, ['recordVersion', 'run', 'route', 'outcome', 'loadout', 'rooms'], [], 'run record');
  if (record.recordVersion !== RUN_RECORD_VERSION) fail('run record.recordVersion is unsupported');
  const run = object(record.run, 'run record.run');
  exact(run, ['runCount', 'startedAt'], [], 'run record.run');
  const route = object(record.route, 'run record.route');
  exact(route, ['biomes', 'dream'], [], 'run record.route');
  const rooms = list(record.rooms, 'run record.rooms', room, MAX_ROOMS);
  if (rooms.length === 0) fail('run record.rooms must not be empty');
  rooms.forEach((entry, index) => {
    const next = rooms[index + 1];
    if (next === undefined) {
      if (entry.exit !== undefined) fail(`run record.rooms[${index}].exit must be absent`);
    } else if (entry.exit !== next.name)
      fail(`run record.rooms[${index}].exit must name the next room`);
  });
  const decodedOutcome = outcome(record.outcome);
  if (decodedOutcome.endingRoom !== rooms[rooms.length - 1]!.name)
    fail('run record.outcome.endingRoom must name the last room');
  return Object.freeze({
    recordVersion: RUN_RECORD_VERSION,
    run: Object.freeze({
      runCount: integer(run.runCount, 'run record.run.runCount'),
      startedAt: integer(run.startedAt, 'run record.run.startedAt'),
    }),
    route: Object.freeze({
      biomes: list(route.biomes, 'run record.route.biomes', text, 8),
      dream: bool(route.dream, 'run record.route.dream'),
    }),
    outcome: decodedOutcome,
    loadout: loadout(record.loadout),
    rooms,
  });
}

/** Validates the record and returns its compact wire form. */
export function encodeRunRecord(record: RunRecord): string {
  return JSON.stringify(decodeRunRecord(record));
}
