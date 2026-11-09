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
import {
  assessRoomActionMove,
  assessRoomActionOrder,
  assessRoomActionPlacement,
} from '../../../src/authored-project/room-actions/order-assessment';

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
/** Optional, before combat. */
const prep: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'Prep' };
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
      action(prep, 'optional', { kind: 'standard', phase: 'beforeCombat' }),
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

function issueKinds(order: readonly RoomActionReference[]) {
  return assessRoomActionOrder(order, context())
    .filter((issue) => issue.kind !== 'unrankedRequired')
    .map((issue) => [issue.kind, roomActionKey(issue.reference)]);
}

describe('room action insertion legality', () => {
  it('judges an index by the rows before it and the inserted row itself', () => {
    // At 2 the dependent before it waits on the reward.
    expect(legalIndexes([before, dependent, optional, press], reward)).toEqual([1]);
    // At 3 the press before it would precede a required action.
    expect(legalIndexes([before, optional, press], reward)).toEqual([1, 2]);
  });

  it('refuses an index past which a required action of an earlier window still waits', () => {
    // The required before-combat action's deadline passes before the reward's window opens.
    expect(assessRoomActionInsertion([before, optional], reward, 0, context()).blockers).toEqual([
      {
        kind: 'requiredFirst',
        reference: reward,
        detail: `must follow ${roomActionKey(before)}, a required action of an earlier window`,
        window: { kind: 'standard', phase: 'afterCombat' },
        requiredAction: before,
        requiredWindow: { kind: 'standard', phase: 'beforeCombat' },
      },
    ]);
    // An optional action of an earlier window takes no part.
    expect(legalIndexes([prep, optional], reward)).toEqual([0, 1, 2]);
  });

  it('refuses an index whose prefix holds a later-window row, a missing dependency or an unmet checkpoint', () => {
    const order = [before, reward, optional, press];
    const at = (index: number) => assessRoomActionInsertion(order, dependent, index, context());
    expect(at(0).blockers).toEqual([
      expect.objectContaining({
        kind: 'dependency',
        reference: dependent,
        detail: expect.stringMatching(/^must follow/),
      }),
      expect.objectContaining({
        kind: 'requiredFirst',
        reference: dependent,
        requiredAction: before,
      }),
    ]);
    expect(at(1).blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: dependent }),
    ]);
    expect(at(2).structurallyAuthorable).toBe(true);
    expect(at(3).structurallyAuthorable).toBe(true);
    // After the press: the press now precedes a required action, and the
    // dependent follows a later window.
    expect(at(4).blockers).toEqual([
      expect.objectContaining({
        kind: 'dependency',
        reference: press,
        dependency: { kind: 'afterCheckpoint', checkpointKey: 'exitUsable' },
      }),
      expect.objectContaining({
        kind: 'window',
        reference: dependent,
        precedingAction: press,
        precedingWindow: { kind: 'postOutgoing' },
      }),
    ]);
    expect(legalIndexes(order, dependent)).toEqual([2, 3]);
    expect(legalIndexes([before, reward], press)).toEqual([2]);
    expect(legalIndexes([before, reward, press], optional)).toEqual([1, 2]);
  });

  it('lets no row after the index veto it by its own issue, even one already invalid', () => {
    // The press precedes the required dependent: an issue of the press.
    const order = [before, reward, press, dependent];
    expect(issueKinds(order)).toEqual([
      ['dependency', roomActionKey(press)],
      ['window', roomActionKey(dependent)],
      ['requiredFirst', roomActionKey(press)],
    ]);
    expect(legalIndexes(order, optional)).toEqual([1, 2]);
    expect(assessRoomActionInsertion(order, optional, 3, context()).blockers).toEqual([
      expect.objectContaining({
        kind: 'dependency',
        reference: press,
        dependency: expect.objectContaining({ kind: 'afterCheckpoint' }),
      }),
      expect.objectContaining({ kind: 'window', reference: optional, precedingAction: press }),
      expect.objectContaining({
        kind: 'requiredFirst',
        reference: press,
        requiredAction: dependent,
      }),
    ]);
  });

  it('accepts an index that invalidates a later row, which then carries its issue', () => {
    const inserted = assessRoomActionInsertion([prep, optional], reward, 0, context());
    expect(inserted).toMatchObject({ structurallyAuthorable: true, blockers: [] });
    expect(issueKinds(inserted.order)).toEqual([['window', roomActionKey(prep)]]);
  });

  it('judges a move like an insertion at its target', () => {
    const order = [before, prep, reward, optional, press];
    // After the required action, the optional row passes the walk; prep then finds its window closed.
    const early = assessRoomActionMove(order, 3, 1, context());
    expect(early).toMatchObject({ structurallyAuthorable: true, blockers: [] });
    expect(issueKinds(early.order)).toEqual([['window', roomActionKey(prep)]]);
    // Ahead of the required before-combat action it is not reached.
    expect(assessRoomActionMove(order, 3, 0, context()).blockers).toEqual([
      expect.objectContaining({
        kind: 'requiredFirst',
        reference: optional,
        requiredAction: before,
      }),
    ]);
    // Past the press, the press in its prefix precedes the required reward.
    expect(assessRoomActionMove(order, 2, 4, context()).blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: press }),
      expect.objectContaining({ kind: 'window', reference: reward }),
    ]);
    // The press moved before a required action waits on it itself.
    expect(assessRoomActionMove(order, 4, 2, context()).blockers).toEqual([
      expect.objectContaining({
        kind: 'dependency',
        reference: press,
        dependency: expect.objectContaining({ kind: 'afterCheckpoint' }),
      }),
      expect.objectContaining({ kind: 'requiredFirst', reference: press, requiredAction: reward }),
    ]);
  });

  it('puts nothing after a terminal action, and does not move it before another', () => {
    const order = [before, reward, dependent];
    expect(legalIndexes(order, optional)).toEqual([1, 2, 3]);
    expect(legalIndexes(order, optional, roomActionKey(dependent))).toEqual([1, 2]);
    expect(
      assessRoomActionInsertion(order, optional, 3, context(roomActionKey(dependent))),
    ).toMatchObject({ followsTerminal: true, blockers: [], structurallyAuthorable: false });
    const terminal = context(roomActionKey(optional));
    expect(assessRoomActionMove([before, reward, optional], 2, 1, terminal).followsTerminal).toBe(
      true,
    );
    // A row already after the terminal one may leave the tail, not move within it.
    const tail = [before, optional, reward, dependent];
    expect(assessRoomActionMove(tail, 2, 1, terminal).structurallyAuthorable).toBe(true);
    expect(assessRoomActionMove(tail, 3, 2, terminal).followsTerminal).toBe(true);
  });

  it('judges each row of a placed group by its own prefix', () => {
    // The press at 3 waits on the reward placed right before it.
    const group = [before, optional, reward, press];
    expect(assessRoomActionPlacement(group, 3, context()).structurallyAuthorable).toBe(true);
    const reversed = [before, optional, press, reward];
    expect(assessRoomActionPlacement(reversed, 3, context()).blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: press }),
      expect.objectContaining({ kind: 'window', reference: reward }),
    ]);
    // A placed row's prefix ends at that row: the reward at 2 is judged before the press.
    expect(assessRoomActionPlacement(reversed, 1, context()).structurallyAuthorable).toBe(true);
  });

  it('stops the authored order at each row a later required action of an earlier window must precede', () => {
    // The walk reaches the optional after-combat row before the before-combat
    // action's deadline, and the reward after it no earlier; the issue names the
    // earliest-window required action after each row.
    expect(
      assessRoomActionOrder([optional, reward, before], context()).filter(
        (issue) => issue.kind === 'requiredFirst',
      ),
    ).toEqual([
      expect.objectContaining({ reference: optional, requiredAction: before }),
      {
        kind: 'requiredFirst',
        reference: reward,
        detail: `must follow ${roomActionKey(before)}, a required action of an earlier window`,
        window: { kind: 'standard', phase: 'afterCombat' },
        requiredAction: before,
        requiredWindow: { kind: 'standard', phase: 'beforeCombat' },
      },
    ]);
    // Only a required action sets a deadline: an optional earlier-window row
    // after a later one is that row's own window issue.
    expect(issueKinds([before, optional, prep])).toEqual([['window', roomActionKey(prep)]]);
  });

  it('sets no deadline for a required action placed at a phase the room does not play', () => {
    const delivery: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: 'delivery',
      encounterPhaseKey: 'Gone',
    };
    const retained = roomActionOrderContext({
      lifecycleStructure: structure,
      contributions: [
        action(reward, 'required', { kind: 'standard', phase: 'afterCombat' }),
        action(delivery, 'required', { kind: 'encounterEnd', phaseKey: 'Gone' }),
      ],
    });
    expect(
      assessRoomActionOrder([reward, delivery], retained).some(
        (issue) => issue.kind === 'requiredFirst',
      ),
    ).toBe(false);
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
