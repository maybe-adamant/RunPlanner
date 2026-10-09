import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { expect, vi } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

import { normalizeAuthoredChaosTraitOffer } from '../../../src/authored-project/traits/state';
import {
  activateTemporaryArcana,
  createArcanaFearState,
} from '../../../src/simulation/arcana-fear';
import type { HistoryEvent } from '../../../src/simulation/history';
import * as rewardChronology from '../../../src/simulation/rewards/biome/chronology';
import { initializeRewardBranches } from '../../../src/simulation/rewards/branch-lifecycle';
import { replaceSimulationTraitHistory } from '../../../src/simulation/state/transitions';
import { foldTraitHistoryEvents } from '../../../src/simulation/traits';
import type { StygianWellRunState } from '../../../src/simulation/commerce/stygian-well';

export const fightKey = 'DiminishingHealthAndManaBoon';
const enshroudedKey = 'ChaosHiddenRoomRewardCurse';
export const seedOwner = createBiomeAddress('Surface', 'N');

type ChronologyArguments = Parameters<typeof rewardChronology.evaluateBiomeRewardChronology>;

/** The exact N reward walk inputs from the fixture's own evaluation. */
export function observeNChronology(): ChronologyArguments {
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
export function walkWithDepartureClocks(
  fightFraction: number,
  stygianWell?: StygianWellRunState,
  arcanaKeys: readonly string[] = [],
  curseKey = enshroudedKey,
) {
  const [, snapshot, history, routePosition, routeLoadout, , placements, findings] =
    observeNChronology();
  const seededArcana = createArcanaFearState(catalog, routeLoadout);
  const activated =
    arcanaKeys.length === 0
      ? undefined
      : activateTemporaryArcana(catalog, seededArcana, arcanaKeys, {
          owner: seedOwner,
          sequence: 0,
        });
  if (activated !== undefined && !activated.legal) throw new Error('seed Arcana must activate');
  const [start] = initializeRewardBranches(
    undefined,
    activated?.state ?? seededArcana,
    catalog,
    routeLoadout.startingKeepsakeKey,
    routeLoadout.keepsakeEquipResults,
    snapshot.routeKey,
    routeLoadout,
    { routePosition, historyView: history.biomeStart },
  );
  const curse = catalog.chaos.curses.byKey[curseKey]!;
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
        curseOptions: [curseKey, 'ChaosCommonCurse', 'ChaosTimeCurse'].map((key) => ({
          curseKey: key,
          requirementCount:
            key === curseKey
              ? curse.duration.maximum
              : catalog.chaos.curses.byKey[key]!.duration.minimum,
        })) as never,
        selectedOptionKey: 'option1',
        selectedCurseValues: Object.freeze({}),
        blessingKey,
        // Barren pairs only with a Heroic blessing.
        rarity: curse.semanticTag === 'Barren' ? 'Heroic' : 'Common',
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
    { curseKey, remaining: curse.duration.maximum },
  ]);
  const traited = replaceSimulationTraitHistory(start!.state, traitHistory);
  const seeded = Object.freeze({
    ...start!,
    state: stygianWell === undefined ? traited : Object.freeze({ ...traited, stygianWell }),
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
  return { result, departures, restored, curse, history };
}
