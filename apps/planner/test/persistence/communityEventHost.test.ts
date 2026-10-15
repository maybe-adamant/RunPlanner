import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserEventDismissalPreference,
  createTauriCommunityEventDevelopmentHost,
  createTauriCommunityEventHost,
} from '@planner/persistence/communityEventHost';

describe('community event host adapters', () => {
  it('invoke the fixed feed and event slot commands', async () => {
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
    await host.refreshFeed(true, { oldest: 86, newest: 96 });
    await host.publishEvent('2026-w42-staff', '{"projectId":"p"}', summary);
    await host.clearEvent();
    await host.downloadProject('2026-w42-staff');
    expect(invoke.mock.calls).toEqual([
      ['event_feed_refresh', { retryFailed: true, projectSchemas: { oldest: 86, newest: 96 } }],
      ['game_event_publish', { eventId: '2026-w42-staff', planJson: '{"projectId":"p"}', summary }],
      ['game_event_clear'],
      ['event_project_download', { eventId: '2026-w42-staff' }],
    ]);
  });

  it('load a development event folder through the folder dialog', async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const host = createTauriCommunityEventDevelopmentHost({
      invoke,
      chooseEventFolder: () => Promise.resolve('/events/2026-w42-staff'),
    });
    expect(await host.pickEventFolder()).toBe('/events/2026-w42-staff');
    await host.loadEventFolder('/events/2026-w42-staff');
    await host.clearLocalEvent();
    expect(invoke.mock.calls).toEqual([
      ['game_event_folder_load', { path: '/events/2026-w42-staff' }],
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
