import { describe, expect, it } from 'vitest';
import { createOccurrenceId } from '../../../src/authored-project/addresses';
import type { RoomActionReference } from '../../../src/authored-project/model';
import type {
  RoomActionContribution,
  RoomActionDependency,
} from '../../../src/authored-project/room-actions/domain';
import type { RoomEventGraph } from '../../../src/authored-project/room-actions/event-graph';
import { roomActionKey } from '../../../src/authored-project/room-actions/state';
import { assembleRoomActionRoster } from '../../../src/simulation/room-actions/assemble';
import { gateFreeGraphEvents } from '../../support/event-graph';
import { boundsForPlacement, type TestRowPlacement } from '../../support/room-action-bounds';

const owner = {
  kind: 'occurrence' as const,
  routeKey: 'Underworld' as const,
  biomeKey: 'F' as const,
  occurrenceId: createOccurrenceId('blockers'),
};
const first: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'first' };
const second: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'second' };
const other: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'other' };
const before: TestRowPlacement = { kind: 'beforeCombat' as const };
const after: TestRowPlacement = { kind: 'afterCombat' as const };
const structure: RoomEventGraph = {
  profileKey: 'StandardRewardRoom',
  activeEncounterSlotKeys: ['first'],
  phases: [{ phaseKey: 'first' }],
  events: gateFreeGraphEvents(['first'], false),
};
function action(
  reference: RoomActionReference,
  dependencies: readonly RoomActionDependency[] = [],
  placement = after,
): RoomActionContribution {
  return {
    kind: 'action',
    reference,
    owner,
    participation: 'optional',
    bounds: boundsForPlacement(placement, structure),
    dependencies,
  };
}
describe('room action proposal blockers', () => {
  it('distinguishes a spawn the room never reaches', () => {
    const roster = assembleRoomActionRoster({
      owner,
      eventGraph: structure,
      order: [],
      contributions: [
        {
          ...action(first),
          bounds: {
            spawn: { kind: 'encounterEnd', phaseKey: 'missing' },
            deadline: { kind: 'doorsOpened' },
          },
        },
      ],
    });
    expect(roster.proposals[0]?.blockers).toEqual([
      expect.objectContaining({
        kind: 'beforeSpawn',
        unavailable: true,
        point: { kind: 'encounterEnd', phaseKey: 'missing' },
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
      eventGraph: structure,
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
      eventGraph: structure,
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
  it('anchors each move at the current-order index it lands in front of', () => {
    const roster = assembleRoomActionRoster({
      owner,
      eventGraph: structure,
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
      eventGraph: structure,
      order: [first, second],
      contributions: [
        action(first, [], before),
        action(second, [{ kind: 'afterAction', action: first }], after),
      ],
    });
    expect(roster.proposals.find((p) => p.kind === 'move' && p.fromIndex === 0)?.blockers).toEqual([
      expect.objectContaining({ kind: 'dependency', reference: second }),
      expect.objectContaining({
        kind: 'pastDeadline',
        reference: first,
        precedingAction: second,
        deadline: { kind: 'encounterEnd', phaseKey: 'first' },
      }),
    ]);
    const legal = assembleRoomActionRoster({
      owner,
      eventGraph: structure,
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
    };
    const roster = assembleRoomActionRoster({
      owner,
      eventGraph: structure,
      order: [well, staleShrine],
      contributions: [action(well)],
    });
    expect(roster.proposals.filter((proposal) => proposal.kind === 'remove')).toEqual([]);
    expect(roster.proposals.some((proposal) => proposal.kind === 'move')).toBe(true);
  });
  it('lists every index of a missing required action, its canonical one marked and authorable', () => {
    const required = (
      reference: RoomActionReference,
      placement: TestRowPlacement,
    ): RoomActionContribution => ({
      ...action(reference, [], placement),
      participation: 'required',
    });
    const extra: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'extra' };
    const roster = assembleRoomActionRoster({
      owner,
      eventGraph: structure,
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
      expect.objectContaining({ kind: 'beforeSpawn', reference: second, requiredAction: first }),
    ]);
    expect(inserts[1]?.blockers).toEqual([
      expect.objectContaining({ kind: 'beforeSpawn', reference: other, requiredAction: first }),
      expect.objectContaining({ kind: 'beforeSpawn', reference: second, requiredAction: first }),
    ]);
    expect(inserts[2]?.blockers).toEqual([
      expect.objectContaining({ kind: 'pastDeadline', reference: first }),
    ]);
    expect(inserts[3]?.blockers).toEqual([]);
  });
});
