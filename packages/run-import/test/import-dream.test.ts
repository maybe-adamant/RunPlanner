import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord } from '../src/import';
import { expectReachesLastRoom, fixture } from './support/run-import';

describe('run import of a Dream run', () => {
  it('walks the visited biomes from the Dream prologue, filling the itinerary unconfigured', () => {
    // The capture's first biome through Q's MiniBoss, as an abandoned run leaves it.
    const record = fixture('dream');
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['Q'], dream: true },
      rooms: record.rooms.slice(0, 8),
    });
    expectReachesLastRoom(imported);
    const route = imported.project.route;
    expect(route.routeKey).toBe('Dream');
    expect(route.itineraryBiomeKeys).toHaveLength(4);
    expect(route.itineraryBiomeKeys[0]).toBe('Q');
    expect(route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q']);
    // The prologue holds no occurrence; the first biome opens with the run's starting reward.
    expect(imported.report.rooms![0]).toMatchObject({ verdict: 'accepted' });
    expect(imported.report.rooms!.slice(0, 7).map((room) => room.verdict)).toEqual(
      Array(7).fill('accepted'),
    );
    const topology = route.biomes[0]!.topology!;
    expect(
      topology.occurrences.find((entry) => entry.occurrenceId === topology.startOccurrenceId)
        ?.gameName,
    ).toBe('Q_Intro');
  });
});
