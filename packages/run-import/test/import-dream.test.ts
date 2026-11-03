import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord } from '../src/import';
import { expectReachesLastRoom, fixture, occurrence } from './support/run-import';

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

  it("opens a bought blind box on the god whose screen the Shop's named boons leave", () => {
    // Q's Preboss sold two Hera boons, one Aphrodite boon and a blind box; four screens, two each.
    const imported = projectFromRunRecord(catalog, fixture('dream'));
    expect(imported.kind).toBe('complete');
    const shop = occurrence(imported.project, 'Q-r8');
    const box = shop.acquisitionSites?.['roomExit']?.pickupEntries?.['MixedProgress1'];
    expect(box?.offer.payload).toEqual({ kind: 'BoonSource', source: 'AphroditeUpgrade' });
    // The box opens after the Hera boons, on the later of the Aphrodite screens the purchase leaves.
    expect(shop.roomActions.order.map((action) => 'offerKey' in action && action.offerKey)).toEqual(
      ['MixedProgress2', 'LargeSurvival', 'PremiumProgress', 'MixedProgress1'],
    );
    // Each Dream PostBoss room is the route's postboss link after its biome's boss.
    expect(
      imported.project.route.biomes.flatMap((biome) =>
        (biome.topology?.occurrences ?? [])
          .filter((entry) => entry.gameName.startsWith('Dream_PostBoss'))
          .map((entry) => entry.gameName),
      ),
    ).toEqual(['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03']);
  });
});
