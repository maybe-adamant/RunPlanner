// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { decodeRunRecord } from '@run-planner/engine/run-record';
import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { RecentRunEntry } from '@planner/workspace/run-recording/recentRuns';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';
import { createMemoryRecordHost } from '@planner-test/support/memoryRecordHost';

const record = decodeRunRecord(
  JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../packages/planner-engine/test/run-record/fixtures/underworld.run-record.json',
      ),
      'utf8',
    ),
  ),
);

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const victory: RecentRunEntry = {
  entryVersion: 1,
  id: `p2-${NOW_SECONDS - 3_600}-1003`,
  profile: 2,
  runCount: 1003,
  attempt: 1,
  startedAt: NOW_SECONDS - 3_600,
  outcome: 'victory',
  route: { biomes: ['F', 'G', 'H', 'I'], dream: false, rooms: 42, endingRoom: 'I_Boss01' },
  record,
  project: encodeProjectDocument(createGoldenFGHProject()),
  report: {
    entries: [
      { area: 'doors', reason: 'assumption', record: { roomIndex: 2, visit: 1 } },
      { area: 'traitOffer', reason: 'notInRecord', record: { roomIndex: 1, visit: 1 } },
    ],
  },
  importKind: 'complete',
};

const reset: RecentRunEntry = {
  entryVersion: 1,
  id: `p2-${NOW_SECONDS - 7_200}-1002`,
  profile: 2,
  runCount: 1002,
  attempt: 2,
  startedAt: NOW_SECONDS - 7_200,
  outcome: 'reset',
  route: { biomes: ['F'], dream: false, rooms: 9, endingRoom: 'F_PreBoss01' },
  failure: 'room 3 has no entry save',
};

async function renderRecentRuns(options: { readonly startOnRuns?: boolean } = {}) {
  const host = createMemoryRecordHost();
  for (const entry of [victory, reset]) host.recentRuns.files.set(entry.id, JSON.stringify(entry));
  host.recentRuns.files.set(`p2-${NOW_SECONDS - 90_000}-990`, '{"entryVersion":7}');
  const library = createMemoryProjectLibrary();
  const application = createApplication({ projectLibrary: library.adapter, recordHost: host });
  await application.startupReady;
  await application.recording!.start();
  const rendered = renderPlannerForInteraction({ application, startWithProject: false });
  await screen.findByRole('region', { name: 'Library' });
  if (options.startOnRuns !== false)
    await rendered.user.click(
      within(screen.getByRole('navigation', { name: 'Home' })).getByRole('button', {
        name: 'Recent runs',
      }),
    );
  return { ...rendered, application, host, library };
}

const page = () => screen.getByRole('region', { name: 'Recent runs' });
const rowOf = (identity: string) => within(page()).getByText(identity).closest('tr')!;

describe('Recent runs screen', () => {
  afterEach(cleanup);

  it('is a Home tab with a header control only with a record host', async () => {
    const application = createApplication({ projectLibrary: createMemoryProjectLibrary().adapter });
    await application.startupReady;
    renderPlannerForInteraction({ application, startWithProject: false });
    await screen.findByRole('region', { name: 'Library' });
    expect(screen.queryByRole('button', { name: 'Recent runs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record runs' })).toBeNull();
  });

  it('lists recorded runs newest first, with a muted line for unreadable ones', async () => {
    await renderRecentRuns();
    const first = rowOf('Profile 2 · Run 1003 · Attempt 1');
    expect(within(first).getByText('Victory')).toBeTruthy();
    expect(within(first).getByText('Erebus › Oceanus › Fields › Tartarus')).toBeTruthy();
    expect(within(first).getByRole('button', { name: '2 guesses' })).toBeTruthy();
    const second = rowOf('Profile 2 · Run 1002 · Attempt 2');
    expect(within(second).getByText('Reset')).toBeTruthy();
    expect(within(second).getByText('Not imported')).toBeTruthy();
    expect(within(second).queryByRole('button', { name: /to library/ })).toBeNull();
    expect(within(page()).getByText('1 run can’t be read.')).toBeTruthy();
  });

  it('toggles recording from the header, whose status opens the tab from any Home tab', async () => {
    const { application, host, user } = await renderRecentRuns({ startOnRuns: false });
    const toggle = screen.getByRole('button', { name: 'Record runs' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Off' })).toBeTruthy();
    await user.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'));
    expect(host.watched()).toBe('/saves/Hades II');
    // The toggle only toggles; the status shows the tab.
    expect(application.store.getState().librarySession.view).toEqual({
      kind: 'home',
      tab: 'library',
    });
    await user.click(screen.getByRole('button', { name: 'Waiting for a run' }));
    expect(await screen.findByRole('region', { name: 'Recent runs' })).toBeTruthy();
    await user.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('false'));
    expect(host.watched()).toBeNull();
  });

  it('adds a run to the library named after it, then opens it from the row', async () => {
    const { application, library, user } = await renderRecentRuns();
    const row = rowOf('Profile 2 · Run 1003 · Attempt 1');
    await user.click(
      within(row).getByRole('button', {
        name: 'Add Profile 2 · Run 1003 · Attempt 1 to library',
      }),
    );
    expect(await within(row).findByText('In library')).toBeTruthy();
    expect((await library.plans(catalog)).map((plan) => plan.name)).toEqual([
      'Profile 2 · Run 1003 · Attempt 1 (Victory)',
    ]);
    await user.click(
      within(row).getByRole('button', { name: 'Open Profile 2 · Run 1003 · Attempt 1' }),
    );
    await waitFor(() =>
      expect(application.store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
  });

  it('expands a run guesses by area', async () => {
    const { user } = await renderRecentRuns();
    const guesses = within(rowOf('Profile 2 · Run 1003 · Attempt 1')).getByRole('button', {
      name: '2 guesses',
    });
    await user.click(guesses);
    expect(guesses.getAttribute('aria-expanded')).toBe('true');
    expect(await within(page()).findByText('Door order assumed in 1 room')).toBeTruthy();
    const offers = within(page()).getByRole('region', { name: 'Boon offers' });
    expect(within(offers).getByText('Guessed')).toBeTruthy();
    await user.click(guesses);
    expect(within(page()).queryByText('Door order assumed in 1 room')).toBeNull();
  });

  it('deletes a run and puts it back on Undo', async () => {
    const { host, user } = await renderRecentRuns();
    await user.click(
      within(rowOf('Profile 2 · Run 1002 · Attempt 2')).getByRole('button', {
        name: 'Delete Profile 2 · Run 1002 · Attempt 2',
      }),
    );
    const toast = await screen.findByRole('status');
    expect(within(toast).getByText('Deleted Profile 2 · Run 1002 · Attempt 2')).toBeTruthy();
    await waitFor(() =>
      expect(within(page()).queryByText('Profile 2 · Run 1002 · Attempt 2')).toBeNull(),
    );
    expect(host.recentRuns.files.has(reset.id)).toBe(false);
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await within(page()).findByText('Profile 2 · Run 1002 · Attempt 2')).toBeTruthy();
    expect(JSON.parse(host.recentRuns.files.get(reset.id)!)).toEqual(reset);
  });

  it('shows why recording stopped', async () => {
    const { host, user } = await renderRecentRuns();
    host.startFailure = 'No Hades II save folder was found.';
    await user.click(screen.getByRole('button', { name: 'Record runs' }));
    expect(await within(page()).findByRole('alert')).toHaveProperty(
      'textContent',
      'No Hades II save folder was found.',
    );
    expect(screen.getByRole('button', { name: 'Stopped' })).toBeTruthy();
  });
});
