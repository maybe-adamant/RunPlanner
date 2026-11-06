import { describe, expect, it } from 'vitest';
import { workspacePressSurfaceStates } from '@planner/projections/structured-workspace/assembly/reroll-assembly';

const gold = { rewardType: 'RoomMoneyDrop' } as const;
const health = { rewardType: 'MaxHealthDrop' } as const;
const magick = { rewardType: 'MaxManaDrop' } as const;
const pom = { rewardType: 'StackUpgrade' } as const;

const entries = [
  { key: 'exit1', visible: true, owners: [{ ownerKey: 'door1', first: health }] },
  { key: 'exit2', visible: false, owners: [{ ownerKey: 'door2', first: magick }] },
];

describe('a press’s view of its surface', () => {
  it('reads each press in order and never shows a hidden reward', () => {
    const states = workspacePressSurfaceStates({
      entries,
      presses: [
        { rowKey: 'p1', ownerKey: 'door1', label: 'Door 1', reward: gold },
        { rowKey: 'p2', ownerKey: 'door2', label: 'Door 2', reward: pom },
        { rowKey: 'p3', ownerKey: 'door1', label: 'Door 1', reward: pom },
      ],
      settled: new Map(),
    });
    expect(states.get('p1')).toEqual({
      doorLabel: 'Door 1',
      before: health,
      after: [
        { exitKey: 'exit1', rewards: [gold] },
        { exitKey: 'exit2', rewards: [] },
      ],
    });
    // A hidden door names no reward, before or after its press.
    expect(states.get('p2')).toMatchObject({
      before: null,
      after: [
        { exitKey: 'exit1', rewards: [gold] },
        { exitKey: 'exit2', rewards: [] },
      ],
    });
    expect(states.get('p3')).toMatchObject({
      before: gold,
      after: [
        { exitKey: 'exit1', rewards: [pom] },
        { exitKey: 'exit2', rewards: [] },
      ],
    });
  });

  it('takes the engine’s settled reward for an owner’s last press', () => {
    // The engine settled Door 1 on Gold: its later press did not land.
    const states = workspacePressSurfaceStates({
      entries,
      presses: [
        { rowKey: 'p1', ownerKey: 'door1', label: 'Door 1', reward: gold },
        { rowKey: 'p2', ownerKey: 'door1', label: 'Door 1', reward: pom },
      ],
      settled: new Map([['door1', gold]]),
    });
    expect(states.get('p1')?.after[0]).toEqual({ exitKey: 'exit1', rewards: [gold] });
    expect(states.get('p2')).toMatchObject({
      before: gold,
      after: [
        { exitKey: 'exit1', rewards: [gold] },
        { exitKey: 'exit2', rewards: [] },
      ],
    });
  });

  it('marks the doors still locked once each press lands', () => {
    const states = workspacePressSurfaceStates({
      entries,
      presses: [
        { rowKey: 'p1', ownerKey: 'door1', label: 'Door 1', reward: gold, locked: ['exit2'] },
        { rowKey: 'p2', ownerKey: 'door1', label: 'Door 1', reward: pom, locked: [] },
      ],
      settled: new Map(),
    });
    expect(states.get('p1')?.after[1]).toEqual({ exitKey: 'exit2', locked: true, rewards: [] });
    expect(states.get('p2')?.after[1]).toEqual({ exitKey: 'exit2', rewards: [] });
  });
});
