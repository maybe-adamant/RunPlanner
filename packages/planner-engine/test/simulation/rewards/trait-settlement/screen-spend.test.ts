import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  type AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';

import { settleEncounterTraitOffer } from '../../../../src/simulation/rewards/trait-settlement/coordinator';
import { selectedTraitOfferProducts } from '../../../../src/simulation/rewards/biome/selected-trait-products';
import type { RewardBranchState } from '../../../../src/simulation/rewards/branch-primitives';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitHistoryState,
} from '../../../../src/simulation/traits';
import { normalizeAuthoredChaosTraitOffer } from '../../../../src/authored-project/traits/state';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute as initializeRewardBranches,
} from '../../../support/arcana-fear';

const biome = createBiomeAddress('Underworld', 'G');

/** An Ordinary curse acquired through its own Chaos screen. */
function ordinaryHistory(): TraitHistoryState {
  const curse = catalog.chaos.curses.byKey.ChaosCommonCurse!;
  const blessing = catalog.chaos.blessings.byKey.ChaosWeaponBlessing!;
  const offer = normalizeAuthoredChaosTraitOffer(catalog, {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [0, 1, 2].map(() => ({
      curseKey: curse.key,
      requirementCount: curse.duration.maximum,
    })) as never,
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.fromEntries(curse.operands.map((o) => [o.key, o.minimum])),
    blessingKey: blessing.key,
    rarity: 'Common',
    blessingValues: Object.fromEntries(
      blessing.operands.map((o) => [o.key, o.byRarity?.Common?.minimum ?? o.minimum]),
    ),
  });
  return foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: biome,
      acquisitionRole: 'self',
      sequence: 0,
      acquisitionPoint: 'reward',
      acquisitionIdentity: 'seed:ordinary',
      offer,
    }),
  ]);
}

function branchWith(
  well: { yarnUses?: number; hymnUses?: number },
  ordinary = false,
): RewardBranchState {
  const base = initializeRewardBranches(undefined, createTestArcanaFearState(), catalog)[0]!;
  const traitHistory = ordinary ? ordinaryHistory() : base.state.traitHistory;
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      traitHistory,
      rewardHistory: attachTraitHistory(base.state.rewardHistory, traitHistory),
      stygianWell: Object.freeze({ ...base.state.stygianWell, ...well }),
    }),
  });
}

function encounterScreen(
  giverKey: string,
  branch: RewardBranchState,
  encounterSource?: { readonly suppressTemporaryBoonRarity: true },
) {
  const giver = catalog.traitGivers.byKey[giverKey]!;
  const offer = Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(
      giver.traitKeys.slice(0, 3).map((traitKey) => Object.freeze({ traitKey, rarity: 'Common' })),
    ),
    selectedOptionKey: 'option1',
  }) as AuthoredTraitOffer;
  const owner = createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(`${giverKey}-room`) },
    'Encounter',
  );
  return settleEncounterTraitOffer(
    catalog,
    branch,
    owner,
    offer,
    1,
    'encounterCompleted',
    undefined,
    'selection',
    undefined,
    encounterSource,
  ).branch;
}

// Native spends Yarn and Ordinary on encounter loot treated as god loot, except
// Hades, whose loot ignores temporary rarity and blocks Ordinary (NPCData_Hades.lua:17-21).
describe('encounter god screen spends', () => {
  for (const giverKey of ['Artemis', 'Athena', 'Dionysus']) {
    it(`${giverKey} spends one Yarn use and one Ordinary use, and never Hymn`, () => {
      expect(
        encounterScreen(giverKey, branchWith({ yarnUses: 1 })).state.stygianWell.yarnUses,
      ).toBe(0);
      expect(
        encounterScreen(giverKey, branchWith({}, true)).state.traitHistory.activeChaosCurses[0]
          ?.remaining,
      ).toBe(ordinaryHistory().activeChaosCurses[0]!.remaining - 1);
      expect(
        encounterScreen(giverKey, branchWith({ hymnUses: 1 })).state.stygianWell.hymnUses,
      ).toBe(1);
    });
  }

  it('publishes the spends an Artemis screen settled in its expectation', () => {
    const published = (branch: RewardBranchState) =>
      selectedTraitOfferProducts([encounterScreen('Artemis', branch)], Object.freeze([]), catalog)
        .selectedTraitOffers[0]?.branches[0]?.screenExpectation;
    expect(published(branchWith({ yarnUses: 1 }))).toEqual({
      hymnUses: 0,
      yarnUses: 1,
      consumesHymn: false,
      consumesYarn: true,
      consumesOrdinary: false,
    });
    // Ordinary forces Common, so the loot is not rarity boosted and keeps its Yarn.
    expect(published(branchWith({ yarnUses: 1 }, true))).toMatchObject({
      yarnUses: 1,
      consumesYarn: false,
      consumesOrdinary: true,
    });
  });

  it('spends nothing on a Hades screen', () => {
    expect(encounterScreen('Hades', branchWith({ yarnUses: 1 })).state.stygianWell.yarnUses).toBe(
      1,
    );
    expect(
      encounterScreen('Hades', branchWith({}, true)).state.traitHistory.activeChaosCurses[0]
        ?.remaining,
    ).toBe(ordinaryHistory().activeChaosCurses[0]!.remaining);
  });

  it('spends no Yarn on a Gorgon Athena screen that ignores temporary rarity', () => {
    expect(
      encounterScreen('Athena', branchWith({ yarnUses: 1 }), {
        suppressTemporaryBoonRarity: true,
      }).state.stygianWell.yarnUses,
    ).toBe(1);
  });
});
