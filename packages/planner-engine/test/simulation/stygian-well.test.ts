import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenGBiome,
  goldenGStartId,
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
      const biome = assembly.evaluation.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((candidateBiome) => candidateBiome.biomeKey === 'F');
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

  it('consumes one Spark at the first authored force-capable Chaos host', () => {
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
    project = applyProjectCommand(project, catalog, {
      kind: 'AddSparkChaos',
      additional: createAdditionalExitAddress(goldenGBiome, goldenGStartId, 'sparkChaos'),
      occurrenceId: createOccurrenceId('well-spark-chaos'),
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const g = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g?.findings).not.toContainEqual(
      expect.objectContaining({ code: 'sparkChaosUnavailable' }),
    );
    expect(g?.findings).not.toContainEqual(expect.objectContaining({ code: 'sparkChaosMissing' }));
    if (g?.authoring !== 'complete') throw new Error('expected complete G Spark evaluation');
    expect(g.rewards.branches.every((branch) => branch.stygianWell?.sparkUses === 0)).toBe(true);
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
    const f = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
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
    const f = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
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
    const g = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
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
