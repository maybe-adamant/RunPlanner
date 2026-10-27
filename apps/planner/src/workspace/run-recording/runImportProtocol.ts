import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { encodeRunRecord, type RunRecord } from '@run-planner/engine/run-record';
import { projectFromRunRecord, type RunImportReport } from '@run-planner/engine/simulation';

import { buildRunRecord } from './runRecordBuilder';
import type { SaveCheckpoint } from './saveCheckpoint';

/** A closed run's saves, structured-cloned to the import worker. */
export interface RunImportRequest {
  readonly id: number;
  readonly checkpoints: readonly SaveCheckpoint[];
  readonly end?: SaveCheckpoint;
}

/**
 * The import of one run. `failed` keeps the record when only the plan import
 * failed, so a later importer can rebuild it.
 */
export type RunImportResult =
  | {
      readonly kind: 'imported';
      /** The record's canonical JSON. */
      readonly recordJson: string;
      readonly projectJson: string;
      readonly report: RunImportReport;
      readonly importKind: 'complete' | 'stopped';
    }
  | { readonly kind: 'failed'; readonly message: string; readonly recordJson?: string };

export interface RunImportResponse {
  readonly id: number;
  readonly result: RunImportResult;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Builds the run record, then imports it as a plan; shared by the worker and in-process runners. */
export function answerRunImportRequest(
  catalog: Catalog,
  request: RunImportRequest,
): RunImportResponse {
  let record: RunRecord;
  let recordJson: string;
  try {
    record = buildRunRecord(request.checkpoints, request.end);
    recordJson = encodeRunRecord(record);
  } catch (error) {
    return { id: request.id, result: { kind: 'failed', message: message(error) } };
  }
  try {
    const imported = projectFromRunRecord(catalog, record);
    return {
      id: request.id,
      result: {
        kind: 'imported',
        recordJson,
        projectJson: encodeProjectDocument(imported.project),
        // Reports carry commands and addresses, plain JSON values.
        report: JSON.parse(JSON.stringify(imported.report)) as RunImportReport,
        importKind: imported.kind,
      },
    };
  } catch (error) {
    return { id: request.id, result: { kind: 'failed', message: message(error), recordJson } };
  }
}
