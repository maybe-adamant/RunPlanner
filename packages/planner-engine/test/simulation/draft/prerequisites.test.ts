import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createDraftPrerequisites,
  prerequisiteOrder,
  type DraftHeldTraits,
  type DraftPrerequisiteNeed,
} from '../../../src/simulation/draft/prerequisites';

const nothing: DraftHeldTraits = {
  traitKeys: new Set(),
  elementCounts: { Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 },
  godBoonRarityCounts: {},
};
const anyOf = (...keys: string[]): DraftPrerequisiteNeed => [
  { weights: new Map(keys.map((key) => [key, 1])), needed: 1 },
];

describe('draft prerequisite order', () => {
  it('places a trait after one member of each of its needs', () => {
    const needs = new Map([
      ['Duo', [anyOf('A1', 'A2'), anyOf('B')]],
      ['A1', []],
      ['A2', []],
      ['B', []],
    ]);
    const order = prerequisiteOrder(['Duo', 'B', 'A2', 'A1'], needs);
    expect(order.indexOf('Duo')).toBeGreaterThan(order.indexOf('B'));
    expect(order.indexOf('Duo')).toBeGreaterThan(
      Math.min(order.indexOf('A1'), order.indexOf('A2')),
    );
  });

  it('places the first pending trait of a cycle and keeps going', () => {
    const needs = new Map([
      ['A', [anyOf('B')]],
      ['B', [anyOf('A')]],
      ['C', [anyOf('A')]],
    ]);
    expect(prerequisiteOrder(['A', 'B', 'C'], needs)).toEqual(['A', 'B', 'C']);
  });

  it('drops a need the loadout already meets', () => {
    const basket = ['SprintEchoBoon', 'ZeusWeaponBoon', 'AphroditeManaBoon'];
    const free = createDraftPrerequisites(catalog, basket, nothing).needs.get('SprintEchoBoon')!;
    expect(free).toHaveLength(2);
    const held = createDraftPrerequisites(catalog, basket, {
      ...nothing,
      traitKeys: new Set(['ZeusSpecialBoon']),
    }).needs.get('SprintEchoBoon')!;
    expect(held).toHaveLength(1);
    expect([...held[0]![0]!.weights.keys()]).toEqual(['AphroditeManaBoon']);
  });

  it('judges an Infusion ready only at its element count', () => {
    const prerequisites = createDraftPrerequisites(catalog, ['ElementalDamageFloorBoon'], nothing);
    const air = (count: number) => ({
      ...nothing,
      elementCounts: { ...nothing.elementCounts, Air: count },
    });
    expect(prerequisites.ready('ElementalDamageFloorBoon', air(2))).toBe(false);
    expect(prerequisites.ready('ElementalDamageFloorBoon', air(3))).toBe(true);
    expect(prerequisites.runStateWaiting('ElementalDamageFloorBoon', air(2))).toBe(true);
  });

  it('waits on run state for Uncommon Grace while any Common god boon is held', () => {
    const prerequisites = createDraftPrerequisites(catalog, ['CommonGlobalDamageBoon'], nothing);
    const commons = (count: number) => ({ ...nothing, godBoonRarityCounts: { Common: count } });
    expect(prerequisites.ready('CommonGlobalDamageBoon', commons(0))).toBe(true);
    expect(prerequisites.runStateWaiting('CommonGlobalDamageBoon', commons(1))).toBe(true);
    // A held-trait need is not run state: Double Strike waits on a Zeus core boon.
    const zeus = createDraftPrerequisites(catalog, ['ZeusCastBoon', 'DoubleBoltBoon'], nothing);
    expect(zeus.runStateWaiting('DoubleBoltBoon', nothing)).toBe(false);
  });
});
