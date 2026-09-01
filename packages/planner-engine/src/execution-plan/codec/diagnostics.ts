import type { ExecutionRunStateDiagnostic } from '../model';
import {
  array,
  booleanValue,
  count,
  exact,
  fail,
  integer,
  MAX_ITEMS,
  numberRecord,
  object,
  stringArray,
  stringValue,
  stableJson,
  type Dict,
} from './primitives';

export function runState(value: unknown, label: string): ExecutionRunStateDiagnostic {
  const record = object(value, label);
  exact(
    record,
    [
      'owner',
      'checkpoint',
      'counters',
      'bags',
      'godPool',
      'traits',
      'arcana',
      'vows',
      'forfeit',
      'chaos',
      'keepsakes',
      'rewardPriorities',
      'hexProgress',
      'artificer',
    ],
    [],
    label,
  );
  if (record.checkpoint !== 'roomEntered' && record.checkpoint !== 'beforeRoomExit')
    fail(`${label}.checkpoint is unsupported`);
  const counters = object(record.counters, `${label}.counters`);
  exact(
    counters,
    ['biomeDepthCache', 'biomeEncounterDepth', 'routeEncounterDepth', 'roomHistoryOrdinal'],
    [],
    `${label}.counters`,
  );
  const bags = array(record.bags, `${label}.bags`).map((entry, index) => {
    const row = object(entry, `${label}.bags[${index}]`);
    exact(row, ['storeKey', 'remaining'], [], `${label}.bags[${index}]`);
    return Object.freeze({
      storeKey: stringValue(row.storeKey, `${label}.bags[${index}].storeKey`),
      remaining: count(row.remaining, `${label}.bags[${index}].remaining`),
    });
  });
  const godPool = object(record.godPool, `${label}.godPool`);
  exact(
    godPool,
    ['acquiredSourceKeys', 'effectiveSourceKeys', 'capNarrowed'],
    [],
    `${label}.godPool`,
  );
  const traits = object(record.traits, `${label}.traits`);
  exact(
    traits,
    ['equipped', 'slots', 'elements', 'godRarityCounts', 'upgradableCount', 'bannedTraitKeys'],
    [],
    `${label}.traits`,
  );
  const equipped = array(traits.equipped, `${label}.traits.equipped`).map((entry, index) => {
    const row = object(entry, `${label}.traits.equipped[${index}]`);
    exact(
      row,
      ['traitKey'],
      ['rarity', 'level', 'hammerRank'],
      `${label}.traits.equipped[${index}]`,
    );
    if (row.hammerRank !== undefined && row.hammerRank !== 'RankI' && row.hammerRank !== 'RankII')
      fail(`${label}.traits.equipped[${index}].hammerRank is unsupported`);
    return Object.freeze({
      traitKey: stringValue(row.traitKey, `${label}.traits.equipped[${index}].traitKey`),
      ...(row.rarity === undefined
        ? {}
        : { rarity: stringValue(row.rarity, `${label}.traits.equipped[${index}].rarity`) }),
      ...(row.level === undefined
        ? {}
        : { level: integer(row.level, `${label}.traits.equipped[${index}].level`) }),
      ...(row.hammerRank === undefined ? {} : { hammerRank: row.hammerRank as 'RankI' | 'RankII' }),
    });
  });
  const slots = array(traits.slots, `${label}.traits.slots`, 6).map((entry, index) => {
    const row = object(entry, `${label}.traits.slots[${index}]`);
    exact(row, ['slot'], ['traitKey'], `${label}.traits.slots[${index}]`);
    if (!['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'].includes(row.slot as string))
      fail(`${label}.traits.slots[${index}].slot is unsupported`);
    return Object.freeze({
      slot: row.slot as 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell',
      ...(row.traitKey === undefined
        ? {}
        : { traitKey: stringValue(row.traitKey, `${label}.traits.slots[${index}].traitKey`) }),
    });
  });
  const arcana = object(record.arcana, `${label}.arcana`);
  exact(arcana, ['active'], [], `${label}.arcana`);
  const activeArcana = array(arcana.active, `${label}.arcana.active`).map((entry, index) => {
    const row = object(entry, `${label}.arcana.active[${index}]`);
    exact(row, ['key', 'origin', 'rarity'], [], `${label}.arcana.active[${index}]`);
    if (
      !['manual', 'automatic', 'temporary'].includes(row.origin as string) ||
      !['Common', 'Rare', 'Epic', 'Heroic'].includes(row.rarity as string)
    )
      fail(`${label}.arcana.active[${index}] contains unsupported values`);
    return Object.freeze({
      key: stringValue(row.key, `${label}.arcana.active[${index}].key`),
      origin: row.origin as 'manual' | 'automatic' | 'temporary',
      rarity: row.rarity as 'Common' | 'Rare' | 'Epic' | 'Heroic',
    });
  });
  const vows = object(record.vows, `${label}.vows`);
  exact(vows, ['configuredRanks', 'effectiveRanks', 'disabledKeys'], [], `${label}.vows`);
  const chaos = object(record.chaos, `${label}.chaos`);
  exact(chaos, ['active', 'matured'], [], `${label}.chaos`);
  const activeChaos = array(chaos.active, `${label}.chaos.active`).map((entry, index) => {
    const row = object(entry, `${label}.chaos.active[${index}]`);
    exact(
      row,
      ['curseKey', 'blessingKey', 'rarity', 'clock', 'remaining'],
      [],
      `${label}.chaos.active[${index}]`,
    );
    if (!['encounters', 'locations', 'godBoonScreens'].includes(row.clock as string))
      fail(`${label}.chaos.active[${index}].clock is unsupported`);
    return Object.freeze({
      curseKey: stringValue(row.curseKey, `${label}.chaos.active[${index}].curseKey`),
      blessingKey: stringValue(row.blessingKey, `${label}.chaos.active[${index}].blessingKey`),
      rarity: stringValue(row.rarity, `${label}.chaos.active[${index}].rarity`),
      clock: row.clock as 'encounters' | 'locations' | 'godBoonScreens',
      remaining: integer(row.remaining, `${label}.chaos.active[${index}].remaining`),
    });
  });
  const matured = array(chaos.matured, `${label}.chaos.matured`).map((entry, index) => {
    const row = object(entry, `${label}.chaos.matured[${index}]`);
    exact(row, ['blessingKey', 'rarity'], [], `${label}.chaos.matured[${index}]`);
    return Object.freeze({
      blessingKey: stringValue(row.blessingKey, `${label}.chaos.matured[${index}].blessingKey`),
      rarity: stringValue(row.rarity, `${label}.chaos.matured[${index}].rarity`),
    });
  });
  const keepsakes = object(record.keepsakes, `${label}.keepsakes`);
  exact(
    keepsakes,
    ['currentKey', 'usedKeys', 'blockedKeys', 'fatedStatus'],
    [],
    `${label}.keepsakes`,
  );
  if (!['Unknown', 'Fated', 'Unfated'].includes(keepsakes.fatedStatus as string))
    fail(`${label}.keepsakes.fatedStatus is unsupported`);
  const hex = object(record.hexProgress, `${label}.hexProgress`);
  exact(
    hex,
    ['talentKeys', 'closed', 'bankedPathPoints', 'investedPathPoints'],
    ['spellTraitKey', 'layoutKey'],
    `${label}.hexProgress`,
  );
  const artificer =
    record.artificer === null ? null : object(record.artificer, `${label}.artificer`);
  if (artificer !== null)
    exact(artificer, ['usedCount', 'remainingCount'], [], `${label}.artificer`);
  return Object.freeze({
    owner: stringValue(record.owner, `${label}.owner`, 256),
    checkpoint: record.checkpoint as 'roomEntered' | 'beforeRoomExit',
    counters: Object.freeze({
      biomeDepthCache: integer(counters.biomeDepthCache, `${label}.counters.biomeDepthCache`),
      biomeEncounterDepth: integer(
        counters.biomeEncounterDepth,
        `${label}.counters.biomeEncounterDepth`,
      ),
      routeEncounterDepth: integer(
        counters.routeEncounterDepth,
        `${label}.counters.routeEncounterDepth`,
      ),
      roomHistoryOrdinal: integer(
        counters.roomHistoryOrdinal,
        `${label}.counters.roomHistoryOrdinal`,
      ),
    }),
    bags: Object.freeze(bags),
    godPool: Object.freeze({
      acquiredSourceKeys: Object.freeze(
        stringArray(godPool.acquiredSourceKeys, `${label}.godPool.acquiredSourceKeys`),
      ),
      effectiveSourceKeys: Object.freeze(
        stringArray(godPool.effectiveSourceKeys, `${label}.godPool.effectiveSourceKeys`),
      ),
      capNarrowed: booleanValue(godPool.capNarrowed, `${label}.godPool.capNarrowed`),
    }),
    traits: Object.freeze({
      equipped: Object.freeze(equipped),
      slots: Object.freeze(slots),
      elements: numberRecord(traits.elements, `${label}.traits.elements`),
      godRarityCounts: numberRecord(traits.godRarityCounts, `${label}.traits.godRarityCounts`),
      upgradableCount: integer(traits.upgradableCount, `${label}.traits.upgradableCount`),
      bannedTraitKeys: Object.freeze(
        stringArray(traits.bannedTraitKeys, `${label}.traits.bannedTraitKeys`),
      ),
    }),
    arcana: Object.freeze({ active: Object.freeze(activeArcana) }),
    vows: Object.freeze({
      configuredRanks: numberRecord(vows.configuredRanks, `${label}.vows.configuredRanks`),
      effectiveRanks: numberRecord(vows.effectiveRanks, `${label}.vows.effectiveRanks`),
      disabledKeys: Object.freeze(stringArray(vows.disabledKeys, `${label}.vows.disabledKeys`)),
    }),
    forfeit: (() => {
      if (!['inactive', 'available', 'consumed'].includes(record.forfeit as string))
        fail(`${label}.forfeit is unsupported`);
      return record.forfeit as 'inactive' | 'available' | 'consumed';
    })(),
    chaos: Object.freeze({ active: Object.freeze(activeChaos), matured: Object.freeze(matured) }),
    keepsakes: Object.freeze({
      currentKey: stringValue(keepsakes.currentKey, `${label}.keepsakes.currentKey`),
      usedKeys: Object.freeze(stringArray(keepsakes.usedKeys, `${label}.keepsakes.usedKeys`)),
      blockedKeys: Object.freeze(
        stringArray(keepsakes.blockedKeys, `${label}.keepsakes.blockedKeys`),
      ),
      fatedStatus: keepsakes.fatedStatus as 'Unknown' | 'Fated' | 'Unfated',
    }),
    rewardPriorities: Object.freeze(
      stringArray(record.rewardPriorities, `${label}.rewardPriorities`),
    ),
    hexProgress: Object.freeze({
      ...(hex.spellTraitKey === undefined
        ? {}
        : { spellTraitKey: stringValue(hex.spellTraitKey, `${label}.hexProgress.spellTraitKey`) }),
      ...(hex.layoutKey === undefined
        ? {}
        : { layoutKey: stringValue(hex.layoutKey, `${label}.hexProgress.layoutKey`) }),
      talentKeys: Object.freeze(stringArray(hex.talentKeys, `${label}.hexProgress.talentKeys`)),
      closed: booleanValue(hex.closed, `${label}.hexProgress.closed`),
      bankedPathPoints: integer(hex.bankedPathPoints, `${label}.hexProgress.bankedPathPoints`),
      investedPathPoints: integer(
        hex.investedPathPoints,
        `${label}.hexProgress.investedPathPoints`,
      ),
    }),
    artificer:
      artificer === null
        ? null
        : Object.freeze({
            usedCount: integer(artificer.usedCount, `${label}.artificer.usedCount`),
            remainingCount: integer(artificer.remainingCount, `${label}.artificer.remainingCount`),
          }),
  });
}

export const diagnosticSections = [
  'counters',
  'bags',
  'godPool',
  'traits',
  'arcana',
  'vows',
  'forfeit',
  'chaos',
  'keepsakes',
  'rewardPriorities',
  'hexProgress',
  'artificer',
] as const;

export function expandDiagnosticFrames(value: unknown): Dict {
  const record = object(value, 'execution plan');
  const rawOccurrences = array(record.occurrences, 'execution plan.occurrences', MAX_ITEMS);
  let expectedFrame = 0;
  let prior: Dict | undefined;
  const occurrences = rawOccurrences.map((occurrenceValue, occurrenceIndex) => {
    const occurrenceRecord = object(occurrenceValue, `occurrences[${occurrenceIndex}]`);
    if (occurrenceRecord.diagnostics === undefined) return occurrenceRecord;
    const diagnostics = object(
      occurrenceRecord.diagnostics,
      `occurrences[${occurrenceIndex}].diagnostics`,
    );
    exact(
      diagnostics,
      [],
      ['roomEntered', 'beforeRoomExit'],
      `occurrences[${occurrenceIndex}].diagnostics`,
    );
    const expanded: Dict = {};
    for (const checkpoint of ['roomEntered', 'beforeRoomExit'] as const) {
      const raw = diagnostics[checkpoint];
      if (raw === undefined) continue;
      const row = object(raw, `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}`);
      if (!('frame' in row)) {
        const state = runState(row, `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}`);
        prior = Object.fromEntries(
          diagnosticSections.map((section) => [section, (state as unknown as Dict)[section]]),
        );
        expanded[checkpoint] = state;
        continue;
      }
      exact(
        row,
        ['frame', 'owner', 'checkpoint', 'replace'],
        [],
        `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}`,
      );
      const frame = integer(
        row.frame,
        `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}.frame`,
      );
      if (frame !== expectedFrame)
        fail(`occurrences[${occurrenceIndex}].diagnostics.${checkpoint} frame is not sequential`);
      expectedFrame += 1;
      if (row.checkpoint !== checkpoint)
        fail(`occurrences[${occurrenceIndex}].diagnostics.${checkpoint} checkpoint disagrees`);
      const owner = stringValue(
        row.owner,
        `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}.owner`,
        256,
      );
      const replace = object(
        row.replace,
        `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}.replace`,
      );
      for (const key of Object.keys(replace))
        if (!diagnosticSections.includes(key as (typeof diagnosticSections)[number]))
          fail(
            `occurrences[${occurrenceIndex}].diagnostics.${checkpoint}.replace has unknown field ${key}`,
          );
      if (frame === 0 && diagnosticSections.some((section) => !(section in replace)))
        fail(
          `occurrences[${occurrenceIndex}].diagnostics.${checkpoint} frame zero must replace every diagnostic section`,
        );
      if (frame !== 0 && prior === undefined)
        fail(`occurrences[${occurrenceIndex}].diagnostics.${checkpoint} has no prior frame`);
      prior = { ...prior, ...replace };
      if (diagnosticSections.some((section) => !(section in prior!)))
        fail(
          `occurrences[${occurrenceIndex}].diagnostics.${checkpoint} does not establish complete state`,
        );
      expanded[checkpoint] = Object.freeze({
        owner,
        checkpoint,
        ...prior,
      });
    }
    return Object.freeze({ ...occurrenceRecord, diagnostics: Object.freeze(expanded) });
  });
  return { ...record, occurrences: Object.freeze(occurrences) };
}

export function wireDiagnostic(
  state: ExecutionRunStateDiagnostic,
  frame: number,
  prior: Dict | undefined,
): Dict {
  const source = state as unknown as Dict;
  const replace: Dict = {};
  for (const section of diagnosticSections) {
    if (frame === 0 || stableJson(source[section]) !== stableJson(prior?.[section]))
      replace[section] = source[section];
  }
  return { frame, owner: state.owner, checkpoint: state.checkpoint, replace };
}
