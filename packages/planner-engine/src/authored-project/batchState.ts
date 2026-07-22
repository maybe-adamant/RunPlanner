import type { GeneratedBatchPolicy } from '../catalog-schema';
import type { AuthoredBatchState } from './model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from './validation';

export function createDefaultBatchState(policy: GeneratedBatchPolicy): AuthoredBatchState {
  switch (policy.kind) {
    case 'standard':
    case 'clockwork':
      return null;
    case 'fields':
      return Object.freeze({ cageOutcome: 'min' });
  }
}

export function decodeBatchState(
  value: unknown,
  policy: GeneratedBatchPolicy,
  path: string,
): AuthoredBatchState {
  if (policy.kind !== 'fields') {
    if (value !== null) {
      failProjectDocument(path, 'must be null');
    }
    return null;
  }

  const state = expectRecord(value, path);
  expectExactKeys(state, ['cageOutcome'], path);
  const cageOutcome = expectString(state.cageOutcome, `${path}.cageOutcome`);
  if (cageOutcome !== 'min' && cageOutcome !== 'max') {
    failProjectDocument(`${path}.cageOutcome`, `expected min or max, received ${cageOutcome}`);
  }
  return Object.freeze({ cageOutcome });
}
