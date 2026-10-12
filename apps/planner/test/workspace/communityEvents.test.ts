import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { createHash } from 'node:crypto';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { selectProfileStatus } from '@planner/state/store';
import { compileEventPlan } from '@planner/workspace/eventDocument';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import {
  clearing,
  createFakeCommunityEventDevelopmentHost,
  createFakeCommunityEventHost,
  eventPlan,
} from '@planner-test/fixtures/communityEventHost';

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

function planJson(): string {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(createGoldenFGHProject()));
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('Expected an open project');
  return compileEventPlan(catalog, workspace.assembly, 'Week 42: Staff sprint');
}

describe('community event controller', () => {
  it('exists with a game host, and offers file actions only in development builds', () => {
    expect(setup().controller.development).toBeDefined();
    expect(setup({ devBuild: false }).controller.development).toBeUndefined();
    expect(createApplication({ devBuild: true }).communityEvents).toBeUndefined();
  });

  it('writes the active event to the event slot by id with its summary and announces it', async () => {
    const { controller, dismissed, events, game } = setup();
    const plan = eventPlan(planJson());
    events.refreshFeed.mockResolvedValue({ active: plan, source: 'network', problem: null });

    await controller.sync();

    expect(events.publishEvent).toHaveBeenCalledTimes(1);
    const [eventId, fingerprint, summary] = events.publishEvent.mock.calls[0]!;
    expect(eventId).toBe('2026-w42-staff');
    // The summary describes the plan the host is asked to write.
    expect(fingerprint).toBe(decodeExecutionPlan(JSON.parse(plan.planJson)).planFingerprint);
    expect(summary).toMatchObject({ route: 'Underworld', planName: 'Week 42: Staff sprint' });
    expect(events.clearEvent).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ kind: 'active', event: plan.event });
    await vi.waitFor(() => expect(game.host.status).toHaveBeenCalled());

    controller.dismiss();
    expect(dismissed).toEqual(['2026-w42-staff']);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });
    // A dismissed event is still written, but not announced again.
    await controller.sync('panel');
    expect(events.publishEvent).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });
  });

  it('clears the event slot without an active event and says when slot 1 took over', async () => {
    const { controller, events } = setup();
    const plan = eventPlan(planJson());
    events.refreshFeed.mockResolvedValueOnce({ active: plan, source: 'network', problem: null });
    await controller.sync();
    expect(controller.getSnapshot().kind).toBe('active');

    // The event left the feed while the event slot was not active: the notice just goes.
    await controller.sync('panel');
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ kind: 'none' });

    events.clearEvent.mockResolvedValueOnce(
      clearing({
        status: 'cleared',
        clearedEvent: { id: plan.event.id, title: plan.event.title, endsAt: plan.event.endsAt },
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
    const plan = eventPlan(planJson());
    events.refreshFeed.mockResolvedValue({ active: plan, source: 'network', problem: null });
    await controller.sync();
    const announced = controller.getSnapshot();
    expect(announced).toEqual({ kind: 'active', event: plan.event });

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
    const plan = eventPlan(planJson());
    events.refreshFeed.mockResolvedValueOnce({ active: plan, source: 'cache', problem: 'offline' });
    await controller.sync();
    // Offline with nothing verified: the host keeps the event slot until its own end.
    events.refreshFeed.mockResolvedValueOnce({ active: null, source: 'none', problem: 'offline' });
    events.clearEvent.mockResolvedValueOnce(
      clearing({ status: 'kept', message: 'The event slot is kept until its event ends.' }),
    );
    await controller.sync('panel');
    expect(events.clearEvent).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ kind: 'active', event: plan.event });
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
    expect(events.refreshFeed.mock.calls).toEqual([[false], [true]]);
  });

  it('opens the active event’s project as an unsaved copy with its own identity', async () => {
    const { application, controller, events } = setup();
    const plan = eventPlan(planJson());
    events.refreshFeed.mockResolvedValue({ active: plan, source: 'network', problem: null });
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

  it('imports a local event file in place of the feed’s event and clears it again', async () => {
    const { controller, development, events } = setup();
    await expect(controller.development!.importEventFile()).resolves.toEqual({
      kind: 'cancelled',
    });
    // An import never reports a read that started before it.
    let finish: (() => void) | undefined;
    events.refreshFeed.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ active: null, source: 'network', problem: null });
        }),
    );
    const background = controller.sync();
    const plan = eventPlan(planJson(), { id: 'local-test' });
    development.pickEventFile.mockResolvedValue('/events/local.json');
    development.loadEventFile.mockResolvedValue(plan);
    events.refreshFeed.mockResolvedValue({ active: plan, source: 'network', problem: null });
    const imported = controller.development!.importEventFile();
    await vi.waitFor(() => expect(development.loadEventFile).toHaveBeenCalled());
    finish?.();
    await background;
    await expect(imported).resolves.toEqual({
      kind: 'done',
      message: 'The event slot now holds Week 42: Staff sprint.',
    });
    expect(events.refreshFeed).toHaveBeenCalledTimes(2);
    expect(development.loadEventFile).toHaveBeenCalledWith('/events/local.json');
    expect(events.publishEvent.mock.calls[0]![0]).toBe('local-test');

    events.refreshFeed.mockResolvedValue({ active: null, source: 'network', problem: null });
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
    events.refreshFeed.mockResolvedValue({ active: plan, source: 'network', problem: null });
    await expect(controller.development!.importEventFile()).resolves.toEqual({
      kind: 'failed',
      message: 'The game target is not ready for publication.',
    });
  });

  it('exports the open project as an event document for the bundled build', async () => {
    const { application, controller, development } = setup();
    const metadata = {
      id: '2026-w42-staff',
      title: 'Week 42: Staff sprint',
      description: 'Clear the Surface.',
      startsAt: '2026-10-12T00:00:00Z',
      endsAt: '2026-10-19T00:00:00Z',
    };
    await expect(controller.development!.exportEventFile(metadata)).resolves.toEqual({
      kind: 'failed',
      message: 'Open a project to export it as an event.',
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHProject()));
    await expect(
      controller.development!.exportEventFile({ ...metadata, endsAt: metadata.startsAt }),
    ).resolves.toEqual({ kind: 'failed', message: 'An event must end after it starts.' });
    await expect(
      controller.development!.exportEventFile({ ...metadata, startsAt: '12 October' }),
    ).resolves.toMatchObject({ kind: 'failed' });

    await expect(
      controller.development!.exportEventFile({ ...metadata, rules: 'Fear 8.' }),
    ).resolves.toEqual({ kind: 'done', message: 'Exported 2026-w42-staff.' });
    const [fileName, json] = development.saveEventFile.mock.calls[0]!;
    expect(fileName).toBe('2026-w42-staff.event.json');
    const document = JSON.parse(json) as Record<string, unknown>;
    expect(document).toMatchObject({
      format: 'run-planner-event',
      formatVersion: 1,
      ...metadata,
      rules: 'Fear 8.',
    });
    expect(document.projectUrl).toBe(
      'https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42-staff.runplanner.json',
    );
    const project = application.store.getState().projectWorkspace;
    if (project.kind !== 'openProject') throw new Error('Expected an open project');
    expect(document.projectSha256).toBe(
      createHash('sha256').update(encodeProjectDocument(project.history.present)).digest('hex'),
    );
    expect(JSON.stringify((document.plans as Record<string, unknown>)['test-build'])).toBe(
      planJson(),
    );

    development.saveEventFile.mockResolvedValueOnce(false);
    await expect(controller.development!.exportEventFile(metadata)).resolves.toEqual({
      kind: 'cancelled',
    });
  });
});
