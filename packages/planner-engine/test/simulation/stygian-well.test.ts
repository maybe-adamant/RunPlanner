import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
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
import { simulateProjectAssembly } from '../../src/simulation/project';
import { stygianWellCandidateForProjectEvaluationAssembly } from '../../src/simulation/project-evaluation-assembly';
import {
  applyStygianWellPurchase,
  advanceStygianWellBossUses,
  advanceStygianWellEncounterUses,
  assessStygianWell,
  extendedWellItemKeys,
  twistResultItemKeys,
} from '../../src/simulation/stygian-well';

const empty = () => ({
  sparkUses: 0,
  yarnUses: 0,
  hymnUses: 0,
  discountUses: [],
  emptySlotUses: [],
  extendedUses: 0,
});

describe('Stygian Well consequential purchase state', () => {
  it('keeps the forced F Postboss refill and consequences identical at a configured route tail', () => {
    const owner = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const outcomes = [true, false].map((configuredTail) => {
      const assembly = simulateProjectAssembly(
        catalog,
        createUnderworldFWellCheckpoint(configuredTail),
      );
      const candidate = stygianWellCandidateForProjectEvaluationAssembly(assembly, owner);
      expect(candidate?.assessments).not.toHaveLength(0);
      expect(candidate?.assessments.every((assessment) => assessment.inventory?.complete)).toBe(
        true,
      );
      const biome = assembly.evaluation.route.biomes.find(
        (candidateBiome) => candidateBiome.biomeKey === 'F',
      );
      if (biome?.authoring !== 'complete') throw new Error('expected complete F Well evaluation');
      expect(biome.rewards.findings).not.toContainEqual(
        expect.objectContaining({ code: 'stygianWellTravelDealRefillUnavailable' }),
      );
      return biome.rewards.branches.map((branch) => branch.stygianWell);
    });
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[0]?.every((state) => state?.yarnUses === 1)).toBe(true);
    expect(outcomes[0]?.every((state) => state?.hymnUses === 1)).toBe(true);
    expect(outcomes[0]?.every((state) => state?.extendedUses === 1)).toBe(true);
  });

  it('applies paid effects without creating a pickup state', () => {
    expect(
      applyStygianWellPurchase(catalog, empty(), 'TemporaryForcedSecretDoorTrait').sparkUses,
    ).toBe(1);
    expect(applyStygianWellPurchase(catalog, empty(), 'TemporaryBoonRarityTrait').yarnUses).toBe(1);
    expect(applyStygianWellPurchase(catalog, empty(), 'LimitedSwapTraitDrop').hymnUses).toBe(1);
    expect(applyStygianWellPurchase(catalog, empty(), 'LastStandShopItem')).toEqual(empty());
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
    expect(g.rewards.branches.every((branch) => branch.stygianWell?.sparkUses === 0)).toBe(true);
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

  it('records paid Last Stand and publishes its one-step runtime fallback', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint();
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
    expect(f.rewards.runtimeOfferFallbacks).toContainEqual(
      expect.objectContaining({
        preferredKey: 'LastStandShopItem',
        fallbackKey: 'ArmorBoostStore',
      }),
    );
    expect(
      f.rewards.branches.every((branch) => branch.history.consumableRecord.LastStandDrop === 1),
    ).toBe(true);
  });

  it('uses Twist nested fallback without treating its result as a direct Extended purchase', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint();
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
    expect(f.rewards.runtimeOfferFallbacks).toContainEqual(
      expect.objectContaining({
        preferredKey: 'LastStandShopItem',
        fallbackKey: 'EmptyMaxHealthShopItem',
      }),
    );
    expect(f.rewards.branches.every((branch) => branch.stygianWell?.extendedUses === 1)).toBe(true);
    expect(
      f.rewards.branches.every((branch) => branch.history.consumableRecord.LastStandDrop === 1),
    ).toBe(true);
  });

  it('keeps Extended Discount and Empty Slot on their two-Boss clock', () => {
    const extended = applyStygianWellPurchase(
      catalog,
      { ...empty(), extendedUses: 1 },
      'TemporaryDiscountTrait',
    );
    expect(extended.discountUses).toEqual([-2]);
    expect(advanceStygianWellEncounterUses(extended).discountUses).toEqual([-2]);
    expect(advanceStygianWellBossUses(extended).discountUses).toEqual([-1]);
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
    expect(g.rewards.branches.every((branch) => branch.stygianWell?.discountUses[0] === -1)).toBe(
      true,
    );
  });

  it('consumes Extended only for its exact direct-purchase whitelist', () => {
    const withExtended = { ...empty(), extendedUses: 1 };
    for (const itemKey of extendedWellItemKeys(catalog))
      expect(applyStygianWellPurchase(catalog, withExtended, itemKey).extendedUses, itemKey).toBe(
        0,
      );
    for (const itemKey of catalog.rewards.shops.byKey
      .RoomShop!.groups.values.flatMap((group) => group.options.values.map((option) => option.key))
      .filter((itemKey) => !extendedWellItemKeys(catalog).includes(itemKey)))
      expect(applyStygianWellPurchase(catalog, withExtended, itemKey).extendedUses, itemKey).toBe(
        itemKey === 'ExtendedShopTrait' ? 2 : 1,
      );
    expect(extendedWellItemKeys(catalog)).toContain('TemporaryEmptySlotDamageTrait');
    expect(extendedWellItemKeys(catalog)).not.toContain('TemporaryBoonRarityTrait');
  });

  it('publishes exact Travel Deal and active Twist domains while retaining stale authored children', () => {
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
    const assessment = assessStygianWell(
      catalog,
      catalog.rooms.byKey.F_Combat01,
      well,
      empty(),
      undefined,
      [],
      'initial:secondLeft',
      true,
    );
    expect(assessment.complete).toBe(true);
    expect(assessment.travelDealRefill).toMatchObject({
      sourceGenerationKey: 'initial:secondLeft',
    });
    expect(assessment.travelDealRefill?.candidateItemKeys).not.toContain('RandomStoreItem');
    expect(assessment.travelDealRefill?.candidateItemKeys).not.toContain('LimitedSwapTraitDrop');
    expect(assessment.twistCandidateItemKeysByGeneration['initial:secondLeft']).toEqual(
      twistResultItemKeys(catalog),
    );

    const activeDiscount = assessStygianWell(
      catalog,
      catalog.rooms.byKey.F_Combat01,
      well,
      { ...empty(), discountUses: [3] },
      undefined,
      [],
      'initial:secondLeft',
      true,
    );
    expect(activeDiscount.twistCandidateItemKeysByGeneration['initial:secondLeft']).not.toContain(
      'TemporaryDiscountTrait',
    );
    expect(activeDiscount.issues).toContain('twistInvalid');
  });

  it('requires a same-group refill only after the actual first ranked purchase activates Travel Deal', () => {
    const base = {
      interacted: true,
      offerKeyBySlot: {
        healing: 'LastStandShopItem',
        secondLeft: 'TemporaryImprovedCastTrait',
        secondRight: 'LimitedSwapTraitDrop',
      },
      purchasedGenerationKeys: ['initial:healing'],
    } as const;
    const missing = assessStygianWell(
      catalog,
      catalog.rooms.byKey.F_Combat01,
      base,
      empty(),
      undefined,
      [],
      'initial:healing',
      true,
    );
    expect(missing.issues).toContain('refillMissing');
    expect(missing.travelDealRefill?.candidateItemKeys).toContain('ArmorBoostStore');
    const withoutTravel = assessStygianWell(
      catalog,
      catalog.rooms.byKey.F_Combat01,
      base,
      empty(),
      undefined,
      [],
      'initial:healing',
      false,
    );
    expect(withoutTravel.travelDealRefill).toBeUndefined();
    expect(withoutTravel.issues).not.toContain('refillMissing');
  });

  it('retains stale purchased initial and refill generations as repairable assessment findings', () => {
    const assessment = assessStygianWell(
      catalog,
      catalog.rooms.byKey.F_Combat01,
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
      [],
      'initial:secondLeft',
      true,
    );
    expect(assessment.candidateItemKeysBySlot.secondLeft).toContain('RandomStoreItem');
    expect(assessment.issues).toEqual(
      expect.arrayContaining(['missing', 'refillMissing', 'twistOrphan']),
    );
    expect(assessment.complete).toBe(false);
  });
});
