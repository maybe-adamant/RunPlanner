import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { draftRefusals, type DraftSpec } from '@run-planner/engine/simulation';

import { projectDraftSpec } from '@planner/projections/draftSpec';
import {
  draftRunCleared,
  draftRunSettled,
  draftRunStarted,
  type DraftRunState,
} from '@planner/state/draftSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import type { PlannerStore } from '@planner/state/store';
import {
  answerDraftWorkerRequest,
  type DraftRunEvent,
  type DraftWorkerRequest,
  type DraftWorkerResponse,
} from './draftWorkerProtocol';

export interface DraftRunRequest {
  readonly project: ProjectDocument;
  readonly spec: DraftSpec;
  readonly seed: number;
}

export interface DraftRunHandle {
  cancel(): void;
}

/** Runs the engine draft search away from the caller and reports through `onEvent`. */
export interface DraftRunner {
  start(request: DraftRunRequest, onEvent: (event: DraftRunEvent) => void): DraftRunHandle;
}

/** Runs the search on the calling thread after the current task; for tests and hosts without workers. */
export function createInProcessDraftRunner(catalog: Catalog): DraftRunner {
  return {
    start(request, onEvent) {
      let cancelled = false;
      setTimeout(() => {
        if (cancelled) return;
        const response = answerDraftWorkerRequest(catalog, {
          id: 0,
          projectJson: encodeProjectDocument(request.project),
          spec: request.spec,
          seed: request.seed,
        });
        if (!cancelled) onEvent(response.event);
      }, 0);
      return {
        cancel() {
          cancelled = true;
        },
      };
    },
  };
}

/** Runs the search in a dedicated worker; cancelling terminates it and the next run starts a new one. */
export function createWorkerDraftRunner(createWorker: () => Worker): DraftRunner {
  let worker: Worker | undefined;
  let nextId = 1;
  const listeners = new Map<number, (event: DraftRunEvent) => void>();
  const ensureWorker = (): Worker => {
    if (worker !== undefined) return worker;
    const created = createWorker();
    created.onmessage = (message: MessageEvent<DraftWorkerResponse>) => {
      listeners.get(message.data.id)?.(message.data.event);
      if (message.data.event.kind !== 'settled' && message.data.event.kind !== 'error') return;
      listeners.delete(message.data.id);
    };
    created.onerror = (error) => {
      error.preventDefault();
      for (const listener of listeners.values())
        listener({ kind: 'error', message: error.message });
      listeners.clear();
      created.terminate();
      if (worker === created) worker = undefined;
    };
    worker = created;
    return created;
  };
  return {
    start(request, onEvent) {
      const id = nextId++;
      listeners.set(id, onEvent);
      const message: DraftWorkerRequest = {
        id,
        projectJson: encodeProjectDocument(request.project),
        spec: request.spec,
        seed: request.seed,
      };
      ensureWorker().postMessage(message);
      return {
        cancel() {
          if (!listeners.delete(id)) return;
          worker?.terminate();
          worker = undefined;
          listeners.clear();
        },
      };
    },
  };
}

export interface DraftRunController {
  /** Drafts with the session seed. */
  draft(): void;
  /** Drafts with a new seed. */
  reroll(): void;
  cancel(): void;
  dispose(): void;
}

/**
 * Runs drafts against the present project and applies a drafted route as one
 * ReplaceRoute. A replaced workspace cancels the run; a later edit clears the outcome.
 */
export function createDraftRunController({
  catalog,
  store,
  runner,
  now = () => Date.now(),
  randomSeed,
}: {
  readonly catalog: Catalog;
  readonly store: PlannerStore;
  readonly runner: DraftRunner;
  readonly now?: () => number;
  readonly randomSeed: () => number;
}): DraftRunController {
  let current: { handle?: DraftRunHandle } | undefined;
  /** The project an outcome describes; editing past it clears the outcome. */
  let settledProject: ProjectDocument | undefined;
  let revision = store.getState().editorSession.workspaceReplacementRevision;
  const presentProject = () => {
    const workspace = store.getState().projectWorkspace;
    return workspace.kind === 'openProject' ? workspace.history.present : undefined;
  };
  const stop = () => {
    current?.handle?.cancel();
    current = undefined;
  };
  const settle = (outcome: Exclude<DraftRunState, { readonly kind: 'idle' | 'running' }>) => {
    current = undefined;
    settledProject = presentProject();
    store.dispatch(draftRunSettled(outcome));
  };
  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    if (state.editorSession.workspaceReplacementRevision !== revision) {
      revision = state.editorSession.workspaceReplacementRevision;
      stop();
      settledProject = undefined;
      return;
    }
    const run = state.draftSession.run.kind;
    if (run === 'idle' || run === 'running' || settledProject === undefined) return;
    if (presentProject() === settledProject) return;
    settledProject = undefined;
    store.dispatch(draftRunCleared());
  });
  const start = (seed: number): void => {
    if (current !== undefined) return;
    const project = presentProject();
    if (project === undefined) return;
    const { spec } = projectDraftSpec(catalog, project, store.getState().draftSession);
    if (spec === undefined || draftRefusals(catalog, project, spec).length > 0) return;
    settledProject = undefined;
    store.dispatch(draftRunStarted({ seed, startedAt: now() }));
    const run: { handle?: DraftRunHandle } = {};
    current = run;
    run.handle = runner.start({ project, spec, seed }, (event) => {
      if (current !== run) return;
      if (event.kind === 'error') {
        settle({ kind: 'error', message: event.message });
        return;
      }
      if (presentProject() !== project) {
        settle({ kind: 'superseded' });
        return;
      }
      const result = event.result;
      switch (result.kind) {
        case 'drafted':
          try {
            store.dispatch(authoredProjectCommandDispatched(result.command));
          } catch (error) {
            settle({
              kind: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
            return;
          }
          if (presentProject() === project) {
            settle({ kind: 'error', message: 'The drafted route was not applied.' });
            return;
          }
          settle({ kind: 'drafted', seed, report: result.report, attempts: result.attempts });
          return;
        case 'failed':
        case 'refused':
          settle(result);
          return;
      }
    });
  };
  return {
    draft: () => start(store.getState().draftSession.seed),
    reroll: () => start(randomSeed()),
    cancel() {
      if (current === undefined) return;
      stop();
      store.dispatch(draftRunCleared());
    },
    dispose() {
      unsubscribe();
      stop();
    },
  };
}
