import { createRouteAddress } from '@run-planner/engine/authored-project';
import { draftReport, type DraftResult } from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { draftGodToggled } from '@planner/state/draftSessionSlice';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type { DraftRunner, DraftRunRequest } from '@planner/workspace/draftRun';
import type { DraftRunEvent } from '@planner/workspace/draftWorkerProtocol';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

/** A runner whose run settles only when the test says so. */
function createManualRunner() {
  const runs: {
    request: DraftRunRequest;
    emit: (event: DraftRunEvent) => void;
    cancelled: boolean;
  }[] = [];
  const runner: DraftRunner = {
    start(request, onEvent) {
      const run = { request, emit: onEvent, cancelled: false };
      runs.push(run);
      return {
        cancel() {
          run.cancelled = true;
        },
      };
    },
  };
  return { runner, runs };
}

function openUnderworld(runner: DraftRunner) {
  const generated = loadUnderworldFGHICheckpoint();
  const application = createApplication({ draftRunner: runner, draftSeed: () => 7 });
  const { catalog } = application;
  application.store.dispatch(
    newProjectCreated({
      ...generated,
      route: { ...generated.route, biomes: [] },
    }),
  );
  const draftedResult = (request: DraftRunRequest): DraftResult => {
    const { runModifiers: _runModifiers, ...loadout } = generated.route.loadout;
    void _runModifiers;
    return {
      kind: 'drafted',
      command: {
        kind: 'ReplaceRoute',
        route: createRouteAddress(generated.route.routeKey),
        loadout,
        biomes: generated.route.biomes,
      },
      project: generated,
      report: draftReport(catalog, request.spec, simulateProjectAssembly(catalog, generated)),
      attempts: 4,
    };
  };
  const history = () => {
    const workspace = application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('no open project');
    return workspace.history;
  };
  return { application, draftedResult, generated, history };
}

describe('draft run controller', () => {
  it('applies a drafted result as one undoable ReplaceRoute', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, generated, history } = openUnderworld(runner);
    const before = history().present;
    application.store.dispatch(draftGodToggled('Zeus'));

    application.draftRun.draft();
    expect(application.store.getState().draftSession.run).toMatchObject({
      kind: 'running',
      seed: 7,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.request.spec.world.godKeys).toEqual(['Zeus']);
    expect(runs[0]!.request.project).toBe(before);

    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().past).toEqual([before]);
    expect(history().present.route.biomes).toEqual(generated.route.biomes);
    expect(application.store.getState().draftSession.run).toMatchObject({
      kind: 'drafted',
      seed: 7,
    });

    application.store.dispatch(authoredProjectUndoRequested());
    expect(history().present).toBe(before);
  });

  it('rerolls with a new seed', () => {
    const { runner, runs } = createManualRunner();
    const { application } = openUnderworld(runner);
    application.draftRun.reroll();
    expect(runs[0]!.request.seed).toBe(7);
    expect(application.store.getState().draftSession.seed).toBe(7);
  });

  it('drops a result whose base project changed while drafting', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, history } = openUnderworld(runner);
    application.draftRun.draft();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFamiliar',
        route: createRouteAddress('Underworld'),
        familiarKey: 'CatFamiliar',
      }),
    );
    const edited = history().present;
    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().present).toBe(edited);
    expect(application.store.getState().draftSession.run).toEqual({ kind: 'superseded' });
  });

  it('cancels the run and ignores anything it reports afterwards', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, history } = openUnderworld(runner);
    const before = history().present;
    application.draftRun.draft();
    application.draftRun.cancel();
    expect(runs[0]!.cancelled).toBe(true);
    expect(application.store.getState().draftSession.run).toEqual({ kind: 'idle' });
    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().present).toBe(before);
  });
});
