import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../src/run-record';
import { projectFromRunRecord } from '../src/import';
import { fixture, occurrence, reward, expectReachesLastRoom } from './support/run-import';

describe('run import route support', () => {
  it('stops a Dream run whose visited biomes are no legal Dream itinerary', () => {
    // A Dream run never starts in N.
    const record = fixture('surface');
    const result = projectFromRunRecord(catalog, {
      ...record,
      route: { ...record.route, dream: true },
    });
    expect(result.kind === 'stopped' && result.stop).toEqual({
      area: 'dream',
      code: 'unsupportedRoute',
    });
    expect(result.report.entries).toEqual([{ area: 'dream', reason: 'stopped' }]);
  });

  it('stops before the first room when the recorded weapon and aspect are refused', () => {
    // The Hub weapon beside an installed aspect of another weapon: no default kit stands in.
    const record = fixture('underworld');
    const result = projectFromRunRecord(catalog, {
      ...record,
      loadout: { ...record.loadout, weapon: 'WeaponTorch' },
    });
    const route = { kind: 'route', routeKey: result.project.route.routeKey };
    expect(result.kind === 'stopped' && result.stop).toEqual({
      area: 'loadout',
      code: 'refused',
      address: route,
      record: { roomIndex: 0, visit: 0 },
    });
    expect(result.report.entries.filter((entry) => entry.area === 'loadout')).toEqual([
      {
        area: 'loadout',
        reason: 'refused',
        address: route,
        applied: {
          kind: 'ReplaceRouteLoadout',
          route,
          weaponKey: 'WeaponTorch',
          aspectKey: 'StaffClearCastAspect',
        },
      },
      { area: 'loadout', reason: 'stopped', address: route, record: { roomIndex: 0, visit: 0 } },
    ]);
    expect(new Set(result.report.rooms?.map((room) => room.verdict))).toEqual(
      new Set(['unchecked']),
    );
  });

  it("routes a profile's first attempt, whose run count is zero, to the Fresh File route", () => {
    const record = fixture('underworld');
    const result = projectFromRunRecord(catalog, {
      ...record,
      run: { ...record.run, runCount: 0 },
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms.slice(0, 3),
    });
    expect(result.project.route.routeKey).toBe('FreshFile');
    // The route fixes the whole loadout, so the record's weapon, keepsake and Arcana author nothing.
    expect(record.loadout.keepsake).toBeDefined();
    expect(result.report.entries.filter((entry) => entry.area === 'loadout')).toEqual([]);
    expect(result.project.route.loadout).toMatchObject({
      weaponKey: null,
      startingKeepsakeKey: null,
      manualArcanaKeys: [],
    });
  });

  it("routes the recorded fresh profile's first attempt to Fresh File, authoring no loadout", () => {
    const imported = projectFromRunRecord(catalog, fixture('fresh'));
    expect(imported.project.route.routeKey).toBe('FreshFile');
    expect(imported.report.entries.filter((entry) => entry.area === 'loadout')).toEqual([]);
  });

  // The opening's unspawned Boon roll leaves RunProgress one Boon short and
  // counts a RunProgress room, so F_Combat07's MetaProgress doors are accepted.
  it('imports the recorded fresh first attempt as the saves show it', () => {
    const imported = projectFromRunRecord(catalog, fixture('fresh'));
    expect(imported.report.rooms?.slice(0, 2).map((room) => room.verdict)).toEqual([
      'accepted',
      'accepted',
    ]);
    expectReachesLastRoom(imported);
  });

  it("buys nothing at the fresh attempt's untouched Shops and reaches Oceanus as the saves show it", () => {
    // Each Shop's boon is a god already picked up on this new file (Apollo at r7, Aphrodite at r17).
    const imported = projectFromRunRecord(catalog, fixture('fresh-oceanus'));
    expect(imported.report.rooms?.slice(0, 21).map((room) => room.verdict)).not.toContain(
      'mismatch',
    );
    expect(imported.report.rooms?.slice(0, 21).map((room) => room.verdict)).not.toContain(
      'unchecked',
    );
    // The run died in G_Combat17 before its Apollo boon was taken: the plan ends before it.
    expect(imported).toMatchObject({
      kind: 'complete',
      report: { end: { cause: 'death', record: { roomIndex: 20 } } },
    });
  });

  it('stops a run on a route the catalog does not declare', () => {
    const record = fixture('surface');
    const result = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['Z'], dream: false },
    });
    expect(result.kind).toBe('stopped');
    expect(result.report.entries).toEqual([{ area: 'route', reason: 'stopped' }]);
  });
});

describe('run import door assignment', () => {
  /** Erebus through its PostBoss, the Preboss's recorded Shop door renumbered below its other door. */
  function erebusWithLowShopDoor(): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      rooms: record.rooms.slice(0, 14).map((room, index) =>
        index === 10
          ? {
              ...room,
              doors: room.doors.map((door) =>
                door.reward?.type === 'Shop' ? { ...door, door: 560900 } : door,
              ),
            }
          : room,
      ),
    };
  }

  it("takes the twin door whose god the next room's reward names", () => {
    // F_Combat13's two doors both lead to F_Combat02; the Zeus door, listed second, was taken.
    const record = fixture('underworld-live');
    const rooms = record.rooms.slice(0, 14).map((room, index) =>
      index === 2
        ? {
            ...room,
            doors: [
              {
                door: 561217,
                room: 'F_Combat02',
                reward: { type: 'Boon', lootName: 'AresUpgrade' },
              },
              {
                door: 566353,
                room: 'F_Combat02',
                reward: { type: 'Boon', lootName: 'ZeusUpgrade' },
              },
            ],
          }
        : index === 3
          ? { ...room, reward: { type: 'Boon', lootName: 'ZeusUpgrade', store: 'RunProgress' } }
          : room,
    );
    const { exit: _exit, ...last } = rooms[13]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['F'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 13), last],
    });
    expect(reward(imported.project, 'F-r3').offer).toMatchObject({
      payload: { source: 'ZeusUpgrade' },
    });
    expect(reward(imported.project, 'F-r2-d561217').offer).toMatchObject({
      payload: { source: 'AresUpgrade' },
    });
  });

  it('maps the recorded Shop door to the takeover Shop target whatever its id', () => {
    const imported = projectFromRunRecord(catalog, erebusWithLowShopDoor());
    expect(imported.kind).toBe('complete');
    expect(occurrence(imported.project, 'F-r11').state.kind).toBe('shop');
    expect(reward(imported.project, 'F-r10-d560915').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });

  /**
   * Oceanus through its Preboss, G_MiniBoss01's doors swapped for two Anomaly
   * maps and the entered one returning to the Preboss.
   */
  function oceanusWithAnomalyDoors(collected: boolean): RunRecord {
    const record = fixture('underworld');
    const rooms = record.rooms.slice(0, 23).map((room, index) =>
      index === 20
        ? {
            ...room,
            doors: [
              { door: 558528, room: 'B_Combat05', reward: { type: 'MetaCurrencyBigDrop' } },
              { door: 568792, room: 'B_Combat06', reward: { type: 'MetaCardPointsCommonBigDrop' } },
            ],
            exit: 'B_Combat06',
          }
        : index === 21
          ? {
              ...room,
              name: 'B_Combat06',
              doors: [{ door: 569281, room: 'G_PreBoss01', reward: { type: 'Shop' } }],
              encounters: [{ name: 'GeneratedAnomalyB' }],
              uses: collected ? { MetaCardPointsCommonBigDrop: 1 } : { CapturePointSwitch: 1 },
              traits: { acquired: [], removed: [], upgraded: [] },
            }
          : room,
    );
    const { exit: _exit, ...last } = rooms[22]!;
    void _exit;
    return {
      ...record,
      route: { biomes: ['F', 'G'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 22), last],
    };
  }

  it('authors Anomaly doors as displaced G targets switched to their recorded maps', () => {
    const imported = projectFromRunRecord(catalog, oceanusWithAnomalyDoors(true));
    // The saves after the swapped doors are the original run's, so the entered map's next one differs.
    expect(imported).toMatchObject({
      kind: 'stopped',
      stop: { code: 'entryMismatch', record: { roomIndex: 21 } },
    });
    expect(imported.report.rooms?.[20]).toMatchObject({ verdict: 'accepted' });
    const entered = occurrence(imported.project, 'G-r21');
    expect(entered.gameName).toBe('B_Combat06');
    expect(entered.state).toMatchObject({ kind: 'anomaly', success: true });
    expect(occurrence(imported.project, 'G-r20-d558528').gameName).toBe('B_Combat05');
    expect(occurrence(imported.project, 'G-r22').gameName).toBe('G_PreBoss01');
    // The displaced G room is never created and leaves no trace, so it goes unreported.
    expect(
      imported.report.entries.filter(
        (entry) => entry.area === 'doors' && entry.record?.roomIndex === 20,
      ),
    ).toEqual([]);
  });

  it("fails the entered Anomaly's challenge when its reward was not picked up", () => {
    const imported = projectFromRunRecord(catalog, oceanusWithAnomalyDoors(false));
    expect(occurrence(imported.project, 'G-r21').state).toMatchObject({
      kind: 'anomaly',
      success: false,
    });
  });
});
