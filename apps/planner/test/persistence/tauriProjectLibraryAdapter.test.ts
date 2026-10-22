import { describe, expect, it, vi } from 'vitest';

import { createTauriProjectLibraryAdapter } from '@planner/persistence/tauriProjectLibraryAdapter';

describe('Tauri project library adapter', () => {
  it('addresses each library operation to its host command', async () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    const chosen = { fileName: 'outside.runplanner.json', json: '{}' };
    const library = createTauriProjectLibraryAdapter({
      chooseFile: () => Promise.resolve(chosen),
      invoke: invoke as never,
    });

    await library.list();
    await library.read('a.runplanner.json');
    await library.create('{"c":1}');
    await library.write('a.runplanner.json', '{"w":1}');
    await library.delete('a.runplanner.json');
    await library.restore('a.runplanner.json');
    await library.reveal();
    await library.previousActiveFile();

    expect(library.supportsReveal).toBe(true);
    expect(invoke.mock.calls).toEqual([
      ['project_library_list'],
      ['project_library_read', { key: 'a.runplanner.json' }],
      ['project_library_create', { json: '{"c":1}' }],
      ['project_library_write', { key: 'a.runplanner.json', json: '{"w":1}' }],
      ['project_library_delete', { key: 'a.runplanner.json' }],
      ['project_library_restore', { key: 'a.runplanner.json' }],
      ['project_library_reveal'],
      ['project_library_previous_active'],
    ]);
    await expect(library.chooseImportFile()).resolves.toBe(chosen);
  });
});
