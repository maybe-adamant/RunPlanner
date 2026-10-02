import { EXECUTION_PLAN_FORMAT, type ExecutionCompilerInput, type ExecutionPlan } from './model';

import { fingerprint } from './fingerprint';

/** Lossless data-only mapping from the explicit engine product to the protocol. */
export function compileExecutionPlan({
  product,
  displayName,
}: ExecutionCompilerInput): ExecutionPlan {
  const body = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    ...product,
  });
  // The display name is presentation metadata, so it never changes the fingerprint.
  return Object.freeze({
    ...body,
    planFingerprint: fingerprint(body),
    ...(displayName === undefined ? {} : { displayName }),
  });
}
