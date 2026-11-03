import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { nativeExitDoorOrder, type OpenExitDoor } from '../../src/catalog-schema';
import { luaPairsOrder, luaSort } from '../../src/catalog-schema/exit-door-order';
import { hubBoardProbes } from '../support/hub-board-probe';

const map = (...doorIds: number[]): OpenExitDoor[] => doorIds.map((doorId) => ({ doorId }));

describe('native exit door order', () => {
  it.each(hubBoardProbes.map((probe, index) => [index, probe] as const))(
    'emulates the Lua table walk and sort of probe board %i',
    (_, probe) => {
      const pairs = luaPairsOrder(probe.insertion);
      expect(pairs).toEqual(probe.pairs);
      expect(luaSort(pairs, () => false)).toEqual(probe.assignment);
    },
  );

  // Door-order probe records: the open doors and the order the game processed them in.
  it.each([
    ['G_Combat14', map(569053, 609522, 609523), [609523, 609522, 569053]],
    ['G_Combat20', map(569053, 776584, 776586), [776584, 776586, 569053]],
    ['I_Combat01', map(625872, 625883), [625872, 625883]],
    ['F_Combat12', map(560915, 561217), [561217, 560915]],
    [
      'F_Combat12',
      [...map(560915, 561217), { doorId: 2000163, additionalExitKey: 'chaos' as const }],
      [560915, 561217, 2000163],
    ],
    [
      'G_Combat06',
      [...map(558528, 569065), { doorId: 2000165, additionalExitKey: 'chaos' as const }],
      [569065, 558528, 2000165],
    ],
    ['G_Shop01', map(561365, 561374), [561365, 561374]],
    [
      'G_Shop01',
      [...map(561365, 561374), { doorId: 2000166, additionalExitKey: 'zagreusContract' as const }],
      [561374, 561365, 2000166],
    ],
  ])('orders %s doors %j as recorded', (room, open, expected) => {
    expect(nativeExitDoorOrder(catalog, room, open)).toEqual(expected);
    // The record's door order carries no information.
    expect(nativeExitDoorOrder(catalog, room, [...open].reverse())).toEqual(expected);
  });

  it.each([
    ['a room without a declared door-setup order', 'F_Opening01', map(1, 2)],
    ['a map door the room does not declare', 'G_Combat14', map(569053, 1)],
    [
      'an additional exit the room lacks',
      'G_Combat14',
      [{ doorId: 1, additionalExitKey: 'zagreusContract' as const }],
    ],
  ])('has no order for %s', (_, room, open) => {
    expect(nativeExitDoorOrder(catalog, room, open)).toBeUndefined();
  });
});
