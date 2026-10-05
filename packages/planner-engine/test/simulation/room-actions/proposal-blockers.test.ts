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
  it('retains the actual dependency pair even when an unrelated action is inserted or moved', () => {
    const roster = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [second, first],
      contributions: [
        action(first),
        action(second, [{ kind: 'afterAction', action: first }]),
        action(other),
      ],
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
    const move = assembleRoomActionRoster({
      owner,
      lifecycleStructure: structure,
      order: [second, first, other],
      contributions: [
        action(first),
        action(second, [{ kind: 'afterAction', action: first }]),
        action(other),
      ],
    }).proposals.find((p) => p.kind === 'move' && p.fromIndex === 2 && p.toIndex === 0)!;
    expect(move.blockers).toEqual(insert.blockers);
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
});
