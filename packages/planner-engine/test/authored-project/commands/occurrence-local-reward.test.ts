import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHProject,
  createRepresentativeNOProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';

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
      changed.routes[0]?.biomes[2]?.topology?.occurrences.find(
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

  it('replaces an exact Ephyra side-room reward without changing its local state', () => {
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const reward = createLocalRewardAddress(nBiome, combatId, 'sideRooms', 'sideDoor1');
    const initial = createCompleteNProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'RoomMoneyTinyDrop' },
    });
    const state = changed.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId)?.state;

    expect(state).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: {
        sideDoor1: {
          generation: 'notGenerated',
          enteredOrdinal: null,
          reward: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        },
      },
    });
  });

  it('rejects undeclared Fields and Ephyra local reward owners', () => {
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

    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          nBiome,
          createOccurrenceId('round-trip-n-combat02'),
          'sideRooms',
          'sideDoor3',
        ),
        value: { rewardType: 'MaxHealthDropSmall' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceLocalReward',
        detail: 'unknown side-room slot sideDoor3',
      }),
    );
  });

  it('updates a trait offer on the exact Ephyra side-room reward and rejects an unknown slot', () => {
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const reward = createLocalRewardAddress(nBiome, combatId, 'sideRooms', 'sideDoor1');
    const initial = createCompleteNProject();
    const projectWithSideTraitOffer = {
      ...initial,
      routes: initial.routes.map((route) =>
        route.routeKey !== 'Surface'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((biome) =>
                biome.biomeKey !== 'N' || biome.topology === null
                  ? biome
                  : {
                      ...biome,
                      topology: {
                        ...biome.topology,
                        occurrences: biome.topology.occurrences.map((occurrence) =>
                          occurrence.occurrenceId !== combatId ||
                          occurrence.state.kind !== 'ephyraCombat'
                            ? occurrence
                            : {
                                ...occurrence,
                                state: {
                                  ...occurrence.state,
                                  sideRooms: {
                                    ...occurrence.state.sideRooms,
                                    sideDoor1: {
                                      ...occurrence.state.sideRooms.sideDoor1!,
                                      reward: {
                                        offer: {
                                          rewardType: 'Boon',
                                          payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
                                        },
                                        traitOffersByAcquisitionRole: {
                                          source: {
                                            giverKey: 'Demeter',
                                            options: [
                                              { traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
                                              { traitKey: 'DemeterSpecialBoon', rarity: 'Common' },
                                              { traitKey: 'DemeterCastBoon', rarity: 'Common' },
                                            ],
                                            selectedOptionKey: 'option1',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                        ),
                      },
                    },
              ),
            },
      ),
    } as unknown as ProjectDocument;
    let project = projectWithSideTraitOffer;
    const parentStateBefore = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId)?.state;
    const parentRewardBefore =
      parentStateBefore?.kind === 'ephyraCombat' ? parentStateBefore.reward : undefined;
    const trait = createTraitOfferAddress(reward, 'source');
    project = applyTraitOfferCommand(
      project,
      catalog,
      {
        routeIndex: 1,
        biomeIndex: 0,
        loadout: project.routes[1]!.loadout,
        plan: project.routes[1]!.biomes[0]!,
        layout: catalog.biomeLayouts.byKey.N!,
      },
      {
        kind: 'ReplaceTraitSelection',
        trait,
        selectedOptionKey: 'option2',
      },
    );
    const state = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId)?.state;
    expect(state).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: {
        sideDoor1: {
          reward: { traitOffersByAcquisitionRole: { source: { selectedOptionKey: 'option2' } } },
        },
      },
    });
    expect(state?.kind === 'ephyraCombat' ? state.reward : undefined).toEqual(parentRewardBefore);
    expect(() =>
      applyTraitOfferCommand(
        project,
        catalog,
        {
          routeIndex: 1,
          biomeIndex: 0,
          loadout: project.routes[1]!.loadout,
          plan: project.routes[1]!.biomes[0]!,
          layout: catalog.biomeLayouts.byKey.N!,
        },
        {
          kind: 'ReplaceTraitSelection',
          trait: createTraitOfferAddress(
            createLocalRewardAddress(nBiome, combatId, 'sideRooms', 'sideDoor3'),
            'source',
          ),
          selectedOptionKey: 'option1',
        },
      ),
    ).toThrowError(expect.objectContaining({ detail: 'unknown side-room slot sideDoor3' }));
  });

  it('rejects trait owners from the wrong reward family without mutating a parent', () => {
    const initial = createCompleteNProject();
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const located = {
      routeIndex: 1,
      biomeIndex: 0,
      loadout: initial.routes[1]!.loadout,
      plan: initial.routes[1]!.biomes[0]!,
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
      routeIndex: 0,
      biomeIndex: 0,
      loadout: initial.routes[0]!.loadout,
      plan: initial.routes[0]!.biomes[0]!,
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
      routeIndex: 0,
      biomeIndex: 2,
      loadout: fieldsProject.routes[0]!.loadout,
      plan: fieldsProject.routes[0]!.biomes[2]!,
      layout: catalog.biomeLayouts.byKey.H!,
    };
    const fieldsBefore = fieldsProject.routes[0]!.biomes[2]!.topology!.occurrences.find(
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
        fieldsProject.routes[0]!.biomes[2]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === fieldsOccurrenceId,
        ),
      ).toEqual(fieldsBefore);
    }

    const surfaceProject = createRepresentativeNOProject();
    const surfaceDocumentBefore = JSON.stringify(surfaceProject);
    const shipOccurrenceId = oOccurrenceIds.combat04;
    const surfaceLocated = {
      routeIndex: 1,
      biomeIndex: 1,
      loadout: surfaceProject.routes[1]!.loadout,
      plan: surfaceProject.routes[1]!.biomes[1]!,
      layout: catalog.biomeLayouts.byKey.O!,
    };
    const shipBefore = surfaceProject.routes[1]!.biomes[1]!.topology!.occurrences.find(
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
      surfaceProject.routes[1]!.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shipOccurrenceId,
      ),
    ).toEqual(shipBefore);

    const shopOccurrenceId = oOccurrenceIds.preboss;
    const shopBefore = surfaceProject.routes[1]!.biomes[1]!.topology!.occurrences.find(
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
      surfaceProject.routes[1]!.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shopOccurrenceId,
      ),
    ).toEqual(shopBefore);
  });
});
