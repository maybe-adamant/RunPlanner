import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionPlan,
  type ExecutionRoom,
  type ExecutionTraceStep,
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
function strings(value: unknown, label: string, maximum: number): readonly string[] {
  return Object.freeze(
    array(value, label, maximum).map((entry, index) => stringValue(entry, `${label}[${index}]`)),
  );
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
  });
}
function diagnostic(value: unknown, label: string) {
  const record = object(value, label);
  exact(
    record,
    ['owner', 'checkpoint', 'counters', 'bags', 'godPool', 'traits', 'arcana', 'vows', 'forfeit'],
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
  });
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
  const id = stringValue(record.id, `${label}.id`);
  const requireRoomOwner = (): void => {
    if (stepOwner !== context.owner) fail(`${label}.owner mismatch`);
  };
  if (record.kind === 'roomEntered' || record.kind === 'beforeRoomExit') {
    exact(record, ['id', 'kind', 'owner', 'runState'], label);
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
    return Object.freeze({ id, kind: record.kind, owner: stepOwner, runState: state });
  }
  if (record.kind === 'cleanup') {
    exact(record, ['id', 'kind', 'owner'], label);
    requireRoomOwner();
    return Object.freeze({ id, kind: 'cleanup', owner: stepOwner });
  }
  if (record.kind === 'encounterStart') {
    exact(record, ['id', 'kind', 'owner', 'phase', 'encounter', 'encounterKind'], label);
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
      id,
      kind: 'encounterStart',
      owner: stepOwner,
      phase,
      encounter: stringValue(record.encounter, `${label}.encounter`),
      encounterKind: stringValue(record.encounterKind, `${label}.encounterKind`),
    });
  }
  if (record.kind === 'encounterEnd') {
    exact(record, ['id', 'kind', 'owner', 'phase', 'endEffectsExpected'], label);
    requireRoomOwner();
    const phase = stringValue(record.phase, `${label}.phase`);
    if (!context.phases.has(phase)) fail(`${label} names an undeclared encounter phase`);
    return Object.freeze({
      id,
      kind: 'encounterEnd',
      owner: stepOwner,
      phase,
      endEffectsExpected: booleanValue(record.endEffectsExpected, `${label}.endEffectsExpected`),
    });
  }
  if (record.kind === 'encounterInteraction') {
    exact(record, ['id', 'kind', 'owner', 'phaseKey'], label);
    const phaseKey = stringValue(record.phaseKey, `${label}.phaseKey`);
    if (validateEncounterAddress(stepOwner, context, `${label}.owner`) !== phaseKey)
      fail(`${label}.owner and phaseKey mismatch`);
    return Object.freeze({
      id,
      kind: 'encounterInteraction',
      owner: stepOwner,
      phaseKey,
    });
  }
  if (record.kind === 'steadyGrowth' || record.kind === 'transcendentEmbryo') {
    exact(
      record,
      record.kind === 'steadyGrowth'
        ? ['id', 'kind', 'owner', 'phase', 'source', 'target']
        : ['id', 'kind', 'owner', 'phase', 'source', 'target', 'rarity'],
      label,
    );
    requireRoomOwner();
    const phase = stringValue(record.phase, `${label}.phase`);
    if (!context.phases.has(phase)) fail(`${label} names an undeclared encounter phase`);
    const base = {
      id,
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
      ['id', 'kind', 'owner', 'sourceOwner', 'reward', 'producerLifecycleKey', 'roles'],
      label,
    );
    const roles = array(record.roles, `${label}.roles`, 16).map((entry, index) => {
      const role = object(entry, `${label}.roles[${index}]`);
      exact(role, ['role', 'lifecyclePoint', 'kind', 'gameName'], `${label}.roles[${index}]`, [
        'settlement',
        'traitOffer',
        'levelResolution',
      ]);
      const settlement =
        role.settlement === undefined
          ? undefined
          : object(role.settlement, `${label}.roles[${index}].settlement`);
      if (settlement !== undefined)
        exact(settlement, ['site', 'entry'], `${label}.roles[${index}].settlement`);
      const roleKey = stringValue(role.role, `${label}.roles[${index}].role`);
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
        lifecyclePoint: stringValue(role.lifecyclePoint, `${label}.roles[${index}].lifecyclePoint`),
        kind: stringValue(role.kind, `${label}.roles[${index}].kind`),
        gameName: stringValue(role.gameName, `${label}.roles[${index}].gameName`),
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
      id,
      kind: 'acquireReward',
      owner: stepOwner,
      sourceOwner,
      reward: parsedReward,
      producerLifecycleKey,
      roles: Object.freeze(roles),
    });
  }
  fail(`${label}.kind unsupported`);
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
  exact(record, ['owner', 'kind', 'targets', 'selectedExitKey'], label, [
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
  const selectedExitKey = stringValue(record.selectedExitKey, `${label}.selectedExitKey`);
  if (
    targets.length === 0 ||
    new Set(targets.map((target) => target.exitKey)).size !== targets.length ||
    new Set(targets.map((target) => target.index)).size !== targets.length ||
    targets.some((target, index) => target.index !== index + 1) ||
    targets.filter((target) => target.picked).length !== 1 ||
    targets.find((target) => target.picked)?.exitKey !== selectedExitKey
  )
    fail(`${label} must select exactly one picked target and preserve physical order`);
  return Object.freeze({
    owner,
    kind: 'batch' as const,
    targets: Object.freeze(targets),
    selectedExitKey,
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
  );
  const roomId = stringValue(record.id, `${label}.id`);
  const biomeKey = stringValue(record.biomeKey, `${label}.biomeKey`);
  const owner = stringValue(record.owner, `${label}.owner`);
  const contextBase = { owner, roomId, biomeKey };
  if (owner !== occurrenceOwner({ ...contextBase, phases: new Map() }))
    fail(`${label}.owner does not identify this occurrence`);
  const entered = booleanValue(record.entered, `${label}.entered`);
  const contents = object(record.contents, `${label}.contents`);
  exact(contents, ['encounterPhases', 'requiredObjects'], `${label}.contents`, ['incomingReward']);
  const phases = array(contents.encounterPhases, `${label}.contents.encounterPhases`, 16).map(
    (entry, i) => {
      const phase = object(entry, `${label}.contents.encounterPhases[${i}]`);
      exact(phase, ['slotKey', 'encounterKey', 'kind'], `${label}.contents.encounterPhases[${i}]`);
      return Object.freeze({
        slotKey: stringValue(phase.slotKey, `${label}.contents.encounterPhases[${i}].slotKey`),
        encounterKey: stringValue(
          phase.encounterKey,
          `${label}.contents.encounterPhases[${i}].encounterKey`,
        ),
        kind: stringValue(phase.kind, `${label}.contents.encounterPhases[${i}].kind`),
      });
    },
  );
  if (new Set(phases.map((phase) => phase.slotKey)).size !== phases.length)
    fail(`${label}.contents.encounterPhases has duplicate slots`);
  const phaseMap = new Map(
    phases.map((phase) => [phase.slotKey, { encounterKey: phase.encounterKey, kind: phase.kind }]),
  );
  const steps = array(record.trace, `${label}.trace`, 128).map((entry, i) =>
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
  return Object.freeze({
    id: roomId,
    owner,
    biomeKey,
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    entered,
    contents: Object.freeze({
      ...(contents.incomingReward === undefined
        ? {}
        : { incomingReward: reward(contents.incomingReward, `${label}.contents.incomingReward`) }),
      encounterPhases: Object.freeze(phases),
      requiredObjects: strings(contents.requiredObjects, `${label}.contents.requiredObjects`, 64),
    }),
    trace: Object.freeze(steps),
    outgoing: outgoing(record.outgoing, `${label}.outgoing`),
  });
}
export function encodeExecutionPlan(plan: ExecutionPlan): string {
  return JSON.stringify(plan);
}
export function decodeExecutionPlan(value: unknown): ExecutionPlan {
  const record = object(value, 'execution plan');
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
        ? room.outgoing.targets.map((target) => target.room)
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
