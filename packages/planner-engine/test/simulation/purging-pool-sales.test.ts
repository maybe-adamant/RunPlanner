import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  attachTraitHistory,
  purgingPoolCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
} from '@run-planner/test-fixtures/underworld';

const biome = createBiomeAddress('Underworld', 'F');
const occurrence = createOccurrenceAddress(biome, createOccurrenceId('completion:F:postboss'));

function fRewards(project: ProjectDocument) {
  const biomeEvaluation = simulateProjectAssembly(catalog, project)
    .evaluation.routes.find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'F');
  if (biomeEvaluation?.authoring !== 'complete') throw new Error('F is not complete');
  return biomeEvaluation.rewards;
}

function withPoolSlots(project: ProjectDocument, traitKeys: readonly string[]) {
  const interacted = applyProjectCommand(project, catalog, {
    kind: 'SetPurgingPoolInteraction',
    occurrence,
    interacted: true,
  });
  return traitKeys.reduce(
    (current, traitKey, index) =>
      applyProjectCommand(current, catalog, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence,
        slotKey: (['left', 'middle', 'right'] as const)[index]!,
        traitKey,
      }),
    interacted,
  );
}

function sell(project: ProjectDocument, slotKey: 'left' | 'middle' | 'right') {
  const reference = { kind: 'sellPurgingPoolTrait' as const, slotKey };
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference)),
    reference,
    index: 1,
  });
}

function asConfiguredTailF(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(route.biomes.filter((plan) => plan.biomeKey === 'F')),
            }),
      ),
    ),
  });
}

describe('Purging Pool sales', () => {
  it('rejects an unknown Pool slot before mutating authored state', () => {
    const interacted = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence,
      interacted: true,
    });

    expect(() =>
      applyProjectCommand(interacted, catalog, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence,
        slotKey: 'upper',
        traitKey: null,
      } as unknown as ProjectCommand),
    ).toThrow(/unknown Purging Pool slot upper/);
  });

  it('keeps an uninteracted forced Pool runtime-random and disabling it removes sales but retains detail', () => {
    const initial = createGoldenFGHProject();
    expect(
      purgingPoolCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, initial),
        occurrence,
      ),
    ).toBeUndefined();

    const equipped = Object.keys(fRewards(initial).branches[0]?.traitHistory?.equippedTraits ?? {});
    if (equipped.length < 3) throw new Error('fixture has too few Pool candidates');
    const resolved = withPoolSlots(initial, [equipped[0]!, equipped[1]!, equipped[2]!]);
    const sold = sell(resolved, 'left');
    const disabled = applyProjectCommand(sold, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence,
      interacted: false,
    });
    const pool = disabled.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((plan) => plan.biomeKey === 'F')
      ?.completionOccurrences.find(
        (entry) => entry.occurrenceId === occurrence.occurrenceId,
      )?.purgingPool;
    expect(pool?.interacted).toBe(false);
    expect(pool?.traitKeyBySlot.left).toBe(equipped[0]);
    expect(
      disabled.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'F')
        ?.completionOccurrences.find((entry) => entry.occurrenceId === occurrence.occurrenceId)
        ?.roomActions.order,
    ).not.toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' });
    expect(
      purgingPoolCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, disabled),
        occurrence,
      ),
    ).toBeUndefined();
    expect(
      fRewards(disabled).branches.every(
        (branch) => branch.traitHistory?.equippedTraits[equipped[0]!] !== undefined,
      ),
    ).toBe(true);
  });

  it('leaves zero sales neutral and removes only each selected displayed trait', () => {
    const initial = createGoldenFGHProject();
    const equipped = Object.keys(fRewards(initial).branches[0]?.traitHistory?.equippedTraits ?? {});
    if (equipped.length < 3) throw new Error('fixture has too few Pool candidates');
    const [left, middle, right] = equipped;
    const resolved = withPoolSlots(initial, [left!, middle!, right!]);

    expect(Object.keys(fRewards(resolved).branches[0]!.traitHistory!.equippedTraits)).toContain(
      left,
    );

    const partial = fRewards(sell(resolved, 'middle'));
    expect(partial.findings).not.toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(
      partial.branches.every(
        (branch) => branch.traitHistory?.equippedTraits[middle!] === undefined,
      ),
    ).toBe(true);
    expect(
      partial.branches.every((branch) => branch.traitHistory?.equippedTraits[left!] !== undefined),
    ).toBe(true);
    expect(
      partial.branches.every((branch) => branch.traitHistory?.equippedTraits[right!] !== undefined),
    ).toBe(true);

    const all = fRewards(sell(sell(sell(resolved, 'left'), 'middle'), 'right'));
    for (const traitKey of [left!, middle!, right!]) {
      expect(
        all.branches.every((branch) => branch.traitHistory?.equippedTraits[traitKey] === undefined),
      ).toBe(true);
      expect(
        all.branches.every((branch) =>
          branch.traitHistory?.previouslyPickedTraitKeys.includes(traitKey),
        ),
      ).toBe(true);
    }
  }, 15_000);

  it('retains a stale sale and reports it without removing a different trait', () => {
    const initial = createGoldenFGHProject();
    const equipped = Object.keys(fRewards(initial).branches[0]?.traitHistory?.equippedTraits ?? {});
    if (equipped.length < 2) throw new Error('fixture has too few Pool candidates');
    const [left, middle] = equipped;
    const resolved = withPoolSlots(initial, [left!, middle!]);
    const stale = {
      ...sell(resolved, 'left'),
      routes: sell(resolved, 'left').routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F'
                  ? plan
                  : {
                      ...plan,
                      completionOccurrences: plan.completionOccurrences.map((entry) =>
                        entry.occurrenceId !== occurrence.occurrenceId
                          ? entry
                          : {
                              ...entry,
                              purgingPool: {
                                ...entry.purgingPool!,
                                traitKeyBySlot: {
                                  ...entry.purgingPool!.traitKeyBySlot,
                                  left: null,
                                },
                              },
                            },
                      ),
                    },
              ),
            },
      ),
    };
    const evaluated = fRewards(stale);
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(
      evaluated.branches.every(
        (branch) => branch.traitHistory?.equippedTraits[middle!] !== undefined,
      ),
    ).toBe(true);
  }, 15_000);

  it('removes the same F Pool trait at the configured tail and when G follows', () => {
    const withG = createCompleteFGProject();
    const tail = asConfiguredTailF(createCompleteFGProject());
    const poolTraitKeys = Object.keys(
      fRewards(withG).branches[0]?.traitHistory?.equippedTraits ?? {},
    ).slice(0, 3);
    const traitKey = poolTraitKeys[0];
    if (traitKey === undefined || poolTraitKeys.length !== 3)
      throw new Error('fixture has too few Pool candidates');
    for (const project of [withG, tail]) {
      const sold = fRewards(sell(withPoolSlots(project, poolTraitKeys), 'left'));
      expect(sold.findings).not.toContainEqual(
        expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
      );
      expect(
        sold.branches.every(
          (branch) => branch.traitHistory?.equippedTraits[traitKey] === undefined,
        ),
      ).toBe(true);
      expect(
        sold.branches.every((branch) =>
          branch.traitHistory?.previouslyPickedTraitKeys.includes(traitKey),
        ),
      ).toBe(true);
    }
  }, 15_000);
});
