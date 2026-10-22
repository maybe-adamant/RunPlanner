import { describe, expect, it, vi } from 'vitest';

import { createTauriProjectLibraryAdapter } from '@planner/persistence/tauriProjectLibraryAdapter';

function createAdapter(path: string | null = null) {
  const invoke = vi.fn(() => Promise.resolve(null));
  const readTextFile = vi.fn(() => Promise.resolve('{"plan":true}'));
  const openDialog = vi.fn(() => Promise.resolve(path));
  const library = createTauriProjectLibraryAdapter({
    invoke: invoke as never,
    openDialog,
    readTextFile,
  });
  return { invoke, library, openDialog, readTextFile };
}

describe('Tauri project library adapter', () => {
  it('addresses each library operation to its host command', async () => {
    const { invoke, library } = createAdapter();
    const session = { lastOpened: null, previousFileOffered: true };

    await library.list();
    await library.read('a.runplanner.json');
    await library.create('{"c":1}');
    await library.write('a.runplanner.json', '{"w":1}');
    await library.delete('a.runplanner.json');
    await library.preserveOriginal('a.runplanner.json');
    await library.reveal();
    await library.previousActiveFile();
    await library.readSession();
    await library.writeSession(session);

    expect(library.supportsReveal).toBe(true);
    expect(invoke.mock.calls).toEqual([
      ['project_library_list'],
      ['project_library_read', { key: 'a.runplanner.json' }],
      ['project_library_create', { json: '{"c":1}' }],
      ['project_library_write', { key: 'a.runplanner.json', json: '{"w":1}' }],
      ['project_library_delete', { key: 'a.runplanner.json' }],
      ['project_library_preserve_original', { key: 'a.runplanner.json' }],
      ['project_library_reveal'],
      ['project_library_previous_active'],
      ['project_library_session_read'],
      ['project_library_session_write', { session }],
    ]);
  });

  it('reads a file chosen in the native dialog by its file name', async () => {
    const chosen = createAdapter('C:\\Plans\\Surface run.runplanner.json');
    await expect(chosen.library.chooseImportFile()).resolves.toEqual({
      fileName: 'Surface run.runplanner.json',
      json: '{"plan":true}',
    });
    expect(chosen.readTextFile).toHaveBeenCalledWith('C:\\Plans\\Surface run.runplanner.json');

    const cancelled = createAdapter(null);
    await expect(cancelled.library.chooseImportFile()).resolves.toBeNull();
    expect(cancelled.readTextFile).not.toHaveBeenCalled();
  });
});
