import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress, semanticAddressKey } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

import { normalizeAuthoredChaosTraitOffer } from '../../../../src/authored-project/traits/state';
import { createArcanaFearState } from '../../../../src/simulation/arcana-fear';
import type { HistoryEvent } from '../../../../src/simulation/history';
import * as rewardChronology from '../../../../src/simulation/rewards/biome/chronology';
import { initializeRewardBranches } from '../../../../src/simulation/rewards/branch-lifecycle';
import { hubDepartureTraitInventory } from '../../../../src/simulation/rewards/run-state-conformance';
import { replaceSimulationTraitHistory } from '../../../../src/simulation/state/transitions';
import { foldTraitHistoryEvents } from '../../../../src/simulation/traits';

const fightKey = 'DiminishingHealthAndManaBoon';
const enshroudedKey = 'ChaosHiddenRoomRewardCurse';
const seedOwner = createBiomeAddress('Surface', 'N');

type ChronologyArguments = Parameters<typeof rewardChronology.evaluateBiomeRewardChronology>;

/** The exact N reward walk inputs from the fixture's own evaluation. */
function observeNChronology(): ChronologyArguments {
  const observer = vi.spyOn(rewardChronology, 'evaluateBiomeRewardChronology');
  try {
    simulateProjectAssembly(catalog, loadSurfaceNProject());
    const call = observer.mock.calls.find(([, snapshot]) => snapshot.biomeKey === 'N');
    if (call === undefined) throw new Error('N reward walk was not evaluated');
    return call;
  } finally {
    observer.mockRestore();
  }
}

/**
 * Replays the N walk from a start holding Fight Fight Fight and a room-clocked curse.
 * The seed is a walk-level clock injection; neither is authorable before the N Hub.
 */
function walkWithDepartureClocks(fightFraction: number) {
  const [, snapshot, history, routePosition, routeLoadout, , placements, findings] =
    observeNChronology();
  const [start] = initializeRewardBranches(
    undefined,
    createArcanaFearState(catalog, routeLoadout),
    catalog,
    routeLoadout.startingKeepsakeKey,
    routeLoadout.keepsakeEquipResults,
    snapshot.routeKey,
    routeLoadout,
    { routePosition, historyView: history.biomeStart },
  );
  const curse = catalog.chaos.curses.byKey[enshroudedKey]!;
  const blessingKey = 'ChaosElementalBlessing';
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...start!.state.traitHistory.events,
    Object.freeze({
      kind: 'traitOffer' as const,
      owner: seedOwner,
      acquisitionRole: 'self',
      sequence: 0,
      giverKey: 'Echo',
      options: Object.freeze([
        { traitKey: fightKey },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ]) as never,
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'encounterCompleted',
      acquisitionIdentity: 'fight:seed',
      roomDecayStartFraction: fightFraction,
    }),
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: seedOwner,
      acquisitionRole: 'self',
      sequence: 0,
      acquisitionPoint: 'reward',
      acquisitionIdentity: 'chaos:seed',
      offer: normalizeAuthoredChaosTraitOffer(catalog, {
        kind: 'chaos',
        giverKey: 'Chaos',
        curseOptions: [enshroudedKey, 'ChaosCommonCurse', 'ChaosTimeCurse'].map((curseKey) => ({
          curseKey,
          requirementCount:
            curseKey === enshroudedKey
              ? curse.duration.maximum
              : catalog.chaos.curses.byKey[curseKey]!.duration.minimum,
        })) as never,
        selectedOptionKey: 'option1',
        selectedCurseValues: Object.freeze({}),
        blessingKey,
        rarity: 'Common',
        blessingValues: Object.freeze(
          Object.fromEntries(
            catalog.chaos.blessings.byKey[blessingKey]!.operands.map((operand) => [
              operand.key,
              operand.minimum,
            ]),
          ),
        ),
      }),
    }),
  ]);
  expect(traitHistory.equippedTraits[fightKey]?.roomDecay).toEqual({
    fraction: fightFraction,
    blocked: true,
  });
  expect(traitHistory.activeChaosCurses).toMatchObject([
    { curseKey: enshroudedKey, remaining: curse.duration.maximum },
  ]);
  const seeded = Object.freeze({
    ...start!,
    state: replaceSimulationTraitHistory(start!.state, traitHistory),
  });
  const result = rewardChronology.evaluateBiomeRewardChronology(
    catalog,
    snapshot,
    history,
    routePosition,
    routeLoadout,
    [seeded],
    placements,
    findings,
  );
  expect(result.simulation.branches.length).toBeGreaterThan(0);
  const departures = history.events.filter(
    (event): event is Extract<HistoryEvent, { readonly kind: 'roomDeparted' }> =>
      event.kind === 'roomDeparted',
  );
  const restored = new Set(
    departures
      .filter(
        (event) =>
          history.events[event.sequence - history.events[0]!.sequence - 1]?.kind !== 'roomExited',
      )
      .map((event) => event.sequence),
  );
  return { result, departures, restored, curse };
}

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
});
