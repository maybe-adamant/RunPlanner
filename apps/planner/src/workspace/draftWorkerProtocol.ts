import { parseProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  DEFAULT_DRAFT_BUDGET,
  draftProject,
  type DraftResult,
  type DraftSpec,
} from '@run-planner/engine/simulation';

/** What a run reports; a run may report more than once before it settles. */
export type DraftRunEvent =
  | { readonly kind: 'settled'; readonly result: DraftResult }
  | { readonly kind: 'error'; readonly message: string };

/** Wire form of a request; the project crosses as its canonical JSON. */
export interface DraftWorkerRequest {
  readonly id: number;
  readonly projectJson: string;
  readonly spec: DraftSpec;
  readonly seed: number;
}

export interface DraftWorkerResponse {
  readonly id: number;
  readonly event: DraftRunEvent;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Answers one wire request with the engine search; shared by the worker and in-process runners. */
export function answerDraftWorkerRequest(
  catalog: Catalog,
  request: DraftWorkerRequest,
): DraftWorkerResponse {
  try {
    const project = parseProjectDocument(request.projectJson, catalog);
    const result = draftProject(catalog, project, request.spec, request.seed, DEFAULT_DRAFT_BUDGET);
    return { id: request.id, event: { kind: 'settled', result } };
  } catch (error) {
    return { id: request.id, event: { kind: 'error', message: errorMessage(error) } };
  }
}
