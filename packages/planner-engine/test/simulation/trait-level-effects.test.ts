import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createTraitAcquisitionTargetAddress,
  createTraitOfferAddress,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  attachTraitHistory,
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
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';

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

describe('Icarus occupied-slot level upgrades', () => {
  function atLevel(
    giverKey: string,
    traitKey: string,
    rarity: TraitOfferEvent['options'][number]['rarity'],
    level: number,
  ) {
    const initial = historyWith(giverKey, traitKey, rarity);
    if (level === 1) return initial;
    return foldTraitHistoryEvents(catalog, [
      ...initial.events,
      {
        kind: 'levelMutation',
        owner,
        acquisitionRole: 'testLevel',
        sequence: initial.events.length + 1,
        acquisitionPoint: 'test',
        targetTraitKey: traitKey,
        oldLevel: 1,
        newLevel: level,
      },
    ]);
  }

  it.each([
    ['FocusAttackDamageTrait', 'ApolloWeaponBoon', 'Melee'],
    ['FocusSpecialDamageTrait', 'ApolloSpecialBoon', 'Secondary'],
  ] as const)('adds three levels to the eligible trait occupying %s', (source, target, slot) => {
    const before = atLevel('Apollo', target, 'Common', 2);
    expect(before.equippedSlots[slot]?.traitKey).toBe(target);
    const offer: AuthoredTraitOffer = Object.freeze({
      kind: 'traits',
      giverKey: 'Icarus',
      options: Object.freeze([
        { traitKey: source },
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'CastHazardBoon' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    });
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'icarus-slot-upgrade',
      offer,
      before,
      Object.freeze({}),
      before.events.length,
    );
    expect(reached.assessments[0]).toMatchObject({ legal: true, findings: [] });
    const recorded = recordReachedTraitOffer(catalog, reached, before.events.length + 1, 'test');
    expect(recorded.history.equippedTraits[target]).toMatchObject({ level: 5 });
    expect(recorded.history.equippedTraits[source]).toMatchObject({ giverKey: 'Icarus' });
    expect(recorded.history.events.at(-1)).toMatchObject({
      kind: 'levelMutation',
      sourceTraitKey: source,
      targetTraitKey: target,
      oldLevel: 2,
      newLevel: 5,
    });
  });

  it('withholds Ingenious Strike when the occupied Hephaestus Attack is cooldown-capped', () => {
    const capped = atLevel('Hephaestus', 'HephaestusWeaponBoon', 'Common', 10);
    expect(capped.equippedSlots.Melee?.traitKey).toBe('HephaestusWeaponBoon');
    expect(assessTraitOption(catalog, 'FocusAttackDamageTrait', capped)).toMatchObject({
      legal: false,
      findings: expect.arrayContaining([
        { code: 'missingPrerequisite', traitKey: 'FocusAttackDamageTrait', detail: 'Melee' },
      ]),
    });
  });

  it('does not treat a non-core trait occupying the Attack slot as an Ingenious target', () => {
    const nonCore = historyWith('Artemis', 'SupportingFireBoon', 'Common');
    const occupant = nonCore.equippedTraits.SupportingFireBoon;
    if (occupant === undefined) throw new Error('missing non-core fixture trait');
    const malformedSlotState = Object.freeze({
      ...nonCore,
      equippedSlots: Object.freeze({ Melee: occupant }),
    });
    expect(assessTraitOption(catalog, 'FocusAttackDamageTrait', malformedSlotState)).toMatchObject({
      legal: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: 'missingPrerequisite',
          traitKey: 'FocusAttackDamageTrait',
        }),
      ]),
    });
  });
});

describe('Supply Chain lifecycle', () => {
  it('counts every qualifying O encounter phase and defers a Chaos threshold', () => {
    const occurrence = createOccurrenceAddress(goldenFBiome, goldenFStartId);
    const base = initializeTestRewardBranches()[0]!;
    const supplySettlement = settleEncounterTraitOffer(
      catalog,
      base,
      createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFStartId },
        'Encounter',
      ),
      Object.freeze({
        kind: 'traits',
        giverKey: 'Icarus',
        options: Object.freeze([
          { traitKey: 'SupplyDropBoon' },
          { traitKey: 'OmegaExplodeBoon' },
          { traitKey: 'CastHazardBoon' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
        selectedOptionKey: 'option1',
      }),
      0,
      'encounterCompleted',
      new Map(),
      undefined,
      'selection',
    );
    const supplyHistory = supplySettlement.branch.traitHistory!;
    expect(supplyHistory.equippedTraits.SupplyDropBoon?.acquisitionIdentity).toBeDefined();
    let branches: readonly RewardBranchState[] = [
      Object.freeze({
        ...base,
        traitHistory: supplyHistory,
        history: attachTraitHistory(base.history, supplyHistory),
      }),
    ];
    const oRoom = {
      kind: 'authored',
      origin: occurrence,
      occurrenceId: occurrence.occurrenceId,
      gameName: 'O_Combat01',
      encounters: {},
      encounterPhases: [{ slotKey: 'Intro' }, { slotKey: 'Combat1' }, { slotKey: 'Combat2' }],
    } as unknown as CanonicalAuthoredRoom;
    let oBranches = branches;
    const oProgress: number[] = [];
    for (const [index, phaseKey] of ['Intro', 'Combat1', 'Combat2'].entries()) {
      const transition = applyEncounterEndEffectsTransition(
        catalog,
        Object.freeze({
          kind: 'encounterEndEffectsApplied',
          origin: occurrence,
          phaseKey,
          execution: 'normal',
          figLeafSkipOwner: false,
          operationIndex: index + 1,
          sequence: index + 1,
        }),
        oRoom,
        1,
        4,
        oBranches,
      );
      oBranches = transition.branches;
      expect(transition.derivedAcquisitionEntryFrontiers).toEqual([]);
      oProgress.push(
        oBranches[0]?.traitHistory?.equippedTraits.SupplyDropBoon?.pickupProducerProgress ?? 0,
      );
    }
    expect(oProgress).toEqual([1, 2, 3]);

    const skippedRoom = {
      ...oRoom,
      gameName: 'N_Sub01',
      encounterPhases: [{ slotKey: 'Encounter' }],
    } as unknown as CanonicalAuthoredRoom;
    const skipped = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied',
        origin: occurrence,
        phaseKey: 'Encounter',
        execution: 'normal',
        figLeafSkipOwner: false,
        operationIndex: 4,
        sequence: 4,
      }),
      skippedRoom,
      1,
      4,
      branches,
    );
    expect(catalog.rooms.byKey.N_Sub01?.skipRoomsPerUpgrade).toBe(true);
    expect(skipped.derivedAcquisitionEntryFrontiers).toEqual([]);
    expect(
      skipped.branches[0]?.traitHistory?.equippedTraits.SupplyDropBoon?.pickupProducerProgress,
    ).toBeUndefined();

    const room = {
      kind: 'authored',
      origin: occurrence,
      occurrenceId: occurrence.occurrenceId,
      gameName: 'RoomOpening01',
      encounters: {},
      encounterPhases: [{ slotKey: 'Encounter' }],
    } as unknown as CanonicalAuthoredRoom;
    const maturedAt: number[] = [];
    for (let sequence = 1; sequence <= 14; sequence += 1) {
      const transition = applyEncounterEndEffectsTransition(
        catalog,
        Object.freeze({
          kind: 'encounterEndEffectsApplied',
          origin: occurrence,
          phaseKey: 'Encounter',
          execution: 'normal',
          figLeafSkipOwner: false,
          operationIndex: sequence,
          sequence,
        }),
        room,
        1,
        4,
        branches,
      );
      branches = transition.branches;
      if (transition.derivedAcquisitionEntryFrontiers.length > 0) {
        maturedAt.push(sequence);
        expect(transition.derivedAcquisitionEntryFrontiers).toHaveLength(2);
        expect(
          new Set(
            transition.derivedAcquisitionEntryFrontiers.map(
              (frontier) => frontier.address.entryKey,
            ),
          ),
        ).toHaveLength(2);
        expect(transition.derivedAcquisitionEntryFrontiers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: 'clockedTraitPickup',
              participation: 'optional',
              rewardTypes: ['StoreRewardRandomStack'],
              fixedReward: expect.objectContaining({
                offer: { rewardType: 'StoreRewardRandomStack' },
                levelResolutionsByAcquisitionRole: expect.any(Object),
              }),
            }),
            expect.objectContaining({
              kind: 'clockedTraitPickup',
              participation: 'optional',
              rewardTypes: ['StoreRewardRandomStack'],
              fixedReward: expect.objectContaining({
                offer: { rewardType: 'StoreRewardRandomStack' },
                levelResolutionsByAcquisitionRole: expect.any(Object),
              }),
            }),
          ]),
        );
      }
      expect(branches[0]?.traitHistory?.equippedTraits.SupplyDropBoon?.pickupProducerProgress).toBe(
        sequence % 7,
      );
    }
    expect(maturedAt).toEqual([7, 14]);

    for (let sequence = 15; sequence <= 20; sequence += 1) {
      branches = applyEncounterEndEffectsTransition(
        catalog,
        Object.freeze({
          kind: 'encounterEndEffectsApplied',
          origin: occurrence,
          phaseKey: 'Encounter',
          execution: 'normal',
          figLeafSkipOwner: false,
          operationIndex: sequence,
          sequence,
        }),
        room,
        1,
        4,
        branches,
      ).branches;
    }
    expect(branches[0]?.traitHistory?.equippedTraits.SupplyDropBoon?.pickupProducerProgress).toBe(
      6,
    );

    const chaosRoom = {
      ...room,
      gameName: 'Chaos_01',
    } as unknown as CanonicalAuthoredRoom;
    const deferred = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied',
        origin: occurrence,
        phaseKey: 'Encounter',
        execution: 'normal',
        figLeafSkipOwner: false,
        operationIndex: 21,
        sequence: 21,
      }),
      chaosRoom,
      1,
      4,
      branches,
    );
    expect(catalog.rooms.byKey.Chaos_01?.skipTimedDropResources).toBe(true);
    expect(deferred.derivedAcquisitionEntryFrontiers).toEqual([]);
    expect(
      deferred.branches[0]?.traitHistory?.equippedTraits.SupplyDropBoon?.pickupProducerProgress,
    ).toBe(6);

    const maturedAfterChaos = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied',
        origin: occurrence,
        phaseKey: 'Encounter',
        execution: 'normal',
        figLeafSkipOwner: false,
        operationIndex: 22,
        sequence: 22,
      }),
      room,
      1,
      4,
      deferred.branches,
    );
    expect(maturedAfterChaos.derivedAcquisitionEntryFrontiers).toHaveLength(2);
    expect(
      maturedAfterChaos.branches[0]?.traitHistory?.equippedTraits.SupplyDropBoon
        ?.pickupProducerProgress,
    ).toBe(0);
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
