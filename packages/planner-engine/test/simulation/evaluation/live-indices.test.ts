import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import { roomActionKey } from '@run-planner/engine/authored-project';
import { parseClockedTraitGeneratedPickupEntryKey } from '../../../src/authored-project/acquisition/pickup-producers';
import {
  liveActionsForProjectEvaluationAssembly,
  type LivePickup,
} from '../../../src/simulation/evaluation/live-actions';
import {
  assertLifecycleSnapshot,
  byRoomVariant,
  compactActionKey,
  corpusAssemblies,
  corpusRooms,
  roomLabel,
  setUnique,
  type RoomWitness,
} from '../../support/lifecycle-snapshots';

const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), 'live-indices.snapshot.json');

/** A Hermes Shrine delivery or a clocked trait's drop. */
function deliveryOrDrop(pickup: LivePickup): boolean {
  const reference = pickup.reference;
  return (
    reference.kind === 'interactAcquisitionEntry' &&
    (reference.siteKey === 'hermesShrineDelivery' ||
      parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined)
  );
}

interface ItemIndices {
  spawn: string;
  placed: number[];
  place: number[];
  canonical: number[];
  move: number[];
  deadline: Set<number>;
  locked: number[];
}

function itemLine(item: ItemIndices): string {
  const list = (name: string, values: readonly number[]) =>
    values.length === 0 ? [] : [`${name} ${values.join(',')}`];
  return [
    `spawn ${item.spawn}`,
    ...list('placed', item.placed),
    ...list('place', item.place),
    ...list('canonical', item.canonical),
    ...list('move', item.move),
    ...list('locked', item.locked),
    ...list('deadline', [...item.deadline]),
  ].join(' | ');
}

describe('live delivery and drop placement indices', () => {
  it('match the checked-in snapshot for every delivery and clocked drop the live product shows', async () => {
    const witnesses: RoomWitness<{ readonly items: Record<string, string> }>[] = [];
    for (const { entry, assembly } of corpusAssemblies()) {
      for (const room of corpusRooms(assembly)) {
        if (!room.entered) continue;
        const live = liveActionsForProjectEvaluationAssembly(entry.catalog, assembly, room.origin);
        if (live === undefined) continue;
        const items = new Map<string, ItemIndices>();
        for (const gap of live.gaps)
          for (const item of gap.items) {
            if (item.kind !== 'pickup' || !deliveryOrDrop(item)) continue;
            const key = compactActionKey(roomActionKey(item.reference));
            const indices = items.get(key) ?? {
              spawn: `${item.spawn.gap}${item.spawn.moment === undefined ? '' : ` ${item.spawn.moment}`}${
                item.spawn.sourceAction === undefined
                  ? ''
                  : ` after ${compactActionKey(item.spawn.sourceAction.actionKey)}`
              }`,
              placed: [],
              place: [],
              canonical: [],
              move: [],
              deadline: new Set<number>(),
              locked: [],
            };
            for (const action of item.actions) {
              if (action.kind === 'place' && action.canonical === true)
                indices.canonical.push(gap.index);
              indices[action.kind].push(gap.index);
            }
            if (item.lockedUntil !== undefined) indices.locked.push(gap.index);
            if (item.deadline !== undefined) indices.deadline.add(item.deadline);
            items.set(key, indices);
          }
        if (items.size === 0) continue;
        const lines: Record<string, string> = {};
        for (const [key, item] of items) setUnique(lines, key, itemLine(item));
        witnesses.push({
          entry: entry.name,
          room: roomLabel(room.origin, room.gameName),
          content: { items: lines },
        });
      }
    }
    await assertLifecycleSnapshot(snapshotPath, byRoomVariant(witnesses));
  });
});
