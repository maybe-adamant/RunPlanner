import type { Catalog, ResourceFamily } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type {
  RunRecord,
  RunRecordDoorReward,
  RunRecordRoom,
  RunRecordRoomReward,
} from '../../run-record/model';

/**
 * The catalog route whose biome order the record walked; a Dream run has none
 * here. The run count is `#GameState.RunHistory`, which only `EndRun` grows, so
 * it is zero only on a new profile's first attempt: the fresh-profile route.
 */
export function routeKeyForRecord(catalog: Catalog, record: RunRecord): string | undefined {
  if (record.route.dream) return undefined;
  const first = record.route.biomes[0];
  const fresh = record.run.runCount === 0;
  const routes = catalog.routes.values.filter((route) => route.biomeKeys[0] === first);
  return (
    routes.find((route) => (route.initialProfile.kind === 'freshFile') === fresh) ?? routes[0]
  )?.key;
}

/** The planner resource family of a gathering tool (`WeaponShopData` `Tool*` items). */
export function resourceFamilyOfTool(tool: string): ResourceFamily | undefined {
  const name = tool.replace(/\d+$/, '');
  return name === 'ToolPickaxe'
    ? 'Pickaxe'
    : name === 'ToolExorcismBook'
      ? 'Exorcism'
      : name === 'ToolShovel'
        ? 'Shovel'
        : name === 'ToolFishingRod'
          ? 'Fishing'
          : undefined;
}

/** The biome a record room belongs to: its own room set, else the room it was entered from. */
export function recordRoomBiomeKeys(catalog: Catalog, record: RunRecord): readonly string[] {
  const biomeKeys = new Set(catalog.biomes.values.map((biome) => biome.key));
  const result: string[] = [];
  let current = record.route.biomes[0] ?? '';
  for (const room of record.rooms) {
    const roomSet = catalog.rooms.byKey[room.name]?.roomSetKey;
    if (roomSet !== undefined && biomeKeys.has(roomSet)) current = roomSet;
    result.push(current);
  }
  return Object.freeze(result);
}

/**
 * The planner offer a recorded reward names: a god boon carries its loot as the
 * boon source; Devotion keeps its two gods in the recorded order.
 */
export function recordedOffer(
  catalog: Catalog,
  reward: RunRecordRoomReward | RunRecordDoorReward | undefined,
): ResolvedRewardOffer | undefined {
  const type = reward?.type;
  if (type === undefined) return undefined;
  if (catalog.rewards.rewardTypes.byKey[type] === undefined) return undefined;
  if (type === 'Boon')
    return reward?.lootName === undefined
      ? undefined
      : { rewardType: 'Boon', payload: { kind: 'BoonSource', source: reward.lootName } };
  if (type === 'Devotion') {
    const pair = 'lootNames' in reward! ? reward.lootNames : undefined;
    return pair === undefined
      ? undefined
      : {
          rewardType: 'Devotion',
          payload: { kind: 'DevotionPair', chosenSource: pair[0], spurnedSource: pair[1] },
        };
  }
  return { rewardType: type };
}

/** How many pickups of a reward type the room's uses record, by the type's and its acquisitions' names. */
export function pickupUseCount(catalog: Catalog, room: RunRecordRoom, rewardType: string): number {
  const roles = catalog.rewards.rewardTypes.byKey[rewardType]?.acquisitionRoles.values;
  const names = new Set([
    rewardType,
    ...(roles ?? []).flatMap((role) =>
      role.resolution.kind === 'fixed' ? [role.resolution.acquisition.gameName] : [],
    ),
  ]);
  return [...names].reduce((count, name) => count + (room.uses[name] ?? 0), 0);
}

/** Pom level-up screens, by their loot: a Pom of Power and a Big Pom. */
export const POM_GIVERS: ReadonlySet<string> = new Set(['StackUpgrade', 'StackUpgradeBig']);
