import { createAction, type Middleware, type Reducer } from '@reduxjs/toolkit';
import {
  publishProjectHistoryEdit,
  createProjectHistory,
  projectCommandAuthoringAddresses,
  redoProjectHistory,
  semanticAddressKey,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  authoringReadinessAt,
  settleProjectEdit,
  type ProjectEvaluationAssembly,
  type SettlementFault,
} from '@run-planner/engine/simulation';

export type ProjectEvaluationAssembler = (project: ProjectDocument) => ProjectEvaluationAssembly;

export interface OpenProjectWorkspaceState {
  readonly kind: 'openProject';
  readonly assembly: ProjectEvaluationAssembly;
  readonly history: ProjectHistory;
  /** The repair the last edit's settlement could not finish; cleared by the next publication. */
  readonly settlementFault?: SettlementFault;
}
export interface NoProjectWorkspaceState {
  readonly kind: 'noProject';
  /** Absent at runtime; these optional members make the union ergonomic for callers after narrowing. */
  readonly assembly?: never;
  readonly history?: never;
  readonly settlementFault?: never;
}
export type ProjectWorkspaceState = OpenProjectWorkspaceState | NoProjectWorkspaceState;

export interface PreparedProjectWorkspace {
  readonly assembly: ProjectEvaluationAssembly;
  readonly project: ProjectDocument;
}

export const authoredProjectCommandDispatched = createAction<ProjectCommand>(
  'projectWorkspace/commandDispatched',
);
/** Several commands applied in order and published as one history step. */
export const authoredProjectCommandsDispatched = createAction<readonly ProjectCommand[]>(
  'projectWorkspace/commandsDispatched',
);
export const authoredProjectUndoRequested = createAction('projectWorkspace/undoRequested');
export const authoredProjectRedoRequested = createAction('projectWorkspace/redoRequested');
/** Opens another document, starting a new history. */
export const authoredProjectReplaced = createAction<ProjectDocument>(
  'projectWorkspace/projectReplaced',
);
/** Closes the open plan, as when its library item is deleted. */
export const authoredProjectClosed = createAction('projectWorkspace/projectClosed');
/** Returns the open plan to a document as one undoable history step. */
export const authoredProjectReverted = createAction<ProjectDocument>(
  'projectWorkspace/projectReverted',
);

function publishWorkspace(
  history: ProjectHistory,
  assembleProjectEvaluation: ProjectEvaluationAssembler,
): ProjectWorkspaceState {
  const assembly = assembleProjectEvaluation(history.present);
  assertProjectEvaluationAssembly(assembly);
  if (assembly.project !== history.present) {
    throw new Error('project evaluation assembly does not match authored workspace identity');
  }
  return Object.freeze({
    kind: 'openProject' as const,
    assembly,
    history,
  });
}

function publishPreparedWorkspace(
  history: ProjectHistory,
  prepared: PreparedProjectWorkspace,
  settlementFault?: SettlementFault,
): ProjectWorkspaceState {
  assertProjectEvaluationAssembly(prepared.assembly);
  if (prepared.project !== history.present || prepared.assembly.project !== history.present) {
    throw new Error('prepared project workspace does not match authored workspace identity');
  }
  return Object.freeze({
    kind: 'openProject' as const,
    assembly: prepared.assembly,
    history,
    ...(settlementFault === undefined ? {} : { settlementFault }),
  });
}

/** Warns once per recorded settlement fault; a fault signals an engine repair defect. */
export const settlementFaultWarning: Middleware<
  object,
  { readonly projectWorkspace: ProjectWorkspaceState }
> = (api) => (next) => (action) => {
  const before = api.getState().projectWorkspace.settlementFault;
  const result = next(action);
  const fault = api.getState().projectWorkspace.settlementFault;
  if (fault !== undefined && fault !== before) {
    globalThis.console.warn(
      `Settlement could not finish repairing ${semanticAddressKey(fault.owner)} (${fault.key}).`,
    );
  }
  return result;
};

export function createProjectWorkspaceReducer(
  catalog: Catalog,
  assembleProjectEvaluation: ProjectEvaluationAssembler,
): Reducer<ProjectWorkspaceState> {
  const initialState: ProjectWorkspaceState = Object.freeze({ kind: 'noProject' });

  const publishCommands = (
    state: OpenProjectWorkspaceState,
    commands: readonly ProjectCommand[],
  ): ProjectWorkspaceState => {
    let assembly = state.assembly;
    let fault: SettlementFault | undefined;
    for (const command of commands) {
      if (
        projectCommandAuthoringAddresses(command, assembly.project).some(
          (owner) => authoringReadinessAt(assembly, owner) === 'locked',
        )
      ) {
        return state;
      }
      const settled = settleProjectEdit({
        catalog,
        before: assembly,
        command,
        evaluate: assembleProjectEvaluation,
      });
      assembly = settled.assembly;
      // The first unfinished repair is the one reported.
      fault ??= settled.fault;
    }
    if (assembly.project === state.history.present) return state;
    const history = publishProjectHistoryEdit(state.history, assembly.project);
    return publishPreparedWorkspace(history, { project: assembly.project, assembly }, fault);
  };

  return (state = initialState, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      if (state.kind === 'noProject') return state;
      return publishCommands(state, [action.payload]);
    }
    if (authoredProjectCommandsDispatched.match(action)) {
      if (state.kind === 'noProject') return state;
      return publishCommands(state, action.payload);
    }
    if (authoredProjectUndoRequested.match(action)) {
      if (state.kind === 'noProject') return state;
      const history = undoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectRedoRequested.match(action)) {
      if (state.kind === 'noProject') return state;
      const history = redoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectReplaced.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), assembleProjectEvaluation);
    }
    if (authoredProjectClosed.match(action)) return initialState;
    if (authoredProjectReverted.match(action)) {
      if (state.kind === 'noProject') return state;
      const history = publishProjectHistoryEdit(state.history, action.payload);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    return state;
  };
}
