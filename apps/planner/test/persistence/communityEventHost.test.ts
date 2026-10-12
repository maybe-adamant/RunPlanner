import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserEventDismissalPreference,
  createTauriCommunityEventDevelopmentHost,
  createTauriCommunityEventHost,
} from '@planner/persistence/communityEventHost';

describe('community event host adapters', () => {
  it('invoke the fixed feed and event slot commands, naming events only by id', async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const host = createTauriCommunityEventHost(invoke);
    const summary = {
      label: 'Circe - Surface',
      sentAt: '2026-10-12T10:00:00.000Z',
      aspect: 'Circe (Staff)',
      route: 'Surface',
      endBiome: 'Olympus',
      startingFear: 0,
    };
    await host.refreshFeed(true);
    await host.publishEvent('2026-w42-staff', 'print', summary);
    await host.clearEvent();
    await host.downloadProject('2026-w42-staff');
    expect(invoke.mock.calls).toEqual([
      ['event_feed_refresh', { retryFailed: true }],
      ['game_event_publish', { eventId: '2026-w42-staff', planFingerprint: 'print', summary }],
      ['game_event_clear'],
      ['event_project_download', { eventId: '2026-w42-staff' }],
    ]);
  });

  it('load and save development event files through the dialogs', async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const chooseSavePath = vi
      .fn<(name: string) => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/events/e.event.json');
    const writeTextFile = vi.fn(() => Promise.resolve());
    const host = createTauriCommunityEventDevelopmentHost({
      invoke,
      chooseEventFile: () => Promise.resolve('/events/e.json'),
      chooseSavePath,
      writeTextFile,
    });
    expect(await host.pickEventFile()).toBe('/events/e.json');
    await host.loadEventFile('/events/e.json');
    await host.clearLocalEvent();
    expect(await host.saveEventFile('e.event.json', '{}')).toBe(false);
    expect(await host.saveEventFile('e.event.json', '{}')).toBe(true);
    expect(chooseSavePath).toHaveBeenCalledWith('e.event.json');
    expect(writeTextFile).toHaveBeenCalledWith('/events/e.event.json', '{}');
    expect(invoke.mock.calls).toEqual([
      ['game_event_file_load', { path: '/events/e.json' }],
      ['game_event_local_clear'],
    ]);
  });

  it('remember dismissed events, in memory when storage is blocked', () => {
    const values = new Map<string, string>();
    const preference = createBrowserEventDismissalPreference(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    }));
    expect(preference.isDismissed('a')).toBe(false);
    preference.dismiss('a');
    expect(preference.isDismissed('a')).toBe(true);
    expect(JSON.parse(values.get('run-planner.dismissed-events')!)).toEqual(['a']);
    const blocked = createBrowserEventDismissalPreference(() => {
      throw new Error('blocked');
    });
    blocked.dismiss('b');
    expect(blocked.isDismissed('b')).toBe(true);
  });
});
