import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';
import { applyTraitOfferCommand } from '../../../src/authored-project/commands/trait-offer';

describe('authored-project local reward commands', () => {
  it('replaces a declaration-owned Fields cage and preserves unchanged identity', () => {
    const combatId = createOccurrenceId('golden-h-combat02');
    const reward = createLocalRewardAddress(goldenHBiome, combatId, 'cages', 'cage1');
    const initial = createGoldenFGHProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'MaxManaDrop' },
    });

    expect(
      changed.route?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === combatId,
      )?.state,
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage1: { offer: { rewardType: 'MaxManaDrop' } } },
    });
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceLocalReward',
        reward,
        value: { rewardType: 'MaxManaDrop' },
      }),
    ).toBe(changed);
  });

  it('rejects an undeclared Fields local reward owner', () => {
    expect(() =>
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          goldenHBiome,
          createOccurrenceId('golden-h-combat02'),
          'cages',
          'cage4',
        ),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceLocalReward' }));
  });

  it('rejects trait owners from the wrong reward family without mutating a parent', () => {
    const initial = createCompleteNProject();
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const located = {
      routeKey: 'Surface',
      biomeIndex: 0,
      loadout: initial.route.loadout,
      plan: initial.route.biomes[0]!,
      layout: catalog.biomeLayouts.byKey.N!,
    };
    const owner = createTraitOfferAddress(
      createLocalRewardAddress(nBiome, combatId, 'ordinaryParent', 'cage1'),
      'source',
    );
    expect(() =>
      applyTraitOfferCommand(initial, catalog, located, {
        kind: 'ReplaceTraitSelection',
        trait: owner,
        selectedOptionKey: 'option2',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitSelection' }));

    expect(() =>
      applyTraitOfferCommand(initial, catalog, located, {
        kind: 'ReplaceTraitSelection',
        trait: createTraitOfferAddress(
          createLocalRewardAddress(nBiome, combatId, 'wrongFieldsGroup', 'cage1'),
          'source',
        ),
        selectedOptionKey: 'option2',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitSelection' }));

    expect(() =>
      applyTraitOfferCommand(initial, catalog, located, {
        kind: 'ReplaceTraitSelection',
        trait: createTraitOfferAddress(
          createRewardWheelOfferAddress(nBiome, combatId, 'wheel1', 'offer1'),
          'source',
        ),
        selectedOptionKey: 'option2',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitSelection' }));

    expect(() =>
      applyTraitOfferCommand(initial, catalog, located, {
        kind: 'ReplaceTraitSelection',
        trait: createTraitOfferAddress(createShopOfferAddress(nBiome, combatId, 'Boon'), 'source'),
        selectedOptionKey: 'option2',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitSelection' }));
  });

  it('rejects a local reward aimed at an ordinary parent and wrong Fields group', () => {
    const initial = createGoldenFGHProject();
    const located = {
      routeKey: 'Underworld',
      biomeIndex: 0,
      loadout: initial.route!.loadout,
      plan: initial.route!.biomes[0]!,
      layout: catalog.biomeLayouts.byKey.F!,
    };
    const command = (groupKey: string) => ({
      kind: 'ReplaceTraitSelection' as const,
      trait: createTraitOfferAddress(
        createLocalRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1), groupKey, 'cage1'),
        'source',
      ),
      selectedOptionKey: 'option2' as const,
    });
    expect(() => applyTraitOfferCommand(initial, catalog, located, command('cages'))).toThrow();
    expect(() => applyTraitOfferCommand(initial, catalog, located, command('wrong'))).toThrow();
  });

  it('rejects malformed owners on real Fields, Ship, and Shop family branches without mutation', () => {
    const command = (trait: ReturnType<typeof createTraitOfferAddress>) => ({
      kind: 'ReplaceTraitSelection' as const,
      trait,
      selectedOptionKey: 'option2' as const,
    });

    const fieldsProject = createGoldenFGHProject();
    const fieldsDocumentBefore = JSON.stringify(fieldsProject);
    const fieldsOccurrenceId = createOccurrenceId('golden-h-combat02');
    const fieldsLocated = {
      routeKey: 'Underworld',
      biomeIndex: 2,
      loadout: fieldsProject.route!.loadout,
      plan: fieldsProject.route!.biomes[2]!,
      layout: catalog.biomeLayouts.byKey.H!,
    };
    const fieldsBefore = fieldsProject.route!.biomes[2]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fieldsOccurrenceId,
    )!;
    if (fieldsBefore.state.kind !== 'fieldsCombat') throw new Error('missing real Fields branch');
    for (const owner of [
      createLocalRewardAddress(goldenHBiome, fieldsOccurrenceId, 'wrongGroup', 'cage1'),
      createLocalRewardAddress(goldenHBiome, fieldsOccurrenceId, 'cages', 'wrongSlot'),
    ]) {
      expect(() =>
        applyTraitOfferCommand(
          fieldsProject,
          catalog,
          fieldsLocated,
          command(createTraitOfferAddress(owner, 'source')),
        ),
      ).toThrow();
      expect(JSON.stringify(fieldsProject)).toBe(fieldsDocumentBefore);
      expect(
        fieldsProject.route!.biomes[2]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === fieldsOccurrenceId,
        ),
      ).toEqual(fieldsBefore);
    }

    const surfaceProject = loadSurfaceNOProject();
    const surfaceDocumentBefore = JSON.stringify(surfaceProject);
    const shipOccurrenceId = oOccurrenceIds.combat04;
    const surfaceLocated = {
      routeKey: 'Surface',
      biomeIndex: 1,
      loadout: surfaceProject.route.loadout,
      plan: surfaceProject.route.biomes[1]!,
      layout: catalog.biomeLayouts.byKey.O!,
    };
    const shipBefore = surfaceProject.route.biomes[1]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === shipOccurrenceId,
    )!;
    if (shipBefore.state.kind !== 'shipCombat') throw new Error('missing real Ship branch');
    for (const owner of [
      createRewardWheelOfferAddress(oBiome, shipOccurrenceId, 'wrongWheel', 'offer1'),
      createRewardWheelOfferAddress(oBiome, shipOccurrenceId, 'wheel1', 'wrongOffer'),
    ]) {
      expect(() =>
        applyTraitOfferCommand(
          surfaceProject,
          catalog,
          surfaceLocated,
          command(createTraitOfferAddress(owner, 'source')),
        ),
      ).toThrow();
      expect(JSON.stringify(surfaceProject)).toBe(surfaceDocumentBefore);
    }
    expect(
      surfaceProject.route.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shipOccurrenceId,
      ),
    ).toEqual(shipBefore);

    const shopOccurrenceId = oOccurrenceIds.preboss;
    const shopBefore = surfaceProject.route.biomes[1]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === shopOccurrenceId,
    )!;
    if (shopBefore.state.kind !== 'shop' || shopBefore.state.shop === undefined) {
      throw new Error('missing materialized Shop branch');
    }
    expect(() =>
      applyTraitOfferCommand(
        surfaceProject,
        catalog,
        surfaceLocated,
        command(
          createTraitOfferAddress(
            createShopOfferAddress(oBiome, shopOccurrenceId, 'wrongOffer'),
            'source',
          ),
        ),
      ),
    ).toThrow();
    expect(JSON.stringify(surfaceProject)).toBe(surfaceDocumentBefore);
    expect(
      surfaceProject.route.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shopOccurrenceId,
      ),
    ).toEqual(shopBefore);
  });
});
