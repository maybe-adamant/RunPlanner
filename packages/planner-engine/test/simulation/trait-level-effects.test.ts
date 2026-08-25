import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createTraitAcquisitionTargetAddress,
  createTraitOfferAddress,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  assessSelectedTargetedAcquisition,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordReachedTraitOffer,
  targetedAcquisitionTargetKeys,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures/underworld';

import { initializeTestRewardBranches } from '../support/arcana-fear';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement';

const owner = { kind: 'project' } as SemanticAddress;

function historyWith(
  giverKey: string,
  traitKey: string,
  rarity?: TraitOfferEvent['options'][number]['rarity'],
) {
  return historyFrom([{ giverKey, traitKey, rarity }]);
}

function historyFrom(
  entries: readonly {
    readonly giverKey: string;
    readonly traitKey: string;
    readonly rarity?: TraitOfferEvent['options'][number]['rarity'];
  }[],
) {
  return foldTraitHistoryEvents(
    catalog,
    entries.map(({ giverKey, traitKey, rarity }, index) => {
      const giver = catalog.traitGivers.byKey[giverKey];
      if (giver === undefined) throw new Error(`missing giver ${giverKey}`);
      const options = [
        { traitKey: giver.traitKeys[0]! },
        { traitKey: giver.traitKeys[1]! },
        { traitKey: giver.traitKeys[2]! },
      ] as [
        TraitOfferEvent['options'][number],
        TraitOfferEvent['options'][number],
        TraitOfferEvent['options'][number],
      ];
      options[0] = { traitKey, ...(rarity === undefined ? {} : { rarity }) };
      return {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: `test${index + 1}`,
        sequence: index + 1,
        giverKey,
        options: Object.freeze(options),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

describe('Latest Model Hammer Rank II target predicate', () => {
  const latestModelOffer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: 'Icarus',
    options: Object.freeze([
      { traitKey: 'UpgradeHammerBoon' },
      { traitKey: 'OmegaExplodeBoon' },
      { traitKey: 'CastHazardBoon' },
    ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    selectedOptionKey: 'option1',
  });

  it('uses only source-declared equipped Rank-I Hammers and folds exactly one to Rank II', () => {
    const before = historyFrom([
      { giverKey: 'WeaponUpgrade', traitKey: 'StaffDoubleAttackTrait' },
      { giverKey: 'WeaponUpgrade', traitKey: 'StaffDashAttackTrait' },
    ]);
    expect(before.equippedTraits.StaffDoubleAttackTrait?.hammerRank).toBe('RankI');
    expect(before.equippedTraits.StaffDashAttackTrait?.hammerRank).toBe('RankI');
    expect(targetedAcquisitionTargetKeys(catalog, 'UpgradeHammerBoon', before)).toEqual([
      'StaffDoubleAttackTrait',
    ]);

    const withTarget = Object.freeze({
      ...latestModelOffer,
      options: Object.freeze([
        { ...latestModelOffer.options[0], targetTraitKey: 'StaffDoubleAttackTrait' },
        latestModelOffer.options[1],
        latestModelOffer.options[2],
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    });
    const assessment = assessSelectedTargetedAcquisition(catalog, withTarget, before);
    expect(assessment).toMatchObject({
      applies: true,
      legal: true,
      transition: {
        kind: 'upgradeHammerToRank2',
        sourceTraitKey: 'UpgradeHammerBoon',
        targetTraitKey: 'StaffDoubleAttackTrait',
        oldHammerRank: 'RankI',
        newHammerRank: 'RankII',
      },
    });
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'icarus-latest-model',
      withTarget,
      before,
      Object.freeze({}),
      before.events.length,
    );
    const recorded = recordReachedTraitOffer(catalog, reached, before.events.length + 1, 'test');
    expect(recorded.history.equippedTraits.StaffDoubleAttackTrait?.hammerRank).toBe('RankII');
    expect(recorded.history.equippedTraits.StaffDashAttackTrait?.hammerRank).toBe('RankI');
    expect(recorded.history.equippedTraits.UpgradeHammerBoon).toMatchObject({
      giverKey: 'Icarus',
    });
    expect(recorded.history.equippedTraits.UpgradeHammerBoon?.rarity).toBeUndefined();
    expect(targetedAcquisitionTargetKeys(catalog, 'UpgradeHammerBoon', recorded.history)).toEqual(
      [],
    );
  });

  it('keeps Latest Model unavailable without an eligible Rank-I Hammer', () => {
    const history = historyWith('WeaponUpgrade', 'StaffDashAttackTrait');
    expect(assessTraitOption(catalog, 'UpgradeHammerBoon', history).findings).toContainEqual({
      code: 'targetedAcquisitionNoEligibleTarget',
      traitKey: 'UpgradeHammerBoon',
    });
  });
});

describe('targeted selected-trait child chronology', () => {
  const traitOwner = createTraitOfferAddress(
    createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    'source',
  );

  it.each([
    ['Bridal Glow', 'BoonDecayBoon', undefined, 'targetedAcquisitionTargetMissing'],
    [
      'Bridal Glow retained invalid',
      'BoonDecayBoon',
      'ApolloCastBoon',
      'targetedAcquisitionTargetUnavailable',
    ],
    ['Latest Model', 'UpgradeHammerBoon', undefined, 'targetedAcquisitionTargetMissing'],
    [
      'Latest Model retained invalid',
      'UpgradeHammerBoon',
      'StaffDashAttackTrait',
      'targetedAcquisitionTargetUnavailable',
    ],
  ] as const)(
    'retains %s as the outer acquisition while blocking its exact child',
    (_label, selectedTraitKey, targetTraitKey, findingCode) => {
      const before =
        selectedTraitKey === 'BoonDecayBoon'
          ? historyFrom([{ giverKey: 'Demeter', traitKey: 'DemeterWeaponBoon', rarity: 'Common' }])
          : historyFrom([{ giverKey: 'WeaponUpgrade', traitKey: 'StaffDoubleAttackTrait' }]);
      const offer: AuthoredTraitOffer = Object.freeze({
        kind: 'traits',
        giverKey: selectedTraitKey === 'BoonDecayBoon' ? 'Hera' : 'Icarus',
        options: Object.freeze(
          selectedTraitKey === 'BoonDecayBoon'
            ? [
                {
                  traitKey: selectedTraitKey,
                  rarity: 'Common',
                  ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
                },
                { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
                { traitKey: 'HeraCastBoon', rarity: 'Common' },
              ]
            : [
                {
                  traitKey: selectedTraitKey,
                  ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
                },
                { traitKey: 'OmegaExplodeBoon' },
                { traitKey: 'CastHazardBoon' },
              ],
        ) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
        selectedOptionKey: 'option1',
      });
      const initial = initializeTestRewardBranches()[0]!;
      const findings = new Map();
      const settlement = settleEncounterTraitOffer(
        catalog,
        Object.freeze({ ...initial, traitHistory: before }),
        traitOwner.owner,
        offer,
        before.events.length + 1,
        'encounterCompleted',
        findings,
        undefined,
        'source',
      );
      const expectedChild = createTraitAcquisitionTargetAddress(traitOwner, 'option1');
      expect(settlement.branch.traitHistory?.equippedTraits[selectedTraitKey]).toBeDefined();
      expect(settlement.blockedChild?.address).toEqual(expectedChild);
      expect(settlement.blockedChild?.branch).toBe(settlement.branch);
      expect([...findings.values()].map((entry) => entry.finding)).toContainEqual(
        expect.objectContaining({ code: findingCode, origin: expectedChild }),
      );
      expect(settlement.branch.traitHistory?.events.at(-1)).not.toHaveProperty(
        'targetedAcquisitionTransition',
      );
      if (selectedTraitKey === 'BoonDecayBoon') {
        expect(settlement.branch.traitHistory?.equippedTraits.DemeterWeaponBoon).toMatchObject({
          rarity: 'Common',
          level: 1,
        });
      } else {
        expect(settlement.branch.traitHistory?.equippedTraits.StaffDoubleAttackTrait).toMatchObject(
          {
            hammerRank: 'RankI',
          },
        );
      }
    },
  );
});
