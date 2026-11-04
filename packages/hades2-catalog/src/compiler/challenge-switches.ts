import {
  CHALLENGE_SWITCH_KINDS,
  type CatalogCollection,
  type ChallengeSwitchCatalog,
  type ChallengeSwitchHostDeclaration,
  type ChallengeSwitchKindDeclaration,
  type ChallengeSwitchVariantDeclaration,
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
 * Normalizes the switch kinds, variants and hosts. A host is every anchored
 * room of a declared RoomSet whose own chance is not zero; every other
 * anchored room must be declared spawn-free, so no anchored room is silent.
 */
export function normalizeChallengeSwitches(
  raw: RawChallengeSwitchInput,
  rooms: CatalogCollection<RoomDeclaration>,
  rewards: RewardKernelCatalog,
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

  const gold = raw.gold;
  requirePositiveInteger(gold.minimumValue, `${path}.gold.minimumValue`);
  requirePositiveInteger(gold.startingValue, `${path}.gold.startingValue`);
  requirePositiveInteger(gold.defaultValue, `${path}.gold.defaultValue`);
  if (gold.minimumValue > gold.defaultValue || gold.defaultValue > gold.startingValue)
    fail(`${path}.gold`, 'must order minimumValue <= defaultValue <= startingValue');

  return Object.freeze({
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
