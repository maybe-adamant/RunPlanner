import {
  createExitDecisionAddress,
  semanticAddressKey,
  type ExitDecision,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { StructuredWorkspaceProjectionContractError } from './contract';
import type { WorkspaceBiomeSource } from './source-index';

type WorkspaceAuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};

function requireFieldsRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

/**
 * One authored Fields batch determines both its decision summary and each
 * target room's active cage surface. Keep that calculation keyed by the
 * decision rather than letting those two assemblers derive it independently.
 */
export interface WorkspaceFieldsActiveCageCounts {
  readonly countForDecision: (decision: ExitDecision) => number | undefined;
  readonly countForOccurrence: (occurrenceId: OccurrenceId) => number | undefined;
}

function activeCageCountForDecision(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  decision: WorkspaceAuthoredBatchDecision,
): number | undefined {
  const layout = source.layout;
  if (
    layout.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields' ||
    decision.normal.batchState === null
  ) {
    return undefined;
  }
  let maxCount = layout.progression.batchPolicy.maxDoorCageRewards;
  for (const target of decision.normal.targets) {
    const occurrence = source.occurrence(target.occurrenceId);
    if (occurrence === undefined) continue;
    const room = requireFieldsRoom(catalog, occurrence.gameName);
    const cages = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
    if (cages?.kind === 'boundedRewardSlots') {
      maxCount = Math.min(maxCount, cages.maxActiveSlots);
    }
  }
  return decision.normal.batchState.cageOutcome === 'min'
    ? layout.progression.batchPolicy.minDoorCageRewards
    : maxCount;
}

/**
 * Derive every authored Fields count once for a biome. The decision map is
 * the authority; the occurrence lookup is only the direct room-local view of
 * its owning decision's result.
 */
export function createWorkspaceFieldsActiveCageCounts(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): WorkspaceFieldsActiveCageCounts {
  const byDecision = new Map<string, number>();
  const byOccurrence = new Map<OccurrenceId, number>();
  for (const candidate of source.exitDecisions) {
    if (candidate.normal.kind !== 'batch') continue;
    const decision = candidate as WorkspaceAuthoredBatchDecision;
    const count = activeCageCountForDecision(catalog, source, decision);
    if (count === undefined) continue;
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const key = semanticAddressKey(owner);
    if (byDecision.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has duplicate authored Fields cage counts`,
      );
    }
    byDecision.set(key, count);
    for (const target of decision.normal.targets) {
      if (source.occurrence(target.occurrenceId)?.state.kind === 'fieldsCombat') {
        byOccurrence.set(target.occurrenceId, count);
      }
    }
  }
  return Object.freeze({
    countForDecision: (decision: ExitDecision) =>
      decision.normal.kind !== 'batch'
        ? undefined
        : byDecision.get(
            semanticAddressKey(createExitDecisionAddress(source.biome, decision.source)),
          ),
    countForOccurrence: (occurrenceId: OccurrenceId) => byOccurrence.get(occurrenceId),
  });
}
