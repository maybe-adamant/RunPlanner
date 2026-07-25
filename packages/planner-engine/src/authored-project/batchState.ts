import type { NormalDoorBatchPolicy } from '../catalog-schema';
import type { AuthoredBatchState } from './model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from './validation';

export function createInitialBatchState(policy: NormalDoorBatchPolicy): AuthoredBatchState {
  switch (policy.kind) {
    case 'standard':
    case 'clockwork':
    case 'fields':
      return null;
  }
}

export function decodeBatchState(
  value: unknown,
  policy: NormalDoorBatchPolicy,
  path: string,
): AuthoredBatchState {
  if (policy.kind !== 'fields') {
    if (value !== null) {
      failProjectDocument(path, 'must be null');
    }
    return null;
  }

  if (value === null) {
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
