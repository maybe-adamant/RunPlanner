import type { Catalog } from '../catalog-schema';
import { applyProjectCommand, type ProjectCommand } from './commands/dispatch';
import type { ProjectDocument } from './model';

export interface ProjectHistory {
  readonly past: readonly ProjectDocument[];
  readonly present: ProjectDocument;
  readonly future: readonly ProjectDocument[];
}

function history(
  past: readonly ProjectDocument[],
  present: ProjectDocument,
  future: readonly ProjectDocument[],
): ProjectHistory {
  return Object.freeze({
    past: Object.freeze(past),
    present,
    future: Object.freeze(future),
  });
}

export function createProjectHistory(document: ProjectDocument): ProjectHistory {
  return history([], document, []);
}

export function applyProjectHistoryCommand(
  current: ProjectHistory,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectHistory {
  const next = applyProjectCommand(current.present, catalog, command);
  if (next === current.present) {
    return current;
  }
  return history([...current.past, current.present], next, []);
}

/** Apply one semantic transaction made of engine commands as one undo step. */
export function applyProjectHistoryCommands(
  current: ProjectHistory,
  catalog: Catalog,
  commands: readonly ProjectCommand[],
): ProjectHistory {
  const next = commands.reduce(
    (document, command) => applyProjectCommand(document, catalog, command),
    current.present,
  );
  return next === current.present ? current : history([...current.past, current.present], next, []);
}

export function canUndoProjectHistory(current: ProjectHistory): boolean {
  return current.past.length > 0;
}

export function canRedoProjectHistory(current: ProjectHistory): boolean {
  return current.future.length > 0;
}

export function undoProjectHistory(current: ProjectHistory): ProjectHistory {
  const previous = current.past.at(-1);
  if (previous === undefined) {
    return current;
  }
  return history(current.past.slice(0, -1), previous, [current.present, ...current.future]);
}

export function redoProjectHistory(current: ProjectHistory): ProjectHistory {
  const next = current.future[0];
  if (next === undefined) {
    return current;
  }
  return history([...current.past, current.present], next, current.future.slice(1));
}
