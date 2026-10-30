import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord } from '../../../src/simulation';
import { fixture, occurrence, reward } from '../../support/run-import';

describe('run import route support', () => {
  it('stops a Dream run before authoring anything', () => {
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

  it("routes a profile's first attempt, whose run count is zero, to the Fresh File route", () => {
    const record = fixture('underworld');
    const result = projectFromRunRecord(catalog, {
      ...record,
      run: { ...record.run, runCount: 0 },
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms.slice(0, 3),
    });
    expect(result.project.route.routeKey).toBe('FreshFile');
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
});
