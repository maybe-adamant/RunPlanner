import {
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '../authored-project/model';
import { EXECUTION_PLAN_FORMAT, type ExecutionCompilerInput, type ExecutionPlan } from './model';

import { fingerprint } from './fingerprint';

/** Lossless data-only mapping from the explicit engine product to the protocol. */
export function compileExecutionPlan({
  product,
  displayName,
}: ExecutionCompilerInput): ExecutionPlan {
  const { catalogVersion, ...rest } = product;
  // The authored schema pair identifies the planner version that compiled the plan.
  const body = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    catalogVersion,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION,
    ...rest,
  });
  // The display name is presentation metadata, so it never changes the fingerprint.
  return Object.freeze({
    ...body,
    planFingerprint: fingerprint(body),
    ...(displayName === undefined ? {} : { displayName }),
  });
}
