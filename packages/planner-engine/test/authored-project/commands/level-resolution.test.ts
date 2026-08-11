import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLevelResolutionAddress,
  createRewardWheelOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  createRepresentativeNOPQProject,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';
import { describe, expect, it } from 'vitest';

const wheelOwner = createRewardWheelOfferAddress(
  oBiome,
  oOccurrenceIds.combat02,
  'wheel1',
  'offer1',
);
const resolution = createLevelResolutionAddress(wheelOwner, 'self');

function pomProject() {
  return applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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
});
