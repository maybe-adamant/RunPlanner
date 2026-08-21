import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNOPQProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { describe, expect, it } from 'vitest';

const wheelOwner = createRewardWheelOfferAddress(
  oBiome,
  oOccurrenceIds.combat02,
  'wheel1',
  'offer1',
);
const resolution = createLevelResolutionAddress(wheelOwner, 'self');

function pomProject() {
  return applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: wheelOwner,
    value: { rewardType: 'StackUpgrade' },
  });
}

describe('level-resolution commands', () => {
  it('rejects a visible Pom random shape, duplicate offers, and selected keys outside its offer', () => {
    const project = pomProject();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLevelResolution',
        levelResolution: resolution,
        value: { kind: 'random', targetTraitKey: null },
      }),
    ).toThrow('Pom acquisition requires a visible choice');

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLevelResolution',
        levelResolution: resolution,
        value: {
          kind: 'choice',
          offeredTraitKeys: ['ApolloWeaponBoon', 'ApolloWeaponBoon'],
          selectedTraitKey: 'ApolloWeaponBoon',
        },
      }),
    ).toThrow('Pom offered trait keys must be distinct');

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLevelResolution',
        levelResolution: resolution,
        value: {
          kind: 'choice',
          offeredTraitKeys: ['ApolloWeaponBoon'],
          selectedTraitKey: 'ApolloSpecialBoon',
        },
      }),
    ).toThrow('Pom selected trait must be one of the offered traits');
  });

  it('updates a Pom resolution at its exact Artificer replacement site', () => {
    const project = pomProject();
    const acquisition = createAcquisitionRoleAddress(wheelOwner, 'self');
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat02);
    const site = artificerAcquisitionSite(occurrence, wheelOwner);
    const entryKey = artificerReplacementEntryKey(wheelOwner, 'self');
    const entry = createAcquisitionEntryAddress(site, entryKey);
    const withDisposition = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    const withPom = applyProjectCommand(withDisposition, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType: 'StackUpgrade' },
    });
    const value = {
      kind: 'choice' as const,
      offeredTraitKeys: ['ApolloWeaponBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
    };

    const updated = applyProjectCommand(withPom, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(entry, 'self'),
      value,
    });
    const authoredOccurrence = updated.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat02,
      );
    expect(
      authoredOccurrence?.acquisitionSites?.[acquisitionSiteStorageKey(site)]?.pickupEntries?.[
        entryKey
      ]?.levelResolutionsByAcquisitionRole?.self,
    ).toEqual(value);
  });
});
