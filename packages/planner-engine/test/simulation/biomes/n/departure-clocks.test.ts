import { catalog } from '@run-planner/hades2-catalog';
import {
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

import { hubDepartureTraitInventory } from '../../../../src/simulation/rewards/run-state-conformance';
import type { StygianWellRunState } from '../../../../src/simulation/commerce/stygian-well';
import {
  fightKey,
  observeNChronology,
  seedOwner,
  walkWithDepartureClocks,
} from '../../support/n-departure-clock-walk';

describe('N room-departure clocks', () => {
  it('advances Fight Fight Fight decay and the Chaos rooms clock at every native departure', () => {
    const { result, departures, restored, curse } = walkWithDepartureClocks(0.8);
    const events = result.simulation.branches[0]!.state.traitHistory.events;
    const decay = events.filter(
      (event) =>
        (event.kind === 'roomDecayProgress' || event.kind === 'traitRemoval') &&
        event.acquisitionRole === 'roomDecay',
    );
    const clocks = events.filter(
      (event) => event.kind === 'chaosClock' && event.clock === 'locations',
    );
    // 0.8 clears its block, then decays fifteen times and is removed on the sixteenth.
    expect(decay).toHaveLength(17);
    expect(decay.at(-1)?.kind).toBe('traitRemoval');
    expect(decay.map((event) => event.sequence)).toEqual(
      departures.slice(0, 17).map((event) => event.sequence),
    );
    expect(clocks.map((event) => event.sequence)).toEqual(
      departures.slice(0, curse.duration.maximum).map((event) => event.sequence),
    );
    expect(decay.some((event) => restored.has(event.sequence))).toBe(true);
    expect(clocks.some((event) => restored.has(event.sequence))).toBe(true);
  });

  it('counts The Centaur at every room start but never at a Hub or parent restore', () => {
    const { result, history } = walkWithDepartureClocks(0.8, undefined, ['MaxHealthPerRoom']);
    const starts = history.events.filter((event) => event.kind === 'roomEntered').length;
    const restores = history.events.filter((event) => event.kind === 'roomRestored').length;
    expect(restores).toBeGreaterThan(0);
    expect(starts).toBeGreaterThan(5);
    expect(
      result.simulation.branches[0]!.state.arcanaFear.arcana.roomEntryGrowth?.MaxHealthPerRoom,
    ).toMatchObject({ progress: starts % 5, grants: Math.floor(starts / 5) });
  });

  it('counts no Centaur room starts while a real Barren curse holds the Arcana', () => {
    const { result, history, curse } = walkWithDepartureClocks(
      0.8,
      undefined,
      ['MaxHealthPerRoom'],
      'ChaosMetaUpgradeCurse',
    );
    expect(curse.semanticTag).toBe('Barren');
    const state = result.simulation.branches[0]!.state;
    const expiry = state.traitHistory.events.filter(
      (event) => event.kind === 'chaosClock' && event.clock === 'encounters',
    )[curse.duration.maximum - 1]!.sequence;
    expect(state.traitHistory.activeChaosCurses).toEqual([]);
    const starts = history.events.filter((event) => event.kind === 'roomEntered');
    const after = starts.filter((event) => event.sequence > expiry).length;
    expect(after).toBeLessThan(starts.length);
    expect(state.arcanaFear.arcana.roomEntryGrowth?.MaxHealthPerRoom).toMatchObject({
      progress: after % 5,
      grants: Math.floor(after / 5),
    });
  });

  it('captures each Hub departure before its LeaveRoom decay', () => {
    const probe = walkWithDepartureClocks(0.8);
    const hubKey = probe.departures.find((event) => event.origin.kind === 'hubRoom')!.origin;
    const firstHub = probe.departures.findIndex(
      (event) => semanticAddressKey(event.origin) === semanticAddressKey(hubKey),
    );
    // Cleared at the first departure, then removed exactly at the first Hub departure.
    const fraction = 0.05 * firstHub - 0.01;
    const { result, departures } = walkWithDepartureClocks(fraction);
    const removal = result.simulation.branches[0]!.state.traitHistory.events.find(
      (event) => event.kind === 'traitRemoval' && event.acquisitionRole === 'roomDecay',
    );
    expect(removal?.sequence).toBe(departures[firstHub]!.sequence);
    const [first, second] = result.simulation.hubDepartures;
    expect(hubDepartureTraitInventory(first!.departure).map((trait) => trait.traitKey)).toContain(
      fightKey,
    );
    expect(
      hubDepartureTraitInventory(second!.departure).map((trait) => trait.traitKey),
    ).not.toContain(fightKey);
  });

  it('spends room-clocked Well uses at every native departure, Hub revisits included', () => {
    const { result, departures, restored } = walkWithDepartureClocks(
      0.8,
      wellHolding([
        wellInstance('TemporaryDoorHealTrait', 'rooms', 3),
        wellInstance('TemporaryDoorHealTrait', 'bosses', 2),
      ]),
    );
    // The third native departure is the first Hub departure, a restored one.
    expect(restored.has(departures[2]!.sequence)).toBe(true);
    expectUsesAtSnapshots(result, 'rooms', 3, departures);
    expect(result.simulation.branches[0]!.state.stygianWell.timedInstances).toEqual([
      // Only the N Boss defeat spends a boss use.
      wellInstance('TemporaryDoorHealTrait', 'bosses', 1),
    ]);
  });

  it('skips encounter-clocked Well uses where the room ignores encounter uses', () => {
    const occurrences =
      loadSurfaceNProject().route.biomes.find((biome) => biome.biomeKey === 'N')?.topology
        ?.occurrences ?? [];
    const ignores = (occurrenceId: string) =>
      catalog.rooms.byKey[
        occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)!.gameName
      ]?.ignoreEncounterUses === true;
    const encounterEnds = observeNChronology()[2].events.filter(
      (event) => event.kind === 'encounterEndEffectsApplied',
    );
    const counted = encounterEnds.filter(
      (event) => event.origin.kind !== 'occurrence' || !ignores(event.origin.occurrenceId),
    );
    // A side-room encounter ends while the five-use buff is still held.
    expect(
      encounterEnds.some(
        (event) => !counted.includes(event) && event.sequence < counted[4]!.sequence,
      ),
    ).toBe(true);
    const { result } = walkWithDepartureClocks(
      0.8,
      wellHolding([wellInstance('TemporaryImprovedCastTrait', 'encounters', 5)]),
    );
    expectUsesAtSnapshots(result, 'encounters', 5, counted);
    expect(result.simulation.branches[0]!.state.stygianWell.timedInstances).toEqual([]);
  });
});

function wellInstance(
  itemKey: string,
  clock: 'encounters' | 'rooms' | 'bosses',
  remainingUses: number,
) {
  return Object.freeze({
    itemKey,
    traitKey: itemKey,
    clock,
    remainingUses,
    source: Object.freeze({
      occurrence: createOccurrenceAddress(seedOwner, createOccurrenceId('well')),
      generationKey: 'initial:healing' as const,
    }),
  });
}

function wellHolding(
  timedInstances: readonly ReturnType<typeof wellInstance>[],
): StygianWellRunState {
  return {
    sparkUses: 0,
    yarnUses: 0,
    hymnUses: 0,
    extendedUses: 0,
    timedInstances,
    directPurchases: {},
  };
}

/**
 * Each captured Run State holds the initial uses less the clock contacts it has
 * passed; a Hub departure capture precedes its own departure.
 */
function expectUsesAtSnapshots(
  result: ReturnType<typeof walkWithDepartureClocks>['result'],
  clock: 'encounters' | 'rooms',
  initialUses: number,
  contacts: readonly { readonly sequence: number }[],
) {
  const captures = [
    ...result.simulation.runStateSnapshots.map((snapshot) => ({ snapshot, passes: 1 })),
    ...result.simulation.hubDepartures.map((entry) => ({ snapshot: entry.departure, passes: 0 })),
  ];
  expect(captures.length).toBeGreaterThan(contacts.length);
  for (const { snapshot, passes } of captures) {
    const remaining =
      initialUses -
      contacts.filter((contact) => contact.sequence < snapshot.historySequence + passes).length;
    expect(
      snapshot.stygianWell.timedInstances.filter((instance) => instance.clock === clock),
      `${snapshot.historySequence}`,
    ).toEqual(remaining > 0 ? [expect.objectContaining({ remainingUses: remaining })] : []);
  }
}
