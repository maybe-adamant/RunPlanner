import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredTraitOffer, SemanticAddress } from '@run-planner/engine/authored-project';
import { evaluateReachedTraitOffer, recordReachedTraitOffer } from '@run-planner/engine/simulation';

import type { EquippedTrait } from '../../src/authored-project/traits/state';
import type { InRunTraitRarity } from '../../src/catalog-schema';
import { deriveArmor } from '../../src/simulation/armor';
import {
  applyEchoSilkenSashReplay,
  createKeepsakeState,
} from '../../src/simulation/keepsakes/state';
import type { SimulationState } from '../../src/simulation/state/model';
import { createTraitHistoryState } from '../../src/simulation/traits';
import type { TraitHistoryState } from '../../src/simulation/traits/history/model';
import { createTestArcanaFearState } from '../support/arcana-fear';
import { traitFrontierState } from '../support/simulation-state';

const owner = { kind: 'project' } as SemanticAddress;
const NEUTRAL_KEEPSAKE = 'BossPreDamageKeepsake';

function equipped(
  traitKey: string,
  rarity?: InRunTraitRarity,
  extra: Partial<EquippedTrait> = {},
): EquippedTrait {
  return Object.freeze({
    traitKey,
    giverKey: 'Test',
    providerKind: 'olympian' as const,
    ...(rarity === undefined ? {} : { rarity }),
    sourceRole: 'selection',
    ...extra,
  });
}

function withTraits(list: readonly EquippedTrait[]): TraitHistoryState {
  return Object.freeze({
    ...createTraitHistoryState(),
    equippedTraits: Object.freeze(Object.fromEntries(list.map((trait) => [trait.traitKey, trait]))),
  });
}

function state(list: readonly EquippedTrait[] = []): SimulationState {
  return traitFrontierState(withTraits(list), { startingKeepsakeKey: NEUTRAL_KEEPSAKE });
}

const armor = (value: SimulationState) => deriveArmor(catalog, value).armor;

/** Records one NPC menu pick at a Dream acquisition ordinal and returns the folded state. */
function dreamPick(
  giverKey: string,
  traitKeys: readonly [string, string, string],
  ordinal: number,
) {
  const before = traitFrontierState(createTraitHistoryState(), {
    routeKey: 'Dream',
    itineraryBiomeKeys: ['G', 'F', 'H', 'I'],
    acquisitionOrdinal: ordinal,
    startingKeepsakeKey: NEUTRAL_KEEPSAKE,
  });
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(traitKeys.map((traitKey) => ({ traitKey }))) as Extract<
      AuthoredTraitOffer,
      { kind: 'traits' }
    >['options'],
    selectedOptionKey: 'option1',
  });
  const reached = evaluateReachedTraitOffer(catalog, owner, 'npc-menu', offer, before, {}, 0);
  const recorded = recordReachedTraitOffer(catalog, reached, 1, 'test');
  return Object.freeze({ ...before, traitHistory: recorded.history });
}

describe('lasting hero armor', () => {
  it('is zero with no armor source', () => {
    expect(deriveArmor(catalog, state())).toEqual({ armor: 0, sources: [] });
  });

  it.each([
    ['Common', 1, 10],
    ['Rare', 1, 15],
    ['Epic', 1, 20],
    ['Heroic', 1, 25],
    ['Common', 2, 15],
    ['Common', 3, 18],
    ['Common', 5, 22],
    ['Rare', 7, 15 + 5 + 3 + 2 + 2 + 2 + 2],
  ] as const)('scales Trusty Shield at %s level %s to %s', (rarity, level, expected) => {
    expect(armor(state([equipped('ArmorBoon', rarity, { level })]))).toBe(expected);
  });

  it.each([
    ['Common', 50],
    ['Rare', 75],
    ['Epic', 100],
    ['Heroic', 125],
  ] as const)('gives Heavy Metal at %s %s armor', (rarity, expected) => {
    expect(armor(state([equipped('HeavyArmorBoon', rarity, { level: 1 })]))).toBe(expected);
  });

  it('records Arachne and Icarus armor at the acquisition ordinal', () => {
    const azure = dreamPick('Arachne', ['ManaCostume', 'AgilityCostume', 'VitalityCostume'], 4);
    expect(azure.traitHistory.equippedTraits.ManaCostume?.armor).toBe(40);
    expect(armor(azure)).toBe(40);
    const onyx = (ordinal: number) =>
      armor(dreamPick('Arachne', ['HighArmorCostume', 'AgilityCostume', 'ManaCostume'], ordinal));
    expect([1, 2, 3, 4].map(onyx)).toEqual([60, 80, 100, 140]);
    const coating = (traitKey: string, ordinal: number) =>
      armor(dreamPick('Icarus', [traitKey, 'OmegaExplodeBoon', 'CastHazardBoon'], ordinal));
    expect([1, 3, 4].map((ordinal) => coating('BreakInvincibleArmorBoon', ordinal))).toEqual([
      100, 100, 140,
    ]);
    expect(coating('BreakExplosiveArmorBoon', 4)).toBe(50);
  });

  it('counts only the first held trait of one native armor source', () => {
    const first = equipped('BreakExplosiveArmorBoon', undefined, { armor: 50 });
    const second = equipped('BreakInvincibleArmorBoon', undefined, { armor: 140 });
    expect(armor(state([first, second]))).toBe(50);
  });

  it('adds items and the held Silken Sash, ordinary or Echo, with one source row each', () => {
    const base = state([equipped('ArmorBoon', 'Rare', { level: 2 })]);
    const keepsakes = createKeepsakeState(
      catalog,
      'ArmorGainKeepsake',
      createTestArcanaFearState(),
    );
    const ordinary: SimulationState = Object.freeze({
      ...base,
      keepsakes: Object.freeze({
        ...keepsakes,
        silkenSash: Object.freeze({ ...keepsakes.silkenSash!, currentArmor: 42 }),
      }),
      rewardHistory: Object.freeze({ ...base.rewardHistory, itemArmor: 60 }),
    });
    expect(deriveArmor(catalog, ordinary)).toEqual({
      armor: 20 + 60 + 42,
      sources: [
        { source: { kind: 'trait', key: 'ArmorBoon' }, armor: 20 },
        { source: { kind: 'items' }, armor: 60 },
        {
          source: { kind: 'keepsake', key: 'ArmorGainKeepsake', origin: 'ordinary' },
          armor: 42,
        },
      ],
    });
    const echo: SimulationState = Object.freeze({
      ...base,
      keepsakes: applyEchoSilkenSashReplay(catalog, base.keepsakes, 'ArmorGainKeepsake'),
    });
    expect(deriveArmor(catalog, echo).sources.at(-1)).toEqual({
      source: { kind: 'keepsake', key: 'ArmorGainKeepsake', origin: 'echo' },
      armor: 30,
    });
  });
});
