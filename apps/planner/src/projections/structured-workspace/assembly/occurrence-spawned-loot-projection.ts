import { roomActionKey, semanticAddressKey } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  RoomSpawnedLoot,
  SpawnMoment,
  SpawnUnlock,
  SpawnedLootItem,
} from '@run-planner/engine/simulation';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import type {
  WorkspaceActionSpawn,
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSpawnGroup,
  WorkspaceSpawnCopy,
  WorkspaceSpawnSource,
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

/** The choice an item's pickup asks for, as the engine publishes it, named in its hint. */
function pickupChoice(item: SpawnedLootItem): string | undefined {
  switch (item.needsChoice) {
    case 'levelResolution':
      return 'Pom';
    case undefined:
      return undefined;
  }
}

function itemHint(
  item: SpawnedLootItem,
  name: string,
  placement: WorkspaceSpawnedItem['placement'],
): string {
  switch (placement.kind) {
    case 'placed':
      return `Go to ${name}`;
    case 'unavailable':
      return `${name}: ${placement.reason}`;
    case 'unplaced': {
      if (item.participation === 'required')
        return item.source.kind === 'generated' &&
          item.source.family.kind === 'hermesShrineDelivery'
          ? 'Collect the delivery'
          : `Collect ${name}`;
      const choice = pickupChoice(item);
      return choice === undefined ? `Pick up ${name}` : `Pick up ${name} — choose its ${choice}`;
    }
  }
}

function projectItem(
  item: SpawnedLootItem,
  rowByKey: ReadonlyMap<string, WorkspaceRoomActionRow>,
  proposals: readonly WorkspaceRoomActionProposal[],
  roomLocal: WorkspaceRoomLocal,
  unlocked: boolean,
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
  const label = itemLabel(row);
  return Object.freeze({
    key: semanticAddressKey(item.owner),
    actionKey,
    label,
    ...(item.reward === undefined ? {} : { reward: item.reward }),
    hint: itemHint(item, place === undefined ? label : `${label} · ${place.label}`, placement),
    participation: item.participation,
    ...(place === undefined ? {} : { place }),
    ...(item.lockedUntil === undefined || unlocked ? {} : { locked: true as const }),
    placement,
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

type NoticeMoment = Pick<SpawnMoment, 'kind' | 'phaseKey'>;

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
  moment: NoticeMoment,
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
    case 'encounterOutcome':
      return first(
        ['after', boundaryAt('encounterOutcome', phase)],
        ['before', boundaryAt('encounterEnd', phase)],
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
 * spawns it and each unlock's where its locked loot becomes takeable, groups each source action's spawned loot under its row, and
 * marks each Sea Star copy on the row of the pickup it copies.
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
  readonly copies: readonly WorkspaceSpawnCopy[];
} {
  if (loot === undefined)
    return { entries, actionSpawns: Object.freeze([]), copies: Object.freeze([]) };
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const item = (spawned: SpawnedLootItem) =>
    projectItem(spawned, rowByKey, proposals, roomLocal, false);
  const unlockedItem = (spawned: SpawnedLootItem) =>
    projectItem(spawned, rowByKey, proposals, roomLocal, true);
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
  const noticeMoments: readonly NoticeMoment[] = [...loot.unlocks, ...loot.moments];
  const notices: SpawnedEntry[] = [
    ...loot.unlocks.map(unlockNotice),
    ...loot.moments.map((moment) =>
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
    ),
  ];
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
    const anchor = momentAnchor(noticeMoments[index]!, present, rewardActionByPhase);
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
    entries: Object.freeze(out),
    actionSpawns: Object.freeze(actionSpawns),
    copies: Object.freeze(copies),
  };
}
