import { describe, expect, it } from 'vitest';

import {
  assessRoomActionInsertion,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionInsertionRefusal,
  roomActionKey,
  roomActionOrderContext,
  type RoomActionReference,
  type RoomLifecycleStructure,
} from '@run-planner/engine/authored-project';
import type { RoomActionDependency } from '../../../src/authored-project/room-actions/domain';
import type { RoomActionWindow } from '../../../src/authored-project/room-actions/lifecycle-structure';

const owner = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('order-assessment'),
);

const structure: RoomLifecycleStructure = {
  profileKey: 'StandardRewardRoom',
  activeEncounterSlotKeys: ['Encounter'],
  phases: [{ phaseKey: 'Encounter' }],
  points: [
    { kind: 'roomEntered', key: 'roomEntered' },
    { kind: 'encounterStart', key: 'encounterStart:Encounter', phaseKey: 'Encounter' },
    { kind: 'encounterEnd', key: 'encounterEnd:Encounter', phaseKey: 'Encounter' },
    { kind: 'outgoingGeneration', key: 'outgoingGeneration' },
    { kind: 'cleanup', key: 'cleanup' },
  ],
};

/** Required, before combat. */
const before: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'Before' };
/** Required, after combat. */
const reward: RoomActionReference = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
};
/** Required, after combat, after the reward. */
const dependent: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'After' };
/** Optional, after combat, later in contribution order than the reward. */
const optional: RoomActionReference = {
  kind: 'interactAcquisitionEntry',
  siteKey: 'roomExit',
  entryKey: 'optional',
};
/** Optional doors-open press after every required action. */
const press: RoomActionReference = { kind: 'unlockExit', exitKey: 'exit2' };

function action(
  reference: RoomActionReference,
  participation: 'required' | 'optional',
  window: RoomActionWindow,
  dependencies: RoomActionDependency[] = [],
) {
  return { kind: 'action' as const, reference, owner, participation, window, dependencies };
}

function context(terminalActionKey?: string) {
  return roomActionOrderContext({
    lifecycleStructure: structure,
    contributions: [
      action(before, 'required', { kind: 'standard', phase: 'beforeCombat' }),
      action(reward, 'required', { kind: 'standard', phase: 'afterCombat' }),
      action(dependent, 'required', { kind: 'standard', phase: 'afterCombat' }, [
        { kind: 'afterAction', action: reward },
      ]),
      action(optional, 'optional', { kind: 'standard', phase: 'afterCombat' }),
      action(press, 'optional', { kind: 'postOutgoing' }, [
        { kind: 'afterCheckpoint', checkpointKey: 'exitUsable' },
      ]),
      {
        kind: 'checkpoint' as const,
        checkpointKey: 'exitUsable',
        label: 'Exit usable',
        window: { kind: 'postOutgoing' as const },
      },
    ],
    ...(terminalActionKey === undefined ? {} : { terminalActionKey }),
  });
}

function legalIndexes(
  order: readonly RoomActionReference[],
  reference: RoomActionReference,
  terminalActionKey?: string,
) {
  return Array.from({ length: order.length + 1 }, (_, index) => index).filter(
    (index) =>
      assessRoomActionInsertion(order, reference, index, context(terminalActionKey))
        .structurallyAuthorable,
  );
}

describe('room action insertion legality', () => {
  it('admits every index inside the window, not only the earliest', () => {
    // Before combat stays first; the press must follow every required action.
    expect(legalIndexes([before, dependent, optional, press], reward)).toEqual([1]);
    expect(legalIndexes([before, optional, press], reward)).toEqual([1, 2]);
  });

  it('refuses an index that crosses a window, breaks a dependency or precedes a checkpoint', () => {
    const order = [before, reward, optional, press];
    const at = (index: number) => assessRoomActionInsertion(order, dependent, index, context());
    expect(at(0).blockers.map((blocker) => blocker.kind)).toEqual(
      expect.arrayContaining(['dependency', 'window']),
    );
    expect(at(1).blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: dependent }),
    ]);
    expect(at(2).structurallyAuthorable).toBe(true);
    expect(at(3).structurallyAuthorable).toBe(true);
    expect(at(4).blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency',
          reference: press,
          dependency: { kind: 'afterCheckpoint', checkpointKey: 'exitUsable' },
        }),
      ]),
    );
    expect(legalIndexes(order, dependent)).toEqual([2, 3]);
  });

  it('places an optional action anywhere its own window allows', () => {
    expect(legalIndexes([before, reward, press], optional)).toEqual([1, 2]);
    expect(legalIndexes([before, reward], press)).toEqual([2]);
  });

  it('puts nothing after a terminal action', () => {
    const order = [before, reward, dependent];
    expect(legalIndexes(order, optional)).toEqual([1, 2, 3]);
    expect(legalIndexes(order, optional, roomActionKey(dependent))).toEqual([1, 2]);
    expect(
      assessRoomActionInsertion(order, optional, 3, context(roomActionKey(dependent))),
    ).toMatchObject({ followsTerminal: true, blockers: [], structurallyAuthorable: false });
  });

  it('names a refused index and its blocker, and the accepted range', () => {
    const order = [before, reward, optional, press];
    expect(roomActionInsertionRefusal(order, dependent, 2, context())).toBeUndefined();
    expect(roomActionInsertionRefusal(order, dependent, 1, context())).toBe(
      `index 1 is not a legal position for ${roomActionKey(dependent)}: ${roomActionKey(dependent)} must follow ${roomActionKey(reward)}`,
    );
    expect(roomActionInsertionRefusal(order, dependent, 5, context())).toBe(
      'index must be an integer from 0 through 4',
    );
    expect(
      roomActionInsertionRefusal([before, reward], optional, 2, context(roomActionKey(reward))),
    ).toBe('index 2 follows leaving the switch fight, which ends the room');
  });
});
