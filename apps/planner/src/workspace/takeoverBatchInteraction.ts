import type {
  ExitDecisionAddress,
  OccurrenceId,
  ProjectCommand,
} from '@run-planner/engine/authored-project';

import { allocateOccurrenceId } from './occurrenceIds';

export type TakeoverBatchAction = 'create' | 'replace' | 'reconcile';

export type TakeoverBatchCommand = Extract<
  ProjectCommand,
  {
    readonly kind: 'CreateTakeoverBatch' | 'ReplaceWithTakeoverBatch' | 'ReconcileTakeoverBatch';
  }
>;

interface CreateTakeoverBatchCommandInput {
  readonly action: TakeoverBatchAction;
  readonly decision: ExitDecisionAddress;
  readonly existingTargetOccurrenceIds: ReadonlyMap<string, OccurrenceId>;
  readonly gameName: string;
  readonly requiredExitKeys: readonly string[];
}

/**
 * The application interaction adapter is the only UI-facing layer that
 * translates engine-owned takeover evidence into an atomic authored command.
 * React receives the resulting command capability, never a target-count or
 * occurrence-identity construction rule.
 */
export function createTakeoverBatchCommand({
  action,
  decision,
  existingTargetOccurrenceIds,
  gameName,
  requiredExitKeys,
}: CreateTakeoverBatchCommandInput): TakeoverBatchCommand {
  if (requiredExitKeys.length === 0) {
    throw new Error('A takeover batch must declare at least one physical exit.');
  }
  const targetOccurrenceIds: Record<string, OccurrenceId> = {};
  for (const exitKey of requiredExitKeys) {
    if (targetOccurrenceIds[exitKey] !== undefined) {
      throw new Error(`A takeover batch cannot repeat physical exit ${exitKey}.`);
    }
    targetOccurrenceIds[exitKey] =
      existingTargetOccurrenceIds.get(exitKey) ?? allocateOccurrenceId();
  }
  switch (action) {
    case 'create':
      return Object.freeze({
        kind: 'CreateTakeoverBatch' as const,
        decision,
        gameName,
        targetOccurrenceIds: Object.freeze(targetOccurrenceIds),
      });
    case 'replace':
      return Object.freeze({
        kind: 'ReplaceWithTakeoverBatch' as const,
        decision,
        gameName,
        targetOccurrenceIds: Object.freeze(targetOccurrenceIds),
      });
    case 'reconcile':
      return Object.freeze({
        kind: 'ReconcileTakeoverBatch' as const,
        decision,
        gameName,
        targetOccurrenceIds: Object.freeze(targetOccurrenceIds),
      });
  }
}
