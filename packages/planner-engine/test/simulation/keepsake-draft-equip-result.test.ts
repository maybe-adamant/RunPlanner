import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  type KeepsakeSelectionAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
} from '@run-planner/test-fixtures/underworld';

const fPostboss = createPostbossKeepsakeSelectionAddress(
  createOccurrenceAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('golden-f-preboss-shop:postboss'),
  ),
);
const routeStart = createRouteStartKeepsakeSelectionAddress('Underworld');

const outcomeKinds = ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo'] as const;

function keepsakeWith(kind: (typeof outcomeKinds)[number]): string {
  const keepsake = catalog.keepsakes.values.find((candidate) => candidate.effect?.kind === kind);
  if (keepsake === undefined) throw new Error(`catalog has no ${kind} keepsake`);
  return keepsake.key;
}

/** A keepsake without an equip result that every site below can equip. */
const plainKeepsakeKey = 'ManaOverTimeRefundKeepsake';

function session(project: ProjectDocument) {
  return createPreparedProjectCandidateSession(catalog, simulateProjectAssembly(catalog, project));
}

function choose(project: ProjectDocument, selection: KeepsakeSelectionAddress, key: string) {
  return applyProjectCommand(
    project,
    catalog,
    selection.owner === 'routeStart'
      ? { kind: 'ReplaceStartingKeepsake', selection, keepsakeKey: key }
      : { kind: 'ReplacePostbossKeepsake', selection, keepsakeKey: key },
  );
}

function selectionOption(
  project: ProjectDocument,
  selection: KeepsakeSelectionAddress,
  key: string,
) {
  const evaluated = session(project).evaluate({ kind: 'keepsakeSelection', selection });
  if (evaluated.kind !== 'keepsakeSelection') throw new Error('expected a reached selection');
  const option = evaluated.result.options.find((candidate) => candidate.key === key);
  if (option === undefined) throw new Error(`missing ${key} option`);
  return option;
}

const sites: readonly {
  readonly name: string;
  readonly selection: KeepsakeSelectionAddress;
  readonly project: () => ProjectDocument;
}[] = [
  { name: 'route start', selection: routeStart, project: createCompleteFGProject },
  { name: 'an unchanged Postboss rack', selection: fPostboss, project: createGoldenFGHProject },
  {
    name: 'a Postboss rack holding another keepsake',
    selection: fPostboss,
    project: () => choose(createGoldenFGHProject(), fPostboss, plainKeepsakeKey),
  },
];

describe('drafted keepsake equip results', () => {
  for (const site of sites)
    for (const kind of outcomeKinds)
      it(`judges a drafted ${kind} keepsake at ${site.name} as the authored keepsake`, () => {
        const keepsakeKey = keepsakeWith(kind);
        const base = site.project();
        const result = selectionOption(base, site.selection, keepsakeKey).equipResult;
        expect(result).toMatchObject({ kind: 'keepsakeEquipResult', resultKind: kind });
        if (result === undefined) throw new Error('expected an equip result address');

        const draftSession = session(base);
        const drafted = draftSession.evaluate({ kind: 'keepsakeEquipResult', result, keepsakeKey });
        const authoredSession = session(choose(base, site.selection, keepsakeKey));
        const authored = authoredSession.evaluate({ kind: 'keepsakeEquipResult', result });
        expect(drafted.kind).toBe('keepsakeEquipResult');
        expect(drafted).toEqual(authored);

        if (drafted.kind !== 'keepsakeEquipResult') return;
        const legal = drafted.result.options.find((option) => option.selectedPossible);
        if (legal === undefined) throw new Error(`expected a legal ${kind} result`);
        const draftedValue = draftSession.evaluate({
          kind: 'keepsakeEquipResult',
          result,
          keepsakeKey,
          value: legal.value,
        });
        expect(draftedValue).toMatchObject({ result: { selectedPossible: true } });
        expect(draftedValue).toEqual(
          authoredSession.evaluate({ kind: 'keepsakeEquipResult', result, value: legal.value }),
        );
      });

  it('opens no equip result for a keepsake without one', () => {
    const base = createGoldenFGHProject();
    for (const selection of [routeStart, fPostboss])
      expect(selectionOption(base, selection, plainKeepsakeKey)).not.toHaveProperty('equipResult');
    const pomResult = selectionOption(base, fPostboss, keepsakeWith('jeweledPom')).equipResult!;
    expect(() =>
      session(base).evaluate({
        kind: 'keepsakeEquipResult',
        result: pomResult,
        keepsakeKey: plainKeepsakeKey,
      }),
    ).toThrow('does not open a jeweledPom result');
  });
});
