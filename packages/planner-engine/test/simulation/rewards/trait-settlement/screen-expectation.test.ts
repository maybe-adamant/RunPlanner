import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';

import { traitScreenExpectation } from '../../../../src/simulation/rewards/trait-settlement/screen-expectation';
import type { SimulationState } from '../../../../src/simulation/state/model';
import type { TraitScreenSpend } from '../../../../src/simulation/traits';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute as initializeRewardBranches,
} from '../../../support/arcana-fear';

function baseState(keepsakeKey = 'ManaOverTimeRefundKeepsake'): SimulationState {
  return initializeRewardBranches(undefined, createTestArcanaFearState(), catalog, keepsakeKey)[0]!
    .state;
}

function withWell(state: SimulationState, well: { hymnUses?: number; yarnUses?: number }) {
  return Object.freeze({
    ...state,
    stygianWell: Object.freeze({ ...state.stygianWell, ...well }),
  });
}

function withKeepsakes(
  state: SimulationState,
  keepsakes: Partial<SimulationState['keepsakes']>,
): SimulationState {
  return Object.freeze({
    ...state,
    keepsakes: Object.freeze({ ...state.keepsakes, ...keepsakes }),
  });
}

function traitsOffer(giverKey: string): AuthoredTraitOffer {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze([Object.freeze({ traitKey: 'ZeusWeaponBoon', rarity: 'Common' })]),
    selectedOptionKey: 'option1',
  }) as AuthoredTraitOffer;
}

function expectationFor(
  giverKey: string,
  state: SimulationState,
  screenSpend?: TraitScreenSpend,
  offer: AuthoredTraitOffer = traitsOffer(giverKey),
) {
  return traitScreenExpectation(catalog, {
    offer,
    state,
    ...(screenSpend === undefined ? {} : { screenSpend }),
  });
}

const noSpend: TraitScreenSpend = Object.freeze({ hymn: false, yarn: false, ordinary: false });

describe('trait screen expectation', () => {
  it('publishes open-time god-screen uses, spent as zero', () => {
    expect(expectationFor('Zeus', baseState())).toEqual({ hymnUses: 0, yarnUses: 0 });
    expect(expectationFor('Zeus', withWell(baseState(), { hymnUses: 1, yarnUses: 2 }))).toEqual({
      hymnUses: 1,
      yarnUses: 2,
    });
  });

  it('copies the spends its settlement recorded, never deriving them again', () => {
    expect(expectationFor('Zeus', baseState(), noSpend)).toMatchObject({
      consumesHymn: false,
      consumesYarn: false,
      consumesOrdinary: false,
    });
    expect(
      expectationFor('Zeus', baseState(), { hymn: true, yarn: true, ordinary: true }),
    ).toMatchObject({ consumesHymn: true, consumesYarn: true, consumesOrdinary: true });
  });

  it('omits god-screen fields on screens that do not roll a god offer', () => {
    expect(
      expectationFor('Icarus', withWell(baseState(), { hymnUses: 1 }), noSpend),
    ).toBeUndefined();
    const chaos = Object.freeze({
      kind: 'chaos',
      curseOptions: Object.freeze([]),
      selectedOptionKey: 'option1',
    }) as unknown as AuthoredTraitOffer;
    expect(expectationFor('Chaos', baseState(), noSpend, chaos)).toBeUndefined();
  });

  it('publishes Concave Stone uses and whether the giver can proc it', () => {
    const pending = withKeepsakes(baseState(), {
      stone: Object.freeze({ origin: 'ordinary', status: 'pending', rank: 'Common' }),
    });
    const spent = withKeepsakes(baseState(), {
      stone: Object.freeze({ origin: 'ordinary', status: 'consumed', rank: 'Common' }),
    });
    expect(expectationFor('Zeus', pending)?.concaveStone).toEqual({ uses: 1, giverProcs: true });
    expect(expectationFor('Zeus', spent)?.concaveStone).toEqual({ uses: 0, giverProcs: true });
    expect(expectationFor('Hades', pending)?.concaveStone).toEqual({ uses: 1, giverProcs: false });
    expect(expectationFor('Icarus', pending)).toEqual({
      concaveStone: { uses: 1, giverProcs: false },
    });
    expect(expectationFor('Zeus', baseState())?.concaveStone).toBeUndefined();
    expect(expectationFor('SpellDrop', pending)).toBeUndefined();
  });

  it('publishes the rarify uses of the matching provider source before Calling Card', () => {
    const zeus = baseState('ForceZeusBoonKeepsake');
    expect(expectationFor('Zeus', zeus)?.rarifyUses).toBe(1);
    expect(expectationFor('Apollo', zeus)?.rarifyUses).toBeUndefined();
    const card = withKeepsakes(baseState(), {
      fatedStatus: 'Fated',
      callingCard: Object.freeze({ remainingCharges: 2 }),
    });
    expect(expectationFor('Apollo', card)?.rarifyUses).toBe(2);
    expect(
      expectationFor('Apollo', withKeepsakes(card, { fatedStatus: 'Unfated' }))?.rarifyUses,
    ).toBe(0);
    expect(expectationFor('Icarus', card)).toBeUndefined();
  });
});
