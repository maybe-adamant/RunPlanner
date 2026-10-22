import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  ALL_PLANS,
  describeImportSummary,
  NO_SLOT_LINKS,
  projectLibraryChips,
  projectLibrarySlotLinks,
  projectLibraryView,
  slotProjectIds,
  type LibraryViewQuery,
} from '@planner/projections/libraryHome';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import { planSlot } from '@planner-test/fixtures/gameModuleHost';

const NOW = Date.UTC(2026, 9, 21, 12);

function ready(
  key: string,
  overrides: Partial<Extract<LibraryItem, { kind: 'ready' }>> = {},
): LibraryItem {
  return {
    kind: 'ready',
    key,
    folder: '',
    modifiedMs: NOW - 60_000,
    projectId: key,
    name: key,
    routeKey: 'Underworld',
    weaponKey: 'WeaponStaffSwing',
    aspectKey: 'BaseStaffAspect',
    biomeCount: 4,
    ...overrides,
  };
}

const query = (overrides: Partial<LibraryViewQuery> = {}): LibraryViewQuery => ({
  folder: '',
  filter: '',
  chip: ALL_PLANS,
  sort: 'edited',
  ...overrides,
});

describe('library slot links', () => {
  it('links slots to plans by identity, current only for the plan as it is now', () => {
    const present = { state: 'present', routeKey: 'Underworld' } as const;
    const slots = [
      planSlot(1, { ...present, projectId: 'a', planFingerprint: 'a-now' }),
      planSlot(2, { ...present, projectId: 'a', planFingerprint: 'a-before' }),
      planSlot(3, { ...present, state: 'stale', projectId: 'a', hasSource: true }),
      planSlot(4, { ...present, projectId: 'outside' }),
      planSlot(5, { ...present, projectId: 'b', planFingerprint: 'b' }),
    ];
    const items = [ready('a', { name: 'Plan A' }), ready('b')];
    expect([...slotProjectIds(slots)].sort()).toEqual(['a', 'b', 'outside']);

    const links = projectLibrarySlotLinks(items, slots, new Map([['a', 'a-now']]));
    expect(links.byKey.get('a')).toEqual([
      { slot: 1, marker: 'current', reason: null },
      { slot: 2, marker: 'older', reason: 'Plan edited since it was sent' },
      { slot: 3, marker: 'older', reason: 'Outdated for this module · rebuild to play' },
    ]);
    // A plan whose fingerprint is not read yet is linked without a marker.
    expect(links.byKey.get('b')).toEqual([{ slot: 5, marker: null, reason: null }]);
    expect(links.bySlot.get(1)?.name).toBe('Plan A');
    expect(links.bySlot.has(4)).toBe(false);
    // A plan that no longer compiles is older than any slot it was sent to.
    expect(
      projectLibrarySlotLinks(items, slots, new Map([['a', null]])).byKey.get('a')?.[0]?.marker,
    ).toBe('older');
  });
});

describe('library view', () => {
  const items: readonly LibraryItem[] = [
    ready('top', { name: 'Top run', modifiedMs: NOW - 2 * 86_400_000 }),
    ready('boss', {
      name: 'Boss practice',
      folder: 'Practice/Bosses',
      routeKey: 'Surface',
      biomeCount: 1,
    }),
    ready('fresh', { name: 'Fresh practice', folder: 'Practice', routeKey: 'FreshFile' }),
    {
      kind: 'tooNew',
      key: 'future',
      folder: '',
      modifiedMs: NOW,
      name: 'Future',
      schemaVersion: 120,
    },
    {
      kind: 'unreadable',
      key: 'Broken.runplanner.json',
      folder: '',
      modifiedMs: 0,
      message: 'Not a plan file.',
    },
  ];
  const listing = { items, folders: ['Practice', 'Practice/Bosses', 'Speedrun'] };

  it('shows a folder’s subfolders above its plans, with a breadcrumb', () => {
    const root = projectLibraryView(catalog, listing, NO_SLOT_LINKS, NOW, query());
    expect(root.searching).toBe(false);
    expect(root.breadcrumb).toEqual([{ path: '', name: 'Library' }]);
    expect(root.folders).toEqual([
      { path: 'Practice', name: 'Practice', planCount: 2 },
      { path: 'Speedrun', name: 'Speedrun', planCount: 0 },
    ]);
    expect(root.rows.map((row) => [row.name, row.kind])).toEqual([
      ['Future', 'unopenable'],
      ['Top run', 'ready'],
      ['Broken.runplanner.json', 'unopenable'],
    ]);
    expect(root.rows[0]).toMatchObject({
      reason: 'Made by a newer Run Planner (schema 120); update to open it.',
    });
    expect(root.rows[1]).toMatchObject({
      location: null,
      summary: `${catalog.routes.byKey.Underworld!.label} · ${catalog.weapons.byKey.WeaponStaffSwing!.label}, ${catalog.aspects.byKey.BaseStaffAspect!.label}`,
      biomes: { count: '4 of 4', trail: `to ${catalog.biomes.byKey.I!.label}` },
      edited: {
        text: new Date(NOW - 2 * 86_400_000).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        iso: new Date(NOW - 2 * 86_400_000).toISOString(),
      },
    });
    expect(root.rows[2]).toMatchObject({ reason: 'Not a plan file.' });
    expect(
      projectLibraryView(
        catalog,
        { items: [ready('recent')], folders: [] },
        NO_SLOT_LINKS,
        NOW,
        query(),
      ).rows[0]?.edited.text,
    ).toBe('1 min ago');

    const bosses = projectLibraryView(
      catalog,
      listing,
      NO_SLOT_LINKS,
      NOW,
      query({ folder: 'Practice/Bosses' }),
    );
    expect(bosses.breadcrumb).toEqual([
      { path: '', name: 'Library' },
      { path: 'Practice', name: 'Practice' },
      { path: 'Practice/Bosses', name: 'Bosses' },
    ]);
    expect(bosses.folders).toEqual([]);
    expect(bosses.rows).toMatchObject([
      { name: 'Boss practice', biomes: { count: '1 of 4', trail: catalog.biomes.byKey.N!.label } },
    ]);
  });

  it('searches the whole library by name and chip, naming each result’s folder', () => {
    const search = (overrides: Partial<LibraryViewQuery>) =>
      projectLibraryView(
        catalog,
        listing,
        NO_SLOT_LINKS,
        NOW,
        query({ folder: 'Practice', ...overrides }),
      );
    const byName = search({ filter: '  PRACTICE ' });
    expect(byName.searching).toBe(true);
    expect(byName.folders).toEqual([]);
    expect(byName.rows.map((row) => [row.name, row.location])).toEqual([
      ['Boss practice', 'Practice › Bosses'],
      ['Fresh practice', 'Practice'],
    ]);
    const fresh = search({ chip: { kind: 'route', routeKey: 'FreshFile' } });
    expect(fresh.rows.map((row) => row.name)).toEqual(['Fresh practice']);
    const underworld = search({ chip: { kind: 'route', routeKey: 'Underworld' } });
    expect(underworld.rows.map((row) => [row.name, row.location])).toEqual([
      ['Top run', 'Library'],
    ]);

    const links = projectLibrarySlotLinks(
      items,
      [planSlot(2, { state: 'present', projectId: 'boss', planFingerprint: 'x' })],
      null,
    );
    const inGame = projectLibraryView(
      catalog,
      listing,
      links,
      NOW,
      query({ chip: { kind: 'inGame' } }),
    );
    expect(inGame.rows).toMatchObject([
      { name: 'Boss practice', slots: [{ slot: 2, marker: null }] },
    ]);
  });

  it('sorts by last edit or by name', () => {
    const names = (sort: 'edited' | 'name') =>
      projectLibraryView(catalog, listing, NO_SLOT_LINKS, NOW, query({ sort })).rows.map(
        (row) => row.name,
      );
    expect(names('edited')).toEqual(['Future', 'Top run', 'Broken.runplanner.json']);
    expect(names('name')).toEqual(['Broken.runplanner.json', 'Future', 'Top run']);
  });

  it('offers one chip per route as the route chooser names it', () => {
    const routes = [
      { routeKey: 'Underworld', label: 'Underworld' },
      { routeKey: 'FreshFile', label: 'Fresh File' },
    ];
    expect(projectLibraryChips(routes).map((chip) => [chip.id, chip.label])).toEqual([
      ['all', 'All'],
      ['route:Underworld', 'Underworld'],
      ['route:FreshFile', 'Fresh File'],
      ['inGame', 'In game'],
    ]);
  });
});

describe('import summary', () => {
  const failed = (fileName: string) => ({ fileName, message: 'Not a plan file.' });

  it('names one import, counts several and lists each file that could not be read', () => {
    expect(describeImportSummary([], [])).toBeNull();
    expect(describeImportSummary(['Erebus opener'], [])).toEqual({
      text: 'Imported “Erebus opener”',
      lasting: false,
    });
    expect(describeImportSummary(['A', 'B', 'C', 'D'], [])).toEqual({
      text: 'Imported 4 plans',
      lasting: false,
    });
    expect(describeImportSummary(['A', 'B', 'C'], [failed('x.json')])).toEqual({
      text: 'Imported 3 · 1 couldn’t be read: x.json: Not a plan file.',
      lasting: true,
    });
    expect(describeImportSummary([], [failed('x.json')])).toEqual({
      text: 'Couldn’t read x.json: Not a plan file.',
      lasting: true,
    });
    expect(describeImportSummary([], [failed('x.json'), failed('y.json')])?.text).toBe(
      '2 couldn’t be read: x.json: Not a plan file.; y.json: Not a plan file.',
    );
  });
});
