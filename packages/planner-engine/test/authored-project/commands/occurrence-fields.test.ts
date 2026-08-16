import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  assessFieldsActionOrder,
  createOccurrenceAddress,
  createOccurrenceId,
  fieldsActionKey,
  fieldsActionOrderProposals,
  type FieldsCombatState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures';

const occurrenceId = createOccurrenceId('golden-h-combat02');
const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);

function fieldsState(project: ProjectDocument): FieldsCombatState {
  const state = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)?.state;
  if (state?.kind !== 'fieldsCombat') throw new Error('missing Fields occurrence');
  return state;
}

describe('authored Fields occurrence commands', () => {
  it('owns bounded one-edit repair proposals without removing active required actions', () => {
    const state = fieldsState(createGoldenFGHProject());
    const room = catalog.rooms.byKey.H_Combat02;
    if (room === undefined) throw new Error('missing Fields declaration');
    expect(assessFieldsActionOrder(catalog, room, state, 2)).toEqual({
      issues: [],
      valid: true,
    });
    const newlyActive = assessFieldsActionOrder(catalog, room, state, 3);
    expect(newlyActive.issues.map((issue) => [issue.kind, fieldsActionKey(issue.action)])).toEqual([
      ['missing', 'complete:Cage03'],
      ['missing', 'interact:cage3'],
    ]);
    const insertions = fieldsActionOrderProposals(catalog, room, state, 3).filter(
      (proposal) => proposal.kind === 'insert',
    );
    expect(
      insertions.some((proposal) => fieldsActionKey(proposal.action) === 'complete:Cage03'),
    ).toBe(true);
    expect(
      insertions.some((proposal) => fieldsActionKey(proposal.action) === 'interact:cage3'),
    ).toBe(true);
    expect(
      fieldsActionOrderProposals(catalog, room, state, 2).some(
        (proposal) => proposal.kind === 'remove',
      ),
    ).toBe(false);

    const withInactive = Object.freeze({
      ...state,
      actionOrder: Object.freeze([
        ...state.actionOrder,
        { kind: 'completeCage' as const, phaseKey: 'Cage03' },
        { kind: 'interactCageReward' as const, slotKey: 'cage3' },
      ]),
    });
    expect(
      fieldsActionOrderProposals(catalog, room, withInactive, 2)
        .filter((proposal) => proposal.kind === 'remove')
        .map((proposal) => fieldsActionKey(proposal.action)),
    ).toEqual(['complete:Cage03', 'interact:cage3']);
  });

  it('replaces one complete mixed action sequence and preserves unchanged identity', () => {
    const initial = createGoldenFGHProject();
    const order = Object.freeze([
      { kind: 'completeCage' as const, phaseKey: 'Cage02' },
      { kind: 'completeCage' as const, phaseKey: 'Cage01' },
      { kind: 'interactCageReward' as const, slotKey: 'cage1' },
      { kind: 'interactCageReward' as const, slotKey: 'cage2' },
    ]);
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceFieldsActionOrder',
      occurrence,
      actionOrder: order,
    });
    expect(fieldsState(changed).actionOrder).toEqual(order);
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceFieldsActionOrder',
        occurrence,
        actionOrder: order,
      }),
    ).toBe(changed);
  });

  it('rejects duplicate and declaration-unknown action identities', () => {
    const initial = createGoldenFGHProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceFieldsActionOrder',
        occurrence,
        actionOrder: [
          { kind: 'completeCage', phaseKey: 'Cage01' },
          { kind: 'completeCage', phaseKey: 'Cage01' },
        ],
      }),
    ).toThrow('duplicate Fields action complete:Cage01');
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceFieldsActionOrder',
        occurrence,
        actionOrder: [{ kind: 'completeCage', phaseKey: 'UnknownCage' }],
      }),
    ).toThrow('unknown Fields action complete:UnknownCage');
  });
});
