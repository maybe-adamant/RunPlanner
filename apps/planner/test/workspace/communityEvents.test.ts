import { catalog } from '@run-planner/hades2-catalog';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '@run-planner/engine/execution-plan';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { createEventSlotOperations } from '@planner/workspace/communityEvents';
import { createFakeGameModuleHost, eventPlan } from '@planner-test/fixtures/gameModuleHost';

function compiledPlanJson(): string {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(createGoldenFGHProject()));
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('Expected an open project');
  return encodeExecutionPlan(
    compileExecutionPlan({
      product: assembleExecutionProduct({ assembly: workspace.assembly, catalog }),
    }),
  );
}

describe('event slot operations', () => {
  it('are offered only in development builds with a game host', () => {
    const game = createFakeGameModuleHost();
    expect(
      createApplication({ gameModuleHost: game.host, devBuild: true }).eventSlot,
    ).toBeDefined();
    expect(
      createApplication({ gameModuleHost: game.host, devBuild: false }).eventSlot,
    ).toBeUndefined();
    expect(createApplication({ devBuild: true }).eventSlot).toBeUndefined();
  });

  it('writes the chosen event file’s plan to the event slot with its summary', async () => {
    const game = createFakeGameModuleHost();
    const planJson = compiledPlanJson();
    game.host.pickEventFile.mockResolvedValue('/events/2026-w42.json');
    game.host.readEventFile.mockResolvedValue(eventPlan(planJson));
    game.host.publishEvent.mockResolvedValue({
      status: 'published',
      message: 'The event slot now holds Week 42: Staff sprint.',
      blockers: [],
      activationProblem: null,
    });
    const operations = createEventSlotOperations({
      catalog,
      host: game.host,
      now: () => new Date('2026-10-12T10:00:00.000Z'),
    });

    await expect(operations.importEventFile()).resolves.toEqual({
      kind: 'done',
      message: 'The event slot now holds Week 42: Staff sprint.',
    });
    expect(game.host.readEventFile).toHaveBeenCalledWith('/events/2026-w42.json');
    const [json, summary, event] = game.host.publishEvent.mock.calls[0]!;
    expect(json).toBe(planJson);
    expect(summary).toMatchObject({ sentAt: '2026-10-12T10:00:00.000Z', route: 'Underworld' });
    expect(event).toEqual({
      id: '2026-w42-staff',
      title: 'Week 42: Staff sprint',
      endsAt: '2026-10-19T00:00:00Z',
    });
    expect(game.host.publish).not.toHaveBeenCalled();
    expect(game.host.setActiveSlot).not.toHaveBeenCalled();
  });

  it('reports a cancelled pick, an unreadable file, an invalid plan and blockers', async () => {
    const game = createFakeGameModuleHost();
    const operations = createEventSlotOperations({ catalog, host: game.host });
    await expect(operations.importEventFile()).resolves.toEqual({ kind: 'cancelled' });

    game.host.pickEventFile.mockResolvedValue('/events/e.json');
    game.host.readEventFile.mockRejectedValueOnce(
      new Error('This event has no plan for this app’s game module build.'),
    );
    await expect(operations.importEventFile()).resolves.toEqual({
      kind: 'failed',
      message: 'This event has no plan for this app’s game module build.',
    });

    game.host.readEventFile.mockResolvedValueOnce(eventPlan('{"format":"other"}'));
    await expect(operations.importEventFile()).resolves.toMatchObject({ kind: 'failed' });
    expect(game.host.publishEvent).not.toHaveBeenCalled();

    game.host.readEventFile.mockResolvedValueOnce(eventPlan(compiledPlanJson()));
    game.host.publishEvent.mockResolvedValueOnce({
      status: 'blocked',
      message: 'The game target is not ready for publication.',
      blockers: [{ code: 'noTarget', found: null, required: null }],
      activationProblem: null,
    });
    const blocked = await operations.importEventFile();
    expect(blocked.kind).toBe('failed');
  });

  it('clears the event slot and reports why it could not', async () => {
    const game = createFakeGameModuleHost();
    const operations = createEventSlotOperations({ catalog, host: game.host });
    await expect(operations.clearEvent()).resolves.toEqual({
      kind: 'done',
      message: 'The event slot was cleared.',
    });
    game.host.clearEvent.mockResolvedValueOnce({
      status: 'nativeWrite',
      message: 'could not remove plan slot',
      blockers: [],
    });
    await expect(operations.clearEvent()).resolves.toEqual({
      kind: 'failed',
      message: 'could not remove plan slot',
    });
  });
});
