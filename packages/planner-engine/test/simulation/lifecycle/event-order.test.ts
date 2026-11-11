import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, vi } from 'vitest';

import { roomActionKey, semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { RoomHistoryFragment, RoomLifecycleEvent } from '../../../src/simulation/lifecycle';
import type { RoomLifecycleTimelineEntry } from '../../../src/simulation/room-actions/timeline';
import type { SpawnedLootItem } from '../../../src/simulation/evaluation/spawned-loot';
import { equivalenceCorpus } from '../../equivalence/corpus';
import {
  assertLifecycleSnapshot,
  byRoomVariant,
  compactActionKey,
  corpusRooms,
  readable,
  roomLabel,
  type RoomWitness,
} from '../../support/lifecycle-snapshots';

const fragments = vi.hoisted(() => [] as RoomHistoryFragment[]);

// Records each room walk as the history composition receives it.
vi.mock('../../../src/simulation/lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/simulation/lifecycle')>();
  return {
    ...actual,
    executeRoomLifecycle: (...args: Parameters<typeof actual.executeRoomLifecycle>) => {
      const fragment = actual.executeRoomLifecycle(...args);
      fragments.push(fragment);
      return fragment;
    },
  };
});

const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), 'event-order.snapshot.json');

/** One walk event: its kind and the fields that place it, without sequence or origin. */
function eventText(event: RoomLifecycleEvent): string {
  const fields: string[] = [];
  const record = event as unknown as Record<string, unknown>;
  for (const field of [
    'phaseKey',
    'offerPoint',
    'point',
    'interaction',
    'lifecyclePoint',
    'role',
    'generationKey',
    'exitKey',
    'objectKey',
    'storeKey',
    'feature',
    'rerollId',
    'endEffects',
  ]) {
    const value = record[field];
    if (typeof value === 'string') fields.push(readable(value));
  }
  if (record.execution === 'skippedByFigLeaf') fields.push('figLeafSkipped');
  if (event.kind === 'rewardRerolled') fields.push(readable(JSON.stringify(event.target)));
  return fields.length === 0 ? event.kind : `${event.kind}(${fields.join(' ')})`;
}

/** The walk's events with each reached row's rank where the walk took it. */
function walkText(fragment: RoomHistoryFragment, rankByKey: ReadonlyMap<string, number>): string {
  const before = new Map<number, string[]>();
  for (const action of fragment.reachedActions) {
    const tokens = before.get(action.sequence) ?? [];
    tokens.push(`#${rankByKey.get(action.actionKey) ?? compactActionKey(action.actionKey)}`);
    before.set(action.sequence, tokens);
  }
  const tokens: string[] = [];
  fragment.events.forEach((event, index) => {
    tokens.push(...(before.get(index + 1) ?? []), eventText(event));
  });
  tokens.push(...(before.get(fragment.events.length + 1) ?? []));
  if (fragment.blockedAt !== undefined) {
    const key = 'actionKey' in fragment.blockedAt ? fragment.blockedAt.actionKey : undefined;
    const deadline = fragment.blockedDeadline;
    const due =
      deadline === undefined
        ? ''
        : ` due ${deadline.kind}${
            deadline.kind === 'action'
              ? ` #${rankByKey.get(deadline.actionKey) ?? compactActionKey(deadline.actionKey)}`
              : deadline.kind === 'encounter' || deadline.kind === 'phaseEnd'
                ? ` ${deadline.phaseKey}`
                : ''
          }`;
    tokens.push(
      `stop ${key === undefined ? semanticAddressKey(fragment.blockedAt) : (rankByKey.get(key) ?? compactActionKey(key))}${due}`,
    );
  }
  return tokens.join(' > ');
}

function timelineEntryText(entry: RoomLifecycleTimelineEntry): string {
  switch (entry.kind) {
    case 'boundary': {
      const boundary = entry.boundary;
      const subject =
        'wheelKey' in boundary
          ? ` ${boundary.wheelKey}`
          : 'phaseKey' in boundary
            ? ` ${boundary.phaseKey}`
            : '';
      const merged = entry.markers === 'merged' ? ' merged' : '';
      return `${boundary.kind}${subject}${merged}`;
    }
    case 'action':
      return `#${entry.rank}${entry.phaseKey === undefined ? '' : ` ${entry.phaseKey}`}`;
    case 'automaticEffect':
      return `${entry.effect} ${entry.phaseKey}`;
  }
}

function itemText(item: SpawnedLootItem): string {
  const placement =
    item.placement.kind === 'placed'
      ? `#${item.placement.rank}`
      : item.placement.command === undefined
        ? 'unplaced'
        : 'unplaced placeable';
  return `${compactActionKey(roomActionKey(item.reference))} ${item.participation} ${placement}${
    item.lockedUntil === undefined ? '' : ` locked ${item.lockedUntil}`
  }`;
}

interface RoomOrder {
  readonly walk: string;
  readonly timeline?: string;
  readonly loot?: readonly string[];
}

describe('room lifecycle event order', () => {
  it('matches the checked-in snapshot for every walked corpus room', async () => {
    const witnesses: RoomWitness<RoomOrder>[] = [];
    for (const entry of equivalenceCorpus()) {
      const project = entry.project();
      fragments.length = 0;
      const assembly = simulateProjectAssembly(entry.catalog, project);
      // A room walked again (a progressive prefix after a block) keeps its last walk.
      const walked = new Map<string, RoomHistoryFragment>();
      for (const fragment of fragments) walked.set(semanticAddressKey(fragment.origin), fragment);
      const canonical = new Map(
        corpusRooms(assembly).map((room) => [semanticAddressKey(room.origin), room]),
      );
      for (const [key, fragment] of walked) {
        const room = canonical.get(key);
        const rankByKey = new Map(
          (room?.roomActionRoster.rows ?? []).flatMap((row) =>
            row.rank === null || row.stale ? [] : [[row.key, row.rank] as const],
          ),
        );
        const loot =
          room === undefined
            ? undefined
            : spawnedLootForProjectEvaluationAssembly(entry.catalog, assembly, room.origin);
        witnesses.push({
          entry: entry.name,
          room: roomLabel(fragment.origin, room?.gameName),
          content: {
            walk: walkText(fragment, rankByKey),
            ...(room === undefined
              ? {}
              : {
                  timeline: room.roomLifecycleTimeline.entries.map(timelineEntryText).join(' | '),
                }),
            ...(loot === undefined
              ? {}
              : {
                  loot: [
                    ...loot.moments.map(
                      (moment) => `${moment.key}: ${moment.items.map(itemText).join(', ')}`,
                    ),
                    ...loot.unlocks.map(
                      (unlock) => `unlock ${unlock.key}: ${unlock.items.map(itemText).join(', ')}`,
                    ),
                    ...loot.actionSpawns.map(
                      (spawn) =>
                        `after ${compactActionKey(roomActionKey(spawn.source))}: ${spawn.items.map(itemText).join(', ')}`,
                    ),
                  ],
                }),
          },
        });
      }
    }
    await assertLifecycleSnapshot(snapshotPath, byRoomVariant(witnesses));
  });
});
