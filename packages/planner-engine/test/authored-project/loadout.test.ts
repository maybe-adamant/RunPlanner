import { catalog } from '@run-planner/hades2-catalog';
import {
  createDefaultRouteLoadout,
  deriveRouteLoadout,
  type RouteLoadout,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

function derive(manualArcanaKeys: readonly string[]) {
  const loadout: RouteLoadout = {
    ...createDefaultRouteLoadout(catalog),
    manualArcanaKeys,
  };
  return deriveRouteLoadout(catalog, loadout);
}

describe('route loadout derivation', () => {
  it.each([
    ['The Moon', ['CastCount'], 'SorceryRegenUpgrade'],
    [
      'The Centaur',
      ['ChanneledCast', 'LowManaDamageBonus', 'CastCount', 'LastStand', 'StartingGold'],
      'MaxHealthPerRoom',
    ],
    ['The Queen', ['ChanneledCast'], 'BonusRarity'],
    ['The Fates', ['DoorReroll', 'StartingGold', 'ScreenReroll'], 'TradeOff'],
    [
      'Divinity',
      ['ChanneledCast', 'HealthRegen', 'LowManaDamageBonus', 'CastCount'],
      'EpicRarityBoost',
    ],
    ['Judgment', ['ChanneledCast'], 'CardDraw'],
  ] as const)('derives %s from its exact ordinary activation rule', (_label, manual, automatic) => {
    expect(derive(manual).automaticArcanaKeys).toContain(automatic);
  });

  it('does not count automatic cards in manual-count and Grasp-cost rules', () => {
    const derived = derive(['ChanneledCast', 'HealthRegen', 'LowManaDamageBonus']);

    expect(derived.automaticArcanaKeys).toContain('BonusRarity');
    expect(derived.automaticArcanaKeys).toContain('CardDraw');
    expect(derived.automaticArcanaKeys).not.toContain('MaxHealthPerRoom');
  });

  it('derives cumulative Fear from each selected rank', () => {
    const defaults = createDefaultRouteLoadout(catalog);
    const derived = deriveRouteLoadout(catalog, {
      ...defaults,
      fearRanks: {
        ...defaults.fearRanks,
        EnemyDamageShrineUpgrade: 3,
        BossDifficultyShrineUpgrade: 4,
      },
    });

    expect(derived.fearTotal).toBe(17);
  });
});
