import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { hubBoardRewardAssignmentOrder } from '../../../../../src/simulation/rewards/biome/generation/hub-board-order';
import { hubBoardProbes } from '../../../../support/hub-board-probe';

function ephyraSlots() {
  const progression = catalog.biomeLayouts.byKey.N?.progression;
  if (progression?.kind !== 'hub') throw new Error('missing the Ephyra Hub');
  return progression.slots;
}

describe('Hub board reward-assignment order', () => {
  it.each(hubBoardProbes.map((probe, index) => [index, probe] as const))(
    'derives probe board %i from the declared Ephyra doors',
    (_, probe) => {
      const open = ephyraSlots().filter((slot) => probe.insertion.includes(slot.physicalDoorId));
      expect(open).toHaveLength(probe.insertion.length);
      expect(
        [...open]
          .sort((left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank)
          .map((slot) => slot.physicalDoorId),
      ).toEqual(probe.insertion);
      // Declaration order is not the insertion order, so the result cannot depend on it.
      expect(
        hubBoardRewardAssignmentOrder([...open].reverse()).map((slot) => slot.physicalDoorId),
      ).toEqual(probe.assignment);
    },
  );

  it('rejects a board that repeats a door', () => {
    const door = { physicalDoorId: 560705, offeredExitInsertionRank: 0 };
    expect(() => hubBoardRewardAssignmentOrder([door, door])).toThrow(/repeat/);
  });
});
