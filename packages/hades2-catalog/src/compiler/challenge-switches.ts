import {
  CHALLENGE_SWITCH_KINDS,
  type CatalogCollection,
  type ChallengeSwitchCatalog,
  type ChallengeSwitchHostDeclaration,
  type ChallengeSwitchKindDeclaration,
  type ChallengeSwitchVariantDeclaration,
  type EncounterDefinition,
  type EncounterSet,
  type RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawChallengeSwitchInput } from '../declarations/challenge-switches-types';
import { createCollection, requireNonEmpty, requirePositiveInteger } from './common';
import { fail } from './errors';

function requireChance(value: number, path: string): number {
  if (typeof value !== 'number' || !(value > 0) || value > 1)
    fail(path, 'must be a chance above 0 and at most 1');
  return value;
}

function requireRewardType(rewards: RewardKernelCatalog, rewardType: string, path: string): string {
  requireNonEmpty(rewardType, path);
  if (rewards.rewardTypes.byKey[rewardType] === undefined)
    fail(path, `unknown reward type ${rewardType}`);
  return rewardType;
}

/**
 * Each RoomSet's switch encounters are declared definitions native generates
 * at room entry, outside every encounter set and fixed binding: Time and
 * PerfectClear through a generated composition with RequireCompletedIntro,
 * Elite as its declared one-elite encounter with no composition. Every one
 * counts encounter depth, cannot be skipped and draws a money store.
 */
function validateChallengeEncounters(
  path: string,
  roomSets: readonly RawChallengeSwitchInput['roomSets'][number][],
  eliteEncounters: CatalogCollection<{ readonly encounterKey: string }>,
  rooms: CatalogCollection<RoomDeclaration>,
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
): void {
  const bound = new Set([
    ...sets.values.flatMap((set) => set.encounterDefinitionKeys),
    ...rooms.values.flatMap((room) =>
      room.encounterSlotBindings.flatMap((binding) =>
        binding.kind === 'fixed'
          ? [
              binding.encounterDefinitionKey,
              ...(binding.rivalsEncounterDefinitionKey === undefined
                ? []
                : [binding.rivalsEncounterDefinitionKey]),
              ...(binding.shadowEncounterDefinitionKey === undefined
                ? []
                : [binding.shadowEncounterDefinitionKey]),
            ]
          : [],
      ),
    ),
  ]);
  const seen = new Set<string>();
  for (const roomSet of roomSets)
    for (const kind of CHALLENGE_SWITCH_KINDS) {
      const key = roomSet.encounterKeyBySwitchKind[kind];
      const encounterPath = `${path}.roomSets.${roomSet.roomSetKey}.encounterKeyBySwitchKind.${kind}`;
      if (seen.has(key)) fail(encounterPath, `${key} serves more than one switch`);
      seen.add(key);
      const definition = definitions.byKey[key];
      if (definition === undefined) fail(encounterPath, `undeclared encounter ${key}`);
      if (bound.has(key)) fail(encounterPath, `${key} is also a room encounter`);
      if (definition.kind !== 'combat') fail(encounterPath, `${key} must be a combat`);
      if (!definition.countsEncounterDepth || definition.canEncounterSkip)
        fail(encounterPath, `${key} must count encounter depth and refuse a skip`);
      if (definition.moneyStore === undefined)
        fail(encounterPath, `${key} must draw a money store`);
      const generated = (definition.customization ?? []).filter(
        (decision) => decision.selection.kind === 'generated',
      );
      if ((definition.customization ?? []).length !== generated.length)
        fail(encounterPath, `${key} may declare only a generated composition`);
      if (kind === 'elite') {
        if (eliteEncounters.byKey[key] === undefined)
          fail(encounterPath, `${key} is not a declared Elite encounter`);
        if (generated.length !== 0)
          fail(encounterPath, `${key} fields its one elite, not a generated composition`);
        continue;
      }
      const selection = generated[0]?.selection;
      if (generated.length !== 1 || selection?.kind !== 'generated')
        fail(encounterPath, `${key} must declare one generated composition`);
      if (selection.requireCompletedIntro !== true)
        fail(encounterPath, `${key} must require completed introductions`);
      if (selection.preparation !== 'roomEntry')
        fail(encounterPath, `${key} is generated at room entry`);
    }
}

/**
 * Normalizes the switch kinds, variants and hosts. A host is every anchored
 * room of a declared RoomSet whose own chance is not zero; every other
 * anchored room must be declared spawn-free, so no anchored room is silent.
 */
export function normalizeChallengeSwitches(
  raw: RawChallengeSwitchInput,
  rooms: CatalogCollection<RoomDeclaration>,
  rewards: RewardKernelCatalog,
  encounters: {
    readonly definitions: CatalogCollection<EncounterDefinition>;
    readonly sets: CatalogCollection<EncounterSet>;
  },
): ChallengeSwitchCatalog {
  const path = 'challengeSwitches';
  const lifecycle = rewards.producerLifecycles.byKey[raw.producerLifecycleKey];
  if (lifecycle === undefined)
    fail(`${path}.producerLifecycleKey`, `unknown producer lifecycle ${raw.producerLifecycleKey}`);
  const lifecycleReward = (rewardType: string, rewardPath: string) => {
    requireRewardType(rewards, rewardType, rewardPath);
    if (lifecycle.rewardTypes.byKey[rewardType] === undefined)
      fail(rewardPath, `${rewardType} is not a ${raw.producerLifecycleKey} reward`);
    return rewardType;
  };

  const variants = createCollection(
    raw.variants.map((variant, index): ChallengeSwitchVariantDeclaration => {
      const variantPath = `${path}.variants[${index}]`;
      if (!CHALLENGE_SWITCH_KINDS.includes(variant.switchKind))
        fail(`${variantPath}.switchKind`, `unknown switch kind ${String(variant.switchKind)}`);
      return Object.freeze({
        key: requireNonEmpty(variant.key, `${variantPath}.key`),
        switchKind: variant.switchKind,
        weight: requirePositiveInteger(variant.weight, `${variantPath}.weight`),
        rewardType: lifecycleReward(variant.rewardType, `${variantPath}.rewardType`),
        ...(variant.requirement === undefined ? {} : { requirement: variant.requirement }),
      });
    }),
    `${path}.variants`,
    (variant) => variant.key,
  );

  if (raw.kinds.length !== CHALLENGE_SWITCH_KINDS.length)
    fail(`${path}.kinds`, 'must declare every switch kind once');
  const kinds = createCollection(
    raw.kinds.map((kind, index): ChallengeSwitchKindDeclaration => {
      const kindPath = `${path}.kinds[${index}]`;
      if (!CHALLENGE_SWITCH_KINDS.includes(kind.key))
        fail(`${kindPath}.key`, `unknown switch kind ${String(kind.key)}`);
      if (variants.byKey[kind.defaultVariantKey]?.switchKind !== kind.key)
        fail(`${kindPath}.defaultVariantKey`, `is not a ${kind.key} variant`);
      if (!variants.values.some((variant) => variant.switchKind === kind.key))
        fail(kindPath, 'has no variant');
      const goldVariants = variants.values.filter(
        (variant) => variant.switchKind === kind.key && variant.rewardType === 'Money',
      );
      if (kind.goldReward !== goldVariants.length > 0)
        fail(`${kindPath}.goldReward`, 'must match whether its variants pay gold');
      return Object.freeze({
        key: kind.key,
        defaultVariantKey: kind.defaultVariantKey,
        goldReward: kind.goldReward,
        ...(kind.minimumBiomeDepth === undefined
          ? {}
          : {
              minimumBiomeDepth: requirePositiveInteger(
                kind.minimumBiomeDepth,
                `${kindPath}.minimumBiomeDepth`,
              ),
            }),
        ...(kind.requirement === undefined ? {} : { requirement: kind.requirement }),
        ...(kind.hitRewardType === undefined
          ? {}
          : { hitRewardType: lifecycleReward(kind.hitRewardType, `${kindPath}.hitRewardType`) }),
      });
    }),
    `${path}.kinds`,
    (kind) => kind.key,
  );

  const roomSets = new Map(
    raw.roomSets.map((roomSet, index) => {
      const roomSetPath = `${path}.roomSets[${index}]`;
      requireNonEmpty(roomSet.roomSetKey, `${roomSetPath}.roomSetKey`);
      requireChance(roomSet.spawnChance, `${roomSetPath}.spawnChance`);
      for (const kind of CHALLENGE_SWITCH_KINDS)
        requireNonEmpty(
          roomSet.encounterKeyBySwitchKind[kind],
          `${roomSetPath}.encounterKeyBySwitchKind.${kind}`,
        );
      return [roomSet.roomSetKey, roomSet] as const;
    }),
  );
  if (roomSets.size !== raw.roomSets.length) fail(`${path}.roomSets`, 'duplicates a RoomSet');

  const noSpawn = new Set(raw.noSpawnRoomGameNames);
  if (noSpawn.size !== raw.noSpawnRoomGameNames.length)
    fail(`${path}.noSpawnRoomGameNames`, 'duplicates a room');
  raw.noSpawnRoomGameNames.forEach((gameName, index) => {
    if ((rooms.byKey[gameName]?.challengeSwitchAnchorCount ?? 0) <= 0)
      fail(`${path}.noSpawnRoomGameNames[${index}]`, `${gameName} is not an anchored room`);
  });

  const hosts: ChallengeSwitchHostDeclaration[] = [];
  for (const room of rooms.values) {
    if ((room.challengeSwitchAnchorCount ?? 0) <= 0 || noSpawn.has(room.gameName)) continue;
    const roomSet = roomSets.get(room.roomSetKey);
    if (roomSet === undefined)
      fail(path, `anchored room ${room.gameName} has no RoomSet switch chance`);
    hosts.push(
      Object.freeze({
        gameName: room.gameName,
        spawnChance: roomSet.spawnChance,
        encounterKeyBySwitchKind: Object.freeze({ ...roomSet.encounterKeyBySwitchKind }),
      }),
    );
  }

  const eliteEncounters = createCollection(
    raw.eliteEncounters.map((encounter, index) => {
      const encounterPath = `${path}.eliteEncounters[${index}]`;
      requireNonEmpty(encounter.encounterKey, `${encounterPath}.encounterKey`);
      if (encounter.enemies.length === 0) fail(`${encounterPath}.enemies`, 'must not be empty');
      encounter.enemies.forEach((enemy, enemyIndex) => {
        const facts = encounter.attributeOptionsByEnemy[enemy.key];
        if (facts === undefined || facts.options.length === 0)
          fail(`${encounterPath}.enemies[${enemyIndex}]`, `${enemy.key} has no attribute options`);
        for (const option of facts.options)
          if (encounter.attributes[option] === undefined)
            fail(`${encounterPath}.enemies[${enemyIndex}]`, `unknown attribute ${option}`);
      });
      requirePositiveInteger(encounter.attributeCount, `${encounterPath}.attributeCount`);
      requirePositiveInteger(encounter.spawnCount, `${encounterPath}.spawnCount`);
      for (const key of encounter.bannedAttributeKeys)
        if (encounter.attributes[key] === undefined)
          fail(`${encounterPath}.bannedAttributeKeys`, `unknown attribute ${key}`);
      return Object.freeze({
        encounterKey: encounter.encounterKey,
        enemies: Object.freeze([...encounter.enemies]),
        spawnCount: encounter.spawnCount,
        attributeOptionsByEnemy: Object.freeze(
          Object.fromEntries(
            encounter.enemies.map((enemy) => [
              enemy.key,
              Object.freeze({
                options: Object.freeze([...encounter.attributeOptionsByEnemy[enemy.key]!.options]),
                blockedOptions: Object.freeze([
                  ...encounter.attributeOptionsByEnemy[enemy.key]!.blockedOptions,
                ]),
              }),
            ]),
          ),
        ),
        attributeCount: encounter.attributeCount,
        bannedAttributeKeys: Object.freeze([...encounter.bannedAttributeKeys]),
        attributes: Object.freeze({ ...encounter.attributes }),
      });
    }),
    `${path}.eliteEncounters`,
    (encounter) => encounter.encounterKey,
    'encounterKey',
  );
  for (const host of hosts)
    if (eliteEncounters.byKey[host.encounterKeyBySwitchKind.elite] === undefined)
      fail(path, `host ${host.gameName} names no declared ${host.encounterKeyBySwitchKind.elite}`);
  validateChallengeEncounters(
    path,
    [...roomSets.values()],
    eliteEncounters,
    rooms,
    encounters.definitions,
    encounters.sets,
  );

  const gold = raw.gold;
  requirePositiveInteger(gold.minimumValue, `${path}.gold.minimumValue`);
  requirePositiveInteger(gold.startingValue, `${path}.gold.startingValue`);
  requirePositiveInteger(gold.defaultValue, `${path}.gold.defaultValue`);
  if (gold.minimumValue > gold.defaultValue || gold.defaultValue > gold.startingValue)
    fail(`${path}.gold`, 'must order minimumValue <= defaultValue <= startingValue');

  return Object.freeze({
    eliteEncounters,
    kinds,
    variants,
    hosts: createCollection(hosts, `${path}.hosts`, (host) => host.gameName, 'gameName'),
    minimumBiomeDepth: requirePositiveInteger(raw.minimumBiomeDepth, `${path}.minimumBiomeDepth`),
    minimumRoomsSinceLast: requirePositiveInteger(
      raw.minimumRoomsSinceLast,
      `${path}.minimumRoomsSinceLast`,
    ),
    producerLifecycleKey: raw.producerLifecycleKey,
    gold: Object.freeze({
      startingValue: gold.startingValue,
      minimumValue: gold.minimumValue,
      defaultValue: gold.defaultValue,
    }),
    bonusReward: Object.freeze({
      rewardType: lifecycleReward(raw.bonusReward.rewardType, `${path}.bonusReward.rewardType`),
      dropChance: requireChance(raw.bonusReward.dropChance, `${path}.bonusReward.dropChance`),
    }),
  });
}
