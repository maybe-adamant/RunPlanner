import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  forcedChaosOccurrenceKeys,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { locateBiome } from '../../src/authored-project/commands/contract';
import { applyRouteDetourCommand } from '../../src/authored-project/commands/route-detours';
import { reconcileChaosTopology } from '../../src/authored-project/chaos-gate-reconciliation';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenGBiome,
  goldenHBiome,
  goldenHStartId,
  goldenIStartId,
  goldenGStartId,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { simulateProjectAssembly } from '../../src/simulation/evaluation/project';
import { createTraitHistoryState } from '../../src/simulation/traits';
import { stygianWellCandidateForProjectEvaluationAssembly } from '../../src/simulation/evaluation/project-evaluation-assembly';
import {
  applyStygianWellPurchase,
  assessStygianWellPurchase,
  advanceStygianWellClock,
  assessStygianWell,
  assessStygianWellPlacement,
  extendedWellItemKeys,
  twistResultItemKeys,
  projectStygianWellLegality,
  type StygianWellRunState,
} from '../../src/simulation/commerce/stygian-well';

const empty = (): StygianWellRunState => ({
  sparkUses: 0,
  yarnUses: 0,
  hymnUses: 0,
  extendedUses: 0,
  timedInstances: [],
  directPurchases: {},
});
const purchaseSource = {
  occurrence: createOccurrenceAddress(goldenFBiome, createOccurrenceId('well')),
  generationKey: 'initial:secondLeft',
} as const;
const buy = (state: StygianWellRunState, itemKey: string, directPurchase = true) =>
  applyStygianWellPurchase(catalog, state, itemKey, purchaseSource, directPurchase);
const withDiscount = (remainingUses: number): StygianWellRunState => ({
  ...empty(),
  timedInstances: [
    {
      itemKey: 'TemporaryDiscountTrait',
      traitKey: 'TemporaryDiscountTrait',
      clock: 'encounters',
      remainingUses,
      source: purchaseSource,
    },
  ],
});

describe('Stygian Well consequential purchase state', () => {
  it('allows buying Ixion while holding pending Ixion uses and adds one use', () => {
    const itemKey = 'TemporaryForcedSecretDoorTrait';
    const well = {
      interacted: true,
      offerKeyBySlot: {
        healing: 'ArmorBoostStore',
        secondLeft: itemKey,
        secondRight: 'TemporaryBoonRarityTrait',
      },
    } as const;
    let state = buy(empty(), itemKey);
    for (const pending of [1, 2]) {
      expect(state.sparkUses).toBe(pending);
      const inventory = assessStygianWell(
        catalog,
        'Underworld',
        catalog.rooms.byKey.F_PostBoss01,
        3,
        well,
        state,
      );
      expect(inventory.candidateItemKeysBySlot.secondLeft).toContain(itemKey);
      expect(inventory.issues).toEqual([]);
      expect(
        assessStygianWellPurchase(
          catalog,
          'Underworld',
          well,
          'initial:secondLeft',
          state,
          createTraitHistoryState(),
          'initial:secondLeft',
        ).issues,
      ).toEqual([]);
      state = buy(state, itemKey);
      expect(state.sparkUses).toBe(pending + 1);
    }
  });

  it('requires biome depth three for ordinary Wells while forced hosts bypass depth and spacing', () => {
    const ordinary = catalog.rooms.byKey.F_Combat01;
    expect(assessStygianWellPlacement(ordinary, 'Underworld', [], 2).eligible).toBe(false);
    expect(assessStygianWellPlacement(ordinary, 'Underworld', [], 3).eligible).toBe(true);
    expect(
      assessStygianWellPlacement(ordinary, 'Underworld', [true, false, false], 3).eligible,
    ).toBe(false);
    expect(
      assessStygianWellPlacement(catalog.rooms.byKey.F_PostBoss01, 'Underworld', [true], 0),
    ).toMatchObject({
      forced: true,
      eligible: true,
    });
  });

  it('uses room-entry depth rather than physical room count for F Well candidates', () => {
    const assembly = simulateProjectAssembly(catalog, createGoldenFGHProject());
    for (const [decision, eligible] of [
      [2, false],
      [3, true],
    ] as const) {
      const owner = createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId(`golden-f-b${decision}-e1`),
      );
      expect(stygianWellCandidateForProjectEvaluationAssembly(assembly, owner)).toMatchObject({
        placementEligible: eligible,
        present: false,
      });
    }
  });

  it.each(['Underworld', 'Surface', 'Dream'])(
    'uses %s availability for initial Ixion and Travel refill',
    (routeKey) => {
      const well = {
        interacted: true,
        offerKeyBySlot: {
          healing: 'ArmorBoostStore',
          secondLeft: 'TemporaryForcedSecretDoorTrait',
          secondRight: 'LimitedSwapTraitDrop',
        },
      } as const;
      const initial = assessStygianWell(
        catalog,
        routeKey,
        catalog.rooms.byKey.F_PostBoss01,
        3,
        well,
      );
      expect(
        initial.candidateItemKeysBySlot.secondLeft.includes('TemporaryForcedSecretDoorTrait'),
      ).toBe(routeKey !== 'Dream');
      expect(initial.issues.some((issue) => issue.kind === 'wrongGroup')).toBe(
        routeKey === 'Dream',
      );
      const refill = assessStygianWellPurchase(
        catalog,
        routeKey,
        {
          ...well,
          offerKeyBySlot: { ...well.offerKeyBySlot, secondLeft: 'TemporaryBoonRarityTrait' },
          travelDealRefillKey: 'TemporaryForcedSecretDoorTrait',
        },
        'initial:secondLeft',
        empty(),
        {
          ...createTraitHistoryState(),
          equippedTraits: { RestockBoon: {} as never },
        },
        'initial:secondLeft',
      );
      expect(
        refill.travelDealRefill?.candidateItemKeys.includes('TemporaryForcedSecretDoorTrait'),
      ).toBe(routeKey !== 'Dream');
      expect(refill.issues.some((issue) => issue.kind === 'refillWrongGroup')).toBe(
        routeKey === 'Dream',
      );
      expect(twistResultItemKeys(catalog)).not.toContain('TemporaryForcedSecretDoorTrait');
      expect(twistResultItemKeys(catalog)).toContain('MetaCurrencyRange');
    },
  );
  it('keeps the forced F Postboss refill and consequences identical at a configured route tail', () => {
    const owner = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const outcomes = [true, false].map((configuredTail) => {
      const assembly = simulateProjectAssembly(
        catalog,
        configuredTail
          ? loadUnderworldFStygianWellCheckpoint()
          : createUnderworldFWellCheckpoint(false),
      );
      const candidate = stygianWellCandidateForProjectEvaluationAssembly(assembly, owner);
      expect(candidate?.assessments).not.toHaveLength(0);
      expect(
        candidate?.assessments
          .filter(
            (
              assessment,
            ): assessment is import('../../src/simulation/commerce/stygian-well').StygianWellEntryCandidateContext =>
              'inventory' in assessment,
          )
          .every((assessment) => assessment.inventory?.complete),
      ).toBe(true);
      const biome = assembly.evaluation.route.biomes.find(
        (candidateBiome) => candidateBiome.biomeKey === 'F',
      );
      if (biome?.authoring !== 'complete') throw new Error('expected complete F Well evaluation');
      expect(biome.rewards.findings).not.toContainEqual(
        expect.objectContaining({ code: 'stygianWellTravelDealRefillUnavailable' }),
      );
      return biome.rewards.branches.map((branch) => branch.state.stygianWell);
    });
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[0]?.every((state) => state?.yarnUses === 1)).toBe(true);
    expect(outcomes[0]?.every((state) => state?.hymnUses === 1)).toBe(true);
    expect(outcomes[0]?.every((state) => state?.extendedUses === 1)).toBe(true);
  });

  it('applies paid effects without creating a pickup state', () => {
    expect(buy(empty(), 'TemporaryForcedSecretDoorTrait').sparkUses).toBe(1);
    expect(buy(empty(), 'TemporaryBoonRarityTrait').yarnUses).toBe(1);
    expect(buy(empty(), 'LimitedSwapTraitDrop').hymnUses).toBe(1);
    expect(buy(empty(), 'LastStandShopItem')).toEqual({
      ...empty(),
      directPurchases: { LastStandShopItem: 1 },
    });
  });

  it('reports and skips a retained Travel refill when its actual trigger is removed', () => {
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-b8-e1')),
        'self',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'RestockBoon', rarity: 'Epic' },
          { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
          { traitKey: 'SprintShieldBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (f?.authoring !== 'complete') throw new Error('expected complete F Well evaluation');
    expect(f.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'stygianWellTravelDealRefillUnavailable' }),
    );
    expect(f.rewards.branches.every((branch) => branch.state.stygianWell?.extendedUses !== 1)).toBe(
      true,
    );
  });

  it('materializes and consumes one Ixion use at the first reached host-capable Chaos room', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    const gTopology = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    expect(
      gTopology?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenGStartId)
        ?.additionalExits,
    ).toEqual([expect.objectContaining({ kind: 'chaos', key: 'chaos' })]);
    const assembly = simulateProjectAssembly(catalog, project);
    const g = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g?.findings).not.toContainEqual(
      expect.objectContaining({ code: 'ixionChaosUnavailable' }),
    );
    expect(g?.findings).not.toContainEqual(expect.objectContaining({ code: 'ixionChaosMissing' }));
    if (g?.authoring !== 'complete') throw new Error('expected complete G Ixion evaluation');
    expect(g.rewards.branches.every((branch) => branch.state.stygianWell?.sparkUses === 0)).toBe(
      true,
    );
  });

  it('places a G Postboss Ixion-generated gate at H Intro and removes it with the purchase', () => {
    let project = createGoldenFGHProject();
    const gPostboss = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_PostBoss01');
    if (gPostboss === undefined) throw new Error('expected fixed G Postboss');
    const well = createOccurrenceAddress(goldenGBiome, gPostboss.occurrenceId);
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: well,
      interacted: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    const generatedAtHIntro = () =>
      project.route.biomes
        .find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenHStartId)
        ?.additionalExits.find((exit) => exit.kind === 'chaos');
    expect(generatedAtHIntro()).toEqual(
      expect.objectContaining({
        kind: 'chaos',
        key: 'chaos',
        origin: {
          kind: 'ixionGenerated',
          sourceBiomeKey: 'G',
          sourceOccurrenceId: gPostboss.occurrenceId,
          generationKey: 'initial:secondLeft',
        },
      }),
    );
    const forcedFindings = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(forcedFindings).not.toContainEqual(
      expect.objectContaining({ code: 'ixionChaosMissing' }),
    );
    expect(forcedFindings).not.toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        evidence: expect.objectContaining({ sourceGameName: 'G_Intro' }),
      }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: false,
    });
    expect(generatedAtHIntro()).toBeUndefined();
  });

  it('keeps an authored G gate source-agnostic when an Ixion use is removed', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional: createAdditionalExitAddress(goldenGBiome, goldenGStartId, 'chaos'),
      occurrenceId: createOccurrenceId('authored-chaos-map'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceChaosMap',
      occurrence: createOccurrenceAddress(goldenGBiome, createOccurrenceId('authored-chaos-map')),
      gameName: 'Chaos_06',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    const g = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const intro = g?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenGStartId);
    expect(intro?.additionalExits).toEqual([
      {
        kind: 'chaos',
        key: 'chaos',
        occurrenceId: createOccurrenceId('authored-chaos-map'),
      },
    ]);
    expect(
      g?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('authored-chaos-map'),
      )?.gameName,
    ).toBe('Chaos_06');
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'ixionChaosMissing' }),
    );
    expect(forcedChaosOccurrenceKeys(project, catalog)).toContain(
      semanticAddressKey(createOccurrenceAddress(goldenGBiome, goldenGStartId)),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: false,
    });
    const restoredG = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    expect(
      restoredG?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenGStartId)
        ?.additionalExits,
    ).toEqual([
      {
        kind: 'chaos',
        key: 'chaos',
        occurrenceId: createOccurrenceId('authored-chaos-map'),
      },
    ]);
    expect(
      restoredG?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('authored-chaos-map'),
      )?.gameName,
    ).toBe('Chaos_06');
    expect(forcedChaosOccurrenceKeys(project, catalog)).not.toContain(
      semanticAddressKey(createOccurrenceAddress(goldenGBiome, goldenGStartId)),
    );
  });

  it('replaces a manually removed gate with an Ixion-owned gate while the use remains pending', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const additional = createAdditionalExitAddress(goldenGBiome, goldenGStartId, 'chaos');
    const manualGateId = createOccurrenceId('manual-chaos-before-ixion-removal');
    let project = applyProjectCommand(createUnderworldFWellCheckpoint(false), catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: manualGateId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveChaos',
      additional,
    });

    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const host = topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === goldenGStartId,
    );
    const generated = host?.additionalExits.find((exit) => exit.kind === 'chaos');
    expect(generated).toEqual(
      expect.objectContaining({
        kind: 'chaos',
        key: 'chaos',
        origin: {
          kind: 'ixionGenerated',
          sourceBiomeKey: 'F',
          sourceOccurrenceId: well.occurrenceId,
          generationKey: 'travelDealRefill',
        },
      }),
    );
    expect(host?.additionalExits).not.toContainEqual(
      expect.objectContaining({ occurrenceId: manualGateId }),
    );
  });

  it('consumes two pending purchases across two capable rooms without doubling a gate', () => {
    let project = createGoldenFGHProject();
    const finalCombatWell = createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(7, 1));
    const gPostboss = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_PostBoss01');
    if (gPostboss === undefined) throw new Error('expected fixed G Postboss');
    const postbossWell = createOccurrenceAddress(goldenGBiome, gPostboss.occurrenceId);
    for (const command of [
      { kind: 'AddStygianWell' as const, occurrence: finalCombatWell },
      { kind: 'SetStygianWellInteraction' as const, occurrence: finalCombatWell, interacted: true },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence: finalCombatWell,
        slotKey: 'secondLeft' as const,
        itemKey: 'TemporaryForcedSecretDoorTrait',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence: finalCombatWell,
        generationKey: 'initial:secondLeft' as const,
        purchased: true,
      },
      { kind: 'SetStygianWellInteraction' as const, occurrence: postbossWell, interacted: true },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence: postbossWell,
        slotKey: 'secondLeft' as const,
        itemKey: 'TemporaryForcedSecretDoorTrait',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence: postbossWell,
        generationKey: 'initial:secondLeft' as const,
        purchased: true,
      },
    ])
      project = applyProjectCommand(project, catalog, command);
    const h = project.route.biomes.find((biome) => biome.biomeKey === 'H')?.topology;
    const intro = h?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenHStartId);
    const introDecision = h?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === goldenHStartId,
    );
    if (introDecision?.kind !== 'exit') throw new Error('expected H Intro exit decision');
    const selectedExitKey =
      introDecision.selection.kind === 'normal' ? introDecision.selection.exitKey : undefined;
    const nextId =
      selectedExitKey !== undefined
        ? introDecision.normal.targets.find((target) => target.exitKey === selectedExitKey)
            ?.occurrenceId
        : introDecision.normal.targets[0]?.occurrenceId;
    const nextRoom = h?.occurrences.find((occurrence) => occurrence.occurrenceId === nextId);
    expect(intro?.additionalExits.filter((exit) => exit.kind === 'chaos')).toHaveLength(1);
    expect(nextRoom?.additionalExits.filter((exit) => exit.kind === 'chaos')).toHaveLength(1);
  });

  it('reports a repeated Well item on the slot that repeats it', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    for (const slotKey of ['secondLeft', 'secondRight'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey,
        itemKey: 'TemporaryForcedSecretDoorTrait',
      });
    const duplicates = simulateProjectAssembly(catalog, project).evaluation.findings.filter(
      (finding) => finding.code === 'stygianWellDuplicate',
    );
    expect(duplicates).toEqual([
      expect.objectContaining({
        origin: createRoomFeatureAddress(well, {
          kind: 'stygianWellOffer',
          generationKey: 'initial:secondRight',
        }),
        evidence: { reason: 'duplicate', slotKey: 'secondRight' },
      }),
    ]);
  });

  it('reassigns generated gate ownership when earlier Ixion purchases are removed', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    const chaosOrigins = () =>
      project.route.biomes.flatMap((biome) =>
        (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
          occurrence.additionalExits.flatMap((exit) =>
            exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated'
              ? [exit.origin.generationKey]
              : [],
          ),
        ),
      ) ?? [];
    expect(chaosOrigins()).toEqual([
      'initial:secondLeft',
      'initial:secondRight',
      'travelDealRefill',
    ]);

    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: false,
    });

    expect(chaosOrigins()).toEqual(['initial:secondRight', 'travelDealRefill']);
  });

  it('removes a later generated gate when an earlier authored gate takes the pending use', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let baseline = createUnderworldFWellCheckpoint(false);
    baseline = applyProjectCommand(baseline, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    baseline = applyProjectCommand(baseline, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryForcedSecretDoorTrait',
    });
    const baselineG = baseline.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const generatedSources =
      baselineG?.occurrences.filter((occurrence) =>
        occurrence.additionalExits.some(
          (exit) => exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated',
        ),
      ) ?? [];
    expect(generatedSources.length).toBeGreaterThanOrEqual(2);
    const firstHost = generatedSources[0];
    const laterHost = generatedSources[1];
    if (firstHost === undefined || laterHost === undefined)
      throw new Error('expected two generated Chaos hosts');

    let project = applyProjectCommand(baseline, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: false,
    });

    const firstGate = firstHost.additionalExits.find(
      (exit) => exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated',
    );
    if (firstGate?.kind !== 'chaos') throw new Error('expected the first generated gate');
    const firstAdditional = createAdditionalExitAddress(
      goldenGBiome,
      firstHost.occurrenceId,
      'chaos',
    );
    const firstMap = createOccurrenceAddress(goldenGBiome, firstGate.occurrenceId);
    project = applyRouteDetourCommand(
      project,
      catalog,
      locateBiome(project, catalog, {
        kind: 'ReplaceChaosMap',
        occurrence: firstMap,
        gameName: 'Chaos_01',
      }),
      { kind: 'RemoveGeneratedChaos', additional: firstAdditional },
    );

    const laterAdditional = createAdditionalExitAddress(
      goldenGBiome,
      laterHost.occurrenceId,
      'chaos',
    );
    project = applyRouteDetourCommand(
      project,
      catalog,
      locateBiome(project, catalog, {
        kind: 'ReplaceChaosMap',
        occurrence: createOccurrenceAddress(
          goldenGBiome,
          createOccurrenceId('ixion-later-generated-gate'),
        ),
        gameName: 'Chaos_01',
      }),
      {
        kind: 'GenerateChaos',
        additional: laterAdditional,
        occurrenceId: createOccurrenceId('ixion-later-generated-gate'),
        sourceBiomeKey: 'F',
        sourceOccurrenceId: well.occurrenceId,
        generationKey: 'travelDealRefill',
      },
    );

    const authoredGateId = createOccurrenceId('earlier-authored-gate');
    project = applyRouteDetourCommand(
      project,
      catalog,
      locateBiome(project, catalog, {
        kind: 'ReplaceChaosMap',
        occurrence: createOccurrenceAddress(goldenGBiome, authoredGateId),
        gameName: 'Chaos_01',
      }),
      {
        kind: 'AddChaos',
        additional: firstAdditional,
        occurrenceId: authoredGateId,
      },
    );

    project = reconcileChaosTopology(project, catalog);
    const finalG = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const finalFirstHost = finalG?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === firstHost.occurrenceId,
    );
    const finalLaterHost = finalG?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === laterHost.occurrenceId,
    );
    expect(finalFirstHost?.additionalExits).toEqual([
      { kind: 'chaos', key: 'chaos', occurrenceId: authoredGateId },
    ]);
    expect(finalLaterHost?.additionalExits).toEqual([]);
    expect(
      finalG?.occurrences.some((occurrence) => occurrence.occurrenceId === authoredGateId),
    ).toBe(true);
  });

  it('skips incapable I Intro and places the pending gate at the first selected I combat', () => {
    let project = createGoldenFGHIProject();
    const hPostboss = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'H_PostBoss01');
    if (hPostboss === undefined) throw new Error('expected fixed H Postboss');
    const well = createOccurrenceAddress(goldenHBiome, hPostboss.occurrenceId);
    for (const command of [
      { kind: 'SetStygianWellInteraction' as const, occurrence: well, interacted: true },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence: well,
        slotKey: 'secondLeft' as const,
        itemKey: 'TemporaryForcedSecretDoorTrait',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence: well,
        generationKey: 'initial:secondLeft' as const,
        purchased: true,
      },
    ])
      project = applyProjectCommand(project, catalog, command);
    const i = project.route.biomes.find((biome) => biome.biomeKey === 'I')?.topology;
    const intro = i?.occurrences.find((occurrence) => occurrence.occurrenceId === goldenIStartId);
    const introDecision = i?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === goldenIStartId,
    );
    if (introDecision?.kind !== 'exit') throw new Error('expected I Intro exit decision');
    const firstId = introDecision.normal.targets[0]?.occurrenceId;
    const firstCombat = i?.occurrences.find((occurrence) => occurrence.occurrenceId === firstId);
    expect(intro?.additionalExits).toEqual([]);
    expect(firstCombat?.additionalExits).toEqual([
      expect.objectContaining({ kind: 'chaos', key: 'chaos' }),
    ]);
  });

  it('records paid Last Stand as the selected well result', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = loadUnderworldFStygianWellCheckpoint();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'healing',
      itemKey: 'LastStandShopItem',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (f?.authoring !== 'complete') throw new Error('expected complete F Last Stand evaluation');
    expect(
      f.rewards.branches.every(
        (branch) => branch.state.rewardHistory.consumableRecord.LastStandShopItem === 1,
      ),
    ).toBe(true);
  });

  it('uses Twist nested result without treating it as a direct Extended purchase', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = loadUnderworldFStygianWellCheckpoint();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'RandomStoreItem',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      itemKey: 'LastStandShopItem',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (f?.authoring !== 'complete') throw new Error('expected complete F Twist evaluation');
    expect(f.rewards.branches.every((branch) => branch.state.stygianWell?.extendedUses === 1)).toBe(
      true,
    );
    expect(
      f.rewards.branches.every(
        (branch) => branch.state.rewardHistory.consumableRecord.LastStandShopItem === 1,
      ),
    ).toBe(true);
  });

  it('keeps Extended Discount and Empty Slot on their two-Boss clock', () => {
    const extended = buy({ ...empty(), extendedUses: 1 }, 'TemporaryDiscountTrait');
    const legality = (state: StygianWellRunState) =>
      projectStygianWellLegality(catalog, state).discountUses;
    expect(legality(extended)).toEqual([-2]);
    expect(legality(advanceStygianWellClock(extended, 'encounters'))).toEqual([-2]);
    expect(legality(advanceStygianWellClock(extended, 'bosses'))).toEqual([-1]);
  });

  it('advances an Extended purchase on the existing Boss event chronology', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryImprovedCastTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'TemporaryDiscountTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: false,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: true,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const g = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('expected complete G Boss evaluation');
    expect(
      g.rewards.branches.every((branch) =>
        branch.state.stygianWell.timedInstances.some(
          (instance) =>
            instance.traitKey === 'TemporaryDiscountTrait' &&
            instance.clock === 'bosses' &&
            instance.remainingUses === 1,
        ),
      ),
    ).toBe(true);
  });

  it('consumes Extended only for its exact direct-purchase whitelist', () => {
    const withExtended = { ...empty(), extendedUses: 1 };
    for (const itemKey of extendedWellItemKeys(catalog))
      expect(buy(withExtended, itemKey).extendedUses, itemKey).toBe(0);
    for (const itemKey of catalog.rewards.shops.byKey
      .RoomShop!.groups.values.flatMap((group) => group.options.values.map((option) => option.key))
      .filter((itemKey) => !extendedWellItemKeys(catalog).includes(itemKey)))
      expect(buy(withExtended, itemKey).extendedUses, itemKey).toBe(
        itemKey === 'ExtendedShopTrait' ? 2 : 1,
      );
    expect(extendedWellItemKeys(catalog)).toContain('TemporaryEmptySlotDamageTrait');
    expect(extendedWellItemKeys(catalog)).not.toContain('TemporaryBoonRarityTrait');
  });

  it('assesses Travel Deal and Twist only at their reached purchase contacts', () => {
    const travelHistory = {
      ...createTraitHistoryState(),
      equippedTraits: { RestockBoon: {} as never },
    };
    const well = {
      interacted: true,
      offerKeyBySlot: {
        healing: 'ArmorBoostStore',
        secondLeft: 'RandomStoreItem',
        secondRight: 'LimitedSwapTraitDrop',
      },
      purchasedGenerationKeys: ['initial:secondLeft'],
      travelDealRefillKey: 'TemporaryImprovedCastTrait',
      twistResultKeyBySlot: { secondLeft: 'TemporaryDiscountTrait' },
    } as const;
    const assessment = assessStygianWellPurchase(
      catalog,
      'Underworld',
      well,
      'initial:secondLeft',
      empty(),
      travelHistory,
      'initial:secondLeft',
    );
    expect(assessment.issues).toEqual([]);
    expect(assessment.travelDealRefill).toMatchObject({
      sourceGenerationKey: 'initial:secondLeft',
    });
    expect(assessment.travelDealRefill?.candidateItemKeys).not.toContain('RandomStoreItem');
    expect(assessment.travelDealRefill?.candidateItemKeys).not.toContain('LimitedSwapTraitDrop');
    expect(assessment.twistCandidateItemKeys).toEqual(twistResultItemKeys(catalog));

    const activeDiscount = assessStygianWellPurchase(
      catalog,
      'Underworld',
      well,
      'initial:secondLeft',
      withDiscount(3),
      travelHistory,
      'initial:secondLeft',
    );
    expect(activeDiscount.twistCandidateItemKeys).not.toContain('TemporaryDiscountTrait');
    expect(activeDiscount.issues).toContainEqual(
      expect.objectContaining({ kind: 'twistInvalid', generationKey: 'initial:secondLeft' }),
    );
  });

  it('uses the authored purchase order for Discount before or after Twist', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const configured = (order: readonly ('initial:secondLeft' | 'initial:secondRight')[]) => {
      let project = createUnderworldFWellCheckpoint(false);
      for (const [slotKey, itemKey] of [
        ['secondLeft', 'TemporaryDiscountTrait'],
        ['secondRight', 'RandomStoreItem'],
      ] as const) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceStygianWellOffer',
          occurrence: well,
          slotKey,
          itemKey,
        });
      }
      for (const generationKey of [
        'initial:healing',
        'initial:secondLeft',
        'initial:secondRight',
      ] as const) {
        project = applyProjectCommand(project, catalog, {
          kind: 'SetStygianWellPurchase',
          occurrence: well,
          generationKey,
          purchased: false,
        });
      }
      for (const generationKey of order) {
        project = applyProjectCommand(project, catalog, {
          kind: 'SetStygianWellPurchase',
          occurrence: well,
          generationKey,
          purchased: true,
        });
      }
      return applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellTwistResult',
        occurrence: well,
        generationKey: 'initial:secondRight',
        itemKey: 'TemporaryDiscountTrait',
      });
    };
    const candidate = (project: ReturnType<typeof configured>) =>
      stygianWellCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        well,
      );

    expect(
      candidate(configured(['initial:secondLeft', 'initial:secondRight']))
        ?.twistCandidateItemKeysByGeneration['initial:secondRight'],
    ).not.toContain('TemporaryDiscountTrait');
    expect(
      candidate(configured(['initial:secondRight', 'initial:secondLeft']))
        ?.twistCandidateItemKeysByGeneration['initial:secondRight'],
    ).toContain('TemporaryDiscountTrait');
  });

  it('captures Travel refill and refill Twist domains before the source effect', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'RandomStoreItem',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      itemKey: 'TemporaryDiscountTrait',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const capability = stygianWellCandidateForProjectEvaluationAssembly(assembly, well);
    expect(capability?.travelDealRefill?.candidateItemKeys).toContain('TemporaryDiscountTrait');
    expect(capability?.twistCandidateItemKeysByGeneration['initial:secondLeft']).toContain(
      'TemporaryDiscountTrait',
    );

    let refillProject = createUnderworldFWellCheckpoint(false);
    for (const [slotKey, itemKey] of [
      ['healing', 'ArmorBoostStore'],
      ['secondLeft', 'TemporaryDiscountTrait'],
      ['secondRight', 'LimitedSwapTraitDrop'],
    ] as const) {
      refillProject = applyProjectCommand(refillProject, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey,
        itemKey,
      });
    }
    for (const generationKey of [
      'initial:healing',
      'initial:secondLeft',
      'initial:secondRight',
    ] as const) {
      refillProject = applyProjectCommand(refillProject, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey,
        purchased: false,
      });
    }
    refillProject = applyProjectCommand(refillProject, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    refillProject = applyProjectCommand(refillProject, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: well,
      itemKey: 'RandomStoreItem',
    });
    refillProject = applyProjectCommand(refillProject, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: true,
    });
    refillProject = applyProjectCommand(refillProject, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: well,
      generationKey: 'travelDealRefill',
      itemKey: 'HealDropRange',
    });
    const refillAssembly = simulateProjectAssembly(catalog, refillProject);
    expect(
      stygianWellCandidateForProjectEvaluationAssembly(refillAssembly, well)
        ?.twistCandidateItemKeysByGeneration.travelDealRefill,
    ).toContain('HealDropRange');
    expect(
      stygianWellCandidateForProjectEvaluationAssembly(refillAssembly, well)
        ?.twistCandidateItemKeysByGeneration.travelDealRefill,
    ).not.toContain('TemporaryDiscountTrait');
  });

  it('requires a same-group refill only when its actual trigger has Travel Deal', () => {
    const base = {
      interacted: true,
      offerKeyBySlot: {
        healing: 'LastStandShopItem',
        secondLeft: 'TemporaryImprovedCastTrait',
        secondRight: 'LimitedSwapTraitDrop',
      },
      purchasedGenerationKeys: ['initial:healing'],
    } as const;
    const missing = assessStygianWellPurchase(
      catalog,
      'Underworld',
      base,
      'initial:healing',
      empty(),
      { ...createTraitHistoryState(), equippedTraits: { RestockBoon: {} as never } },
      'initial:healing',
    );
    expect(missing.issues).toContainEqual(
      expect.objectContaining({ kind: 'refillMissing', generationKey: 'travelDealRefill' }),
    );
    expect(missing.travelDealRefill?.candidateItemKeys).toContain('ArmorBoostStore');
    const withoutTravel = assessStygianWellPurchase(
      catalog,
      'Underworld',
      base,
      'initial:healing',
      empty(),
      undefined,
      'initial:healing',
    );
    expect(withoutTravel.travelDealRefill).toBeUndefined();
    expect(withoutTravel.issues).not.toContainEqual(
      expect.objectContaining({ kind: 'refillMissing' }),
    );
  });

  it('keeps initial inventory repair separate from dormant purchase-owned children', () => {
    const assessment = assessStygianWell(
      catalog,
      'Underworld',
      catalog.rooms.byKey.F_Combat01,
      3,
      {
        interacted: true,
        offerKeyBySlot: {
          healing: 'ArmorBoostStore',
          secondLeft: null,
          secondRight: 'LimitedSwapTraitDrop',
        },
        purchasedGenerationKeys: ['initial:secondLeft', 'travelDealRefill'],
        travelDealRefillKey: null,
        twistResultKeyBySlot: { secondLeft: 'HealDropRange' },
      },
      empty(),
      undefined,
    );
    expect(assessment.candidateItemKeysBySlot.secondLeft).toContain('RandomStoreItem');
    expect(assessment.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'missing', generationKey: 'initial:secondLeft' }),
      ]),
    );
    expect(assessment.complete).toBe(false);
  });

  it('ignores dormant refill and Twist detail at initial inventory assessment', () => {
    const well = {
      interacted: true,
      offerKeyBySlot: {
        healing: 'ArmorBoostStore',
        secondLeft: 'TemporaryImprovedCastTrait',
        secondRight: 'LimitedSwapTraitDrop',
      },
      travelDealRefillKey: 'RandomStoreItem',
      twistResultKeyBySlot: { travelDealRefill: 'HealDropRange' },
    } as const;
    const dormant = assessStygianWell(
      catalog,
      'Underworld',
      catalog.rooms.byKey.F_Combat01,
      3,
      well,
      empty(),
    );
    expect(dormant.issues).toEqual([]);
    expect(dormant.complete).toBe(true);
  });
});

describe('Stygian Well timed holdings', () => {
  const instances = (state: StygianWellRunState) =>
    state.timedInstances.map(({ traitKey, clock, remainingUses }) => [
      traitKey,
      clock,
      remainingUses,
    ]);
  const advance = (state: StygianWellRunState, clock: 'encounters' | 'rooms' | 'bosses', n = 1) =>
    Array.from({ length: n }).reduce<StygianWellRunState>(
      (current) => advanceStygianWellClock(current, clock),
      state,
    );

  it('spends each instance only on its own clock and removes it when expired', () => {
    const state = buy(buy(empty(), 'TemporaryImprovedSecondaryTrait'), 'TemporaryDoorHealTrait');
    expect(instances(state)).toEqual([
      ['TemporaryImprovedSecondaryTrait', 'encounters', 5],
      ['TemporaryDoorHealTrait', 'rooms', 3],
    ]);
    expect(advance(state, 'bosses')).toBe(state);
    expect(instances(advance(state, 'encounters', 4))).toEqual([
      ['TemporaryImprovedSecondaryTrait', 'encounters', 1],
      ['TemporaryDoorHealTrait', 'rooms', 3],
    ]);
    expect(instances(advance(advance(state, 'encounters', 5), 'rooms', 3))).toEqual([]);
  });

  it('converts the next eligible direct purchase to the Seal boss extension', () => {
    const sealed = buy(empty(), 'ExtendedShopTrait');
    const charity = buy(sealed, 'TemporaryHealExpirationTrait');
    expect(charity.extendedUses).toBe(1);
    const hydra = buy(charity, 'TemporaryDoorHealTrait');
    expect(hydra.extendedUses).toBe(0);
    expect(instances(hydra)).toEqual([
      ['TemporaryHealExpirationTrait', 'encounters', 4],
      ['TemporaryDoorHealTrait', 'bosses', 2],
    ]);
    expect(instances(advance(hydra, 'rooms', 5))).toEqual(instances(hydra));
    expect(instances(advance(hydra, 'bosses', 2))).toEqual([
      ['TemporaryHealExpirationTrait', 'encounters', 4],
    ]);
  });

  it('keeps repurchases as separate instances and counts every direct purchase', () => {
    const once = buy(empty(), 'TemporaryImprovedSecondaryTrait');
    const twice = buy(advance(once, 'encounters', 2), 'TemporaryImprovedSecondaryTrait');
    expect(instances(twice)).toEqual([
      ['TemporaryImprovedSecondaryTrait', 'encounters', 3],
      ['TemporaryImprovedSecondaryTrait', 'encounters', 5],
    ]);
    expect(twice.directPurchases).toEqual({ TemporaryImprovedSecondaryTrait: 2 });
    const ledgerOnly = buy(buy(empty(), 'FirstHitHealTrait'), 'FirstHitHealTrait');
    expect(ledgerOnly).toEqual({ ...empty(), directPurchases: { FirstHitHealTrait: 2 } });
  });

  it('never extends or counts a Twist result', () => {
    const twisted = buy({ ...empty(), extendedUses: 1 }, 'RandomStoreItem');
    const result = buy(twisted, 'TemporaryImprovedCastTrait', false);
    expect(result.extendedUses).toBe(1);
    expect(instances(result)).toEqual([['TemporaryImprovedCastTrait', 'encounters', 5]]);
    expect(result.directPurchases).toEqual({ RandomStoreItem: 1 });
  });

  it('withholds a self-gated offer while an instance of its trait is active', () => {
    const well = {
      interacted: true,
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    } as const;
    const domain = (state: StygianWellRunState) =>
      assessStygianWell(catalog, 'Underworld', catalog.rooms.byKey.F_PostBoss01, 3, well, state)
        .candidateItemKeysBySlot.secondLeft;
    const held = buy(empty(), 'TemporaryEmptySlotDamageTrait');
    expect(domain(empty())).toEqual(
      expect.arrayContaining(['TemporaryDiscountTrait', 'TemporaryEmptySlotDamageTrait']),
    );
    expect(domain(held)).not.toContain('TemporaryEmptySlotDamageTrait');
    expect(domain(held)).toContain('TemporaryDiscountTrait');
    expect(domain(advance(held, 'encounters', 6))).toContain('TemporaryEmptySlotDamageTrait');
  });

  it('projects only the legality subset', () => {
    const neutral = buy(buy(empty(), 'TemporaryMoveSpeedTrait'), 'EmptyMaxHealthShopItem');
    expect(projectStygianWellLegality(catalog, neutral)).toEqual(
      projectStygianWellLegality(catalog, empty()),
    );
    expect(projectStygianWellLegality(catalog, advance(neutral, 'encounters', 3))).toEqual(
      projectStygianWellLegality(catalog, empty()),
    );
    const legal = buy(buy(empty(), 'TemporaryDiscountTrait'), 'TemporaryEmptySlotDamageTrait');
    expect(projectStygianWellLegality(catalog, advance(legal, 'encounters'))).toMatchObject({
      discountUses: [5],
      emptySlotUses: [5],
    });
  });
});
