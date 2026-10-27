import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { RunRecord, RunRecordDoorReward, RunRecordRoomReward } from '../../run-record/model';

/** The catalog route whose biome order the record walked; a Dream run has none here. */
export function routeKeyForRecord(catalog: Catalog, record: RunRecord): string | undefined {
  if (record.route.dream) return undefined;
  const first = record.route.biomes[0];
  return catalog.routes.values.find((route) => route.biomeKeys[0] === first)?.key;
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
