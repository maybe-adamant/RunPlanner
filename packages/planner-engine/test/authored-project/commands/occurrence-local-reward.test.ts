import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures';

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
});
