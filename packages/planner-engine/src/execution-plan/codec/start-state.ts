import type {
  ExecutionBiomeKey,
  ExecutionKeepsakeRarity,
  ExecutionMaxStatSource,
  ExecutionStartArcanaCard,
  ExecutionStartBiome,
  ExecutionStartChaosBlessing,
  ExecutionStartChaosCurse,
  ExecutionStartEssences,
  ExecutionStartHex,
  ExecutionStartKeepsake,
  ExecutionStartKeepsakeTrait,
  ExecutionStartState,
  ExecutionStartTrait,
  ExecutionStartWell,
  ExecutionTraitRarity,
} from '../model';
import {
  array,
  booleanValue,
  exact,
  fail,
  integer,
  numberRecord,
  numberValue,
  object,
  oneOf,
  RARITY_UPGRADE_ORDER,
  stringArray,
  stringValue,
  type Dict,
} from './primitives';
import { hexGodSent, hexTreeNodes } from './rewards';

const BIOME_KEYS: readonly string[] = ['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'];
const TRAIT_RARITIES: readonly string[] = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'];
const MAX_STAT_SOURCE_KINDS: readonly string[] = ['trait', 'arcana', 'keepsake'];
const WELL_CLOCKS: readonly string[] = ['encounters', 'rooms', 'bosses'];
/** Room history grows by one record per departed room, Hub returns included. */
const MAX_ROOM_HISTORY = 1024;

function record(value: unknown, label: string, required: string[], optional: string[] = []): Dict {
  const result = object(value, label);
  exact(result, required, optional, label);
  return result;
}

/** An optional field that is present only as `true`. */
function presentTrue(value: unknown, label: string): { readonly flag?: true } {
  if (value === undefined) return {};
  if (value !== true) fail(`${label} must be true when present`);
  return { flag: true };
}

function optional<K extends string, V>(
  key: K,
  value: unknown,
  decode: (value: unknown) => V,
): { readonly [P in K]?: V } {
  return (value === undefined ? {} : { [key]: decode(value) }) as { readonly [P in K]?: V };
}

function flag<K extends string>(
  key: K,
  value: unknown,
  label: string,
): { readonly [P in K]?: true } {
  return (presentTrue(value, label).flag === true ? { [key]: true } : {}) as {
    readonly [P in K]?: true;
  };
}

function uniqueNames<T extends { readonly name: string }>(rows: readonly T[], label: string): void {
  if (new Set(rows.map((row) => row.name)).size !== rows.length)
    fail(`${label} contains a duplicate name`);
}

function traitRow(value: unknown, label: string): ExecutionStartTrait {
  const row = record(
    value,
    label,
    ['name'],
    [
      'rarity',
      'stackNum',
      'blockInRunRarify',
      'upgradedTraitName',
      'selectedTrait',
      'grantedTrait',
      'repeatedKeepsake',
      'currentRoom',
      'roomsPerUpgradeAmount',
      'roomsPerUpgradeMaxMana',
      'echoIncreaseStats',
      'durationHammerUses',
    ],
  );
  return Object.freeze({
    name: stringValue(row.name, `${label}.name`),
    ...optional('rarity', row.rarity, (entry) =>
      oneOf<ExecutionTraitRarity>(entry, TRAIT_RARITIES, `${label}.rarity`),
    ),
    ...optional('stackNum', row.stackNum, (entry) => integer(entry, `${label}.stackNum`, 1)),
    ...flag('blockInRunRarify', row.blockInRunRarify, `${label}.blockInRunRarify`),
    ...optional('upgradedTraitName', row.upgradedTraitName, (entry) =>
      stringValue(entry, `${label}.upgradedTraitName`),
    ),
    ...optional('selectedTrait', row.selectedTrait, (entry) =>
      stringValue(entry, `${label}.selectedTrait`),
    ),
    ...flag('grantedTrait', row.grantedTrait, `${label}.grantedTrait`),
    ...optional('repeatedKeepsake', row.repeatedKeepsake, (entry) =>
      stringValue(entry, `${label}.repeatedKeepsake`),
    ),
    ...optional('currentRoom', row.currentRoom, (entry) => integer(entry, `${label}.currentRoom`)),
    ...optional('roomsPerUpgradeAmount', row.roomsPerUpgradeAmount, (entry) =>
      integer(entry, `${label}.roomsPerUpgradeAmount`, 1),
    ),
    ...optional('roomsPerUpgradeMaxMana', row.roomsPerUpgradeMaxMana, (entry) =>
      numberValue(entry, `${label}.roomsPerUpgradeMaxMana`),
    ),
    ...optional('echoIncreaseStats', row.echoIncreaseStats, (entry) => {
      const stats = record(entry, `${label}.echoIncreaseStats`, [
        'statMultiplier',
        'blockDecay',
        'startMaxHealth',
        'startMaxMana',
      ]);
      return Object.freeze({
        statMultiplier: numberValue(
          stats.statMultiplier,
          `${label}.echoIncreaseStats.statMultiplier`,
        ),
        blockDecay: booleanValue(stats.blockDecay, `${label}.echoIncreaseStats.blockDecay`),
        startMaxHealth: numberValue(
          stats.startMaxHealth,
          `${label}.echoIncreaseStats.startMaxHealth`,
        ),
        startMaxMana: numberValue(stats.startMaxMana, `${label}.echoIncreaseStats.startMaxMana`),
      });
    }),
    ...optional('durationHammerUses', row.durationHammerUses, (entry) =>
      integer(entry, `${label}.durationHammerUses`, 1),
    ),
  });
}

function blessing(
  value: unknown,
  label: string,
): {
  name: string;
  rarity: ExecutionTraitRarity;
  blessingValues: Readonly<Record<string, number>>;
} {
  const row = object(value, label);
  return {
    name: stringValue(row.name, `${label}.name`),
    rarity: oneOf<ExecutionTraitRarity>(row.rarity, TRAIT_RARITIES, `${label}.rarity`),
    blessingValues: numberRecord(row.blessingValues, `${label}.blessingValues`),
  };
}

function chaosCurse(value: unknown, label: string): ExecutionStartChaosCurse {
  const row = record(value, label, ['name', 'remainingUses', 'curseValues', 'blessing']);
  const blessed = record(row.blessing, `${label}.blessing`, ['name', 'rarity', 'blessingValues']);
  return Object.freeze({
    name: stringValue(row.name, `${label}.name`),
    remainingUses: integer(row.remainingUses, `${label}.remainingUses`, 1),
    curseValues: numberRecord(row.curseValues, `${label}.curseValues`),
    blessing: Object.freeze(blessing(blessed, `${label}.blessing`)),
  });
}

function chaosBlessing(value: unknown, label: string): ExecutionStartChaosBlessing {
  const row = record(value, label, ['name', 'rarity', 'blessingValues'], ['fromChaosKeepsake']);
  return Object.freeze({
    ...blessing(row, label),
    ...flag('fromChaosKeepsake', row.fromChaosKeepsake, `${label}.fromChaosKeepsake`),
  });
}

function keepsakeTrait(value: unknown, label: string): ExecutionStartKeepsakeTrait {
  const row = record(
    value,
    label,
    ['name', 'rarity'],
    [
      'slotted',
      'remainingUses',
      'uses',
      'rarityUpgradeUses',
      'boonConversionUses',
      'currentKeepsakeDamageBonus',
      'escalatingKeepsakeValue',
      'currentRoom',
    ],
  );
  const count = (key: string) =>
    optional(key, row[key], (entry) => integer(entry, `${label}.${key}`));
  const multiplier = (key: string) =>
    optional(key, row[key], (entry) => numberValue(entry, `${label}.${key}`));
  return Object.freeze({
    name: stringValue(row.name, `${label}.name`),
    rarity: oneOf<ExecutionKeepsakeRarity>(row.rarity, RARITY_UPGRADE_ORDER, `${label}.rarity`),
    ...flag('slotted', row.slotted, `${label}.slotted`),
    ...count('remainingUses'),
    ...count('uses'),
    ...count('rarityUpgradeUses'),
    ...count('boonConversionUses'),
    ...multiplier('currentKeepsakeDamageBonus'),
    ...multiplier('escalatingKeepsakeValue'),
    ...count('currentRoom'),
  });
}

function keepsake(value: unknown, label: string): ExecutionStartKeepsake {
  const row = record(
    value,
    label,
    ['keepsakeCache', 'blockedKeepsakes', 'traits'],
    ['persistentDionysusSkip'],
  );
  const traits = Object.freeze(
    array(row.traits, `${label}.traits`).map((entry, index) =>
      keepsakeTrait(entry, `${label}.traits[${index}]`),
    ),
  );
  uniqueNames(traits, `${label}.traits`);
  if (traits.filter((trait) => trait.slotted === true).length > 1)
    fail(`${label}.traits holds more than one slotted keepsake`);
  return Object.freeze({
    keepsakeCache: Object.freeze(stringArray(row.keepsakeCache, `${label}.keepsakeCache`)),
    blockedKeepsakes: Object.freeze(stringArray(row.blockedKeepsakes, `${label}.blockedKeepsakes`)),
    traits,
    ...optional('persistentDionysusSkip', row.persistentDionysusSkip, (entry) => {
      const skip = record(entry, `${label}.persistentDionysusSkip`, ['remainingUses']);
      return Object.freeze({
        remainingUses: integer(skip.remainingUses, `${label}.persistentDionysusSkip.remainingUses`),
      });
    }),
  });
}

function arcanaCard(value: unknown, label: string): ExecutionStartArcanaCard {
  const row = record(
    value,
    label,
    ['name', 'rarity'],
    ['temporary', 'currentRoom', 'metaConversionUses'],
  );
  return Object.freeze({
    name: stringValue(row.name, `${label}.name`),
    rarity: oneOf<ExecutionKeepsakeRarity>(row.rarity, RARITY_UPGRADE_ORDER, `${label}.rarity`),
    ...flag('temporary', row.temporary, `${label}.temporary`),
    ...optional('currentRoom', row.currentRoom, (entry) => integer(entry, `${label}.currentRoom`)),
    ...optional('metaConversionUses', row.metaConversionUses, (entry) =>
      integer(entry, `${label}.metaConversionUses`),
    ),
  });
}

function maxStatSource(value: unknown, label: string): ExecutionMaxStatSource {
  const row = object(value, label);
  if (row.kind === 'pickups') {
    exact(row, ['kind'], [], label);
    return Object.freeze({ kind: 'pickups' });
  }
  exact(row, ['kind', 'key'], [], label);
  return Object.freeze({
    kind: oneOf<Exclude<ExecutionMaxStatSource['kind'], 'pickups'>>(
      row.kind,
      MAX_STAT_SOURCE_KINDS,
      `${label}.kind`,
    ),
    key: stringValue(row.key, `${label}.key`),
  });
}

function maxStats(value: unknown, label: string): ExecutionStartState['maxStats'] {
  const row = record(value, label, ['maxHealth', 'maxMana', 'hiddenGrants']);
  return Object.freeze({
    maxHealth: integer(row.maxHealth, `${label}.maxHealth`, 1),
    maxMana: integer(row.maxMana, `${label}.maxMana`),
    hiddenGrants: Object.freeze(
      array(row.hiddenGrants, `${label}.hiddenGrants`).map((entry, index) => {
        const grantLabel = `${label}.hiddenGrants[${index}]`;
        const grant = record(entry, grantLabel, ['source', 'maxHealth', 'maxMana']);
        return Object.freeze({
          source: maxStatSource(grant.source, `${grantLabel}.source`),
          maxHealth: numberValue(grant.maxHealth, `${grantLabel}.maxHealth`),
          maxMana: numberValue(grant.maxMana, `${grantLabel}.maxMana`),
        });
      }),
    ),
  });
}

function well(value: unknown, label: string): ExecutionStartWell {
  const row = record(value, label, [
    'timedTraits',
    'sparkUses',
    'yarnUses',
    'hymnUses',
    'extendedUses',
    'wellShopPurchases',
  ]);
  const uses = (key: string) => integer(row[key], `${label}.${key}`);
  const purchases = numberRecord(row.wellShopPurchases, `${label}.wellShopPurchases`);
  for (const [key, entry] of Object.entries(purchases))
    integer(entry, `${label}.wellShopPurchases.${key}`, 1);
  return Object.freeze({
    timedTraits: Object.freeze(
      array(row.timedTraits, `${label}.timedTraits`).map((entry, index) => {
        const timedLabel = `${label}.timedTraits[${index}]`;
        const timed = record(entry, timedLabel, ['name', 'clock', 'remainingUses']);
        return Object.freeze({
          name: stringValue(timed.name, `${timedLabel}.name`),
          clock: oneOf<ExecutionStartWell['timedTraits'][number]['clock']>(
            timed.clock,
            WELL_CLOCKS,
            `${timedLabel}.clock`,
          ),
          remainingUses: integer(timed.remainingUses, `${timedLabel}.remainingUses`, 1),
        });
      }),
    ),
    sparkUses: uses('sparkUses'),
    yarnUses: uses('yarnUses'),
    hymnUses: uses('hymnUses'),
    extendedUses: uses('extendedUses'),
    wellShopPurchases: purchases,
  });
}

function hex(value: unknown, label: string): ExecutionStartHex {
  const row = record(
    value,
    label,
    ['spellTraitName', 'investedNodes', 'talentPoints', 'allSpellInvested'],
    ['tree'],
  );
  const investedNodes = stringArray(row.investedNodes, `${label}.investedNodes`);
  if (
    new Set(investedNodes).size !== investedNodes.length ||
    investedNodes.some((node) => !/^[1-9][0-9]*:[0-9]+$/.test(node))
  )
    fail(`${label}.investedNodes must be distinct node keys`);
  return Object.freeze({
    spellTraitName: stringValue(row.spellTraitName, `${label}.spellTraitName`),
    ...optional('tree', row.tree, (entry) => {
      const tree = record(entry, `${label}.tree`, ['layoutKey', 'nodes'], ['godSent']);
      const nodes = hexTreeNodes(tree.nodes, `${label}.tree.nodes`);
      const godSent = hexGodSent(tree.godSent, nodes, `${label}.tree.godSent`);
      return Object.freeze({
        layoutKey: stringValue(tree.layoutKey, `${label}.tree.layoutKey`),
        nodes,
        ...(godSent === undefined ? {} : { godSent }),
      });
    }),
    investedNodes: Object.freeze(investedNodes),
    talentPoints: integer(row.talentPoints, `${label}.talentPoints`),
    allSpellInvested: booleanValue(row.allSpellInvested, `${label}.allSpellInvested`),
  });
}

function elementEssences(value: unknown, label: string): ExecutionStartEssences {
  const row = record(value, label, ['Fire', 'Air', 'Earth', 'Water']);
  return Object.freeze({
    Fire: integer(row.Fire, `${label}.Fire`),
    Air: integer(row.Air, `${label}.Air`),
    Earth: integer(row.Earth, `${label}.Earth`),
    Water: integer(row.Water, `${label}.Water`),
  });
}

function biome(value: unknown, label: string): ExecutionStartBiome {
  const row = record(
    value,
    label,
    [
      'biomeDepthCache',
      'biomeEncounterDepth',
      'biomeUseRecord',
      'forfeitConsumed',
      'dionysusSkipActivated',
    ],
    ['clockwork'],
  );
  return Object.freeze({
    biomeDepthCache: integer(row.biomeDepthCache, `${label}.biomeDepthCache`),
    biomeEncounterDepth: integer(row.biomeEncounterDepth, `${label}.biomeEncounterDepth`),
    biomeUseRecord: numberRecord(row.biomeUseRecord, `${label}.biomeUseRecord`),
    forfeitConsumed: booleanValue(row.forfeitConsumed, `${label}.forfeitConsumed`),
    dionysusSkipActivated: booleanValue(
      row.dionysusSkipActivated,
      `${label}.dionysusSkipActivated`,
    ),
    ...optional('clockwork', row.clockwork, (entry) => {
      const clockwork = record(entry, `${label}.clockwork`, [
        'remainingClockworkGoals',
        'maxClockworkNonGoalRewards',
      ]);
      return Object.freeze({
        remainingClockworkGoals: integer(
          clockwork.remainingClockworkGoals,
          `${label}.clockwork.remainingClockworkGoals`,
        ),
        maxClockworkNonGoalRewards: integer(
          clockwork.maxClockworkNonGoalRewards,
          `${label}.clockwork.maxClockworkNonGoalRewards`,
        ),
      });
    }),
  });
}

function list<T>(
  value: unknown,
  label: string,
  decode: (entry: unknown, label: string) => T,
  max?: number,
) {
  return Object.freeze(
    array(value, label, max).map((entry, index) => decode(entry, `${label}[${index}]`)),
  );
}

/** Strict decoding of the closed mid-run start section; references are validated with the graph. */
export function startState(value: unknown): ExecutionStartState {
  const label = 'execution plan.startState';
  const row = record(
    value,
    label,
    [
      'point',
      'biomeKey',
      'occurrenceId',
      'roomName',
      'gold',
      'biomeVisitOrder',
      'roomHistory',
      'encounterDepth',
      'aspectPerfect',
      'traits',
      'elementEssences',
      'chaosCurses',
      'chaosBlessings',
      'keepsake',
      'arcana',
      'arcanaBarren',
      'disabledVows',
      'maxStats',
      'stygianWell',
      'hermesDeliveries',
      'rewardPriorities',
      'useRecord',
      'lootTypeHistory',
      'consumableRecord',
      'rewardStores',
    ],
    ['lastDevotionDepth', 'biome', 'familiar', 'hex'],
  );
  const traits = list(row.traits, `${label}.traits`, traitRow);
  uniqueNames(traits, `${label}.traits`);
  const arcana = list(row.arcana, `${label}.arcana`, arcanaCard);
  uniqueNames(arcana, `${label}.arcana`);
  return Object.freeze({
    point: oneOf<ExecutionStartState['point']>(row.point, ['opening', 'preboss'], `${label}.point`),
    biomeKey: oneOf<ExecutionBiomeKey>(row.biomeKey, BIOME_KEYS, `${label}.biomeKey`),
    occurrenceId: stringValue(row.occurrenceId, `${label}.occurrenceId`),
    roomName: stringValue(row.roomName, `${label}.roomName`),
    gold: integer(row.gold, `${label}.gold`),
    biomeVisitOrder: Object.freeze(stringArray(row.biomeVisitOrder, `${label}.biomeVisitOrder`, 4)),
    roomHistory: list(
      row.roomHistory,
      `${label}.roomHistory`,
      (entry, entryLabel) => {
        const room = record(entry, entryLabel, ['name'], ['nextRoomSet']);
        return Object.freeze({
          name: stringValue(room.name, `${entryLabel}.name`),
          ...flag('nextRoomSet', room.nextRoomSet, `${entryLabel}.nextRoomSet`),
        });
      },
      MAX_ROOM_HISTORY,
    ),
    encounterDepth: integer(row.encounterDepth, `${label}.encounterDepth`),
    ...optional('lastDevotionDepth', row.lastDevotionDepth, (entry) =>
      integer(entry, `${label}.lastDevotionDepth`, 1),
    ),
    ...optional('biome', row.biome, (entry) => biome(entry, `${label}.biome`)),
    aspectPerfect: booleanValue(row.aspectPerfect, `${label}.aspectPerfect`),
    ...optional('familiar', row.familiar, (entry) => {
      const familiar = record(entry, `${label}.familiar`, ['name', 'stackMultiplier']);
      return Object.freeze({
        name: stringValue(familiar.name, `${label}.familiar.name`),
        stackMultiplier: integer(familiar.stackMultiplier, `${label}.familiar.stackMultiplier`, 1),
      });
    }),
    traits,
    elementEssences: elementEssences(row.elementEssences, `${label}.elementEssences`),
    chaosCurses: list(row.chaosCurses, `${label}.chaosCurses`, chaosCurse),
    chaosBlessings: list(row.chaosBlessings, `${label}.chaosBlessings`, chaosBlessing),
    keepsake: keepsake(row.keepsake, `${label}.keepsake`),
    arcana,
    arcanaBarren: booleanValue(row.arcanaBarren, `${label}.arcanaBarren`),
    disabledVows: Object.freeze(stringArray(row.disabledVows, `${label}.disabledVows`)),
    maxStats: maxStats(row.maxStats, `${label}.maxStats`),
    stygianWell: well(row.stygianWell, `${label}.stygianWell`),
    hermesDeliveries: list(
      row.hermesDeliveries,
      `${label}.hermesDeliveries`,
      (entry, entryLabel) => {
        const delivery = record(entry, entryLabel, ['rewardType', 'remainingUses']);
        return Object.freeze({
          rewardType: stringValue(delivery.rewardType, `${entryLabel}.rewardType`),
          remainingUses: integer(delivery.remainingUses, `${entryLabel}.remainingUses`),
        });
      },
    ),
    ...optional('hex', row.hex, (entry) => hex(entry, `${label}.hex`)),
    rewardPriorities: Object.freeze(stringArray(row.rewardPriorities, `${label}.rewardPriorities`)),
    useRecord: numberRecord(row.useRecord, `${label}.useRecord`),
    lootTypeHistory: numberRecord(row.lootTypeHistory, `${label}.lootTypeHistory`),
    consumableRecord: numberRecord(row.consumableRecord, `${label}.consumableRecord`),
    rewardStores: list(row.rewardStores, `${label}.rewardStores`, (entry, entryLabel) => {
      const store = record(entry, entryLabel, ['name', 'remainingEntryCounts']);
      return Object.freeze({
        name: stringValue(store.name, `${entryLabel}.name`),
        remainingEntryCounts: Object.freeze(
          array(store.remainingEntryCounts, `${entryLabel}.remainingEntryCounts`).map(
            (count, index) => integer(count, `${entryLabel}.remainingEntryCounts[${index}]`),
          ),
        ),
      });
    }),
  });
}
