import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
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

describe('authored-project incoming reward commands', () => {
  it('preserves base rarities and the exact ordered Calling Card ledger in one offer command', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const next = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
          { traitKey: 'ApolloCastBoon', rarity: 'Epic' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: ['option2', 'option1', 'option2'],
      },
    });
    const saved = next.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    )?.state;
    const offer =
      saved?.kind === 'counted' ? saved.reward?.traitOffersByAcquisitionRole?.source : undefined;
    if (offer?.kind !== 'traits') throw new Error('Calling Card offer is missing');

    expect(offer.options.map((option) => option.rarity)).toEqual(['Common', 'Rare', 'Epic']);
    expect(offer.rarificationActions).toEqual(['option2', 'option1', 'option2']);
  });

  it('preserves customized trait children when the parent offer is unchanged', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const value = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(reward, 'source'),
      selectedOptionKey: 'option2',
    });

    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    const existing =
      occurrence?.state.kind === 'counted'
        ? occurrence.state.reward?.traitOffersByAcquisitionRole?.source
        : undefined;
    if (existing === undefined) throw new Error('customized trait offer is missing');
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'source'),
        value: existing,
      }),
    ).toBe(project);

    expect(
      applyProjectCommand(project, catalog, { kind: 'ReplaceIncomingReward', reward, value }),
    ).toBe(project);
  });

  it('rejects selecting an unmaterialized sparse trait option', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const trait = createTraitOfferAddress(reward, 'source');
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    const existing =
      occurrence?.state.kind === 'counted'
        ? occurrence.state.reward?.traitOffersByAcquisitionRole?.source
        : undefined;
    if (existing?.kind !== 'traits') throw new Error('missing Apollo trait offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: Object.freeze({
        kind: 'traits',
        giverKey: existing.giverKey,
        options: Object.freeze([existing.options[0]!]) as readonly [
          (typeof existing.options)[number],
        ],
        selectedOptionKey: 'option1',
      }),
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitSelection',
        trait,
        selectedOptionKey: 'option3',
      }),
    ).toThrow('selected option is not materialized');
    const fallback = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: Object.freeze({ kind: 'fallbackGold', giverKey: existing.giverKey }),
    });
    expect(() =>
      applyProjectCommand(fallback, catalog, {
        kind: 'ReplaceTraitSelection',
        trait,
        selectedOptionKey: 'option1',
      }),
    ).toThrow('selected option is not materialized');
  });

  it('rejects a persisted Death Defiance field on an unsupported trait owner', () => {
    const document = JSON.parse(encodeProjectDocument(createGoldenFGHProject())) as {
      routes: Array<{
        biomes: Array<{ topology?: { occurrences: Array<Record<string, unknown>> } }>;
      }>;
    };
    const occurrence = document.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(6, 2));
    if (occurrence === undefined) throw new Error('missing encoded trait owner');
    const state = occurrence.state as {
      reward?: { traitOffersByAcquisitionRole?: Record<string, Record<string, unknown>> };
    };
    const offer = state.reward?.traitOffersByAcquisitionRole?.source;
    if (offer === undefined) throw new Error('missing encoded trait offer');
    offer.deathDefianceConditionMet = true;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(/deathDefianceConditionMet/);
  });

  it('accepts a declaration-owned target and rejects targets on ordinary traits', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
      },
    });
    const trait = createTraitOfferAddress(reward, 'source');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        options: [
          {
            traitKey: 'BoonDecayBoon',
            rarity: 'Common',
            targetTraitKey: 'ApolloWeaponBoon',
          },
          { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    expect(occurrence?.state).toMatchObject({
      reward: {
        traitOffersByAcquisitionRole: {
          source: {
            options: expect.arrayContaining([
              expect.objectContaining({
                traitKey: 'BoonDecayBoon',
                targetTraitKey: 'ApolloWeaponBoon',
              }),
            ]),
          },
        },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: {
          kind: 'traits',
          giverKey: 'Hera',
          options: [
            {
              traitKey: 'HeraWeaponBoon',
              rarity: 'Common',
              targetTraitKey: 'ApolloWeaponBoon',
            },
            { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
            { traitKey: 'HeraCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
        },
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitOffer' }));
  });

  it('replaces counted and free-reward offers and preserves unchanged document identity', () => {
    const ephyraId = createOccurrenceId('round-trip-n-combat02');
    const reward = createIncomingRewardAddress(nBiome, ephyraId);
    const initial = createCompleteNProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MaxManaDropBig' },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === ephyraId)?.state,
    ).toMatchObject({ kind: 'ephyraCombat', reward: { offer: { rewardType: 'MaxManaDropBig' } } });
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'MaxManaDropBig' },
      }),
    ).toBe(changed);

    const countedId = goldenFOccurrenceId(1, 1);
    const counted = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, countedId),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    expect(
      counted.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === countedId,
      )?.state,
    ).toMatchObject({ kind: 'counted', reward: { offer: { rewardType: 'MetaCurrencyDrop' } } });

    const freeId = createOccurrenceId('golden-h-preboss-free');
    const free = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, freeId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      free.routes[0]?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freeId,
      )?.state,
    ).toMatchObject({ kind: 'freeReward', reward: { offer: { rewardType: 'MaxHealthDrop' } } });
  });

  it('replaces only the payload of a declaration-fixed reward', () => {
    const reward = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const initial = createRepresentativeNOProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ApolloUpgrade',
        },
      },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === oOccurrenceIds.devotion,
        )?.state,
    ).toMatchObject({
      kind: 'fixed',
      reward: {
        offer: {
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'ApolloUpgrade',
          },
        },
      },
    });
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'O_Devotion01 has a fixed reward type',
      }),
    );
  });

  it('rejects occurrences without replaceable incoming reward state', () => {
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-preboss')),
        value: { rewardType: 'Boon' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'N_PreBoss01 has no replaceable incoming reward',
      }),
    );
  });
});
