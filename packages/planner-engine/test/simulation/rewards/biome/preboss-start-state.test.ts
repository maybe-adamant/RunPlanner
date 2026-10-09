import { catalog } from '@run-planner/hades2-catalog';
import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNPartialHubProject } from '@run-planner/test-fixtures/surface';

import type { HistoryEvent } from '../../../../src/simulation/history';
import { fightKey, walkWithDepartureClocks } from '../../support/n-departure-clock-walk';

const centaurKey = 'MaxHealthPerRoom';

describe('Preboss start state capture', () => {
  it('captures the Hub-sourced Preboss after the Hub departure and before its own preparation', () => {
    const probe = walkWithDepartureClocks(0.8, undefined, [centaurKey]);
    const probeSequence =
      probe.result.simulation.prebossStartState!.states[0]!.reached.historyView.sequence;
    const departuresBefore = probe.departures.filter(
      (event) => event.sequence <= probeSequence,
    ).length;
    // Cleared at the first departure, then removed exactly at the last one before the Preboss.
    const { result, history, departures } = walkWithDepartureClocks(
      0.05 * (departuresBefore - 1) - 0.01,
      undefined,
      [centaurKey],
    );
    const capture = result.simulation.prebossStartState!;
    expect(capture.gameName).toBe('N_PreBoss01');
    const prepared = history.events.find(
      (event): event is Extract<HistoryEvent, { readonly kind: 'roomPrepared' }> =>
        event.kind === 'roomPrepared' &&
        semanticAddressKey(event.origin) === semanticAddressKey(capture.owner),
    )!;
    const [state] = capture.states;
    const sequence = state!.reached.historyView.sequence;
    expect(sequence).toBe(prepared.sequence - 1);
    // The deferred Hub departure follows the Handoff generation and precedes the Preboss.
    const received = history.events.find((event) => event.sequence === sequence)!;
    expect(received).toMatchObject({ kind: 'roomDeparted', origin: { kind: 'hubRoom' } });
    expect(
      history.events.some(
        (event) =>
          event.kind === 'roomCreated' &&
          event.gameName === capture.gameName &&
          event.sequence < sequence,
      ),
    ).toBe(true);

    // Every departure clock through the Hub departure has run.
    const decay = state!.traitHistory.events.filter(
      (event) =>
        (event.kind === 'roomDecayProgress' || event.kind === 'traitRemoval') &&
        event.acquisitionRole === 'roomDecay',
    );
    expect(decay.map((event) => event.sequence)).toEqual(
      departures.filter((event) => event.sequence <= sequence).map((event) => event.sequence),
    );
    expect(decay.at(-1)).toMatchObject({ kind: 'traitRemoval', sequence });
    expect(state!.traitHistory.equippedTraits[fightKey]).toBeUndefined();

    // The Preboss's own entry has not ticked The Centaur yet.
    const startsBefore = history.events.filter(
      (event) => event.kind === 'roomEntered' && event.sequence < prepared.sequence,
    ).length;
    expect(state!.arcanaFear.arcana.roomEntryGrowth?.[centaurKey]).toMatchObject({
      progress: startsBefore % 5,
      grants: Math.floor(startsBefore / 5),
    });
    const entered = result.simulation.runStateSnapshots.find(
      (snapshot) =>
        semanticAddressKey(snapshot.owner) ===
        semanticAddressKey(
          createRoomRunStateCheckpointAddress(capture.owner, { kind: 'roomEntered' }),
        ),
    )!;
    expect(entered.arcanaFear.arcana.roomEntryGrowth?.[centaurKey]).toMatchObject({
      progress: (startsBefore + 1) % 5,
    });
  });

  it('publishes no start state when coverage stops before the Preboss', () => {
    const assembly = simulateProjectAssembly(catalog, loadSurfaceNPartialHubProject());
    const n = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'N')!;
    expect('rewards' in n).toBe(true);
    expect('rewards' in n ? n.rewards.prebossStartState : undefined).toBeUndefined();
  });
});
