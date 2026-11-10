import { describe, expect, it } from 'vitest';
import { createOccurrenceId } from '../../../src/authored-project/addresses';
import type { RoomActionReference } from '../../../src/authored-project/model';
import type {
  RoomActionContribution,
  RoomActionDependency,
} from '../../../src/authored-project/room-actions/domain';
import type {
  RoomActionWindow,
  RoomLifecycleStructure,
} from '../../../src/authored-project/room-actions/lifecycle-structure';
import { roomActionKey } from '../../../src/authored-project/room-actions/state';
import { assembleRoomActionRoster } from '../../../src/simulation/room-actions/assemble';

const owner = {
  kind: 'occurrence' as const,
  routeKey: 'Underworld' as const,
  biomeKey: 'F' as const,
  occurrenceId: createOccurrenceId('blockers'),
};
const first: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'first' };
const second: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'second' };
const other: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'other' };
const before: RoomActionWindow = { kind: 'standard', phase: 'beforeCombat' };
const after: RoomActionWindow = { kind: 'standard', phase: 'afterCombat' };
const structure: RoomLifecycleStructure = {
  profileKey: 'StandardRewardRoom',
  activeEncounterSlotKeys: ['first'],
  phases: [{ phaseKey: 'first' }],
  points: [
    { kind: 'roomEntered', key: 'roomEntered' },
    { kind: 'encounterStart', key: 'start', phaseKey: 'first' },
    { kind: 'encounterEnd', key: 'end', phaseKey: 'first' },
    { kind: 'cleanup', key: 'cleanup' },
  ],
};
function action(
  reference: RoomActionReference,
  dependencies: readonly RoomActionDependency[] = [],
  window = after,
): RoomActionContribution {
  return { kind: 'action', reference, owner, participation: 'optional', window, dependencies };
}
describe('room action proposal blockers', () => {
  it('distinguishes unavailable checkpoint evidence', () => {
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [],
      contributions: [action(first, [{ kind: 'afterCheckpoint', checkpointKey: 'missing' }])],
    });
    expect(roster.proposals[0]?.blockers).toEqual([
      expect.objectContaining({
        checkpointUnavailable: true,
        dependency: { kind: 'afterCheckpoint', checkpointKey: 'missing' },
      }),
    ]);
  });
  it('retains the prefix dependency pair for an unrelated insertion or move after it, and none before it', () => {
    const contributions = [
      action(first),
      action(second, [{ kind: 'afterAction', action: first }]),
      action(other),
    ];
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [second, first],
      contributions,
    });
    const insert = roster.proposals.find((p) => p.kind === 'insert' && p.toIndex === 2)!;
    expect(insert.structurallyAuthorable).toBe(false);
    expect(insert.blockers).toEqual([
      expect.objectContaining({
        kind: 'dependency',
        reference: second,
        dependency: { kind: 'afterAction', action: first },
      }),
    ]);
    // Before the invalid row the walk has not reached it yet.
    expect(roster.proposals.find((p) => p.kind === 'insert' && p.toIndex === 0)).toMatchObject({
      structurallyAuthorable: true,
      blockers: [],
    });
    const moves = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [second, first, other],
      contributions,
    }).proposals.filter((p) => p.kind === 'move' && p.fromIndex === 2);
    expect(moves.find((p) => p.toIndex === 1)!.blockers).toEqual(insert.blockers);
    expect(moves.find((p) => p.toIndex === 0)).toMatchObject({
      structurallyAuthorable: true,
      blockers: [],
    });
    expect(
      roster.proposals
        .filter((p) => p.structurallyAuthorable)
        .every((p) => p.blockers.length === 0),
    ).toBe(true);
  });
  it.each(['beforeCheckpoint', 'afterCheckpoint'] as const)('retains %s evidence', (kind) => {
    const dependency = { kind, checkpointKey: 'combat' };
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [],
      contributions: [
        action(first, [dependency], kind === 'beforeCheckpoint' ? after : before),
        {
          kind: 'checkpoint',
          checkpointKey: 'combat',
          label: 'Combat',
          window: kind === 'beforeCheckpoint' ? before : after,
        },
      ],
    });
    expect(roster.proposals[0]).toMatchObject({
      structurallyAuthorable: false,
      blockers: [{ kind: 'dependency', reference: first, dependency }],
    });
  });
  it('anchors each move at the current-order index it lands in front of', () => {
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [first, second, other],
      contributions: [action(first), action(second), action(other)],
    });
    const anchors = roster.proposals
      .filter((p) => p.kind === 'move' && p.reference === second)
      .map((p) => [p.toIndex, p.anchorIndex, p.order]);
    // An earlier move lands in front of the action at its target index; a later
    // one in front of the action after it, or past the end.
    expect(anchors).toEqual([
      [0, 0, [second, first, other]],
      [2, 3, [first, other, second]],
    ]);
  });
  it('retains all dependency and timing evidence, and no evidence for a legal move', () => {
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [first, second],
      contributions: [
        action(first, [], before),
        action(second, [{ kind: 'afterAction', action: first }], after),
      ],
    });
    expect(roster.proposals.find((p) => p.kind === 'move' && p.fromIndex === 0)?.blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: second }),
      expect.objectContaining({
        kind: 'window',
        reference: first,
        window: before,
        precedingAction: second,
        precedingWindow: after,
      }),
    ]);
    const legal = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [first, second],
      contributions: [action(first), action(second)],
    });
    expect(legal.proposals.find((p) => p.kind === 'move')).toMatchObject({
      structurallyAuthorable: true,
      blockers: [],
    });
  });
  it('offers no generic removal for purchase rows owned by their feature', () => {
    const well: RoomActionReference = {
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:healing',
    };
    const staleShrine: RoomActionReference = {
      kind: 'purchaseHermesShrineOffer',
      generationKey: 'initial:first',
      rushed: false,
    };
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [well, staleShrine],
      contributions: [action(well)],
    });
    expect(roster.proposals.filter((proposal) => proposal.kind === 'remove')).toEqual([]);
    expect(roster.proposals.some((proposal) => proposal.kind === 'move')).toBe(true);
  });
  it('lists every index of a missing required action, its canonical one marked and authorable', () => {
    const required = (
      reference: RoomActionReference,
      window: RoomActionWindow,
    ): RoomActionContribution => ({ ...action(reference, [], window), participation: 'required' });
    const extra: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'extra' };
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      // The retained before-combat row follows an after-combat one: its own window issue.
      order: [other, first, extra],
      contributions: [
        required(first, before),
        required(second, after),
        action(other),
        action(extra),
      ],
      canonicalRequiredInsertions: [{ actionKey: roomActionKey(second), toIndex: 3 }],
    });
    const inserts = roster.proposals.filter(
      (proposal) => proposal.kind === 'insert' && proposal.reference === second,
    );
    expect(
      inserts.map((proposal) => [
        proposal.toIndex,
        proposal.structurallyAuthorable,
        proposal.canonical,
      ]),
    ).toEqual([
      // Ahead of the required before-combat row, the walk does not reach the insertion.
      [0, false, undefined],
      [1, false, undefined],
      // Past it, the retained row's own window issue is in the prefix.
      [2, false, undefined],
      // The default restore stays authorable past the retained issue.
      [3, true, true],
    ]);
    expect(inserts[0]?.blockers).toEqual([
      expect.objectContaining({ kind: 'requiredFirst', reference: second, requiredAction: first }),
    ]);
    expect(inserts[1]?.blockers).toEqual([
      expect.objectContaining({ kind: 'requiredFirst', reference: other, requiredAction: first }),
      expect.objectContaining({ kind: 'requiredFirst', reference: second, requiredAction: first }),
    ]);
    expect(inserts[2]?.blockers).toEqual([
      expect.objectContaining({ kind: 'window', reference: first }),
    ]);
    expect(inserts[3]?.blockers).toEqual([]);
  });
});
