import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserRecordingPreference,
  createTauriRecordHost,
  readSaveFrame,
  type SaveFileDelivery,
} from '@planner/persistence/recordHost';

function frame(name: string, bytes: readonly number[]): ArrayBuffer {
  const encoded = new TextEncoder().encode(name);
  return Uint8Array.from([encoded.length & 255, encoded.length >> 8, ...encoded, ...bytes]).buffer;
}

describe('record host adapters', () => {
  it('invoke the fixed save watch and recent-runs commands', async () => {
    const invoke = vi.fn().mockResolvedValue(Uint8Array.of(1, 2).buffer);
    const channels: ((frame: ArrayBuffer) => void)[] = [];
    const host = createTauriRecordHost(invoke, (onMessage) => {
      channels.push(onMessage);
      return 'channel';
    });
    const delivered: SaveFileDelivery[] = [];
    const problems: string[] = [];
    await host.discoverFolder();
    await host.start(
      '/saves',
      (delivery) => delivered.push(delivery),
      (problem) => problems.push(problem),
    );
    expect(await host.readSave('Profile1.sav')).toEqual(Uint8Array.of(1, 2));
    await host.stop();
    await host.recentRuns.list();
    await host.recentRuns.read('p1-1-2');
    await host.recentRuns.write('p1-1-2', '{}');
    await host.recentRuns.delete('p1-1-2');
    expect(invoke.mock.calls).toEqual([
      ['record_save_folder_discover'],
      ['record_watch_start', { folder: '/saves', onSave: 'channel' }],
      ['record_save_read', { fileName: 'Profile1.sav' }],
      ['record_watch_stop'],
      ['recent_runs_list'],
      ['recent_runs_read', { id: 'p1-1-2' }],
      ['recent_runs_write', { id: 'p1-1-2', json: '{}' }],
      ['recent_runs_delete', { id: 'p1-1-2' }],
    ]);
    channels[0]!(frame('Profile1_Temp.sav', [0x53, 0x47]));
    channels[0]!(Uint8Array.of(9).buffer);
    expect(problems).toEqual(['save frame is too short']);
    expect(delivered).toEqual([
      { fileName: 'Profile1_Temp.sav', bytes: Uint8Array.of(0x53, 0x47) },
    ]);
  });

  it('read the home folder once, and none when it cannot be read', async () => {
    const readHome = vi.fn().mockResolvedValue('C:\\Users\\Melinoe');
    const host = createTauriRecordHost(vi.fn(), () => 'channel', vi.fn(), readHome);
    expect([await host.homeFolder(), await host.homeFolder()]).toEqual([
      'C:\\Users\\Melinoe',
      'C:\\Users\\Melinoe',
    ]);
    expect(readHome).toHaveBeenCalledTimes(1);
    const denied = createTauriRecordHost(
      vi.fn(),
      () => 'channel',
      vi.fn(),
      () => Promise.reject(new Error('not allowed')),
    );
    expect(await denied.homeFolder()).toBeNull();
  });

  it('invoke the raw-save commands, sending the bytes as the request body', async () => {
    const invoke = vi.fn().mockResolvedValue(Uint8Array.of(7).buffer);
    const host = createTauriRecordHost(invoke, () => 'channel');
    await host.rawSaves.folders();
    await host.rawSaves.list('open-p1');
    expect(await host.rawSaves.read('open-p1', '000-Profile1.sav')).toEqual(Uint8Array.of(7));
    await host.rawSaves.write('open-p1', '000-Profile1.sav', Uint8Array.of(1, 2));
    await host.rawSaves.move('open-p1', 'p1-1-2');
    await host.rawSaves.delete('p1-1-2');
    expect(invoke.mock.calls).toEqual([
      ['raw_saves_folders'],
      ['raw_saves_list', { folder: 'open-p1' }],
      ['raw_saves_read', { folder: 'open-p1', name: '000-Profile1.sav' }],
      [
        'raw_saves_write',
        Uint8Array.of(1, 2),
        { headers: { 'x-raw-folder': 'open-p1', 'x-raw-name': '000-Profile1.sav' } },
      ],
      ['raw_saves_move', { from: 'open-p1', to: 'p1-1-2' }],
      ['raw_saves_delete', { folder: 'p1-1-2' }],
    ]);
  });

  it('reject a cut save frame', () => {
    expect(() => readSaveFrame(Uint8Array.of(1).buffer)).toThrow('too short');
    expect(() => readSaveFrame(Uint8Array.of(9, 0, 65).buffer)).toThrow('cut short');
  });

  it('remember recording and its folder, in memory when storage is blocked', () => {
    const values = new Map<string, string>();
    const preference = createBrowserRecordingPreference(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    }));
    expect(preference.read()).toEqual({ enabled: false, folder: null });
    preference.write({ enabled: true, folder: 'D:/Saves' });
    expect(preference.read()).toEqual({ enabled: true, folder: 'D:/Saves' });
    const blocked = createBrowserRecordingPreference(() => {
      throw new Error('blocked');
    });
    blocked.write({ enabled: true, folder: null });
    expect(blocked.read()).toEqual({ enabled: true, folder: null });
  });
});
