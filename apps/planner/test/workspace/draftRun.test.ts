import { createRouteAddress, type AuthoredDraftSpec } from '@run-planner/engine/authored-project';
import { draftReport, forcesGod } from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { withDraftGodToggled, withDraftRackKeepsake } from '@planner/projections/draftSpec';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type { DraftRunner, DraftRunRequest } from '@planner/workspace/draftRun';
import type { DraftRunEvent, DraftRunOutcome } from '@planner/workspace/draftWorkerProtocol';
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

type Application = ReturnType<typeof createApplication>;

function editDraft(
  application: Application,
  edit: (draft: AuthoredDraftSpec) => AuthoredDraftSpec,
) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('no open project');
  const route = workspace.history.present.route;
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ReplaceDraftSpec',
      route: createRouteAddress(route.routeKey),
      draft: edit(route.draft),
    }),
  );
}

function chooseGods(application: Application) {
  for (const godKey of ['Apollo', 'Hera', 'Hestia'])
    editDraft(application, (draft) => withDraftGodToggled(draft, godKey));
  editDraft(application, (draft) => ({ ...draft, seed: 7 }));
}

function openUnderworld(runner: DraftRunner, seeds: readonly number[] = [11]) {
  const generated = loadUnderworldFGHICheckpoint();
  let seedIndex = 0;
  const application = createApplication({
    draftRunner: runner,
    rerollSeed: () => seeds[Math.min(seedIndex++, seeds.length - 1)]!,
  });
  const { catalog } = application;
  application.store.dispatch(
    newProjectCreated({
      ...generated,
      route: { ...generated.route, biomes: [] },
    }),
  );
  chooseGods(application);
  const draftedResult = (request: DraftRunRequest): DraftRunOutcome => {
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
      report: draftReport(catalog, request.spec, simulateProjectAssembly(catalog, generated)),
      attempts: 4,
    };
  };
  const history = () => {
    const workspace = application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('no open project');
    return workspace.history;
  };
  const run = () => application.store.getState().draftSession.run;
  return { application, draftedResult, generated, history, run };
}

describe('draft run controller', () => {
  it('applies a drafted result as one undoable ReplaceRoute', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, generated, history, run } = openUnderworld(runner);
    editDraft(application, (draft) => withDraftGodToggled(draft, 'Zeus'));
    const before = history().present;

    application.draftRun.draft();
    expect(run()).toMatchObject({ kind: 'running', seed: 7 });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.request.spec.world.godKeys).toEqual(['Apollo', 'Hera', 'Hestia', 'Zeus']);
    expect(runs[0]!.request.project).toBe(before);

    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().past.at(-1)).toBe(before);
    expect(history().present.route.biomes).toEqual(generated.route.biomes);
    // Drafting replaces the route and loadout but keeps the saved draft settings.
    expect(history().present.route.draft).toBe(before.route.draft);
    expect(run()).toMatchObject({ kind: 'drafted', seed: 7 });

    application.store.dispatch(authoredProjectUndoRequested());
    expect(history().present).toBe(before);
    // The outcome described the drafted project, which Undo left.
    expect(run()).toEqual({ kind: 'idle' });
  });

  it('saves a reroll seed with its drafted route as one Undo step', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, generated, history, run } = openUnderworld(runner, [11]);
    const before = history().present;
    application.draftRun.reroll();
    expect(runs[0]!.request.seed).toBe(11);
    expect(run()).toMatchObject({ kind: 'running', seed: 11 });
    // The seed is saved only with the outcome.
    expect(history().present).toBe(before);

    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().past.at(-1)).toBe(before);
    expect(history().present.route.draft.seed).toBe(11);
    expect(history().present.route.biomes).toEqual(generated.route.biomes);

    application.store.dispatch(authoredProjectUndoRequested());
    expect(history().present).toBe(before);
    expect(history().present.route.draft.seed).toBe(7);
  });

  it('saves a failed reroll seed so the panel shows the seed it tried', () => {
    const { runner, runs } = createManualRunner();
    const { application, history, run } = openUnderworld(runner, [11]);
    const before = history().present;
    application.draftRun.reroll();
    runs[0]!.emit({
      kind: 'settled',
      result: { kind: 'failed', biomeKey: 'F', reasons: [] },
    });
    expect(run()).toMatchObject({ kind: 'failed' });
    expect(history().past.at(-1)).toBe(before);
    expect(history().present.route.draft.seed).toBe(11);
    expect(history().present.route.biomes).toEqual(before.route.biomes);
  });

  it('keys rack keepsakes by biome and keeps only keepsakes the rack allows', () => {
    const { runner, runs } = createManualRunner();
    const { application, history } = openUnderworld(runner);
    const { catalog } = application;
    const starting = history().present.route.loadout.startingKeepsakeKey;
    const allowed = catalog.keepsakes.values.find(
      (k) => !forcesGod(catalog, k.key) && k.key !== starting,
    )!.key;
    const godKeepsake = catalog.keepsakes.values.find((k) => forcesGod(catalog, k.key))!.key;
    editDraft(application, (draft) =>
      withDraftRackKeepsake(draft, { afterBiomeKey: 'G', inheritedKeepsakeKey: starting }, allowed),
    );
    editDraft(application, (draft) =>
      withDraftRackKeepsake(
        draft,
        { afterBiomeKey: 'H', inheritedKeepsakeKey: allowed },
        godKeepsake,
      ),
    );
    application.draftRun.draft();
    expect(runs[0]!.request.spec.rackKeepsakeKeys).toEqual([null, allowed, null]);
  });

  it('keeps the outcome across draft-settings edits and clears it on any other edit', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, run } = openUnderworld(runner);
    application.draftRun.draft();
    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(run().kind).toBe('drafted');
    editDraft(application, (draft) => withDraftGodToggled(draft, 'Zeus'));
    expect(run().kind).toBe('drafted');
    application.store.dispatch(authoredProjectUndoRequested());
    expect(run().kind).toBe('drafted');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFamiliar',
        route: createRouteAddress('Underworld'),
        familiarKey: 'CatFamiliar',
      }),
    );
    expect(run()).toEqual({ kind: 'idle' });
  });

  it('drops a result whose base project changed while drafting', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, history, run } = openUnderworld(runner);
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
    expect(run()).toEqual({ kind: 'superseded' });
  });

  it('cancels the run when another project is opened and ignores what it reports', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, generated, history, run } = openUnderworld(runner);
    application.draftRun.draft();
    application.store.dispatch(
      newProjectCreated({
        ...generated,
        projectId: 'other',
        route: { ...generated.route, biomes: [] },
      }),
    );
    const opened = history().present;
    expect(runs[0]!.cancelled).toBe(true);
    expect(run()).toEqual({ kind: 'idle' });
    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().present).toBe(opened);
    expect(history().past).toEqual([]);
    chooseGods(application);
    application.draftRun.draft();
    expect(runs).toHaveLength(2);
  });

  it('reports a stopped search as an error, not as a failed draft', () => {
    const { runner, runs } = createManualRunner();
    const { application, run } = openUnderworld(runner);
    application.draftRun.draft();
    runs[0]!.emit({ kind: 'error', message: 'worker crashed' });
    expect(run()).toEqual({ kind: 'error', message: 'worker crashed' });
  });

  it('reports an error when the drafted route cannot be applied', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, history, run } = openUnderworld(runner);
    const before = history().present;
    application.draftRun.draft();
    const drafted = draftedResult(runs[0]!.request);
    if (drafted.kind !== 'drafted') throw new Error('expected a drafted outcome');
    runs[0]!.emit({
      kind: 'settled',
      result: { ...drafted, command: { ...drafted.command, route: createRouteAddress('Surface') } },
    });
    expect(history().present).toBe(before);
    expect(run().kind).toBe('error');
  });

  it('cancels the run and ignores anything it reports afterwards', () => {
    const { runner, runs } = createManualRunner();
    const { application, draftedResult, history, run } = openUnderworld(runner);
    const before = history().present;
    application.draftRun.draft();
    application.draftRun.cancel();
    expect(runs[0]!.cancelled).toBe(true);
    expect(run()).toEqual({ kind: 'idle' });
    runs[0]!.emit({ kind: 'settled', result: draftedResult(runs[0]!.request) });
    expect(history().present).toBe(before);
  });

  it('cancels a running draft when the application is disposed', () => {
    const { runner, runs } = createManualRunner();
    const { application } = openUnderworld(runner);
    application.draftRun.draft();
    application.dispose();
    expect(runs[0]!.cancelled).toBe(true);
  });
});
