import { catalog } from '@run-planner/hades2-catalog';
import { createOccurrenceAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures/underworld';

import type { KeepsakeRank } from '../../src/catalog-schema';
import {
  advanceCurrentKeepsake,
  advanceKeepsakeEncounterValues,
  applyEchoLionFangReplay,
  applyKeepsakeReplacement,
  createKeepsakeState,
  type KeepsakeState,
} from '../../src/simulation/keepsakes/state';
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute,
} from '../support/arcana-fear';

const bell = 'EscalatingKeepsake';
const fang = 'DecayingBoostKeepsake';
const arcanaFear = createTestArcanaFearState();

function equipFang(rank: KeepsakeRank): KeepsakeState {
  return applyKeepsakeReplacement(
    catalog,
    createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear),
    fang,
    arcanaFear,
    rank,
  );
}

function encounters(state: KeepsakeState, count: number): KeepsakeState {
  let next = state;
  for (let index = 0; index < count; index += 1)
    next = advanceKeepsakeEncounterValues(catalog, next);
  return next;
}

describe('Discordant Bell and Lion Fang values', () => {
  it('grows the rank-III Bell by the native double sum at each qualifying encounter end', () => {
    let state = createKeepsakeState(catalog, bell, arcanaFear);
    expect(state.discordantBell).toEqual({ rank: 'Epic', multiplier: 1 });
    const values: number[] = [];
    let native = 1;
    const natives: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      state = advanceKeepsakeEncounterValues(catalog, state);
      values.push(state.discordantBell!.multiplier);
      native += 0.01;
      natives.push(native);
    }
    expect(values).toEqual(natives);
  });

  it('keeps the permanent Bell growing after a swap, while a swapped Fang is removed', () => {
    const grown = encounters(createKeepsakeState(catalog, bell, arcanaFear), 3);
    const swapped = applyKeepsakeReplacement(catalog, grown, fang, arcanaFear);
    expect(swapped.discordantBell).toEqual(grown.discordantBell);
    expect(swapped.lionFang).toEqual({ origin: 'ordinary', multiplier: 1.5, expired: false });
    const later = advanceKeepsakeEncounterValues(catalog, swapped);
    expect(later.discordantBell!.multiplier).toBe(grown.discordantBell!.multiplier + 0.01);
    expect(later.lionFang!.multiplier).toBe(1.45);

    const afterFang = applyKeepsakeReplacement(catalog, later, 'BonusMoneyKeepsake', arcanaFear);
    expect(afterFang.lionFang).toBeUndefined();
    expect(afterFang.discordantBell).toEqual(later.discordantBell);
  });

  it.each([
    ['Common', 1.3, 6],
    ['Rare', 1.4, 8],
    ['Epic', 1.5, 10],
    ['Heroic', 1.7, 14],
  ] as const)(
    'expires a %s Fang from %d at its %dth qualifying encounter end',
    (rank, start, at) => {
      const equipped = equipFang(rank);
      expect(equipped.lionFang).toEqual({ origin: 'ordinary', multiplier: start, expired: false });
      const before = encounters(equipped, at - 1);
      expect(before.lionFang?.expired).toBe(false);
      expect(before.lionFang!.multiplier).toBeGreaterThan(1);
      const expired = advanceKeepsakeEncounterValues(catalog, before);
      expect(expired.lionFang).toEqual({ origin: 'ordinary', multiplier: 1, expired: true });
      expect(advanceKeepsakeEncounterValues(catalog, expired).lionFang).toBe(expired.lionFang);
    },
  );

  it('advances only the current keepsake with Cherished Heirloom', () => {
    const spentFang = encounters(equipFang('Epic'), 12);
    expect(spentFang.lionFang?.expired).toBe(true);
    expect(advanceCurrentKeepsake(catalog, spentFang, 1).lionFang).toEqual({
      origin: 'ordinary',
      multiplier: 1.7,
      expired: false,
    });

    const grownBell = encounters(createKeepsakeState(catalog, bell, arcanaFear), 2);
    const cherished = advanceCurrentKeepsake(catalog, grownBell, 1);
    expect(cherished.discordantBell).toEqual({
      rank: 'Heroic',
      multiplier: grownBell.discordantBell!.multiplier,
    });
    expect(advanceKeepsakeEncounterValues(catalog, cherished).discordantBell!.multiplier).toBe(
      grownBell.discordantBell!.multiplier + 0.015,
    );

    const swappedBell = applyKeepsakeReplacement(catalog, grownBell, fang, arcanaFear);
    expect(advanceCurrentKeepsake(catalog, swappedBell, 1).discordantBell).toEqual(
      grownBell.discordantBell,
    );
  });

  it('replays a Common Echo Fang only while no Fang is held', () => {
    const swapped = applyKeepsakeReplacement(
      catalog,
      equipFang('Epic'),
      'BonusMoneyKeepsake',
      arcanaFear,
    );
    const replayed = applyEchoLionFangReplay(catalog, swapped, fang);
    expect(replayed.lionFang).toEqual({ origin: 'echo', multiplier: 1.3, expired: false });
    const spent = encounters(replayed, 6);
    expect(spent.lionFang?.expired).toBe(true);
    expect(applyEchoLionFangReplay(catalog, spent, fang)).toBe(spent);
    const held = equipFang('Epic');
    expect(applyEchoLionFangReplay(catalog, held, fang)).toBe(held);
  });

  it('advances both values only where the room does not skip RoomsPerUpgrade', () => {
    const occurrence = createOccurrenceAddress(goldenFBiome, goldenFStartId);
    const branches = initializeTestRewardBranchesForRoute(undefined, undefined, catalog, bell);
    const room = (gameName: string) =>
      ({
        kind: 'authored',
        origin: occurrence,
        occurrenceId: occurrence.occurrenceId,
        gameName,
        encounters: {},
        encounterPhases: [{ slotKey: 'Encounter' }],
      }) as unknown as CanonicalAuthoredRoom;
    const end = (gameName: string) =>
      applyEncounterEndEffectsTransition(
        catalog,
        Object.freeze({
          kind: 'encounterEndEffectsApplied',
          origin: occurrence,
          phaseKey: 'Encounter',
          execution: 'normal',
          figLeafSkipOwner: false,
          operationIndex: 1,
          sequence: 1,
        }),
        room(gameName),
        branches,
      ).branches[0]!.state.keepsakes.discordantBell;
    expect(catalog.rooms.byKey.N_Sub01?.skipRoomsPerUpgrade).toBe(true);
    expect(end('N_Sub01')).toEqual({ rank: 'Epic', multiplier: 1 });
    expect(end('RoomOpening01')).toEqual({ rank: 'Epic', multiplier: 1.01 });
  });
});
