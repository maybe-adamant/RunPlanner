import type {
  ExitDecisionAddress,
  OccurrenceId,
  ProjectCommand,
} from '@run-planner/engine/authored-project';

import type { OccurrenceIdFactory } from './occurrenceIds';

export type TakeoverBatchAction = 'create' | 'replace' | 'reconcile';

export type TakeoverBatchCommand = Extract<
  ProjectCommand,
  {
    readonly kind: 'CreateTakeoverBatch' | 'ReplaceWithTakeoverBatch' | 'ReconcileTakeoverBatch';
  }
>;

interface TakeoverBatchCommandInput {
  readonly action: TakeoverBatchAction;
  readonly allocateOccurrenceId: OccurrenceIdFactory;
  readonly decision: ExitDecisionAddress;
  readonly existingTargetOccurrenceIds: ReadonlyMap<string, OccurrenceId>;
  readonly gameName: string;
  readonly requiredExitKeys: readonly string[];
}

type CreateTakeoverBatchCommand = Extract<
  TakeoverBatchCommand,
  { readonly kind: 'CreateTakeoverBatch' }
>;
type ReplaceWithTakeoverBatchCommand = Extract<
  TakeoverBatchCommand,
  { readonly kind: 'ReplaceWithTakeoverBatch' }
>;
type ReconcileTakeoverBatchCommand = Extract<
  TakeoverBatchCommand,
  { readonly kind: 'ReconcileTakeoverBatch' }
>;

/**
 * The application interaction adapter is the only UI-facing layer that
 * translates engine-owned takeover evidence into an atomic authored command.
 * React receives the resulting command capability, never a target-count or
 * occurrence-identity construction rule.
 */
export function createTakeoverBatchCommand(
  input: TakeoverBatchCommandInput & { readonly action: 'create' },
): CreateTakeoverBatchCommand;
export function createTakeoverBatchCommand(
  input: TakeoverBatchCommandInput & { readonly action: 'replace' },
): ReplaceWithTakeoverBatchCommand;
export function createTakeoverBatchCommand(
  input: TakeoverBatchCommandInput & { readonly action: 'reconcile' },
): ReconcileTakeoverBatchCommand;
export function createTakeoverBatchCommand({
  action,
  allocateOccurrenceId,
  decision,
  existingTargetOccurrenceIds,
  gameName,
  requiredExitKeys,
}: TakeoverBatchCommandInput): TakeoverBatchCommand {
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
