import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import type { LiveRoom } from '@run-planner/engine/simulation';
import type { WorkspaceRoomActionRow } from '@planner/projections/structured-workspace';
import { projectRoomLive } from '@planner/projections/structured-workspace/assembly/occurrence-live-projection';

const biome = createBiomeAddress('Underworld', 'F');
const owner = createOccurrenceAddress(biome, createOccurrenceId('live-room'));
const stoppedRow: RoomActionReference = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
};
const loose: RoomActionReference = { kind: 'chooseRewardWheel', wheelKey: 'wheel1' };
const pickup = (reference: RoomActionReference) => ({
  kind: 'pickup' as const,
  owner: createRoomActionAddress(biome, owner.occurrenceId, roomActionKey(reference)),
  reference,
  source: { kind: 'roomReward' as const },
  participation: 'optional' as const,
  spawn: { gap: 0 },
  verbs: [
    {
      verb: 'pickUp' as const,
      participation: 'optional' as const,
      reference,
      commands: [{ kind: 'RenameProject' as const, name: 'placed' }],
    },
  ],
});

/** The room's first row is ranked; the walk's frontier is the gap before its second. */
function live(blocked: LiveRoom['blocked']): LiveRoom {
  return {
    owner,
    frontier: 1,
    gaps: [0, 1].map((index) => ({
      index,
      entries: { from: index, to: index + 1 },
      items: [pickup(stoppedRow), pickup(loose)],
    })),
    ...(blocked === undefined ? {} : { blocked }),
  } as unknown as LiveRoom;
}

const rows = [
  { key: 'first', rank: 1, label: 'First' },
  { key: roomActionKey(stoppedRow), rank: 2, label: 'Collect reward' },
] as unknown as readonly WorkspaceRoomActionRow[];

const project = (blocked: LiveRoom['blocked']) =>
  projectRoomLive({
    catalog,
    owner,
    live: live(blocked),
    rows,
    resets: [],
    labelParts: (reference) => ({ label: reference.kind, name: reference.kind }),
  })!;

describe('the live row against the walk', () => {
  it('shows the live row while the walk stands at an unplaced required item', () => {
    const projected = project({ kind: 'placement' });
    expect(projected.items.length).toBeGreaterThan(0);
    expect(projected.gaps.map((gap) => gap.index)).toEqual([0]);
  });

  it('hides it at any other stop, keeping the gap above the stopped row without its pickup', () => {
    const projected = project({ kind: 'stop' });
    expect(projected.items).toEqual([]);
    expect(projected.gaps.map((gap) => gap.index)).toEqual([0, 1]);
    const above = projected.gaps.find((gap) => gap.index === 1)!;
    expect(above.items.map((item) => item.label)).toEqual(['chooseRewardWheel']);
  });
});
