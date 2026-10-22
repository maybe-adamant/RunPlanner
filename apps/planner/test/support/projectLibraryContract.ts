import { describe, expect, it } from 'vitest';

import {
  EMPTY_LIBRARY_SESSION,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
} from '@planner/persistence/projectLibrary';

/** A stored plan's head: the fields the library reads, around opaque content. */
export function libraryPlanJson(projectId: string, name: string, routeKey = 'Surface'): string {
  return JSON.stringify({
    schemaVersion: 98,
    projectId,
    name,
    catalogVersion: 'catalog',
    route: {
      routeKey,
      loadout: { weaponKey: 'WeaponStaffSwing', aspectKey: 'BaseStaffAspect' },
      biomes: [{ biomeKey: 'N' }, { biomeKey: 'O' }],
    },
  });
}

function summaryOf(entry: ProjectLibraryEntry) {
  if (entry.content.status !== 'summarized') throw new Error(entry.content.message);
  return entry.content.summary;
}

/** What every library host must do, by its adapter alone. */
export function describeProjectLibraryContract(
  host: string,
  createAdapter: () => ProjectLibraryAdapter,
): void {
  describe(`${host} project library contract`, () => {
    it('files, lists, reads and replaces plans', async () => {
      const library = createAdapter();
      expect(await library.list()).toEqual({ folders: [], entries: [] });

      const created = await library.create(libraryPlanJson('plan-a', 'First'), '');
      expect(created.folder).toBe('');
      expect(summaryOf(created)).toEqual({
        schemaVersion: 98,
        schemaRevision: null,
        projectId: 'plan-a',
        name: 'First',
        routeKey: 'Surface',
        weaponKey: 'WeaponStaffSwing',
        aspectKey: 'BaseStaffAspect',
        biomeCount: 2,
      });
      expect(await library.read(created.key)).toBe(libraryPlanJson('plan-a', 'First'));

      const written = await library.write(
        created.key,
        libraryPlanJson('plan-a', 'Renamed', 'Underworld'),
      );
      expect(summaryOf(written)).toMatchObject({ name: 'Renamed', routeKey: 'Underworld' });
      expect(await library.read(written.key)).toBe(
        libraryPlanJson('plan-a', 'Renamed', 'Underworld'),
      );
      expect((await library.list()).entries.map((entry) => entry.key)).toEqual([written.key]);
    });

    it('files plans in folders, moves them, and renames and deletes folders', async () => {
      const library = createAdapter();
      await library.createFolder('Practice/Bosses');
      const boss = await library.create(libraryPlanJson('plan-a', 'Boss'), 'Practice/Bosses');
      const top = await library.create(libraryPlanJson('plan-b', 'Top'), '');
      expect(boss.folder).toBe('Practice/Bosses');
      expect((await library.list()).folders).toEqual(['Practice', 'Practice/Bosses']);

      const moved = await library.movePlan(top.key, 'Practice');
      expect(moved.folder).toBe('Practice');
      expect(await library.read(moved.key)).toBe(libraryPlanJson('plan-b', 'Top'));

      await library.moveFolder('Practice', 'Drills');
      const renamed = await library.list();
      expect(renamed.folders).toEqual(['Drills', 'Drills/Bosses']);
      expect(renamed.entries.map((entry) => entry.folder).sort()).toEqual([
        'Drills',
        'Drills/Bosses',
      ]);
      await expect(library.moveFolder('Drills', 'Drills/Bosses/Inner')).rejects.toThrow(
        /into itself/,
      );

      await library.deleteFolder('Drills/Bosses');
      const remaining = await library.list();
      expect(remaining.folders).toEqual(['Drills']);
      expect(remaining.entries.map((entry) => entry.folder)).toEqual(['Drills']);
    });

    it('refuses a plan without an identity or a name', async () => {
      const library = createAdapter();
      await expect(library.create('{"name":"x"}', '')).rejects.toThrow(/project identity/);
      await expect(library.create('{"projectId":"a","name":"  "}', '')).rejects.toThrow(/no name/);
      await expect(library.create('[1]', '')).rejects.toThrow(/Not a plan file/);
      expect(await library.list()).toEqual({ folders: [], entries: [] });
    });

    it('deletes a plan from the library', async () => {
      const library = createAdapter();
      const kept = await library.create(libraryPlanJson('plan-a', 'Kept'), '');
      const deleted = await library.create(libraryPlanJson('plan-b', 'Deleted'), '');

      await library.delete(deleted.key);
      expect((await library.list()).entries.map((entry) => entry.key)).toEqual([kept.key]);
      await expect(library.read(deleted.key)).rejects.toThrow();
      await expect(library.delete(deleted.key)).rejects.toThrow(/not in the library/);
    });

    it('remembers the library session', async () => {
      const library = createAdapter();
      expect(await library.readSession()).toEqual(EMPTY_LIBRARY_SESSION);
      const session = { previousFileOffered: true };
      await library.writeSession(session);
      expect(await createAdapter().readSession()).toEqual(session);
    });

    it('keeps plans across reopening', async () => {
      const first = createAdapter();
      const created = await first.create(libraryPlanJson('plan-a', 'Kept'), '');
      const reopened = createAdapter();
      expect((await reopened.list()).entries.map((entry) => entry.key)).toContain(created.key);
    });
  });
}
