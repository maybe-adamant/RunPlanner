import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionPlan,
  type ExecutionRoom,
  type ExecutionTraceStep,
  type ExecutionRunStateDiagnostic,
  type ExecutionKeepsakeEquipResults,
} from './model';

export class ExecutionPlanCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionPlanCodecError';
  }
}
function fail(message: string): never {
  throw new ExecutionPlanCodecError(message);
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be a bounded non-empty string`);
  if (value.length === 0 || value.length > 512) fail(`${label} must be a bounded non-empty string`);
  return value;
}
function integer(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== 'number') fail(`${label} must be an integer in range`);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    fail(`${label} must be an integer in range`);
  return value;
}
function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(`${label} must be a finite number`);
  return value;
}
function booleanValue(value: unknown, label: string): boolean {
  if (value !== true && value !== false) fail(`${label} must be boolean`);
  return value;
}
function array(value: unknown, label: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be a bounded array`);
  if (value.length > maximum) fail(`${label} must be a bounded array`);
  return value;
}
function exact(
  value: Record<string, unknown>,
  required: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  for (const key of required) if (!(key in value)) fail(`${label} is missing ${key}`);
  for (const key of Object.keys(value))
    if (!required.includes(key) && !optional.includes(key))
      fail(`${label} has unknown field ${key}`);
}
function strings(value: unknown, label: string, maximum: number, unique = true): readonly string[] {
  const entries = array(value, label, maximum).map((entry, index) =>
    stringValue(entry, `${label}[${index}]`),
  );
  if (unique && new Set(entries).size !== entries.length) fail(`${label} has duplicate values`);
  return Object.freeze(entries);
}
interface TraceContext {
  readonly owner: string;
  readonly roomId: string;
  readonly biomeKey: string;
  readonly phases: ReadonlyMap<string, { readonly encounterKey: string; readonly kind: string }>;
}
function addressParts(value: string, label: string): readonly unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return fail(`${label} must be a semantic address`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    return fail(`${label} must be a semantic address`);
  return parsed;
}
function exactAddressBase(
  parts: readonly unknown[],
  kind: string,
  length: number,
  context: TraceContext,
  label: string,
): void {
  if (
    parts.length !== length ||
    parts[0] !== kind ||
    parts[1] !== 'Underworld' ||
    parts[2] !== context.biomeKey
  )
    fail(`${label} is not a ${kind} address in this room`);
}
function occurrenceOwner(context: TraceContext): string {
  return JSON.stringify(['occurrence', 'Underworld', context.biomeKey, context.roomId]);
}
function validateEncounterAddress(value: string, context: TraceContext, label: string): string {
  const parts = addressParts(value, label);
  exactAddressBase(parts, 'encounterPhase', 5, context, label);
  const nestedOwner = object(parts[3], `${label} occurrence owner`);
  exact(nestedOwner, ['kind', 'occurrenceId'], `${label} occurrence owner`);
  if (nestedOwner.kind !== 'occurrence' || nestedOwner.occurrenceId !== context.roomId)
    fail(`${label} does not belong to this room`);
  const phase = stringValue(parts[4], `${label} phase`);
  if (!context.phases.has(phase)) fail(`${label} names an undeclared encounter phase`);
  return phase;
}
function validateSiteAddress(value: string, context: TraceContext, label: string): void {
  const parts = addressParts(value, label);
  exactAddressBase(parts, 'acquisitionSite', 5, context, label);
  const nestedOwner = stringValue(parts[3], `${label} owner`);
  const ownerParts = addressParts(nestedOwner, `${label} owner`);
  const ownerKind = ownerParts[0];
  if (ownerKind === 'occurrence') {
    if (nestedOwner !== occurrenceOwner(context)) fail(`${label} does not belong to this room`);
  } else if (ownerKind === 'localReward') {
    exactAddressBase(ownerParts, 'localReward', 6, context, `${label} owner`);
    if (ownerParts[3] !== context.roomId) fail(`${label} does not belong to this room`);
  } else if (ownerKind === 'encounterPhase') {
    validateEncounterAddress(nestedOwner, context, `${label} owner`);
  } else {
    fail(`${label} has an unsupported Gate C owner`);
  }
  stringValue(parts[4], `${label} point`);
}
function validateAcquisitionSource(value: string, context: TraceContext, label: string): void {
  const parts = addressParts(value, label);
  const kind = parts[0];
  if (kind === 'incomingReward') {
    exactAddressBase(parts, 'incomingReward', 4, context, label);
    if (parts[3] !== context.roomId) fail(`${label} does not belong to this room`);
    return;
  }
  if (kind === 'localReward') {
    exactAddressBase(parts, 'localReward', 6, context, label);
    if (parts[3] !== context.roomId) fail(`${label} does not belong to this room`);
    stringValue(parts[4], `${label} group`);
    stringValue(parts[5], `${label} slot`);
    return;
  }
  if (kind === 'encounterPhase') {
    validateEncounterAddress(value, context, label);
    return;
  }
  if (kind === 'gorgonPhase') {
    exactAddressBase(parts, 'gorgonPhase', 4, context, label);
    validateEncounterAddress(stringValue(parts[3], `${label} encounter`), context, label);
    return;
  }
  if (kind === 'acquisitionEntry') {
    exactAddressBase(parts, 'acquisitionEntry', 5, context, label);
    validateSiteAddress(stringValue(parts[3], `${label} site`), context, `${label} site`);
    stringValue(parts[4], `${label} entry`);
    return;
  }
  fail(`${label} has an unsupported Gate C source`);
}
function numbers(value: unknown, label: string): Readonly<Record<string, number>> {
  const source = object(value, label);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source))
    result[stringValue(key, `${label} key`)] = integer(entry, `${label}.${key}`);
  return Object.freeze(result);
}
function decimalNumbers(value: unknown, label: string): Readonly<Record<string, number>> {
  const source = object(value, label);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source))
    result[stringValue(key, `${label} key`)] = finiteNumber(entry, `${label}.${key}`);
  return Object.freeze(result);
}
function count(value: unknown, label: string) {
  const record = object(value, label);
  if (record.kind === 'exact') {
    exact(record, ['kind', 'count'], label);
    return Object.freeze({
      kind: 'exact' as const,
      count: integer(record.count, `${label}.count`),
    });
  }
  if (record.kind === 'range') {
    exact(record, ['kind', 'min', 'max'], label);
    const min = integer(record.min, `${label}.min`);
    const max = integer(record.max, `${label}.max`);
    if (min > max) fail(`${label}.min must not exceed max`);
    return Object.freeze({ kind: 'range' as const, min, max });
  }
  fail(`${label}.kind unsupported`);
}
function reward(value: unknown, label: string) {
  const record = object(value, label);
  exact(record, ['rewardType', 'producerLifecycleKey'], label, [
    'resolvedStoreKey',
    'source',
    'spurnedSource',
    'acquisitionEnabled',
  ]);
  return Object.freeze({
    rewardType: stringValue(record.rewardType, `${label}.rewardType`),
    producerLifecycleKey: stringValue(record.producerLifecycleKey, `${label}.producerLifecycleKey`),
    ...(record.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: stringValue(record.resolvedStoreKey, `${label}.resolvedStoreKey`) }),
    ...(record.source === undefined
      ? {}
      : { source: stringValue(record.source, `${label}.source`) }),
    ...(record.spurnedSource === undefined
      ? {}
      : { spurnedSource: stringValue(record.spurnedSource, `${label}.spurnedSource`) }),
    ...(record.acquisitionEnabled === undefined
      ? {}
      : {
          acquisitionEnabled: booleanValue(
            record.acquisitionEnabled,
            `${label}.acquisitionEnabled`,
          ),
        }),
  });
}
function diagnostic(value: unknown, label: string) {
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
    label,
  );
  if (record.checkpoint !== 'roomEntered' && record.checkpoint !== 'beforeRoomExit')
    fail(`${label}.checkpoint unsupported`);
  const counters = object(record.counters, `${label}.counters`);
  exact(
    counters,
    ['biomeDepthCache', 'biomeEncounterDepth', 'routeEncounterDepth', 'roomHistoryOrdinal'],
    `${label}.counters`,
  );
  const bags = array(record.bags, `${label}.bags`, 64).map((entry, index) => {
    const bag = object(entry, `${label}.bags[${index}]`);
    exact(bag, ['storeKey', 'remaining'], `${label}.bags[${index}]`);
    return Object.freeze({
      storeKey: stringValue(bag.storeKey, `${label}.bags[${index}].storeKey`),
      remaining: count(bag.remaining, `${label}.bags[${index}].remaining`),
    });
  });
  if (new Set(bags.map((bag) => bag.storeKey)).size !== bags.length)
    fail(`${label}.bags has duplicate stores`);
  const godPool = object(record.godPool, `${label}.godPool`);
  exact(godPool, ['acquiredSourceKeys', 'effectiveSourceKeys', 'capNarrowed'], `${label}.godPool`);
  const traits = object(record.traits, `${label}.traits`);
  exact(
    traits,
    ['equipped', 'slots', 'elements', 'godRarityCounts', 'upgradableCount', 'bannedTraitKeys'],
    `${label}.traits`,
  );
  const equipped = array(traits.equipped, `${label}.traits.equipped`, 128).map((entry, index) => {
    const trait = object(entry, `${label}.traits.equipped[${index}]`);
    exact(trait, ['traitKey'], `${label}.traits.equipped[${index}]`, [
      'rarity',
      'level',
      'hammerRank',
    ]);
    return Object.freeze({
      traitKey: stringValue(trait.traitKey, `${label}.traits.equipped[${index}].traitKey`),
      ...(trait.rarity === undefined
        ? {}
        : { rarity: stringValue(trait.rarity, `${label}.traits.equipped[${index}].rarity`) }),
      ...(trait.level === undefined
        ? {}
        : { level: integer(trait.level, `${label}.traits.equipped[${index}].level`) }),
      ...(trait.hammerRank === undefined
        ? {}
        : trait.hammerRank === 'RankI' || trait.hammerRank === 'RankII'
          ? { hammerRank: trait.hammerRank }
          : fail(`${label}.traits.equipped[${index}].hammerRank unsupported`)),
    });
  });
  if (new Set(equipped.map((trait) => trait.traitKey)).size !== equipped.length)
    fail(`${label}.traits.equipped has duplicate traits`);
  const slots = array(traits.slots, `${label}.traits.slots`, 6).map((entry, index) => {
    const slot = object(entry, `${label}.traits.slots[${index}]`);
    exact(slot, ['slot'], `${label}.traits.slots[${index}]`, ['traitKey']);
    const name = stringValue(slot.slot, `${label}.traits.slots[${index}].slot`);
    if (!['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'].includes(name))
      fail(`${label}.traits.slots[${index}].slot unsupported`);
    return Object.freeze({
      slot: name as 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell',
      ...(slot.traitKey === undefined
        ? {}
        : { traitKey: stringValue(slot.traitKey, `${label}.traits.slots[${index}].traitKey`) }),
    });
  });
  if (slots.length !== 6 || new Set(slots.map((slot) => slot.slot)).size !== 6)
    fail(`${label}.traits.slots must contain the exact six slots`);
  const expectedSlots = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'];
  if (slots.some((slot, index) => slot.slot !== expectedSlots[index]))
    fail(`${label}.traits.slots must preserve canonical slot order`);
  const arcana = object(record.arcana, `${label}.arcana`);
  exact(arcana, ['active'], `${label}.arcana`);
  const active = array(arcana.active, `${label}.arcana.active`, 32).map((entry, index) => {
    const card = object(entry, `${label}.arcana.active[${index}]`);
    exact(card, ['key', 'origin', 'rarity'], `${label}.arcana.active[${index}]`);
    if (card.origin !== 'manual' && card.origin !== 'automatic' && card.origin !== 'temporary')
      fail(`${label}.arcana.active[${index}].origin unsupported`);
    if (
      card.rarity !== 'Common' &&
      card.rarity !== 'Rare' &&
      card.rarity !== 'Epic' &&
      card.rarity !== 'Heroic'
    )
      fail(`${label}.arcana.active[${index}].rarity unsupported`);
    return Object.freeze({
      key: stringValue(card.key, `${label}.arcana.active[${index}].key`),
      origin: card.origin,
      rarity: card.rarity,
    });
  });
  if (new Set(active.map((card) => card.key)).size !== active.length)
    fail(`${label}.arcana.active has duplicate cards`);
  const vows = object(record.vows, `${label}.vows`);
  exact(vows, ['configuredRanks', 'effectiveRanks', 'disabledKeys'], `${label}.vows`);
  if (
    record.forfeit !== 'inactive' &&
    record.forfeit !== 'available' &&
    record.forfeit !== 'consumed'
  )
    fail(`${label}.forfeit unsupported`);
  const chaos = object(record.chaos, `${label}.chaos`);
  exact(chaos, ['active', 'matured'], `${label}.chaos`);
  const activeChaos = array(chaos.active, `${label}.chaos.active`, 32).map((entry, index) => {
    const item = object(entry, `${label}.chaos.active[${index}]`);
    exact(
      item,
      ['curseKey', 'blessingKey', 'rarity', 'clock', 'remaining'],
      `${label}.chaos.active[${index}]`,
    );
    if (
      item.clock !== 'encounters' &&
      item.clock !== 'locations' &&
      item.clock !== 'godBoonScreens'
    )
      fail(`${label}.chaos.active[${index}].clock unsupported`);
    const remaining = integer(item.remaining, `${label}.chaos.active[${index}].remaining`);
    return Object.freeze({
      curseKey: stringValue(item.curseKey, `${label}.chaos.active[${index}].curseKey`),
      blessingKey: stringValue(item.blessingKey, `${label}.chaos.active[${index}].blessingKey`),
      rarity: stringValue(item.rarity, `${label}.chaos.active[${index}].rarity`),
      clock: item.clock,
      remaining,
    });
  });
  const maturedChaos = array(chaos.matured, `${label}.chaos.matured`, 32).map((entry, index) => {
    const item = object(entry, `${label}.chaos.matured[${index}]`);
    exact(item, ['blessingKey', 'rarity'], `${label}.chaos.matured[${index}]`);
    return Object.freeze({
      blessingKey: stringValue(item.blessingKey, `${label}.chaos.matured[${index}].blessingKey`),
      rarity: stringValue(item.rarity, `${label}.chaos.matured[${index}].rarity`),
    });
  });
  const keepsakes = object(record.keepsakes, `${label}.keepsakes`);
  exact(keepsakes, ['currentKey', 'usedKeys', 'blockedKeys', 'fatedStatus'], `${label}.keepsakes`);
  const rewardPriorities = strings(record.rewardPriorities, `${label}.rewardPriorities`, 32, false);
  const hex = object(record.hexProgress, `${label}.hexProgress`);
  exact(
    hex,
    ['talentKeys', 'closed', 'bankedPathPoints', 'investedPathPoints'],
    `${label}.hexProgress`,
    ['spellTraitKey', 'layoutKey'],
  );
  const artificer =
    record.artificer === null ? null : object(record.artificer, `${label}.artificer`);
  if (artificer !== null) exact(artificer, ['usedCount', 'remainingCount'], `${label}.artificer`);
  const gateD = {
    keepsakes: Object.freeze({
      currentKey: stringValue(keepsakes.currentKey, `${label}.keepsakes.currentKey`),
      usedKeys: strings(keepsakes.usedKeys, `${label}.keepsakes.usedKeys`, 16),
      blockedKeys: strings(keepsakes.blockedKeys, `${label}.keepsakes.blockedKeys`, 32),
      fatedStatus:
        keepsakes.fatedStatus === 'Unknown' ||
        keepsakes.fatedStatus === 'Fated' ||
        keepsakes.fatedStatus === 'Unfated'
          ? keepsakes.fatedStatus
          : fail(`${label}.keepsakes.fatedStatus unsupported`),
    }),
    rewardPriorities: Object.freeze(rewardPriorities),
    hexProgress: Object.freeze({
      ...(hex.spellTraitKey === undefined
        ? {}
        : { spellTraitKey: stringValue(hex.spellTraitKey, `${label}.hexProgress.spellTraitKey`) }),
      ...(hex.layoutKey === undefined
        ? {}
        : { layoutKey: stringValue(hex.layoutKey, `${label}.hexProgress.layoutKey`) }),
      talentKeys: strings(hex.talentKeys, `${label}.hexProgress.talentKeys`, 16),
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
  };
  return Object.freeze({
    owner: stringValue(record.owner, `${label}.owner`),
    checkpoint: record.checkpoint,
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
      acquiredSourceKeys: strings(
        godPool.acquiredSourceKeys,
        `${label}.godPool.acquiredSourceKeys`,
        32,
      ),
      effectiveSourceKeys: strings(
        godPool.effectiveSourceKeys,
        `${label}.godPool.effectiveSourceKeys`,
        32,
      ),
      capNarrowed: booleanValue(godPool.capNarrowed, `${label}.godPool.capNarrowed`),
    }),
    traits: Object.freeze({
      equipped: Object.freeze(equipped),
      slots: Object.freeze(slots),
      elements: numbers(traits.elements, `${label}.traits.elements`),
      godRarityCounts: numbers(traits.godRarityCounts, `${label}.traits.godRarityCounts`),
      upgradableCount: integer(traits.upgradableCount, `${label}.traits.upgradableCount`),
      bannedTraitKeys: strings(traits.bannedTraitKeys, `${label}.traits.bannedTraitKeys`, 128),
    }),
    arcana: Object.freeze({ active: Object.freeze(active) }),
    vows: Object.freeze({
      configuredRanks: numbers(vows.configuredRanks, `${label}.vows.configuredRanks`),
      effectiveRanks: numbers(vows.effectiveRanks, `${label}.vows.effectiveRanks`),
      disabledKeys: strings(vows.disabledKeys, `${label}.vows.disabledKeys`, 128),
    }),
    forfeit: record.forfeit,
    chaos: Object.freeze({
      active: Object.freeze(activeChaos),
      matured: Object.freeze(maturedChaos),
    }),
    ...gateD,
  }) as unknown as ExecutionRunStateDiagnostic;
}
function traitOffer(value: unknown, label: string) {
  const record = object(value, label);
  if (record.kind === 'fallbackGold') {
    exact(record, ['kind', 'giver'], label);
    return Object.freeze({
      kind: 'fallbackGold' as const,
      giver: stringValue(record.giver, `${label}.giver`),
    });
  }
  if (record.kind === 'chaos') {
    exact(
      record,
      [
        'kind',
        'giver',
        'curseOptions',
        'selected',
        'selectedCurseValues',
        'blessingKey',
        'rarity',
        'blessingValues',
      ],
      label,
    );
    if (record.giver !== 'Chaos') fail(`${label}.giver must be Chaos`);
    const curseOptions = array(record.curseOptions, `${label}.curseOptions`, 3).map(
      (entry, index) => {
        const option = object(entry, `${label}.curseOptions[${index}]`);
        exact(option, ['curseKey', 'requirementCount'], `${label}.curseOptions[${index}]`);
        return Object.freeze({
          curseKey: stringValue(option.curseKey, `${label}.curseOptions[${index}].curseKey`),
          requirementCount: integer(
            option.requirementCount,
            `${label}.curseOptions[${index}].requirementCount`,
            1,
          ),
        });
      },
    );
    if (curseOptions.length !== 3) fail(`${label}.curseOptions must contain three ordered curses`);
    const selected = stringValue(record.selected, `${label}.selected`);
    if (!['option1', 'option2', 'option3'].includes(selected))
      fail(`${label}.selected must identify a Chaos option`);
    return Object.freeze({
      kind: 'chaos' as const,
      giver: 'Chaos' as const,
      curseOptions: Object.freeze(curseOptions),
      selected: selected as 'option1' | 'option2' | 'option3',
      selectedCurseValues: decimalNumbers(
        record.selectedCurseValues,
        `${label}.selectedCurseValues`,
      ),
      blessingKey: stringValue(record.blessingKey, `${label}.blessingKey`),
      rarity: stringValue(record.rarity, `${label}.rarity`),
      blessingValues: decimalNumbers(record.blessingValues, `${label}.blessingValues`),
    });
  }
  if (record.kind !== 'traits') fail(`${label}.kind unsupported`);
  exact(record, ['kind', 'giver', 'options', 'selected'], label, ['rejected', 'runtimeFallback']);
  const options = array(record.options, `${label}.options`, 3).map((entry, index) => {
    const option = object(entry, `${label}.options[${index}]`);
    exact(option, ['key'], `${label}.options[${index}]`, [
      'rarity',
      'effectiveLevel',
      'replacement',
    ]);
    const replacement =
      option.replacement === undefined
        ? undefined
        : object(option.replacement, `${label}.options[${index}].replacement`);
    if (replacement !== undefined)
      exact(
        replacement,
        ['slot', 'replacedTraitKey', 'oldRarity', 'newTraitKey', 'requiredRarity'],
        `${label}.options[${index}].replacement`,
        ['levelBonus'],
      );
    return Object.freeze({
      key: stringValue(option.key, `${label}.options[${index}].key`),
      ...(option.rarity === undefined
        ? {}
        : { rarity: stringValue(option.rarity, `${label}.options[${index}].rarity`) }),
      ...(option.effectiveLevel === undefined
        ? {}
        : {
            effectiveLevel: integer(
              option.effectiveLevel,
              `${label}.options[${index}].effectiveLevel`,
            ),
          }),
      ...(replacement === undefined
        ? {}
        : {
            replacement: Object.freeze({
              slot: stringValue(replacement.slot, `${label}.options[${index}].replacement.slot`),
              replacedTraitKey: stringValue(
                replacement.replacedTraitKey,
                `${label}.options[${index}].replacement.replacedTraitKey`,
              ),
              oldRarity: stringValue(
                replacement.oldRarity,
                `${label}.options[${index}].replacement.oldRarity`,
              ),
              newTraitKey: stringValue(
                replacement.newTraitKey,
                `${label}.options[${index}].replacement.newTraitKey`,
              ),
              requiredRarity: stringValue(
                replacement.requiredRarity,
                `${label}.options[${index}].replacement.requiredRarity`,
              ),
              ...(replacement.levelBonus === undefined
                ? {}
                : {
                    levelBonus: integer(
                      replacement.levelBonus,
                      `${label}.options[${index}].replacement.levelBonus`,
                    ),
                  }),
            }),
          }),
    });
  });
  if (options.length === 0) fail(`${label}.options cannot be empty`);
  const selected = stringValue(record.selected, `${label}.selected`);
  const optionKeys = options.map((_, index) => `option${index + 1}`);
  if (!optionKeys.includes(selected)) fail(`${label}.selected must identify a declared option`);
  const rejected =
    record.rejected === undefined ? undefined : stringValue(record.rejected, `${label}.rejected`);
  if (rejected !== undefined && (!optionKeys.includes(rejected) || rejected === selected))
    fail(`${label}.rejected must identify a different declared option`);
  if (new Set(options.map((option) => option.key)).size !== options.length)
    fail(`${label}.options has duplicate trait identities`);
  return Object.freeze({
    kind: 'traits' as const,
    giver: stringValue(record.giver, `${label}.giver`),
    options: Object.freeze(options),
    selected: selected as 'option1' | 'option2' | 'option3',
    ...(rejected === undefined ? {} : { rejected: rejected as 'option1' | 'option2' | 'option3' }),
    ...(record.runtimeFallback === undefined
      ? {}
      : { runtimeFallback: stringValue(record.runtimeFallback, `${label}.runtimeFallback`) }),
  });
}
function trace(value: unknown, label: string, context: TraceContext): ExecutionTraceStep {
  const record = object(value, label);
  const stepOwner = stringValue(record.owner, `${label}.owner`);
  const requireRoomOwner = (): void => {
    if (stepOwner !== context.owner) fail(`${label}.owner mismatch`);
  };
  const requireRoomActionOwner = (actionKey: string): void => {
    const parts = addressParts(stepOwner, `${label}.owner`);
    exactAddressBase(parts, 'roomAction', 5, context, `${label}.owner`);
    if (parts[3] !== context.roomId || parts[4] !== actionKey)
      fail(`${label}.owner does not identify its canonical room action`);
  };
  if (record.kind === 'roomEntered' || record.kind === 'beforeRoomExit') {
    exact(record, ['kind', 'owner', 'runState'], label);
    const state = diagnostic(record.runState, `${label}.runState`);
    requireRoomOwner();
    if (state.checkpoint !== record.kind) fail(`${label}.runState checkpoint mismatch`);
    const expectedDiagnosticOwner = JSON.stringify([
      'roomRunStateCheckpoint',
      'Underworld',
      context.biomeKey,
      context.roomId,
      record.kind,
    ]);
    if (state.owner !== expectedDiagnosticOwner) fail(`${label}.runState owner mismatch`);
    return Object.freeze({ kind: record.kind, owner: stepOwner, runState: state });
  }
  if (record.kind === 'cleanup') {
    exact(record, ['kind', 'owner'], label);
    requireRoomOwner();
    return Object.freeze({ kind: 'cleanup', owner: stepOwner });
  }
  if (record.kind === 'encounterStart') {
    exact(record, ['kind', 'owner', 'phase', 'encounter', 'encounterKind'], label);
    requireRoomOwner();
    const phase = stringValue(record.phase, `${label}.phase`);
    const declared = context.phases.get(phase);
    if (
      declared === undefined ||
      declared.encounterKey !== record.encounter ||
      declared.kind !== record.encounterKind
    )
      fail(`${label} does not match a declared encounter phase`);
    return Object.freeze({
      kind: 'encounterStart',
      owner: stepOwner,
      phase,
      encounter: stringValue(record.encounter, `${label}.encounter`),
      encounterKind: stringValue(record.encounterKind, `${label}.encounterKind`),
    });
  }
  if (record.kind === 'encounterEnd') {
    exact(record, ['kind', 'owner', 'phase', 'endEffectsExpected'], label);
    requireRoomOwner();
    const phase = stringValue(record.phase, `${label}.phase`);
    if (!context.phases.has(phase)) fail(`${label} names an undeclared encounter phase`);
    return Object.freeze({
      kind: 'encounterEnd',
      owner: stepOwner,
      phase,
      endEffectsExpected: booleanValue(record.endEffectsExpected, `${label}.endEffectsExpected`),
    });
  }
  if (record.kind === 'encounterInteraction') {
    exact(record, ['kind', 'owner', 'phaseKey'], label, ['resolution']);
    const phaseKey = stringValue(record.phaseKey, `${label}.phaseKey`);
    if (validateEncounterAddress(stepOwner, context, `${label}.owner`) !== phaseKey)
      fail(`${label}.owner and phaseKey mismatch`);
    const resolution =
      record.resolution === undefined
        ? undefined
        : (() => {
            const value = object(record.resolution, `${label}.resolution`);
            if (value.kind === 'traitOffer') {
              exact(value, ['kind', 'offer'], `${label}.resolution`);
              return Object.freeze({
                kind: 'traitOffer' as const,
                offer: traitOffer(value.offer, `${label}.resolution.offer`),
              });
            }
            if (value.kind === 'nemesisRandomEvent') {
              exact(value, ['kind', 'outcome'], `${label}.resolution`);
              const outcome = object(value.outcome, `${label}.resolution.outcome`);
              if (outcome.kind === 'freeItem') {
                exact(outcome, ['kind'], `${label}.resolution.outcome`);
                return Object.freeze({
                  kind: 'nemesisRandomEvent' as const,
                  outcome: Object.freeze({ kind: 'freeItem' as const }),
                });
              }
              if (outcome.kind === 'goldTrade' || outcome.kind === 'damageTrade') {
                exact(outcome, ['kind', 'response'], `${label}.resolution.outcome`);
                if (outcome.response !== 'accept' && outcome.response !== 'decline')
                  fail(`${label}.resolution outcome response invalid`);
                return Object.freeze({
                  kind: 'nemesisRandomEvent' as const,
                  outcome: Object.freeze({ kind: outcome.kind, response: outcome.response }),
                });
              }
              if (outcome.kind === 'traitTrade') {
                exact(outcome, ['kind', 'traitKey', 'response'], `${label}.resolution.outcome`);
                if (outcome.response !== 'accept' && outcome.response !== 'decline')
                  fail(`${label}.resolution outcome response invalid`);
                return Object.freeze({
                  kind: 'nemesisRandomEvent' as const,
                  outcome: Object.freeze({
                    kind: 'traitTrade' as const,
                    traitKey: stringValue(outcome.traitKey, `${label}.resolution.outcome.traitKey`),
                    response: outcome.response,
                  }),
                });
              }
              if (outcome.kind === 'damageContest') {
                exact(outcome, ['kind', 'result'], `${label}.resolution.outcome`);
                if (outcome.result !== 'success' && outcome.result !== 'failure')
                  fail(`${label}.resolution outcome result invalid`);
                return Object.freeze({
                  kind: 'nemesisRandomEvent' as const,
                  outcome: Object.freeze({
                    kind: 'damageContest' as const,
                    result: outcome.result,
                  }),
                });
              }
            }
            fail(`${label}.resolution unsupported`);
          })();
    return Object.freeze({
      kind: 'encounterInteraction',
      owner: stepOwner,
      phaseKey,
      ...(resolution === undefined ? {} : { resolution }),
    });
  }
  if (record.kind === 'steadyGrowth' || record.kind === 'transcendentEmbryo') {
    exact(
      record,
      record.kind === 'steadyGrowth'
        ? ['kind', 'owner', 'phase', 'source', 'target']
        : ['kind', 'owner', 'phase', 'source', 'target', 'rarity'],
      label,
    );
    requireRoomOwner();
    const phase = stringValue(record.phase, `${label}.phase`);
    if (!context.phases.has(phase)) fail(`${label} names an undeclared encounter phase`);
    const base = {
      owner: stepOwner,
      phase,
      source: stringValue(record.source, `${label}.source`),
      target: stringValue(record.target, `${label}.target`),
    };
    return record.kind === 'steadyGrowth'
      ? Object.freeze({ ...base, kind: 'steadyGrowth' as const })
      : Object.freeze({
          ...base,
          kind: 'transcendentEmbryo' as const,
          rarity: stringValue(record.rarity, `${label}.rarity`),
        });
  }
  if (record.kind === 'acquireReward') {
    exact(
      record,
      ['kind', 'owner', 'sourceOwner', 'reward', 'producerLifecycleKey', 'roles'],
      label,
    );
    const roles = array(record.roles, `${label}.roles`, 16).map((entry, index) => {
      const role = object(entry, `${label}.roles[${index}]`);
      exact(
        role,
        ['role', 'disposition', 'lifecyclePoint', 'kind', 'gameName'],
        `${label}.roles[${index}]`,
        ['settlement', 'producer', 'traitOffer', 'levelResolution'],
      );
      const settlement =
        role.settlement === undefined
          ? undefined
          : object(role.settlement, `${label}.roles[${index}].settlement`);
      if (settlement !== undefined)
        exact(settlement, ['site', 'entry'], `${label}.roles[${index}].settlement`);
      const roleKey = stringValue(role.role, `${label}.roles[${index}].role`);
      const producer =
        role.producer === undefined
          ? undefined
          : object(role.producer, `${label}.roles[${index}].producer`);
      if (producer !== undefined) {
        const kind = stringValue(producer.kind, `${label}.roles[${index}].producer.kind`);
        if (
          kind === 'seaStarDuplicate' ||
          kind === 'artificerReplacement' ||
          kind === 'echoLastReward'
        ) {
          exact(
            producer,
            ['kind', 'sourceOwner', 'sourceRole'],
            `${label}.roles[${index}].producer`,
          );
        } else {
          fail(`${label}.roles[${index}].producer.kind unsupported`);
        }
      }
      if (
        role.disposition !== 'normal' &&
        role.disposition !== 'timePiece' &&
        role.disposition !== 'artificer'
      )
        fail(`${label}.roles[${index}].disposition unsupported`);
      if (settlement !== undefined) {
        const site = stringValue(settlement.site, `${label}.roles[${index}].settlement.site`);
        const entryAddress = stringValue(
          settlement.entry,
          `${label}.roles[${index}].settlement.entry`,
        );
        validateSiteAddress(site, context, `${label}.roles[${index}].settlement.site`);
        const entryParts = addressParts(entryAddress, `${label}.roles[${index}].settlement.entry`);
        exactAddressBase(
          entryParts,
          'acquisitionEntry',
          5,
          context,
          `${label}.roles[${index}].settlement.entry`,
        );
        if (entryParts[3] !== site || entryParts[4] !== roleKey)
          fail(`${label}.roles[${index}].settlement entry does not match its site and role`);
      }
      const level =
        role.levelResolution === undefined
          ? undefined
          : object(role.levelResolution, `${label}.roles[${index}].levelResolution`);
      if (level !== undefined)
        exact(
          level,
          ['offeredTargets', 'selectedTarget', 'levelCount'],
          `${label}.roles[${index}].levelResolution`,
        );
      const offeredTargets =
        level === undefined
          ? undefined
          : strings(
              level.offeredTargets,
              `${label}.roles[${index}].levelResolution.offeredTargets`,
              64,
            );
      if (offeredTargets !== undefined && new Set(offeredTargets).size !== offeredTargets.length)
        fail(`${label}.roles[${index}].levelResolution has duplicate targets`);
      const levelResolution =
        level === undefined || offeredTargets === undefined
          ? undefined
          : Object.freeze({
              offeredTargets,
              selectedTarget:
                level.selectedTarget === null
                  ? null
                  : stringValue(
                      level.selectedTarget,
                      `${label}.roles[${index}].levelResolution.selectedTarget`,
                    ),
              levelCount: integer(
                level.levelCount,
                `${label}.roles[${index}].levelResolution.levelCount`,
              ),
            });
      if (
        levelResolution?.selectedTarget !== null &&
        levelResolution?.selectedTarget !== undefined &&
        !levelResolution.offeredTargets.includes(levelResolution.selectedTarget)
      )
        fail(`${label}.roles[${index}].levelResolution selected target was not offered`);
      return Object.freeze({
        role: roleKey,
        disposition: role.disposition,
        lifecyclePoint: stringValue(role.lifecyclePoint, `${label}.roles[${index}].lifecyclePoint`),
        kind: stringValue(role.kind, `${label}.roles[${index}].kind`),
        gameName: stringValue(role.gameName, `${label}.roles[${index}].gameName`),
        ...(producer === undefined
          ? {}
          : {
              producer: Object.freeze({
                kind: producer.kind as
                  'seaStarDuplicate' | 'artificerReplacement' | 'echoLastReward',
                sourceOwner: stringValue(
                  producer.sourceOwner,
                  `${label}.roles[${index}].producer.sourceOwner`,
                ),
                sourceRole: stringValue(
                  producer.sourceRole,
                  `${label}.roles[${index}].producer.sourceRole`,
                ),
              }),
            }),
        ...(settlement === undefined
          ? {}
          : {
              settlement: Object.freeze({
                site: stringValue(settlement.site, `${label}.roles[${index}].settlement.site`),
                entry: stringValue(settlement.entry, `${label}.roles[${index}].settlement.entry`),
              }),
            }),
        ...(role.traitOffer === undefined
          ? {}
          : { traitOffer: traitOffer(role.traitOffer, `${label}.roles[${index}].traitOffer`) }),
        ...(levelResolution === undefined ? {} : { levelResolution }),
      });
    });
    if (roles.length === 0) fail(`${label}.roles cannot be empty`);
    if (
      new Set(roles.map((role) => JSON.stringify([role.role, role.lifecyclePoint]))).size !==
      roles.length
    )
      fail(`${label}.roles has duplicate identities`);
    const parsedReward = reward(record.reward, `${label}.reward`);
    const sourceOwner = stringValue(record.sourceOwner, `${label}.sourceOwner`);
    validateAcquisitionSource(sourceOwner, context, `${label}.sourceOwner`);
    const actionOwner = addressParts(stepOwner, `${label}.owner`);
    exactAddressBase(actionOwner, 'acquisitionRole', 5, context, `${label}.owner`);
    if (actionOwner[3] !== sourceOwner || !roles.some((role) => role.role === actionOwner[4]))
      fail(`${label}.owner does not identify a declared source role`);
    const producerLifecycleKey = stringValue(
      record.producerLifecycleKey,
      `${label}.producerLifecycleKey`,
    );
    if (parsedReward.producerLifecycleKey !== producerLifecycleKey)
      fail(`${label}.producerLifecycleKey must match reward provenance`);
    return Object.freeze({
      kind: 'acquireReward',
      owner: stepOwner,
      sourceOwner,
      reward: parsedReward,
      producerLifecycleKey,
      roles: Object.freeze(roles),
    });
  }
  if (record.kind === 'purgingPoolSale') {
    exact(record, ['kind', 'owner', 'slotKey', 'traitKey'], label);
    const slotKey =
      record.slotKey === 'left' || record.slotKey === 'middle' || record.slotKey === 'right'
        ? record.slotKey
        : fail(`${label}.slotKey unsupported`);
    requireRoomActionOwner(JSON.stringify(['sellPurgingPoolTrait', slotKey]));
    return Object.freeze({
      kind: 'purgingPoolSale' as const,
      owner: stepOwner,
      slotKey,
      traitKey: stringValue(record.traitKey, `${label}.traitKey`),
    });
  }
  if (record.kind === 'stygianWellPurchase') {
    exact(record, ['kind', 'owner', 'generationKey', 'offerKey'], label, ['twistResultKey']);
    const generationKey = wellGeneration(record.generationKey, `${label}.generationKey`);
    requireRoomActionOwner(JSON.stringify(['purchaseStygianWellOffer', generationKey]));
    return Object.freeze({
      kind: 'stygianWellPurchase' as const,
      owner: stepOwner,
      generationKey,
      offerKey: stringValue(record.offerKey, `${label}.offerKey`),
      ...(record.twistResultKey === undefined
        ? {}
        : { twistResultKey: stringValue(record.twistResultKey, `${label}.twistResultKey`) }),
    });
  }
  if (record.kind === 'worldShopPurchase') {
    exact(record, ['kind', 'owner', 'offerKey', 'rewardType'], label);
    const offerKey = stringValue(record.offerKey, `${label}.offerKey`);
    requireRoomActionOwner(JSON.stringify(['interactShopOffer', offerKey]));
    return Object.freeze({
      kind: 'worldShopPurchase' as const,
      owner: stepOwner,
      offerKey,
      rewardType: stringValue(record.rewardType, `${label}.rewardType`),
    });
  }
  if (record.kind === 'keepsakeRackChange') {
    exact(record, ['kind', 'owner', 'keepsakeKey'], label, ['equipResults']);
    requireRoomActionOwner(JSON.stringify(['interactKeepsakeRack']));
    return Object.freeze({
      kind: 'keepsakeRackChange' as const,
      owner: stepOwner,
      keepsakeKey: stringValue(record.keepsakeKey, `${label}.keepsakeKey`),
      ...(record.equipResults === undefined
        ? {}
        : { equipResults: keepsakeEquipResults(record.equipResults, `${label}.equipResults`) }),
    });
  }
  if (record.kind === 'fountainUse') {
    exact(record, ['kind', 'owner'], label, ['aromaticPhialTarget']);
    requireRoomActionOwner(JSON.stringify(['useFountain']));
    return Object.freeze({
      kind: 'fountainUse' as const,
      owner: stepOwner,
      ...(record.aromaticPhialTarget === undefined
        ? {}
        : {
            aromaticPhialTarget: stringValue(
              record.aromaticPhialTarget,
              `${label}.aromaticPhialTarget`,
            ),
          }),
    });
  }
  fail(`${label}.kind unsupported`);
}
function wellGeneration(
  value: unknown,
  label: string,
): 'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill' {
  if (
    value === 'initial:healing' ||
    value === 'initial:secondLeft' ||
    value === 'initial:secondRight' ||
    value === 'travelDealRefill'
  )
    return value;
  return fail(`${label} unsupported`);
}
function keepsakeEquipResults(value: unknown, label: string): ExecutionKeepsakeEquipResults {
  const record = object(value, label);
  exact(record, [], label, ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo']);
  const jeweledPom =
    record.jeweledPom === undefined ? undefined : object(record.jeweledPom, `${label}.jeweledPom`);
  if (jeweledPom !== undefined) exact(jeweledPom, ['traitKey'], `${label}.jeweledPom`, ['rarity']);
  const hammer =
    record.experimentalHammer === undefined
      ? undefined
      : object(record.experimentalHammer, `${label}.experimentalHammer`);
  if (hammer !== undefined) {
    if (hammer.kind === 'selected')
      exact(hammer, ['kind', 'traitKey'], `${label}.experimentalHammer`);
    else if (hammer.kind === 'exhausted') exact(hammer, ['kind'], `${label}.experimentalHammer`);
    else fail(`${label}.experimentalHammer.kind unsupported`);
  }
  const embryo =
    record.transcendentEmbryo === undefined
      ? undefined
      : object(record.transcendentEmbryo, `${label}.transcendentEmbryo`);
  if (embryo !== undefined) exact(embryo, ['blessingKey'], `${label}.transcendentEmbryo`);
  return Object.freeze({
    ...(jeweledPom === undefined
      ? {}
      : {
          jeweledPom: Object.freeze({
            traitKey: stringValue(jeweledPom.traitKey, `${label}.jeweledPom.traitKey`),
            ...(jeweledPom.rarity === undefined
              ? {}
              : { rarity: stringValue(jeweledPom.rarity, `${label}.jeweledPom.rarity`) }),
          }),
        }),
    ...(hammer === undefined
      ? {}
      : {
          experimentalHammer:
            hammer.kind === 'selected'
              ? Object.freeze({
                  kind: 'selected' as const,
                  traitKey: stringValue(hammer.traitKey, `${label}.experimentalHammer.traitKey`),
                })
              : Object.freeze({ kind: 'exhausted' as const }),
        }),
    ...(embryo === undefined
      ? {}
      : {
          transcendentEmbryo: Object.freeze({
            blessingKey: stringValue(embryo.blessingKey, `${label}.transcendentEmbryo.blessingKey`),
          }),
        }),
  });
}
function roomContents(value: unknown, label: string): ExecutionRoom['contents'] {
  const contents = object(value, label);
  exact(contents, ['encounterPhases', 'requiredObjects'], label, [
    'incomingReward',
    'shop',
    'stygianWell',
    'purgingPool',
    'keepsakeRack',
    'fountain',
    'resources',
  ]);
  const encounterPhases = array(contents.encounterPhases, `${label}.encounterPhases`, 16).map(
    (entry, i) => {
      const phase = object(entry, `${label}.encounterPhases[${i}]`);
      exact(phase, ['slotKey', 'encounterKey', 'kind'], `${label}.encounterPhases[${i}]`);
      return Object.freeze({
        slotKey: stringValue(phase.slotKey, `${label}.encounterPhases[${i}].slotKey`),
        encounterKey: stringValue(
          phase.encounterKey,
          `${label}.encounterPhases[${i}].encounterKey`,
        ),
        kind: stringValue(phase.kind, `${label}.encounterPhases[${i}].kind`),
      });
    },
  );
  if (new Set(encounterPhases.map((phase) => phase.slotKey)).size !== encounterPhases.length)
    fail(`${label}.encounterPhases has duplicate slots`);
  const shop = contents.shop === undefined ? undefined : object(contents.shop, `${label}.shop`);
  if (shop !== undefined)
    exact(shop, ['profileKey', 'offers'], `${label}.shop`, ['travelDealRefill']);
  const shopOffers =
    shop === undefined
      ? undefined
      : array(shop.offers, `${label}.shop.offers`, 16).map((entry, i) => {
          const offer = object(entry, `${label}.shop.offers[${i}]`);
          exact(offer, ['offerKey', 'optionKey', 'rewardType'], `${label}.shop.offers[${i}]`, [
            'source',
            'spurnedSource',
          ]);
          return Object.freeze({
            offerKey: stringValue(offer.offerKey, `${label}.shop.offers[${i}].offerKey`),
            optionKey: stringValue(offer.optionKey, `${label}.shop.offers[${i}].optionKey`),
            rewardType: stringValue(offer.rewardType, `${label}.shop.offers[${i}].rewardType`),
            ...(offer.source === undefined
              ? {}
              : { source: stringValue(offer.source, `${label}.shop.offers[${i}].source`) }),
            ...(offer.spurnedSource === undefined
              ? {}
              : {
                  spurnedSource: stringValue(
                    offer.spurnedSource,
                    `${label}.shop.offers[${i}].spurnedSource`,
                  ),
                }),
          });
        });
  if (
    shopOffers !== undefined &&
    new Set(shopOffers.map((offer) => offer.offerKey)).size !== shopOffers.length
  )
    fail(`${label}.shop.offers has duplicate keys`);
  const shopTravelDealRefill =
    shop === undefined || shop.travelDealRefill === undefined
      ? undefined
      : object(shop.travelDealRefill, `${label}.shop.travelDealRefill`);
  if (shopTravelDealRefill !== undefined)
    exact(
      shopTravelDealRefill,
      ['sourceOfferKey', 'slotIndex', 'optionKey', 'reward'],
      `${label}.shop.travelDealRefill`,
    );
  const decodedShopTravelDealRefill =
    shopTravelDealRefill === undefined
      ? undefined
      : Object.freeze({
          sourceOfferKey: stringValue(
            shopTravelDealRefill.sourceOfferKey,
            `${label}.shop.travelDealRefill.sourceOfferKey`,
          ),
          slotIndex: integer(
            shopTravelDealRefill.slotIndex,
            `${label}.shop.travelDealRefill.slotIndex`,
            0,
            15,
          ),
          optionKey: stringValue(
            shopTravelDealRefill.optionKey,
            `${label}.shop.travelDealRefill.optionKey`,
          ),
          reward: reward(shopTravelDealRefill.reward, `${label}.shop.travelDealRefill.reward`),
        });
  if (
    decodedShopTravelDealRefill !== undefined &&
    (shopOffers === undefined ||
      shopOffers[decodedShopTravelDealRefill.slotIndex]?.offerKey !==
        decodedShopTravelDealRefill.sourceOfferKey)
  )
    fail(`${label}.shop.travelDealRefill source slot does not close inventory`);
  const well =
    contents.stygianWell === undefined
      ? undefined
      : object(contents.stygianWell, `${label}.stygianWell`);
  if (well !== undefined) exact(well, ['offers'], `${label}.stygianWell`);
  const wellOffers =
    well === undefined
      ? undefined
      : array(well.offers, `${label}.stygianWell.offers`, 4).map((entry, i) => {
          const offer = object(entry, `${label}.stygianWell.offers[${i}]`);
          exact(offer, ['generationKey', 'offerKey'], `${label}.stygianWell.offers[${i}]`, [
            'twistResultKey',
          ]);
          return Object.freeze({
            generationKey: wellGeneration(
              offer.generationKey,
              `${label}.stygianWell.offers[${i}].generationKey`,
            ),
            offerKey: stringValue(offer.offerKey, `${label}.stygianWell.offers[${i}].offerKey`),
            ...(offer.twistResultKey === undefined
              ? {}
              : {
                  twistResultKey: stringValue(
                    offer.twistResultKey,
                    `${label}.stygianWell.offers[${i}].twistResultKey`,
                  ),
                }),
          });
        });
  if (
    wellOffers !== undefined &&
    new Set(wellOffers.map((offer) => offer.generationKey)).size !== wellOffers.length
  )
    fail(`${label}.stygianWell.offers has duplicate generations`);
  const pool =
    contents.purgingPool === undefined
      ? undefined
      : object(contents.purgingPool, `${label}.purgingPool`);
  if (pool !== undefined) exact(pool, ['traits'], `${label}.purgingPool`);
  const poolTraits =
    pool === undefined
      ? undefined
      : array(pool.traits, `${label}.purgingPool.traits`, 3).map((entry, i) => {
          const trait = object(entry, `${label}.purgingPool.traits[${i}]`);
          exact(trait, ['slotKey', 'traitKey'], `${label}.purgingPool.traits[${i}]`);
          if (trait.slotKey !== 'left' && trait.slotKey !== 'middle' && trait.slotKey !== 'right')
            fail(`${label}.purgingPool.traits[${i}].slotKey unsupported`);
          if (trait.traitKey !== null && typeof trait.traitKey !== 'string')
            fail(`${label}.purgingPool.traits[${i}].traitKey must be string or null`);
          return Object.freeze({
            slotKey: trait.slotKey,
            traitKey:
              trait.traitKey === null
                ? null
                : stringValue(trait.traitKey, `${label}.purgingPool.traits[${i}].traitKey`),
          });
        });
  if (
    poolTraits !== undefined &&
    (poolTraits.length !== 3 ||
      poolTraits.map((trait) => trait.slotKey).join(',') !== 'left,middle,right')
  )
    fail(`${label}.purgingPool.traits must preserve all canonical slots`);
  const rack =
    contents.keepsakeRack === undefined
      ? undefined
      : object(contents.keepsakeRack, `${label}.keepsakeRack`);
  if (rack !== undefined) exact(rack, ['keepsakeKey'], `${label}.keepsakeRack`);
  const fountain =
    contents.fountain === undefined ? undefined : object(contents.fountain, `${label}.fountain`);
  if (fountain !== undefined) exact(fountain, [], `${label}.fountain`, ['aromaticPhialTarget']);
  const resources =
    contents.resources === undefined
      ? undefined
      : array(contents.resources, `${label}.resources`, 4).map((entry, i) => {
          const resource = object(entry, `${label}.resources[${i}]`);
          exact(
            resource,
            ['acquisitionRole', 'grantedTraitKey', 'contributions'],
            `${label}.resources[${i}]`,
          );
          const acquisitionRole = stringValue(
            resource.acquisitionRole,
            `${label}.resources[${i}].acquisitionRole`,
          );
          const grantedTraitKey = stringValue(
            resource.grantedTraitKey,
            `${label}.resources[${i}].grantedTraitKey`,
          );
          if (acquisitionRole !== `resource:${grantedTraitKey}`)
            fail(`${label}.resources[${i}].acquisitionRole must match granted trait`);
          return Object.freeze({
            acquisitionRole,
            grantedTraitKey,
            contributions: numbers(
              resource.contributions,
              `${label}.resources[${i}].contributions`,
            ),
          });
        });
  if (
    resources !== undefined &&
    new Set(resources.map((resource) => resource.acquisitionRole)).size !== resources.length
  )
    fail(`${label}.resources has duplicate acquisition roles`);
  return Object.freeze({
    encounterPhases: Object.freeze(encounterPhases),
    requiredObjects: strings(contents.requiredObjects, `${label}.requiredObjects`, 64),
    ...(contents.incomingReward === undefined
      ? {}
      : { incomingReward: reward(contents.incomingReward, `${label}.incomingReward`) }),
    ...(shop === undefined
      ? {}
      : {
          shop: Object.freeze({
            profileKey: stringValue(shop.profileKey, `${label}.shop.profileKey`),
            offers: Object.freeze(shopOffers!),
            ...(decodedShopTravelDealRefill === undefined
              ? {}
              : { travelDealRefill: decodedShopTravelDealRefill }),
          }),
        }),
    ...(well === undefined
      ? {}
      : { stygianWell: Object.freeze({ offers: Object.freeze(wellOffers!) }) }),
    ...(pool === undefined
      ? {}
      : { purgingPool: Object.freeze({ traits: Object.freeze(poolTraits!) }) }),
    ...(rack === undefined
      ? {}
      : {
          keepsakeRack: Object.freeze({
            keepsakeKey: stringValue(rack.keepsakeKey, `${label}.keepsakeRack.keepsakeKey`),
          }),
        }),
    ...(fountain === undefined || fountain.aromaticPhialTarget === undefined
      ? {}
      : {
          fountain: Object.freeze({
            aromaticPhialTarget: stringValue(
              fountain.aromaticPhialTarget,
              `${label}.fountain.aromaticPhialTarget`,
            ),
          }),
        }),
    ...(resources === undefined ? {} : { resources: Object.freeze(resources) }),
  });
}
function outgoing(value: unknown, label: string) {
  const record = object(value, label);
  const owner = stringValue(record.owner, `${label}.owner`);
  if (record.kind === 'terminal') {
    exact(record, ['owner', 'kind'], label);
    return Object.freeze({ owner, kind: 'terminal' as const });
  }
  if (record.kind === 'fixed') {
    exact(record, ['owner', 'kind', 'target'], label);
    const target = object(record.target, `${label}.target`);
    exact(target, ['id', 'biomeKey', 'gameName'], `${label}.target`);
    return Object.freeze({
      owner,
      kind: 'fixed' as const,
      target: Object.freeze({
        id: stringValue(target.id, `${label}.target.id`),
        biomeKey: stringValue(target.biomeKey, `${label}.target.biomeKey`),
        gameName: stringValue(target.gameName, `${label}.target.gameName`),
      }),
    });
  }
  if (record.kind !== 'batch') return fail(`${label}.kind unsupported`);
  exact(record, ['owner', 'kind', 'targets', 'additional'], label, [
    'selectedExitKey',
    'selectedAdditionalKey',
    'resolvedSharedRewardStoreKey',
  ]);
  const targets = array(record.targets, `${label}.targets`, 16).map((entry, index) => {
    const target = object(entry, `${label}.targets[${index}]`);
    exact(target, ['exitKey', 'index', 'type', 'room', 'picked'], `${label}.targets[${index}]`);
    const room = object(target.room, `${label}.targets[${index}].room`);
    exact(room, ['id', 'biomeKey', 'gameName'], `${label}.targets[${index}].room`);
    return Object.freeze({
      exitKey: stringValue(target.exitKey, `${label}.targets[${index}].exitKey`),
      index: integer(target.index, `${label}.targets[${index}].index`, 1, 16),
      type: stringValue(target.type, `${label}.targets[${index}].type`),
      room: Object.freeze({
        id: stringValue(room.id, `${label}.targets[${index}].room.id`),
        biomeKey: stringValue(room.biomeKey, `${label}.targets[${index}].room.biomeKey`),
        gameName: stringValue(room.gameName, `${label}.targets[${index}].room.gameName`),
      }),
      picked: booleanValue(target.picked, `${label}.targets[${index}].picked`),
    });
  });
  const selectedExitKey =
    record.selectedExitKey === undefined
      ? undefined
      : stringValue(record.selectedExitKey, `${label}.selectedExitKey`);
  const additional = array(record.additional, `${label}.additional`, 2).map((entry, index) => {
    const item = object(entry, `${label}.additional[${index}]`);
    exact(item, ['kind', 'key', 'owner', 'room', 'picked'], `${label}.additional[${index}]`, [
      'ixionOrigin',
    ]);
    if ((item.kind !== 'chaos' && item.kind !== 'zagreusContract') || item.key !== item.kind)
      fail(`${label}.additional[${index}] has unsupported identity`);
    const room = object(item.room, `${label}.additional[${index}].room`);
    exact(room, ['id', 'biomeKey', 'gameName'], `${label}.additional[${index}].room`);
    const ixion =
      item.ixionOrigin === undefined
        ? undefined
        : object(item.ixionOrigin, `${label}.additional[${index}].ixionOrigin`);
    if (ixion !== undefined) {
      if (item.kind !== 'chaos')
        fail(`${label}.additional[${index}].ixionOrigin belongs only to Chaos`);
      exact(
        ixion,
        ['sourceBiomeKey', 'sourceOccurrenceId', 'generationKey'],
        `${label}.additional[${index}].ixionOrigin`,
      );
    }
    return Object.freeze({
      kind: item.kind as 'chaos' | 'zagreusContract',
      key: item.key as 'chaos' | 'zagreusContract',
      owner: stringValue(item.owner, `${label}.additional[${index}].owner`),
      room: Object.freeze({
        id: stringValue(room.id, `${label}.additional[${index}].room.id`),
        biomeKey: stringValue(room.biomeKey, `${label}.additional[${index}].room.biomeKey`),
        gameName: stringValue(room.gameName, `${label}.additional[${index}].room.gameName`),
      }),
      picked: booleanValue(item.picked, `${label}.additional[${index}].picked`),
      ...(ixion === undefined
        ? {}
        : {
            ixionOrigin: Object.freeze({
              sourceBiomeKey: stringValue(
                ixion.sourceBiomeKey,
                `${label}.additional[${index}].ixionOrigin.sourceBiomeKey`,
              ),
              sourceOccurrenceId: stringValue(
                ixion.sourceOccurrenceId,
                `${label}.additional[${index}].ixionOrigin.sourceOccurrenceId`,
              ),
              generationKey: stringValue(
                ixion.generationKey,
                `${label}.additional[${index}].ixionOrigin.generationKey`,
              ),
            }),
          }),
    });
  });
  const selectedAdditionalKey =
    record.selectedAdditionalKey === undefined
      ? undefined
      : stringValue(record.selectedAdditionalKey, `${label}.selectedAdditionalKey`);
  if (
    targets.length === 0 ||
    new Set(targets.map((target) => target.exitKey)).size !== targets.length ||
    new Set(targets.map((target) => target.index)).size !== targets.length ||
    targets.some((target, index) => target.index !== index + 1) ||
    targets.filter((target) => target.picked).length +
      additional.filter((item) => item.picked).length !==
      1 ||
    new Set(additional.map((item) => item.key)).size !== additional.length ||
    new Set(additional.map((item) => item.owner)).size !== additional.length ||
    (selectedExitKey === undefined && selectedAdditionalKey === undefined) ||
    (selectedExitKey !== undefined && selectedAdditionalKey !== undefined) ||
    (selectedExitKey !== undefined &&
      targets.find((target) => target.picked)?.exitKey !== selectedExitKey) ||
    (selectedAdditionalKey !== undefined &&
      additional.find((item) => item.picked)?.key !== selectedAdditionalKey)
  )
    fail(`${label} must select exactly one picked target and preserve physical order`);
  return Object.freeze({
    owner,
    kind: 'batch' as const,
    targets: Object.freeze(targets),
    additional: Object.freeze(additional),
    ...(selectedExitKey === undefined ? {} : { selectedExitKey }),
    ...(selectedAdditionalKey === undefined
      ? {}
      : { selectedAdditionalKey: selectedAdditionalKey as 'chaos' | 'zagreusContract' }),
    ...(record.resolvedSharedRewardStoreKey === undefined
      ? {}
      : {
          resolvedSharedRewardStoreKey: stringValue(
            record.resolvedSharedRewardStoreKey,
            `${label}.resolvedSharedRewardStoreKey`,
          ),
        }),
  });
}
function room(value: unknown, index: number): ExecutionRoom {
  const label = `rooms[${index}]`;
  const record = object(value, label);
  exact(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'entered', 'contents', 'trace', 'outgoing'],
    label,
    ['anomaly'],
  );
  const roomId = stringValue(record.id, `${label}.id`);
  const biomeKey = stringValue(record.biomeKey, `${label}.biomeKey`);
  const owner = stringValue(record.owner, `${label}.owner`);
  const contextBase = { owner, roomId, biomeKey };
  if (owner !== occurrenceOwner({ ...contextBase, phases: new Map() }))
    fail(`${label}.owner does not identify this occurrence`);
  const entered = booleanValue(record.entered, `${label}.entered`);
  const contents = roomContents(record.contents, `${label}.contents`);
  const anomaly =
    record.anomaly === undefined
      ? undefined
      : (() => {
          const value = object(record.anomaly, `${label}.anomaly`);
          exact(value, ['replacedRoomGameName', 'success'], `${label}.anomaly`);
          return Object.freeze({
            replacedRoomGameName: stringValue(
              value.replacedRoomGameName,
              `${label}.anomaly.replacedRoomGameName`,
            ),
            success: booleanValue(value.success, `${label}.anomaly.success`),
          });
        })();
  const phases = contents.encounterPhases;
  const phaseMap = new Map(
    phases.map((phase) => [phase.slotKey, { encounterKey: phase.encounterKey, kind: phase.kind }]),
  );
  const steps = array(record.trace, `${label}.trace`, 64).map((entry, i) =>
    trace(entry, `${label}.trace[${i}]`, { ...contextBase, phases: phaseMap }),
  );
  if (
    (entered &&
      (steps.length < 2 ||
        steps[0]?.kind !== 'roomEntered' ||
        steps.at(-1)?.kind !== 'beforeRoomExit')) ||
    (!entered && steps.length !== 0)
  )
    fail(`${label}.trace has invalid lifecycle bounds`);
  for (const step of steps) {
    if (step.kind === 'worldShopPurchase') {
      const offer = contents.shop?.offers.find((candidate) => candidate.offerKey === step.offerKey);
      if (offer === undefined || offer.rewardType !== step.rewardType)
        fail(`${label}.trace World Shop purchase does not close inventory`);
    }
    if (step.kind === 'stygianWellPurchase') {
      const offer = contents.stygianWell?.offers.find(
        (candidate) => candidate.generationKey === step.generationKey,
      );
      if (offer === undefined || offer.offerKey !== step.offerKey)
        fail(`${label}.trace Well purchase does not close inventory`);
      if (step.twistResultKey !== undefined && offer.twistResultKey !== step.twistResultKey)
        fail(`${label}.trace Well twist does not close inventory`);
    }
    if (step.kind === 'purgingPoolSale') {
      const trait = contents.purgingPool?.traits.find(
        (candidate) => candidate.slotKey === step.slotKey,
      );
      if (trait === undefined || trait.traitKey !== step.traitKey)
        fail(`${label}.trace Pool sale does not close inventory`);
    }
    if (step.kind === 'keepsakeRackChange') {
      if (contents.keepsakeRack?.keepsakeKey !== step.keepsakeKey)
        fail(`${label}.trace rack change does not close contents`);
    }
    if (step.kind === 'fountainUse') {
      if (
        (step.aromaticPhialTarget !== undefined && contents.fountain === undefined) ||
        (step.aromaticPhialTarget !== undefined &&
          contents.fountain?.aromaticPhialTarget !== step.aromaticPhialTarget)
      )
        fail(`${label}.trace fountain use does not close contents`);
    }
  }
  return Object.freeze({
    id: roomId,
    owner,
    biomeKey,
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    entered,
    contents,
    ...(anomaly === undefined ? {} : { anomaly }),
    trace: Object.freeze(steps),
    outgoing: outgoing(record.outgoing, `${label}.outgoing`),
  });
}
const diagnosticSections = [
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

function wirePlan(value: unknown): Record<string, unknown> {
  const plan = object(value, 'execution plan');
  const rooms = array(plan.rooms, 'rooms', 256);
  let expectedFrame = 0;
  let prior: Record<string, unknown> | undefined;
  const expandedRooms = rooms.map((roomValue, roomIndex) => {
    const room = object(roomValue, `rooms[${roomIndex}]`);
    const traceEntries = array(room.trace, `rooms[${roomIndex}].trace`, 64);
    const trace = traceEntries.map((stepValue, traceIndex) => {
      const step = object(stepValue, `rooms[${roomIndex}].trace[${traceIndex}]`);
      if (!('frame' in step)) return step;
      exact(
        step,
        ['frame', 'owner', 'checkpoint', 'replace'],
        `rooms[${roomIndex}].trace[${traceIndex}]`,
      );
      const frame = integer(step.frame, `rooms[${roomIndex}].trace[${traceIndex}].frame`);
      if (frame !== expectedFrame)
        fail(`rooms[${roomIndex}].trace[${traceIndex}] frame is not sequential`);
      expectedFrame += 1;
      const checkpoint = step.checkpoint;
      if (checkpoint !== 'roomEntered' && checkpoint !== 'beforeRoomExit')
        fail(`rooms[${roomIndex}].trace[${traceIndex}].checkpoint unsupported`);
      const owner = stringValue(step.owner, `rooms[${roomIndex}].trace[${traceIndex}].owner`);
      const replace = object(step.replace, `rooms[${roomIndex}].trace[${traceIndex}].replace`);
      for (const key of Object.keys(replace))
        if (!diagnosticSections.includes(key as (typeof diagnosticSections)[number]))
          fail(`rooms[${roomIndex}].trace[${traceIndex}].replace has unknown field ${key}`);
      if (frame === 0 && diagnosticSections.some((key) => !(key in replace)))
        fail(
          `rooms[${roomIndex}].trace[${traceIndex}] frame zero must replace every diagnostic section`,
        );
      if (prior === undefined) prior = {};
      prior = { ...prior, ...replace };
      return {
        kind: checkpoint,
        owner: JSON.stringify(['occurrence', 'Underworld', room.biomeKey, room.id]),
        runState: { owner, checkpoint, ...prior },
      };
    });
    return { ...room, trace };
  });
  return { ...plan, rooms: expandedRooms };
}

function wireTrace(
  step: ExecutionTraceStep,
  frame: number,
  prior: Record<string, unknown> | undefined,
) {
  if (step.kind !== 'roomEntered' && step.kind !== 'beforeRoomExit') {
    return step;
  }
  const state = step.runState as unknown as Record<string, unknown>;
  const replace: Record<string, unknown> = {};
  for (const section of diagnosticSections) {
    if (frame === 0 || JSON.stringify(state[section]) !== JSON.stringify(prior?.[section]))
      replace[section] = state[section];
  }
  return { frame, owner: state.owner, checkpoint: state.checkpoint, replace };
}
export function encodeExecutionPlan(plan: ExecutionPlan): string {
  let frame = 0;
  let prior: Record<string, unknown> | undefined;
  const rooms = plan.rooms.map((room) => ({
    ...room,
    trace: room.trace.map((step) => {
      const encoded = wireTrace(step, frame, prior);
      if (step.kind === 'roomEntered' || step.kind === 'beforeRoomExit') {
        prior = step.runState as unknown as Record<string, unknown>;
        frame += 1;
      }
      return encoded;
    }),
  }));
  return JSON.stringify({ ...plan, rooms });
}
export function decodeExecutionPlan(value: unknown): ExecutionPlan {
  const record = wirePlan(value);
  exact(
    record,
    [
      'format',
      'protocolVersion',
      'catalogVersion',
      'projectId',
      'planFingerprint',
      'routeKey',
      'extent',
      'rooms',
    ],
    'execution plan',
  );
  if (record.format !== EXECUTION_PLAN_FORMAT) fail('unsupported execution plan format');
  if (record.protocolVersion !== EXECUTION_PROTOCOL_VERSION)
    fail('unsupported execution protocol version');
  if (record.catalogVersion !== EXECUTION_CATALOG_VERSION)
    fail('unsupported execution catalog version');
  if (record.routeKey !== 'Underworld') fail('unsupported execution route');
  const extent = object(record.extent, 'extent');
  exact(extent, ['kind', 'biomeKeys', 'terminalBiomeKey'], 'extent');
  const keys = strings(extent.biomeKeys, 'extent.biomeKeys', 2);
  if (
    extent.kind !== 'configuredPrefix' ||
    !(
      (keys.length === 1 && keys[0] === 'F') ||
      (keys.length === 2 && keys[0] === 'F' && keys[1] === 'G')
    ) ||
    extent.terminalBiomeKey !== keys.at(-1)
  )
    fail('unsupported execution extent');
  const rooms = array(record.rooms, 'rooms', 256).map(room);
  if (rooms.length === 0 || !rooms[0]?.entered || rooms[0].biomeKey !== 'F')
    fail('execution plan has invalid rooms');
  if (new Set(rooms.map((room) => room.id)).size !== rooms.length)
    fail('execution plan has duplicate room ids');
  const roomsById = new Map(rooms.map((room) => [room.id, room] as const));
  for (const room of rooms) {
    if (room.biomeKey !== 'F' && room.biomeKey !== 'G')
      fail(`rooms contains unsupported biome ${room.biomeKey}`);
    const targets =
      room.outgoing.kind === 'batch'
        ? [
            ...room.outgoing.targets.map((target) => target.room),
            ...room.outgoing.additional.map((additional) => additional.room),
          ]
        : room.outgoing.kind === 'fixed'
          ? [room.outgoing.target]
          : [];
    for (const target of targets) {
      const referenced = roomsById.get(target.id);
      if (
        referenced === undefined ||
        referenced.biomeKey !== target.biomeKey ||
        referenced.gameName !== target.gameName
      ) {
        fail(`rooms.${room.id} target room identity mismatch`);
      }
    }
    if (room.outgoing.kind === 'batch') {
      for (const additional of room.outgoing.additional) {
        const expectedOwner = JSON.stringify([
          'additionalExit',
          'Underworld',
          room.biomeKey,
          room.id,
          additional.key,
        ]);
        if (additional.owner !== expectedOwner)
          fail(`rooms.${room.id} additional exit owner mismatch`);
        if (
          (additional.kind === 'chaos' && !additional.room.gameName.startsWith('Chaos_')) ||
          (additional.kind === 'zagreusContract' && additional.room.gameName !== 'C_Boss01')
        )
          fail(`rooms.${room.id} additional exit target mismatch`);
        if (additional.ixionOrigin !== undefined) {
          const source = roomsById.get(additional.ixionOrigin.sourceOccurrenceId);
          if (
            source === undefined ||
            source.biomeKey !== additional.ixionOrigin.sourceBiomeKey ||
            !source.trace.some(
              (step) =>
                step.kind === 'stygianWellPurchase' &&
                step.generationKey === additional.ixionOrigin?.generationKey &&
                step.offerKey === 'TemporaryForcedSecretDoorTrait',
            )
          )
            fail(`rooms.${room.id} Ixion origin mismatch`);
        }
      }
    }
  }
  const fingerprint = stringValue(record.planFingerprint, 'planFingerprint');
  if (!/^[0-9a-f]{8}$/.test(fingerprint))
    fail('planFingerprint must be an eight-character lowercase hexadecimal value');
  return Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: EXECUTION_CATALOG_VERSION,
    projectId: stringValue(record.projectId, 'projectId'),
    planFingerprint: fingerprint,
    routeKey: 'Underworld',
    extent: Object.freeze({
      kind: 'configuredPrefix',
      biomeKeys: Object.freeze(keys) as readonly ['F'] | readonly ['F', 'G'],
      terminalBiomeKey: extent.terminalBiomeKey as 'F' | 'G',
    }),
    rooms: Object.freeze(rooms),
  });
}
