import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../declarations';
import { fail } from './errors';
import { type RoomIdentityFacts } from './room-core-facts';
import { type RoomRewardFacts } from './room-reward-facts';

export type RoomFeatureFacts = Pick<
  RoomDeclaration,
  | 'hasKeepsakeRack'
  | 'hasRequiredFountain'
  | 'challengeSwitchAnchorCount'
  | 'purgingPool'
  | 'surfaceShop'
  | 'roomShop'
  | 'secretPointAnchorCount'
  | 'boonRarityOverride'
>;

export type RoomRequiredObjectFacts = Pick<RoomDeclaration, 'requiredObjects'>;
export type RoomInfernalContractFacts = Pick<RoomDeclaration, 'infernalContractReward'>;

function normalizeBoonRarityOverride(
  raw: RawRoomDeclaration['boonRarityOverride'],
  path: string,
): RoomDeclaration['boonRarityOverride'] {
  if (raw === undefined) return undefined;
  for (const [key, amount] of Object.entries(raw)) {
    if (
      !['Rare', 'Epic', 'Duo', 'Legendary'].includes(key) ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount)
    ) {
      fail(`${path}.${key}`, 'must be a finite supported boon rarity check');
    }
  }
  return Object.freeze({ ...raw });
}

/** Normalizes required room objects at their original validation boundary. */
export function normalizeRoomRequiredObjectFacts(
  room: RawRoomDeclaration,
  path: string,
): RoomRequiredObjectFacts {
  const requiredObjectKeys = new Set<string>();
  const requiredObjects = room.requiredObjects?.map((object, objectIndex) => {
    const objectPath = `${path}.requiredObjects[${objectIndex}]`;
    if (object.key !== 'SoulPylon')
      fail(`${objectPath}.key`, `unknown required room object ${String(object.key)}`);
    if (object.spawnTiming !== 'roomEntry')
      fail(`${objectPath}.spawnTiming`, `unknown spawn timing ${String(object.spawnTiming)}`);
    if (object.completionRequirement !== 'destroyBeforeExit')
      fail(
        `${objectPath}.completionRequirement`,
        `unknown completion requirement ${String(object.completionRequirement)}`,
      );
    if (requiredObjectKeys.has(object.key)) fail(`${objectPath}.key`, `duplicates ${object.key}`);
    requiredObjectKeys.add(object.key);
    return Object.freeze({
      key: 'SoulPylon' as const,
      spawnTiming: 'roomEntry' as const,
      completionRequirement: 'destroyBeforeExit' as const,
    });
  });
  if (requiredObjects !== undefined && requiredObjects.length === 0)
    fail(`${path}.requiredObjects`, 'must not be empty when declared');
  return Object.freeze({
    ...(requiredObjects === undefined ? {} : { requiredObjects: Object.freeze(requiredObjects) }),
  });
}

/** Normalizes the Preboss-owned Infernal Contract reward surface. */
export function normalizeRoomInfernalContractFacts(
  room: RawRoomDeclaration,
  identity: RoomIdentityFacts,
  rewards: RoomRewardFacts,
  rewardCatalog: RewardKernelCatalog,
  path: string,
): RoomInfernalContractFacts {
  const infernalContractReward = (() => {
    const raw = room.infernalContractReward;
    if (raw === undefined) return undefined;
    if (
      identity.kind !== 'Preboss' ||
      identity.mode.kind !== 'authored' ||
      identity.mode.templateKey !== 'Preboss' ||
      rewards.incomingReward.kind !== 'shop'
    ) {
      fail(`${path}.infernalContractReward`, 'requires an authored Preboss Shop');
    }
    if (raw.entryKey !== 'infernalContractReward')
      fail(`${path}.infernalContractReward.entryKey`, 'must be infernalContractReward');
    const expected = [
      'BlindBoxLoot',
      'StackUpgradeBig',
      'StackUpgrade',
      'TalentBigDrop',
      'TalentDrop',
    ] as const;
    if (
      raw.rewardTypes.length !== expected.length ||
      expected.some((rewardType, index) => raw.rewardTypes[index] !== rewardType)
    ) {
      fail(`${path}.infernalContractReward.rewardTypes`, 'must match ZagPedestalOptions');
    }
    const lifecycle = rewardCatalog.producerLifecycles.byKey[raw.producerLifecycleKey];
    if (
      lifecycle === undefined ||
      expected.some((rewardType) => lifecycle.rewardTypes.byKey[rewardType] === undefined)
    ) {
      fail(`${path}.infernalContractReward.producerLifecycleKey`, 'must support the pedestal pool');
    }
    return Object.freeze({
      entryKey: 'infernalContractReward' as const,
      producerLifecycleKey: lifecycle.key,
      rewardTypes: Object.freeze([...expected]) as unknown as readonly [
        string,
        string,
        string,
        string,
        string,
      ],
    });
  })();
  return Object.freeze({
    ...(infernalContractReward === undefined ? {} : { infernalContractReward }),
  });
}

/** Normalizes resources, Shops, anchors, fountain, Pool, and rarity facts. */
export function normalizeRoomFeatureFacts(
  room: RawRoomDeclaration,
  path: string,
): RoomFeatureFacts {
  const boonRarityOverride = normalizeBoonRarityOverride(
    room.boonRarityOverride,
    `${path}.boonRarityOverride`,
  );
  const purgingPool =
    room.purgingPool === undefined
      ? undefined
      : (() => {
          const slotKeys = room.purgingPool.slotKeys;
          if (
            slotKeys.length !== 3 ||
            slotKeys[0] !== 'left' ||
            slotKeys[1] !== 'middle' ||
            slotKeys[2] !== 'right'
          ) {
            fail(`${path}.purgingPool.slotKeys`, 'must be left, middle, right');
          }
          return Object.freeze({
            slotKeys: Object.freeze([...slotKeys]) as readonly ['left', 'middle', 'right'],
          });
        })();
  const challengeSwitchAnchorCount = room.challengeSwitchAnchorCount;
  if (
    challengeSwitchAnchorCount !== undefined &&
    (!Number.isInteger(challengeSwitchAnchorCount) || challengeSwitchAnchorCount < 0)
  ) {
    fail(`${path}.challengeSwitchAnchorCount`, 'must be a non-negative integer');
  }
  const secretPointAnchorCount = room.secretPointAnchorCount;
  if (
    secretPointAnchorCount !== undefined &&
    (!Number.isInteger(secretPointAnchorCount) || secretPointAnchorCount < 0)
  ) {
    fail(`${path}.secretPointAnchorCount`, 'must be a non-negative integer');
  }
  const surfaceShop =
    room.surfaceShop === undefined
      ? undefined
      : (() => {
          if (room.surfaceShop.profileKey !== 'SurfaceShop')
            fail(`${path}.surfaceShop.profileKey`, 'must be SurfaceShop');
          if (
            !Number.isFinite(room.surfaceShop.spawnChance) ||
            room.surfaceShop.spawnChance < 0 ||
            room.surfaceShop.spawnChance > 1
          ) {
            fail(`${path}.surfaceShop.spawnChance`, 'must be a probability from 0 through 1');
          }
          return Object.freeze({
            profileKey: 'SurfaceShop' as const,
            spawnChance: room.surfaceShop.spawnChance,
            forced: room.surfaceShop.forced === true,
          });
        })();
  const roomShop =
    room.roomShop === undefined
      ? undefined
      : (() => {
          if (room.roomShop.profileKey !== 'RoomShop')
            fail(`${path}.roomShop.profileKey`, 'must be RoomShop');
          if (
            !Number.isFinite(room.roomShop.spawnChance) ||
            room.roomShop.spawnChance < 0 ||
            room.roomShop.spawnChance > 1
          ) {
            fail(`${path}.roomShop.spawnChance`, 'must be a probability from 0 through 1');
          }
          return Object.freeze({
            profileKey: 'RoomShop' as const,
            spawnChance: room.roomShop.spawnChance,
            forced: room.roomShop.forced === true,
          });
        })();
  return Object.freeze({
    hasKeepsakeRack: room.hasKeepsakeRack ?? false,
    hasRequiredFountain: room.hasRequiredFountain ?? false,
    ...(challengeSwitchAnchorCount === undefined ? {} : { challengeSwitchAnchorCount }),
    ...(purgingPool === undefined ? {} : { purgingPool }),
    ...(surfaceShop === undefined ? {} : { surfaceShop }),
    ...(roomShop === undefined ? {} : { roomShop }),
    ...(secretPointAnchorCount === undefined ? {} : { secretPointAnchorCount }),
    ...(boonRarityOverride === undefined ? {} : { boonRarityOverride }),
  });
}

/** Normalizes the complete declaration-backed resource support product. */
export function normalizeRoomResourcePointSupport(
  raw: RawRoomDeclaration,
  path: string,
): RoomDeclaration['resourcePointSupport'] {
  const support = raw.resourcePointSupport;
  if (support === undefined)
    fail(`${path}.resourcePointSupport`, 'must declare source-backed resource support');
  const families = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
  const known = new Set(families);
  const supportKeys = new Set(['families', 'capacity', 'ignoresBiomeLimit', 'rules']);
  if (Object.keys(support).some((key) => !supportKeys.has(key)))
    fail(`${path}.resourcePointSupport`, 'contains unknown field');
  if (support.families.some((family) => !known.has(family)))
    fail(`${path}.resourcePointSupport.families`, 'contains unknown family');
  if (new Set(support.families).size !== support.families.length)
    fail(`${path}.resourcePointSupport.families`, 'must not contain duplicate families');
  if (support.capacity !== 'simpleComplex' && support.capacity !== 'allTools')
    fail(`${path}.resourcePointSupport.capacity`, 'must be simpleComplex or allTools');
  if (support.ignoresBiomeLimit !== undefined && support.ignoresBiomeLimit !== true)
    fail(`${path}.resourcePointSupport.ignoresBiomeLimit`, 'must be true when present');
  if (
    Object.keys(support.rules).length !== families.length ||
    families.some((family) => !(family in support.rules))
  ) {
    fail(`${path}.resourcePointSupport.rules`, 'must contain exactly every resource family');
  }
  const rules: Record<
    string,
    RoomDeclaration['resourcePointSupport']['rules'][(typeof families)[number]]
  > = {};
  for (const family of families) {
    const rule = support.rules[family];
    const ruleKeys = new Set([
      'grantedTraitKey',
      'element',
      'sameFamilyLookback',
      'crossFamilyLookback',
    ]);
    if (Object.keys(rule ?? {}).some((key) => !ruleKeys.has(key)))
      fail(`${path}.resourcePointSupport.rules.${family}`, 'contains unknown field');
    if (
      rule === undefined ||
      typeof rule.grantedTraitKey !== 'string' ||
      rule.grantedTraitKey.trim() === ''
    ) {
      fail(`${path}.resourcePointSupport.rules.${family}`, 'must declare a granted trait key');
    }
    if (!['Fire', 'Air', 'Earth', 'Water'].includes(rule.element))
      fail(`${path}.resourcePointSupport.rules.${family}.element`, 'must be a supported element');
    if (!Number.isInteger(rule.sameFamilyLookback) || rule.sameFamilyLookback < 0)
      fail(
        `${path}.resourcePointSupport.rules.${family}.sameFamilyLookback`,
        'must be a non-negative integer',
      );
    const cross = rule.crossFamilyLookback;
    if (
      cross === null ||
      typeof cross !== 'object' ||
      Array.isArray(cross) ||
      Object.keys(cross).length !== families.length ||
      Object.keys(cross).some((key) => !known.has(key as (typeof families)[number])) ||
      families.some((key) => !(key in cross))
    ) {
      fail(
        `${path}.resourcePointSupport.rules.${family}.crossFamilyLookback`,
        'must contain exactly every resource family',
      );
    }
    const crossFamilyLookback: Record<string, number> = {};
    for (const other of families) {
      const value = cross[other];
      if (!Number.isInteger(value) || value < 0)
        fail(
          `${path}.resourcePointSupport.rules.${family}.crossFamilyLookback.${other}`,
          'must be a non-negative integer',
        );
      crossFamilyLookback[other] = value;
    }
    rules[family] = Object.freeze({
      grantedTraitKey: rule.grantedTraitKey,
      element: rule.element,
      sameFamilyLookback: rule.sameFamilyLookback,
      crossFamilyLookback: Object.freeze(crossFamilyLookback),
    });
  }
  return Object.freeze({
    families: Object.freeze([...support.families]),
    capacity: support.capacity,
    rules: Object.freeze(rules),
    ...(support.ignoresBiomeLimit === true ? { ignoresBiomeLimit: true } : {}),
  });
}
