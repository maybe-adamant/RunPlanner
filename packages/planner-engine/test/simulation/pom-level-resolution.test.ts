import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  foldTraitHistoryEvents,
  recordReachedLevelResolution,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { createLevelResolutionCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { applyProjectCommand } from '@run-planner/engine/authored-project';
import {
  createRepresentativeNOPQProject,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';

const owner = { kind: 'project' } as const;
const levelAddress = createLevelResolutionAddress(
  createIncomingRewardAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('pom-test'),
  ),
  'self',
);

function equippedHistory() {
  const event: TraitOfferEvent = {
    kind: 'traitOffer',
    owner,
    acquisitionRole: 'seed',
    sequence: 1,
    giverKey: 'Apollo',
    options: Object.freeze([
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]),
    selectedOptionKey: 'option1',
    acquisitionPoint: 'seed',
  };
  return foldTraitHistoryEvents(catalog, [event]);
}

function twoTargetHistory() {
  const first: TraitOfferEvent = {
    kind: 'traitOffer',
    owner,
    acquisitionRole: 'seed1',
    sequence: 1,
    giverKey: 'Apollo',
    options: Object.freeze([
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]),
    selectedOptionKey: 'option1',
    acquisitionPoint: 'seed',
  };
  const second: TraitOfferEvent = {
    ...first,
    acquisitionRole: 'seed2',
    sequence: 2,
    giverKey: 'Hestia',
    options: Object.freeze([
      { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
      { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
      { traitKey: 'HestiaCastBoon', rarity: 'Common' },
    ]),
    selectedOptionKey: 'option2',
  };
  return foldTraitHistoryEvents(catalog, [first, second]);
}

describe('Pom level resolutions', () => {
  it('requires exact visible cardinality, membership, and eligible equipped targets', () => {
    const before = equippedHistory();
    const invalid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon'],
        selectedTraitKey: null,
      },
      1,
      before,
      2,
      'Pom',
    );
    expect(invalid.event).toBeUndefined();
    const valid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
      3,
      before,
      2,
      'Pom',
    );
    expect(valid.history.equippedTraits.ApolloWeaponBoon?.level).toBe(4);

    const unavailableOffer = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'HermesWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
      1,
      before,
      2,
      'Pom',
    );
    expect(unavailableOffer.event).toBeUndefined();

    const wrongKind = recordReachedLevelResolution(
      catalog,
      levelAddress,
      { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
      1,
      before,
      2,
      'Pom',
      'choice',
    );
    expect(wrongKind.event).toBeUndefined();
  });

  it('records a random Pom as one exact target without a fabricated choice surface', () => {
    const before = equippedHistory();
    const valid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'random',
        targetTraitKey: 'ApolloWeaponBoon',
      },
      1,
      before,
      2,
      'RandomPom',
    );
    expect(valid.event?.targetTraitKey).toBe('ApolloWeaponBoon');
    expect(valid.history.equippedTraits.ApolloWeaponBoon?.level).toBe(2);
  });

  it('retains a target that became stale upstream without recording a level mutation', () => {
    const authored = Object.freeze({
      kind: 'choice' as const,
      offeredTraitKeys: Object.freeze(['ApolloWeaponBoon']),
      selectedTraitKey: 'ApolloWeaponBoon',
    });
    const validBefore = equippedHistory();
    expect(
      recordReachedLevelResolution(catalog, levelAddress, authored, 1, validBefore, 2, 'Pom').event,
    ).toEqual(expect.objectContaining({ targetTraitKey: 'ApolloWeaponBoon' }));

    const staleBefore = foldTraitHistoryEvents(catalog, [
      ...validBefore.events,
      {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'replacement',
        sequence: 2,
        giverKey: 'Zeus',
        options: Object.freeze([
          { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' as const },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' as const },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' as const },
        ]),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'replacement',
        replacementTransition: {
          slot: 'Melee',
          replacedTraitKey: 'ApolloWeaponBoon',
          oldRarity: 'Common' as const,
          newTraitKey: 'ZeusWeaponBoon',
          requiredRarity: 'Rare' as const,
        },
      },
    ]);
    const stale = recordReachedLevelResolution(
      catalog,
      levelAddress,
      authored,
      1,
      staleBefore,
      3,
      'Pom',
    );
    expect(stale.event).toBeUndefined();
    expect(stale.history).toBe(staleBefore);
    expect(authored.selectedTraitKey).toBe('ApolloWeaponBoon');
  });

  it('applies declaration-owned +2 and +3 visible Pom effects exactly', () => {
    const before = equippedHistory();
    const value = {
      kind: 'choice' as const,
      offeredTraitKeys: ['ApolloWeaponBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
    };
    const big = recordReachedLevelResolution(
      catalog,
      levelAddress,
      value,
      2,
      before,
      2,
      'PomBig',
      'choice',
    );
    expect(big.history.equippedTraits.ApolloWeaponBoon?.level).toBe(3);
    const triple = recordReachedLevelResolution(
      catalog,
      levelAddress,
      value,
      3,
      big.history,
      3,
      'PomTriple',
      'choice',
    );
    expect(triple.history.equippedTraits.ApolloWeaponBoon?.level).toBe(6);
  });

  it('keeps divergent Pom branch domains and choice counts correlated', () => {
    const artifacts = createLevelResolutionCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(levelAddress),
          [
            {
              address: levelAddress,
              before: equippedHistory(),
              levelCount: 1,
              effectKind: 'choice' as const,
            },
            {
              address: levelAddress,
              before: twoTargetHistory(),
              levelCount: 1,
              effectKind: 'choice' as const,
            },
          ],
        ],
      ]),
    );
    const capability = artifacts.at(levelAddress);
    expect(capability?.branches).toEqual([
      {
        effectKind: 'choice',
        levelCount: 1,
        requiredOfferCount: 1,
        eligibleTargetTraitKeys: ['ApolloWeaponBoon'],
      },
      {
        effectKind: 'choice',
        levelCount: 1,
        requiredOfferCount: 2,
        eligibleTargetTraitKeys: ['ApolloWeaponBoon', 'HestiaSpecialBoon'],
      },
    ]);
    const value = {
      kind: 'choice' as const,
      offeredTraitKeys: ['ApolloWeaponBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
    };
    expect(capability?.evaluate(value)).toEqual([
      { branchIndex: 0, supported: true, findings: [] },
      { branchIndex: 1, supported: false, findings: ['wrongOfferCount'] },
    ]);
  });

  it('retains the first blocking reached Pom assessment and exact capability', () => {
    const wheelOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat02,
      'wheel1',
      'offer1',
    );
    const address = createLevelResolutionAddress(wheelOwner, 'self');
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: wheelOwner,
      value: { rewardType: 'StackUpgrade' },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const o = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('rewards' in o)) throw new Error('missing evaluated O reward product');
    expect(o.rewards.selectedLevelResolutions).toContainEqual(
      expect.objectContaining({ address, branches: expect.any(Array) }),
    );
    expect(levelResolutionCandidateForProjectEvaluationAssembly(assembly, address)).toBeDefined();
  });
});
