import { roomActionKey, semanticAddressKey } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RoomSpawnedLoot, SpawnMoment, SpawnedLootItem } from '@run-planner/engine/simulation';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import type {
  WorkspaceActionSpawn,
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSpawnedItem,
} from '../contracts/timeline';

type TimelineEntry = WorkspaceRoomLifecycleTimelineEntry;
type SpawnedEntry = Extract<TimelineEntry, { readonly kind: 'spawned' }>;

const NO_POSITION = 'No position to add this action.';

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
  proposals: readonly WorkspaceRoomActionProposal[],
  roomLocal: WorkspaceRoomLocal,
): WorkspaceSpawnedItem {
  const actionKey = roomActionKey(item.reference);
  const row = rowByKey.get(actionKey);
  const place = fieldsPlace(roomLocal, item);
  const placement: WorkspaceSpawnedItem['placement'] =
    item.placement.kind === 'placed'
      ? Object.freeze({ kind: 'placed' as const, owner: row?.address ?? item.placement.action })
      : item.placement.command !== undefined
        ? Object.freeze({
            kind: 'unplaced' as const,
            intent: Object.freeze({ command: item.placement.command }),
          })
        : Object.freeze({
            kind: 'unavailable' as const,
            // The engine's own placement explanation, where its insertion has one.
            reason:
              proposals.find(
                (proposal) =>
                  proposal.kind === 'insert' &&
                  roomActionKey(proposal.reference) === actionKey &&
                  proposal.explanations.length > 0,
              )?.explanations[0] ?? NO_POSITION,
          });
  return Object.freeze({
    key: semanticAddressKey(item.owner),
    actionKey,
    label: itemLabel(row),
    participation: item.participation,
    ...(place === undefined ? {} : { place }),
    placement,
  });
}

/** What spawned an action's loot, by its source family. */
function spawnSourceName(catalog: Catalog, item: SpawnedLootItem | undefined): string | undefined {
  if (item?.source.kind !== 'generated') return undefined;
  const family = item.source.family;
  switch (family.kind) {
    case 'trait':
      return catalog.traits.byKey[family.traitKey]?.label ?? family.traitKey;
    case 'echo':
      return 'Echo';
    case 'nemesisEvent':
      return 'Nemesis';
    case 'erisGift':
      return 'Eris';
    case 'challengeSwitch':
      return 'Switch';
    default:
      return undefined;
  }
}

function momentLabel(moment: SpawnMoment): string {
  return moment.kind === 'deliveryFlush' ? 'Delivered' : 'Spawned';
}

/** A boundary or action entry's identity, which a notice is placed against. */
function entryIdentity(entry: TimelineEntry): string | undefined {
  switch (entry.kind) {
    case 'boundary':
      return `boundary:${entry.boundary.kind}:${'phaseKey' in entry.boundary ? entry.boundary.phaseKey : ''}`;
    case 'action':
      return `action:${entry.actionKey}`;
    case 'automaticEffect':
    case 'spawned':
      return undefined;
  }
}

const boundaryAt = (kind: string, phaseKey?: string) => `boundary:${kind}:${phaseKey ?? ''}`;

/**
 * Where a moment's notice sits: after the boundary or action it follows, or
 * before the boundary it precedes, by the first one present.
 */
function momentAnchor(
  moment: SpawnMoment,
  present: ReadonlySet<string>,
  rewardActionByPhase: ReadonlyMap<string, string>,
): { readonly placement: 'after' | 'before'; readonly identity: string } | undefined {
  const first = (...candidates: readonly (readonly ['after' | 'before', string])[]) => {
    const found = candidates.find(([, identity]) => present.has(identity));
    return found === undefined ? undefined : { placement: found[0], identity: found[1] };
  };
  const entered = ['after', boundaryAt('roomEntered')] as const;
  const phase = moment.phaseKey;
  switch (moment.kind) {
    case 'roomEntered':
    case 'deliveryFlush':
      return first(entered);
    case 'encounterStart':
      return first(['after', boundaryAt('encounterStart', phase)], entered);
    case 'duringEncounter':
      return first(
        ['before', boundaryAt('bossDefeated', phase)],
        ['before', boundaryAt('encounterEnd', phase)],
        ['after', boundaryAt('encounterStart', phase)],
        entered,
      );
    case 'encounterEnd':
      return first(
        ['after', boundaryAt('encounterEnd', phase)],
        ['after', boundaryAt('bossDefeated', phase)],
      );
    case 'afterEncounterReward': {
      const reward = phase === undefined ? undefined : rewardActionByPhase.get(phase);
      return first(
        ...(reward === undefined ? [] : [['after', `action:${reward}`] as const]),
        ['after', `spawned:${phase === undefined ? 'encounterEnd' : `encounterEnd:${phase}`}`],
        ['after', boundaryAt('encounterEnd', phase)],
      );
    }
  }
}

/**
 * Places each spawn moment's notice in the room's Timeline where the game
 * spawns it, and groups each source action's spawned loot under its row.
 */
export function projectSpawnedLoot(
  catalog: Catalog,
  loot: RoomSpawnedLoot | undefined,
  entries: readonly TimelineEntry[],
  rows: readonly WorkspaceRoomActionRow[],
  proposals: readonly WorkspaceRoomActionProposal[],
  roomLocal: WorkspaceRoomLocal,
): {
  readonly entries: readonly TimelineEntry[];
  readonly actionSpawns: readonly WorkspaceActionSpawn[];
} {
  if (loot === undefined) return { entries, actionSpawns: Object.freeze([]) };
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const item = (spawned: SpawnedLootItem) => projectItem(spawned, rowByKey, proposals, roomLocal);
  const notices: SpawnedEntry[] = loot.moments.map((moment) =>
    Object.freeze({
      kind: 'spawned' as const,
      key: moment.key,
      moment: moment.kind,
      ...(moment.phaseKey === undefined ? {} : { phaseKey: moment.phaseKey }),
      label: momentLabel(moment),
      items: Object.freeze(moment.items.map(item)),
    }),
  );
  // A phase's wheel reward, collected before what its end effects spawn.
  const rewardActionByPhase = new Map(
    loot.moments.flatMap((moment) => {
      const reward = moment.items.find((candidate) => candidate.source.kind === 'rewardWheel');
      return moment.kind === 'encounterEnd' &&
        moment.phaseKey !== undefined &&
        reward !== undefined &&
        reward.placement.kind === 'placed'
        ? [[moment.phaseKey, roomActionKey(reward.reference)] as const]
        : [];
    }),
  );
  const present = new Set(
    entries.flatMap((entry) => {
      const identity = entryIdentity(entry);
      return identity === undefined ? [] : [identity];
    }),
  );
  const before = new Map<string, SpawnedEntry[]>();
  const after = new Map<string, SpawnedEntry[]>();
  const unanchored: SpawnedEntry[] = [];
  for (const [index, notice] of notices.entries()) {
    const anchor = momentAnchor(loot.moments[index]!, present, rewardActionByPhase);
    if (anchor === undefined) {
      unanchored.push(notice);
      continue;
    }
    const target = anchor.placement === 'before' ? before : after;
    target.set(anchor.identity, [...(target.get(anchor.identity) ?? []), notice]);
    // A later moment may follow this notice.
    present.add(`spawned:${notice.key}`);
  }
  const out: TimelineEntry[] = [];
  const pushAfter = (identity: string) => {
    for (const notice of after.get(identity) ?? []) {
      out.push(notice);
      pushAfter(`spawned:${notice.key}`);
    }
  };
  for (const entry of entries) {
    const identity = entryIdentity(entry);
    if (identity !== undefined) out.push(...(before.get(identity) ?? []));
    out.push(entry);
    if (identity !== undefined) pushAfter(identity);
  }
  out.push(...unanchored);
  const actionSpawns = loot.actionSpawns.map((spawn) => {
    const items = spawn.items.map(item);
    const names = new Set(items.map((candidate) => candidate.label));
    // One kind of item names the row; several are named by what spawned them.
    const sourceName = spawnSourceName(catalog, spawn.items[0]);
    const label =
      names.size === 1
        ? `${items[0]!.label} spawned`
        : sourceName === undefined
          ? 'Spawned'
          : `${sourceName} spawned`;
    return Object.freeze({
      key: semanticAddressKey(spawn.sourceAction),
      sourceActionKey: roomActionKey(spawn.source),
      label,
      items: Object.freeze(items),
    });
  });
  return { entries: Object.freeze(out), actionSpawns: Object.freeze(actionSpawns) };
}
