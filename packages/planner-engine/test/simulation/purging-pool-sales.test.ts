import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createFountainRarityOutcomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createTraitOfferAddress,
  roomActionKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  purgingPoolCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

const biome = createBiomeAddress('Underworld', 'F');
const occurrence = createOccurrenceAddress(
  biome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);

function fRewards(project: ProjectDocument) {
  const biomeEvaluation = simulateProjectAssembly(catalog, project).evaluation.route?.biomes.find(
    (candidate) => candidate.biomeKey === 'F',
  );
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
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.filter((plan) => plan.biomeKey === 'F')),
    }),
  });
}

describe('Purging Pool sales', () => {
  it('waits for the fountain outcome before exposing pool inventory and then sells the rarified boon', () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: {
        kind: 'keepsakeSelection',
        routeKey: 'Underworld',
        biomeKey: 'routeStart',
        owner: 'routeStart',
      },
      keepsakeKey: 'FountainRarityKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence,
      interacted: true,
    });
    for (const slotKey of ['left', 'middle', 'right'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence,
        slotKey,
        traitKey: null,
      });
    const fountain = createRoomActionAddress(
      biome,
      occurrence.occurrenceId,
      roomActionKey({ kind: 'useFountain' }),
    );
    const outcome = createFountainRarityOutcomeAddress(fountain);
    const pending = simulateProjectAssembly(catalog, project);
    expect(purgingPoolCandidateForProjectEvaluationAssembly(pending, occurrence)).toBeUndefined();
    expect(pending.evaluation.route.biomes[0]?.findings).toContainEqual(
      expect.objectContaining({ code: 'fountainRarityResultMissing', origin: outcome }),
    );
    expect(pending.evaluation.route.biomes[0]?.findings).not.toContainEqual(
      expect.objectContaining({ code: 'purgingPoolTraitMissing' }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const ready = simulateProjectAssembly(catalog, project);
    const capability = purgingPoolCandidateForProjectEvaluationAssembly(ready, occurrence);
    expect(capability?.candidateTraitKeysBySlot.left).toContain('ApolloWeaponBoon');
    expect(ready.evaluation.route.biomes[0]?.findings).toContainEqual(
      expect.objectContaining({ code: 'purgingPoolTraitMissing' }),
    );
    const selected = withPoolSlots(project, [
      'ApolloWeaponBoon',
      'ZeusSpecialBoon',
      'HeraCastBoon',
    ]);
    const beforeSale = fRewards(selected);
    expect(beforeSale.branches.length).toBeGreaterThan(0);
    expect(
      beforeSale.branches[0]?.state.traitHistory.equippedTraits.ApolloWeaponBoon,
    ).toMatchObject({
      rarity: 'Heroic',
    });
    const afterSale = fRewards(sell(selected, 'left'));
    expect(afterSale.findings).not.toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(afterSale.branches.length).toBeGreaterThan(0);
    expect(
      afterSale.branches.every(
        (branch) => branch.state.traitHistory.equippedTraits.ApolloWeaponBoon === undefined,
      ),
    ).toBe(true);
  });

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

    const equipped = Object.keys(
      fRewards(initial).branches[0]?.state.traitHistory?.equippedTraits ?? {},
    );
    if (equipped.length < 3) throw new Error('fixture has too few Pool candidates');
    const resolved = withPoolSlots(initial, [equipped[0]!, equipped[1]!, equipped[2]!]);
    const sold = sell(resolved, 'left');
    const disabled = applyProjectCommand(sold, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence,
      interacted: false,
    });
    const pool = disabled.route.biomes
      .find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find(
        (entry) => entry.occurrenceId === occurrence.occurrenceId,
      )?.purgingPool;
    expect(pool?.interacted).toBe(false);
    expect(pool?.traitKeyBySlot.left).toBe(equipped[0]);
    expect(
      disabled.route.biomes
        .find((plan) => plan.biomeKey === 'F')
        ?.topology?.occurrences.find((entry) => entry.occurrenceId === occurrence.occurrenceId)
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
        (branch) => branch.state.traitHistory?.equippedTraits[equipped[0]!] !== undefined,
      ),
    ).toBe(true);
  });

  it('leaves zero sales neutral and removes only each selected displayed trait', () => {
    const initial = createGoldenFGHProject();
    const equipped = Object.keys(
      fRewards(initial).branches[0]?.state.traitHistory?.equippedTraits ?? {},
    );
    if (equipped.length < 3) throw new Error('fixture has too few Pool candidates');
    const [left, middle, right] = equipped;
    const resolved = withPoolSlots(initial, [left!, middle!, right!]);

    expect(
      Object.keys(fRewards(resolved).branches[0]!.state.traitHistory!.equippedTraits),
    ).toContain(left);

    const partial = fRewards(sell(resolved, 'middle'));
    expect(partial.findings).not.toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(
      partial.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits[middle!] === undefined,
      ),
    ).toBe(true);
    expect(
      partial.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits[left!] !== undefined,
      ),
    ).toBe(true);
    expect(
      partial.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits[right!] !== undefined,
      ),
    ).toBe(true);

    const all = fRewards(sell(sell(sell(resolved, 'left'), 'middle'), 'right'));
    for (const traitKey of [left!, middle!, right!]) {
      expect(
        all.branches.every(
          (branch) => branch.state.traitHistory?.equippedTraits[traitKey] === undefined,
        ),
      ).toBe(true);
      expect(
        all.branches.every((branch) =>
          branch.state.traitHistory?.previouslyPickedTraitKeys.includes(traitKey),
        ),
      ).toBe(true);
    }
  });

  it('removes a credited Bridal Glow at the real Pool without removing its target gains', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    let initial = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1)),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        options: [
          { traitKey: 'BoonDecayBoon', rarity: 'Common', targetTraitKey: 'ApolloWeaponBoon' },
          { traitKey: 'HeraSprintBoon', rarity: 'Common' },
          { traitKey: 'HeraManaBoon', rarity: 'Common' },
        ] as const,
        selectedOptionKey: 'option1',
      },
    });
    initial = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: {
        kind: 'keepsakeSelection',
        routeKey: 'Underworld',
        biomeKey: 'routeStart',
        owner: 'routeStart',
      },
      keepsakeKey: 'FountainRarityKeepsake',
    });
    const fountain = createRoomActionAddress(
      goldenFBiome,
      postbossId,
      roomActionKey({ kind: 'useFountain' }),
    );
    initial = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome: createFountainRarityOutcomeAddress(fountain),
      targetTraitKey: 'BoonDecayBoon',
    });
    initial = applyProjectCommand(initial, catalog, {
      kind: 'MoveRoomAction',
      action: fountain,
      toIndex: 0,
    });
    const credited = fRewards(initial).branches[0]?.state.traitHistory;
    expect(credited?.equippedTraits.BoonDecayBoon).toMatchObject({ rarity: 'Heroic' });
    expect(credited?.equippedTraits.ApolloWeaponBoon).toMatchObject({ rarity: 'Heroic', level: 6 });
    const creditedTarget = credited?.equippedTraits.ApolloWeaponBoon;
    if (creditedTarget === undefined) throw new Error('missing credited Bridal Glow target');

    const configured = withPoolSlots(initial, [
      'BoonDecayBoon',
      'ApolloWeaponBoon',
      'ZeusSpecialBoon',
    ]);
    const sold = fRewards(sell(configured, 'left'));
    expect(sold.findings).not.toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(sold.branches.length).toBeGreaterThan(0);
    expect(
      sold.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits.BoonDecayBoon === undefined,
      ),
    ).toBe(true);
    for (const branch of sold.branches)
      expect(branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon).toEqual(creditedTarget);
  });

  it('retains a stale sale and reports it without removing a different trait', () => {
    const initial = createGoldenFGHProject();
    const equipped = Object.keys(
      fRewards(initial).branches[0]?.state.traitHistory?.equippedTraits ?? {},
    );
    if (equipped.length < 2) throw new Error('fixture has too few Pool candidates');
    const [left, middle] = equipped;
    const resolved = withPoolSlots(initial, [left!, middle!]);
    const sold = sell(resolved, 'left');
    const stale = {
      ...sold,
      route: {
        ...sold.route,
        biomes: sold.route.biomes.map((plan) =>
          plan.biomeKey !== 'F'
            ? plan
            : {
                ...plan,
                topology:
                  plan.topology === null
                    ? null
                    : {
                        ...plan.topology,
                        occurrences: plan.topology.occurrences.map((entry) =>
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
              },
        ),
      },
    };
    const evaluated = fRewards(stale);
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({ code: 'purgingPoolSaleUnavailable' }),
    );
    expect(
      evaluated.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits[middle!] !== undefined,
      ),
    ).toBe(true);
  });

  it('removes the same F Pool trait at the configured tail and when G follows', () => {
    const withG = createCompleteFGProject();
    const tail = asConfiguredTailF(createCompleteFGProject());
    const poolTraitKeys = Object.keys(
      fRewards(withG).branches[0]?.state.traitHistory?.equippedTraits ?? {},
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
          (branch) => branch.state.traitHistory?.equippedTraits[traitKey] === undefined,
        ),
      ).toBe(true);
      expect(
        sold.branches.every((branch) =>
          branch.state.traitHistory?.previouslyPickedTraitKeys.includes(traitKey),
        ),
      ).toBe(true);
    }
  });
});
