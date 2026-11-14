import { roomActionKey, semanticAddressKey } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  RoomSpawnedLoot,
  SpawnCause,
  SpawnMoment,
  SpawnUnlock,
  SpawnedLootItem,
  SpawnedLootReward,
} from '@run-planner/engine/simulation';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import type {
  WorkspaceActionSpawn,
  WorkspaceLiveFace,
  WorkspaceRoomActionRow,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSpawnGroup,
  WorkspaceSpawnCopy,
  WorkspaceSpawnSource,
  WorkspaceSpawnedItem,
} from '../contracts/timeline';

type TimelineEntry = WorkspaceRoomLifecycleTimelineEntry;
type SpawnedEntry = Extract<TimelineEntry, { readonly kind: 'spawned' }>;

/** What an item spawns as, drawn as a reward's face: its offer, its concrete pickup or its drop. */
export function spawnedRewardFace(
  reward: SpawnedLootReward,
): NonNullable<WorkspaceLiveFace['reward']> {
  const offer =
    reward.kind === 'offer'
      ? reward.offer
      : Object.freeze({
          rewardType: reward.kind === 'pickup' ? reward.gameName : reward.consumableKey,
        });
  return Object.freeze({ offer, boosted: false });
}

/** The name a spawned item's chip carries: its row's name, else its whole label. */
function itemLabel(row: WorkspaceRoomActionRow | undefined): string {
  return row?.labelParts?.name ?? row?.label ?? 'Pickup';
}

function fieldsPlace(
  roomLocal: WorkspaceRoomLocal,
  item: SpawnedLootItem,
): WorkspaceSpawnedItem['place'] {
  if (item.source.kind !== 'fieldsReward' || roomLocal.kind !== 'fields') return undefined;
  const { groupKey, slotKey } = item.source;
  const local = [...roomLocal.cages, ...roomLocal.optionalRewards].find(
    (candidate) =>
      candidate.control.owner.address.kind === 'localReward' &&
      candidate.control.owner.address.groupKey === groupKey &&
      candidate.control.owner.address.slotKey === slotKey,
  );
  return local === undefined
    ? undefined
    : Object.freeze({ badge: local.badge, label: local.label });
}

function projectItem(
  item: SpawnedLootItem,
  rowByKey: ReadonlyMap<string, WorkspaceRoomActionRow>,
  roomLocal: WorkspaceRoomLocal,
  unlocked: boolean,
): WorkspaceSpawnedItem {
  const actionKey = roomActionKey(item.reference);
  const row = rowByKey.get(actionKey);
  const place = fieldsPlace(roomLocal, item);
  const label = itemLabel(row);
  return Object.freeze({
    key: semanticAddressKey(item.owner),
    actionKey,
    label,
    ...(item.reward === undefined ? {} : { reward: spawnedRewardFace(item.reward) }),
    participation: item.participation,
    ...(place === undefined ? {} : { place }),
    ...(item.lockedUntil === undefined || unlocked ? {} : { locked: true as const }),
    placed: item.placement.kind === 'placed',
  });
}

/** The boon, keepsake, NPC or room object that spawned an item; the room's own rewards have none. */
function spawnSource(
  catalog: Catalog,
  item: SpawnedLootItem,
  sourceRow: WorkspaceRoomActionRow | undefined,
): WorkspaceSpawnSource | undefined {
  if (item.source.kind !== 'generated') return undefined;
  const family = item.source.family;
  const source = (key: string, name: string): WorkspaceSpawnSource =>
    Object.freeze({ key, name, family });
  switch (family.kind) {
    case 'trait':
      return source(
        `trait:${family.traitKey}`,
        catalog.traits.byKey[family.traitKey]?.label ?? family.traitKey,
      );
    case 'hermesShrineDelivery':
      return source(family.kind, 'Hermes');
    case 'echo':
      return source(family.kind, 'Echo');
    case 'nemesisEvent':
      return source(family.kind, 'Nemesis');
    case 'erisGift':
      return source(family.kind, 'Eris');
    case 'heraclesBounty':
      return source(family.kind, 'Heracles');
    case 'challengeSwitch': {
      const kind = sourceRow?.challengeSwitchKind;
      return kind === undefined
        ? source(family.kind, 'Challenge Switch')
        : Object.freeze({
            ...source(family.kind, challengeSwitchKindLabel(kind)),
            challengeSwitchKind: kind,
          });
    }
    case 'artificer':
      return source(family.kind, 'Artificer');
    case 'seaStar':
      return source(family.kind, 'Sea Star');
    case 'shopTravelDealRefill':
      return undefined;
  }
}

/** Items in spawn order, each run from one source read as one group. */
function spawnGroups(
  items: readonly SpawnedLootItem[],
  project: (item: SpawnedLootItem) => WorkspaceSpawnedItem,
  source: (item: SpawnedLootItem) => WorkspaceSpawnSource | undefined,
): readonly WorkspaceSpawnGroup[] {
  const groups: { key: string; source?: WorkspaceSpawnSource; items: WorkspaceSpawnedItem[] }[] =
    [];
  for (const item of items) {
    const itemSource = source(item);
    const projected = project(item);
    const last = groups.at(-1);
    if (last !== undefined && last.source?.key === itemSource?.key) {
      last.items.push(projected);
      continue;
    }
    groups.push({
      key: `${itemSource?.key ?? 'own'}:${projected.key}`,
      ...(itemSource === undefined ? {} : { source: itemSource }),
      items: [projected],
    });
  }
  return Object.freeze(
    groups.map((group) => Object.freeze({ ...group, items: Object.freeze(group.items) })),
  );
}

function momentLabel(moment: SpawnMoment): string {
  return moment.kind === 'deliveryFlush' ? 'Delivered' : 'Spawned';
}

/** The key a notice attaches to: a boundary's event or an action. */
function entryKey(entry: TimelineEntry): string | undefined {
  switch (entry.kind) {
    case 'boundary':
      return `event:${entry.boundary.key}`;
    case 'action':
      return `action:${entry.actionKey}`;
    case 'automaticEffect':
    case 'spawned':
      return undefined;
  }
}

/** The entry a notice follows: its cause's, an encounter's begin shown on the marker that begins it. */
function causeKey(cause: SpawnCause, entries: readonly TimelineEntry[]): string {
  if (cause.kind === 'action') return `action:${cause.action.actionKey}`;
  const event = cause.event;
  if (event.kind === 'encounterBegun') {
    const marker = entries.find(
      (entry) =>
        entry.kind === 'boundary' &&
        (entry.boundary.key === event.key ||
          (entry.beginsEncounter === true &&
            'phaseKey' in entry.boundary &&
            entry.boundary.phaseKey === event.phaseKey)),
    );
    if (marker !== undefined) return entryKey(marker)!;
  }
  return `event:${event.key}`;
}

/** Each notice right after its cause's entry, in notice order; one whose entry is not shown ends the list. */
function attachNotices(
  entries: readonly TimelineEntry[],
  notices: readonly (readonly [SpawnCause, SpawnedEntry])[],
): readonly TimelineEntry[] {
  const keyed = notices.map(([cause, notice]) => [causeKey(cause, entries), notice] as const);
  const shown = new Set(entries.flatMap((entry) => entryKey(entry) ?? []));
  const out: TimelineEntry[] = [];
  for (const entry of entries) {
    out.push(entry);
    const key = entryKey(entry);
    if (key !== undefined)
      out.push(...keyed.flatMap(([at, notice]) => (at === key ? [notice] : [])));
  }
  out.push(...keyed.flatMap(([at, notice]) => (shown.has(at) ? [] : [notice])));
  return Object.freeze(out);
}

/**
 * Places each spawn moment's notice in the room's Timeline where the game
 * spawns it and each unlock's where its locked loot becomes takeable, groups each source action's spawned loot under its row, and
 * marks each Sea Star copy on the row of the pickup it copies.
 */
export function projectSpawnedLoot(
  catalog: Catalog,
  loot: RoomSpawnedLoot | undefined,
  entries: readonly TimelineEntry[],
  rows: readonly WorkspaceRoomActionRow[],
  roomLocal: WorkspaceRoomLocal,
): {
  readonly entries: readonly TimelineEntry[];
  readonly actionSpawns: readonly WorkspaceActionSpawn[];
  readonly copies: readonly WorkspaceSpawnCopy[];
} {
  if (loot === undefined)
    return { entries, actionSpawns: Object.freeze([]), copies: Object.freeze([]) };
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const item = (spawned: SpawnedLootItem) => projectItem(spawned, rowByKey, roomLocal, false);
  const unlockedItem = (spawned: SpawnedLootItem) =>
    projectItem(spawned, rowByKey, roomLocal, true);
  const unlockNotice = (unlock: SpawnUnlock): SpawnedEntry =>
    Object.freeze({
      kind: 'spawned' as const,
      key: `unlock:${unlock.key}`,
      moment: unlock.kind,
      phaseKey: unlock.phaseKey,
      label: 'Unlocks',
      unlocks: true as const,
      groups: spawnGroups(unlock.items, unlockedItem, (spawned) =>
        spawnSource(catalog, spawned, undefined),
      ),
    });
  // An unlock reads before what the same moment spawns: the freed reward comes first.
  const notices: (readonly [SpawnCause, SpawnedEntry])[] = [
    ...loot.unlocks.map((unlock) => [unlock.cause, unlockNotice(unlock)] as const),
    ...loot.moments.map(
      (moment) =>
        [
          moment.cause,
          Object.freeze({
            kind: 'spawned' as const,
            key: moment.key,
            moment: moment.kind,
            ...(moment.phaseKey === undefined ? {} : { phaseKey: moment.phaseKey }),
            label: momentLabel(moment),
            groups: spawnGroups(moment.items, item, (spawned) =>
              spawnSource(catalog, spawned, undefined),
            ),
          }),
        ] as const,
    ),
  ];
  // Sea Star's copy reads on the row of the pickup it copies, not as a spawn row.
  const isCopy = (spawned: SpawnedLootItem) =>
    spawned.source.kind === 'generated' && spawned.source.family.kind === 'seaStar';
  const actionSpawns = loot.actionSpawns.flatMap((spawn) => {
    const sourceRow = rowByKey.get(roomActionKey(spawn.source));
    const spawnedItems = spawn.items.filter((spawned) => !isCopy(spawned));
    return spawnedItems.length === 0
      ? []
      : [
          Object.freeze({
            key: semanticAddressKey(spawn.sourceAction),
            sourceActionKey: roomActionKey(spawn.source),
            label: 'Spawned',
            groups: spawnGroups(spawnedItems, item, (spawned) =>
              spawnSource(catalog, spawned, sourceRow),
            ),
          }),
        ];
  });
  const copies = loot.actionSpawns.flatMap((spawn) =>
    spawn.items.flatMap((spawned) => {
      const source = isCopy(spawned) ? spawnSource(catalog, spawned, undefined) : undefined;
      if (source === undefined) return [];
      const projected = item(spawned);
      return [
        Object.freeze({
          key: projected.key,
          sourceActionKey: roomActionKey(spawn.source),
          source,
          item: projected,
        }),
      ];
    }),
  );
  return {
    entries: attachNotices(entries, notices),
    actionSpawns: Object.freeze(actionSpawns),
    copies: Object.freeze(copies),
  };
}
