import {
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionCompilerInput,
  type ExecutionPlan,
} from './model';

import { fingerprint } from './fingerprint';

/** Lossless data-only mapping from the explicit engine product to the protocol. */
export function compileExecutionPlan({ product }: ExecutionCompilerInput): ExecutionPlan {
  const body = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    ...product,
  });
  return Object.freeze({ ...body, planFingerprint: fingerprint(body) });
}
