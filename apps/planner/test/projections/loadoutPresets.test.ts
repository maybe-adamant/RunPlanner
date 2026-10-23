import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import {
  describeArcanaPreset,
  describeVowPreset,
  nextPresetName,
  presetFearRanks,
  projectArcanaPresetChips,
  projectVowPresetChips,
} from '@planner/projections/loadoutPresets';

const loadout = (manualArcanaKeys: readonly string[], ranks: Record<string, number> = {}) => ({
  ...createDefaultRouteLoadout(catalog),
  manualArcanaKeys,
  fearRanks: presetFearRanks(catalog, ranks),
});

describe('loadout preset projection', () => {
  it('summarizes each preset for its Settings row', () => {
    expect(
      describeArcanaPreset(catalog, { id: 'a', name: 'A', cardKeys: ['LastStand', 'BonusHealth'] }),
    ).toBe('2 cards · 6 Grasp');
    expect(describeArcanaPreset(catalog, { id: 'a', name: 'A', cardKeys: ['LastStand'] })).toBe(
      '1 card · 4 Grasp',
    );
    expect(
      describeVowPreset(catalog, {
        id: 'v',
        name: 'V',
        ranks: { EnemyDamageShrineUpgrade: 2, LimitGraspShrineUpgrade: 1 },
      }),
    ).toMatch(/^Fear \d+ · 2 Vows$/);
    expect(describeVowPreset(catalog, { id: 'v', name: 'V', ranks: {} })).toBe('Fear 0 · 0 Vows');
  });

  it('numbers a new preset’s name past the ones taken', () => {
    expect(nextPresetName('arcana', [])).toBe('Arcana preset');
    expect(nextPresetName('arcana', [{ name: 'Arcana preset' }])).toBe('Arcana preset 2');
    expect(
      nextPresetName('vows', [{ name: 'Vow preset' }, { name: 'Vow preset 2' }, { name: 'X' }]),
    ).toBe('Vow preset 3');
  });

  it('marks the chip the plan already has and words each refusal by its Grasp', () => {
    const arcana = [
      { id: 'light', name: 'Light', cardKeys: ['LastStand'] },
      { id: 'heavy', name: 'Heavy', cardKeys: ['StartingGold', 'RarityBoost', 'ManaOverTime'] },
    ];
    const chips = projectArcanaPresetChips(
      catalog,
      'Underworld',
      loadout(['LastStand'], { LimitGraspShrineUpgrade: 2 }),
      arcana,
    );
    expect(chips.map((chip) => [chip.name, chip.current, chip.outcome])).toEqual([
      ['Light', true, { kind: 'unchanged' }],
      ['Heavy', false, { kind: 'refused', reason: 'Needs 15 Grasp; your Vows allow 12.' }],
    ]);
    const vows = projectVowPresetChips(
      catalog,
      'Underworld',
      loadout(['StartingGold', 'RarityBoost', 'ManaOverTime']),
      [
        { id: 'void', name: 'Void', ranks: { LimitGraspShrineUpgrade: 2 } },
        { id: 'pain', name: 'Pain', ranks: { EnemyDamageShrineUpgrade: 1 } },
      ],
    );
    expect(vows[0]!.outcome).toEqual({
      kind: 'refused',
      reason: 'Your Arcana need 15 Grasp; these Vows allow 12.',
    });
    expect(vows[1]!.outcome).toMatchObject({ kind: 'apply' });
  });
});
