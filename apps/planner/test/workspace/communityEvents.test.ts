import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import {
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '@run-planner/engine/authored-project';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  ActiveCommunityEvent,
  EventFeedSnapshot,
} from '@planner/persistence/communityEventHost';
import { selectProfileStatus } from '@planner/state/store';
import { compileEventProject } from '@planner/workspace/eventDocument';
import {
  UNAVAILABLE_EVENT_PROJECT,
  UNSUPPORTED_EVENT_SCHEMA,
} from '@planner/workspace/communityEvents';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import {
  activeEvent,
  activeEventWith,
  clearing,
  createFakeCommunityEventDevelopmentHost,
  createFakeCommunityEventHost,
} from '@planner-test/fixtures/communityEventHost';

vi.mock('@planner/workspace/eventDocument', async (importOriginal) => {
  const original = await importOriginal<typeof import('@planner/workspace/eventDocument')>();
  return { ...original, compileEventProject: vi.fn(original.compileEventProject) };
});

function setup(options: { readonly devBuild?: boolean } = {}) {
  const game = createFakeGameModuleHost();
  const events = createFakeCommunityEventHost();
  const development = createFakeCommunityEventDevelopmentHost();
  const dismissed: string[] = [];
  const application = createApplication({
    communityEventDevelopmentHost: development,
    communityEventHost: events,
    devBuild: options.devBuild ?? true,
    eventDismissals: {
      isDismissed: (id) => dismissed.includes(id),
      dismiss: (id) => void dismissed.push(id),
    },
    gameModuleHost: game.host,
    mintProjectId: () => 'event-copy',
  });
  const controller = application.communityEvents!;
  return { application, controller, development, dismissed, events, game };
}

const projectJson = encodeProjectDocument(createGoldenFGHProject());
const SCHEMAS = {
  oldest: 86,
  newest: PROJECT_DOCUMENT_SCHEMA_VERSION,
  newestRevision: PROJECT_DOCUMENT_SCHEMA_REVISION,
};
const feedWith = (
  active: ActiveCommunityEvent | null,
  source: EventFeedSnapshot['source'] = 'network',
): EventFeedSnapshot => ({ active, source, problem: null });

describe('community event controller', () => {
  it('exists with a game host, and offers folder actions only in development builds', () => {
    expect(setup().controller.development).toBeDefined();
    expect(setup({ devBuild: false }).controller.development).toBeUndefined();
    expect(createApplication({ devBuild: true }).communityEvents).toBeUndefined();
  });

  it('compiles the verified project with the event title and writes it to the event slot', async () => {
    const { controller, dismissed, events, game } = setup();
    const active = activeEvent(projectJson);
    events.refreshFeed.mockResolvedValue(feedWith(active));

    await controller.sync();

    expect(events.refreshFeed).toHaveBeenCalledWith(false, SCHEMAS);
    expect(events.publishEvent).toHaveBeenCalledTimes(1);
    const [eventId, planJson, summary] = events.publishEvent.mock.calls[0]!;
    expect(eventId).toBe('2026-w42-staff');
    expect(planJson).toBe(compileEventProject(catalog, projectJson, 'Week 42: Staff sprint'));
    const plan = decodeExecutionPlan(JSON.parse(planJson));
    expect(plan.projectId).toBe(createGoldenFGHProject().projectId);
    expect(plan.displayName).toBe('Week 42: Staff sprint');
    // The summary describes the plan the host is asked to write.
    expect(summary).toMatchObject({ route: 'Underworld', planName: 'Week 42: Staff sprint' });
    expect(events.clearEvent).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      kind: 'active',
      event: active.event,
      problem: null,
    });
    await vi.waitFor(() => expect(game.host.status).toHaveBeenCalled());

    controller.dismiss();
    expect(dismissed).toEqual(['2026-w42-staff']);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });
    // A dismissed event is still written, but not announced again.
    await controller.sync('panel');
    expect(events.publishEvent).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });
  });

  it('compiles an event once and again when its project or title changes', async () => {
    const { controller, events } = setup();
    const compile = vi.mocked(compileEventProject);
    compile.mockClear();
    events.refreshFeed.mockResolvedValue(feedWith(activeEvent(projectJson)));
    await controller.sync();
    await controller.sync('panel');
    expect(compile).toHaveBeenCalledTimes(1);
    expect(events.publishEvent.mock.calls[1]![1]).toBe(events.publishEvent.mock.calls[0]![1]);

    const republished = activeEvent(projectJson, { projectSha256: 'b'.repeat(64) });
    events.refreshFeed.mockResolvedValue(feedWith(republished));
    await controller.sync('panel');
    expect(compile).toHaveBeenCalledTimes(2);
    // The title names the plan, so a renamed event compiles again.
    const renamed = activeEvent(projectJson, { projectSha256: 'b'.repeat(64), title: 'Renamed' });
    events.refreshFeed.mockResolvedValue(feedWith(renamed));
    await controller.sync('panel');
    expect(compile).toHaveBeenCalledTimes(3);
    expect(decodeExecutionPlan(JSON.parse(events.publishEvent.mock.calls[3]![1])).displayName).toBe(
      'Renamed',
    );
  });

  it('writes nothing when the project cannot be compiled, and says so', async () => {
    const { controller, events } = setup();
    const broken = activeEvent('{"schemaVersion":96}');
    events.refreshFeed.mockResolvedValue(feedWith(broken));
    await controller.sync();
    expect(events.publishEvent).not.toHaveBeenCalled();
    // The host keeps the event slot only while it holds this event's plan.
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    const notice = controller.getSnapshot();
    expect(notice).toMatchObject({ kind: 'active', event: broken.event });
    expect(notice.kind === 'active' && notice.problem).toMatch(
      /^This event’s plan could not be built: /,
    );
    // A failed republish of the same event keeps its earlier plan and still says why.
    events.clearEvent.mockResolvedValueOnce(
      clearing({ status: 'kept', message: 'The event slot holds the active event.' }),
    );
    const republished = activeEvent('{"schemaVersion":96}', { projectSha256: 'c'.repeat(64) });
    events.refreshFeed.mockResolvedValue(feedWith(republished));
    await controller.sync('panel');
    expect(controller.getSnapshot()).toMatchObject({ kind: 'active', problem: expect.any(String) });
  });

  it('asks for a planner update when the event’s project schema is not loadable', async () => {
    const { controller, events } = setup();
    const newer = activeEventWith(
      { kind: 'unsupportedSchema' },
      { projectSchemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION + 1 },
    );
    events.refreshFeed.mockResolvedValue(feedWith(newer));
    await controller.sync();
    expect(events.publishEvent).not.toHaveBeenCalled();
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      kind: 'active',
      event: newer.event,
      problem: UNSUPPORTED_EVENT_SCHEMA,
    });
    expect(UNSUPPORTED_EVENT_SCHEMA).toBe('Update the planner to play this event.');
  });

  it('keeps the event’s own plan while its project is unavailable, and writes it once it is', async () => {
    const { controller, events } = setup();
    const offline = activeEventWith({ kind: 'unavailable', problem: 'offline' });
    events.refreshFeed.mockResolvedValue(feedWith(offline, 'cache'));
    events.clearEvent.mockResolvedValueOnce(
      clearing({ status: 'kept', message: 'The event slot holds the active event.' }),
    );
    await controller.sync();
    expect(events.publishEvent).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      kind: 'active',
      event: offline.event,
      problem: null,
    });
    // Without its plan in the event slot, the notice says why and offers no Set as active.
    await controller.sync('panel');
    expect(controller.getSnapshot()).toEqual({
      kind: 'active',
      event: offline.event,
      problem: UNAVAILABLE_EVENT_PROJECT,
    });
    events.refreshFeed.mockResolvedValue(feedWith(activeEvent(projectJson)));
    await controller.sync('panel');
    expect(events.publishEvent).toHaveBeenCalledTimes(1);
  });

  it('clears the previous event’s plan when the next event cannot be played', async () => {
    const { controller, events, game } = setup();
    const previous = {
      id: '2026-w42-staff',
      title: 'Week 42: Staff sprint',
      endsAt: '2026-10-19T00:00:00Z',
    };
    for (const project of [
      { kind: 'unsupportedSchema' } as const,
      { kind: 'unavailable', problem: 'offline' } as const,
      { kind: 'verified', json: '{"schemaVersion":96}' } as const,
    ]) {
      events.refreshFeed.mockResolvedValueOnce(
        feedWith(activeEventWith(project, { id: '2026-w43-next', title: 'Week 43' })),
      );
      events.clearEvent.mockResolvedValueOnce(
        clearing({ status: 'cleared', clearedEvent: previous, activeSlotMoved: true }),
      );
      game.host.status.mockClear();
      await controller.sync('panel');
      expect(controller.getSnapshot()).toEqual({
        kind: 'ended',
        title: 'Week 42: Staff sprint',
        fallbackSlotHasPlan: true,
      });
      await vi.waitFor(() => expect(game.host.status).toHaveBeenCalled());
    }
    expect(events.clearEvent).toHaveBeenCalledTimes(3);
    expect(events.publishEvent).not.toHaveBeenCalled();
  });

  it('clears the event slot without an active event and says when slot 1 took over', async () => {
    const { controller, events } = setup();
    const active = activeEvent(projectJson);
    events.refreshFeed.mockResolvedValueOnce(feedWith(active));
    await controller.sync();
    expect(controller.getSnapshot().kind).toBe('active');

    // The event left the feed while the event slot was not active: the notice just goes.
    await controller.sync('panel');
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });

    events.clearEvent.mockResolvedValueOnce(
      clearing({
        status: 'cleared',
        clearedEvent: {
          id: active.event.id,
          title: active.event.title,
          endsAt: active.event.endsAt,
        },
        activeSlotMoved: true,
      }),
    );
    await controller.sync('panel');
    expect(controller.getSnapshot()).toEqual({
      kind: 'ended',
      title: 'Week 42: Staff sprint',
      fallbackSlotHasPlan: true,
    });
    controller.dismiss();
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });
  });

  it('keeps the notice when the feed or a slot write fails', async () => {
    const { controller, events } = setup();
    const active = activeEvent(projectJson);
    events.refreshFeed.mockResolvedValue(feedWith(active));
    await controller.sync();
    const announced = controller.getSnapshot();
    expect(announced).toEqual({ kind: 'active', event: active.event, problem: null });

    events.refreshFeed.mockRejectedValueOnce(new Error('offline'));
    await expect(controller.sync('panel')).resolves.toBeUndefined();
    expect(controller.getSnapshot()).toBe(announced);

    events.publishEvent.mockRejectedValueOnce(new Error('could not replace plan slot'));
    await expect(controller.sync('panel')).resolves.toBeUndefined();
    expect(controller.getSnapshot()).toBe(announced);
    expect(events.clearEvent).not.toHaveBeenCalled();
  });

  it('leaves the event slot to the host when no verified feed was read', async () => {
    const { controller, events } = setup();
    const active = activeEvent(projectJson);
    events.refreshFeed.mockResolvedValueOnce({ active, source: 'cache', problem: 'offline' });
    await controller.sync();
    // Offline with nothing verified: the host keeps the event slot until its own end.
    events.refreshFeed.mockResolvedValueOnce({ active: null, source: 'none', problem: 'offline' });
    events.clearEvent.mockResolvedValueOnce(
      clearing({ status: 'kept', message: 'The event slot is kept until its event ends.' }),
    );
    await controller.sync('panel');
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      kind: 'active',
      event: active.event,
      problem: null,
    });
  });

  it('runs a Game panel retry after a background read instead of sharing it', async () => {
    const { controller, events } = setup();
    let finish: (() => void) | undefined;
    events.refreshFeed.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ active: null, source: 'none', problem: 'offline' });
        }),
    );
    const background = controller.sync();
    const repeated = controller.sync();
    const panel = controller.sync('panel');
    await vi.waitFor(() => expect(finish).toBeDefined());
    finish?.();
    await Promise.all([background, repeated, panel]);
    expect(events.refreshFeed.mock.calls).toEqual([
      [false, SCHEMAS],
      [true, SCHEMAS],
    ]);
  });

  it('opens the active event’s project as an unsaved copy with its own identity', async () => {
    const { application, controller, events } = setup();
    events.refreshFeed.mockResolvedValue(feedWith(activeEvent(projectJson)));
    const project = createGoldenFGHProject();
    events.downloadProject.mockResolvedValue(encodeProjectDocument(project));

    await expect(controller.openProject()).resolves.toMatchObject({
      operation: 'openCopy',
      status: 'failure',
      message: 'No event is active.',
    });
    await controller.sync();
    await expect(controller.openProject()).resolves.toMatchObject({ status: 'success' });
    expect(events.downloadProject).toHaveBeenCalledWith('2026-w42-staff');
    const workspace = application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('Expected an open project');
    expect(workspace.history.present.projectId).toBe('event-copy');
    expect(project.projectId).not.toBe('event-copy');
    expect(selectProfileStatus(application.store.getState())).toBe('Unsaved');
    expect(application.store.getState().profileSession.fileName).toBeNull();

    events.downloadProject.mockResolvedValueOnce('not a project');
    await expect(controller.openProject()).resolves.toMatchObject({ status: 'failure' });
  });

  it('imports a local event folder in place of the feed’s event and clears it again', async () => {
    const { controller, development, events } = setup();
    await expect(controller.development!.importEventFolder()).resolves.toEqual({
      kind: 'cancelled',
    });
    // An import never reports a read that started before it.
    let finish: (() => void) | undefined;
    events.refreshFeed.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(feedWith(null));
        }),
    );
    const background = controller.sync();
    const local = activeEvent(projectJson, { id: 'local-test' });
    development.pickEventFolder.mockResolvedValue('/events/local-test');
    development.loadEventFolder.mockResolvedValue(local.event);
    events.refreshFeed.mockResolvedValue(feedWith(local));
    const imported = controller.development!.importEventFolder();
    await vi.waitFor(() => expect(development.loadEventFolder).toHaveBeenCalled());
    finish?.();
    await background;
    await expect(imported).resolves.toEqual({
      kind: 'done',
      message: 'The event slot now holds Week 42: Staff sprint.',
    });
    expect(events.refreshFeed).toHaveBeenCalledTimes(2);
    expect(development.loadEventFolder).toHaveBeenCalledWith('/events/local-test');
    expect(events.publishEvent.mock.calls[0]![0]).toBe('local-test');

    events.refreshFeed.mockResolvedValue(feedWith(null));
    await expect(controller.development!.clearEvent()).resolves.toEqual({
      kind: 'done',
      message: 'The event slot is empty.',
    });
    expect(development.clearLocalEvent).toHaveBeenCalledTimes(1);

    events.publishEvent.mockResolvedValueOnce({
      status: 'blocked',
      message: 'The game target is not ready for publication.',
      blockers: [],
      activationProblem: null,
    });
    events.refreshFeed.mockResolvedValue(feedWith(local));
    await expect(controller.development!.importEventFolder()).resolves.toEqual({
      kind: 'failed',
      message: 'The game target is not ready for publication.',
    });

    // A folder whose project this planner cannot load is refused with the same notice.
    events.refreshFeed.mockResolvedValue(
      feedWith(activeEventWith({ kind: 'unsupportedSchema' }, { id: 'local-test' })),
    );
    await expect(controller.development!.importEventFolder()).resolves.toEqual({
      kind: 'failed',
      message: UNSUPPORTED_EVENT_SCHEMA,
    });
    development.loadEventFolder.mockRejectedValueOnce(new Error('Invalid event.json'));
    await expect(controller.development!.importEventFolder()).resolves.toEqual({
      kind: 'failed',
      message: 'Invalid event.json',
    });
  });

  it('plays the event through the game host’s active slot write, then re-reads the status', async () => {
    const { controller, game } = setup();
    game.host.status.mockClear();
    expect(await controller.playEvent()).toBeNull();
    expect(game.host.setActiveSlot).toHaveBeenCalledWith(0);
    expect(game.host.status).toHaveBeenCalledTimes(1);
    game.host.setActiveSlot.mockResolvedValueOnce({
      status: 'notPresent',
      message: 'The event slot has no plan to make active.',
      blockers: [],
    });
    expect(await controller.playEvent()).toBe('The event slot has no plan to make active.');
  });

  it('syncs once just after the active event ends, and not after disposal', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      now: Date.parse('2026-10-18T23:59:00Z'),
    });
    try {
      const { application, controller, events } = setup();
      const active = feedWith(activeEvent(projectJson));
      events.refreshFeed.mockResolvedValue(active);
      await controller.sync();
      expect(events.refreshFeed).toHaveBeenCalledTimes(1);

      events.refreshFeed.mockResolvedValue({ active: null, source: 'network', problem: null });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(events.refreshFeed).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(events.refreshFeed).toHaveBeenCalledTimes(2);
      expect(events.clearEvent).toHaveBeenCalledTimes(1);
      // Without an active event nothing is scheduled.
      await vi.advanceTimersByTimeAsync(30 * 86_400_000);
      expect(events.refreshFeed).toHaveBeenCalledTimes(2);

      const later = feedWith(activeEvent(projectJson, { endsAt: '2026-11-25T00:00:00Z' }));
      events.refreshFeed.mockResolvedValue(later);
      await controller.sync();
      expect(events.refreshFeed).toHaveBeenCalledTimes(3);
      application.dispose();
      await vi.advanceTimersByTimeAsync(10 * 86_400_000);
      expect(events.refreshFeed).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-syncs an event ending beyond the longest timer early, then at its end', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      now: Date.parse('2026-10-01T00:00:00Z'),
    });
    try {
      const { controller, events } = setup();
      const far = activeEvent(projectJson, { endsAt: '2026-11-10T00:00:00Z' });
      events.refreshFeed.mockResolvedValue(feedWith(far));
      await controller.sync();
      expect(events.refreshFeed).toHaveBeenCalledTimes(1);
      // The longest timer runs out first; that sync schedules the rest.
      await vi.advanceTimersByTimeAsync(2 ** 31 - 1);
      expect(events.refreshFeed).toHaveBeenCalledTimes(2);
      events.refreshFeed.mockResolvedValue({ active: null, source: 'network', problem: null });
      await vi.advanceTimersByTimeAsync(Date.parse('2026-11-10T00:00:00Z') - Date.now() - 1);
      expect(events.refreshFeed).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(5_001);
      expect(events.refreshFeed).toHaveBeenCalledTimes(3);
      expect(events.clearEvent).toHaveBeenCalledTimes(1);
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('arms no timer from a sync that finishes after disposal', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      now: Date.parse('2026-10-18T23:59:00Z'),
    });
    try {
      const { controller, events } = setup();
      let respond: (() => void) | undefined;
      events.refreshFeed.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            respond = () => resolve(feedWith(activeEvent(projectJson)));
          }),
      );
      const running = controller.sync();
      await vi.waitFor(() => expect(respond).toBeDefined());
      controller.dispose();
      respond?.();
      await running;
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(events.refreshFeed).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
