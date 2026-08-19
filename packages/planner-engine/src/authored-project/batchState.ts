import type { NormalDecisionProgressionDescriptor, NormalDoorBatchPolicy } from '../catalog-schema';
import type {
  AuthoredBatchState,
  BatchRewardStoreState,
  ExitDecision,
  ExitDecisionSource,
} from './model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from './validation';

export function createInitialBatchState(policy: NormalDoorBatchPolicy): AuthoredBatchState {
  switch (policy.kind) {
    case 'standard':
    case 'clockwork':
    case 'fields':
      return null;
  }
}

export function createInitialBatchRewardStore(
  progression: NormalDecisionProgressionDescriptor,
  sourceRoomTemplateKey?: string,
): BatchRewardStoreState {
  const policy =
    sourceRoomTemplateKey === undefined
      ? progression.rewardStorePolicy
      : (progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy ?? progression.rewardStorePolicy);
  return policy.kind === 'authoredBaseStore'
    ? Object.freeze({ kind: 'authoredBaseStore' as const, baseRewardStoreKey: null })
    : Object.freeze({ kind: policy.kind });
}

/**
 * Declaration-owned empty normal-door envelope. Commands and uncommitted
 * frontier presentation consume this one factory so the first visible door
 * edit cannot drift from the persisted batch it creates.
 */
export function createInitialExitDecision(
  progression: NormalDecisionProgressionDescriptor,
  source: ExitDecisionSource,
  sourceRoomTemplateKey?: string,
): ExitDecision {
  return Object.freeze({
    kind: 'exit' as const,
    source,
    normal: Object.freeze({
      kind: 'batch' as const,
      rewardStore: createInitialBatchRewardStore(progression, sourceRoomTemplateKey),
      batchState: createInitialBatchState(progression.batchPolicy),
      targets: Object.freeze([]),
    }),
    selection: Object.freeze({ kind: 'unresolved' as const }),
  });
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
