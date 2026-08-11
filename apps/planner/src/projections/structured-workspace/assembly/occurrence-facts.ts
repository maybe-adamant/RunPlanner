import {
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  selectedExitContinuation,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceBiomeSource } from '../source-index';

/** The only biome-wide fact an occurrence package needs from authored topology. */
export interface WorkspaceOccurrenceAssemblyFact {
  readonly authoredAdditionalExitKeys: readonly string[];
  readonly detailsActive: boolean;
  readonly occurrenceId: OccurrenceId;
  /** The authored decision spine hosts this room's post-outgoing settlement. */
  readonly postOutgoingSettlement: boolean;
}

/**
 * Immutable occurrence activation lookup for one authored biome. Local leaf
 * state belongs to occurrence assembly; Fields counts have their own
 * decision-owned derivation.
 */
export interface WorkspaceBiomeOccurrenceAssemblyFacts {
  readonly occurrence: (occurrenceId: OccurrenceId) => WorkspaceOccurrenceAssemblyFact | undefined;
}

/**
 * Detail activation is authored topology, not evaluator reachability. A
 * selected retained room keeps its declaration-owned editable surface even
 * when evaluation cannot enter it yet.
 */
function authoredDetailsActiveOccurrenceIds(plan: AuthoredBiomePlan): ReadonlySet<OccurrenceId> {
  const active = new Set<OccurrenceId>();
  const topology = plan.topology;
  if (topology === null) return active;
  active.add(topology.startOccurrenceId);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const slotKey of decision.visitOrder) {
        const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        if (target !== undefined) active.add(target.occurrenceId);
      }
      continue;
    }
    const sourceOccurrenceId =
      decision.source.kind === 'occurrence' ? decision.source.occurrenceId : undefined;
    const continuation = selectedExitContinuation(
      decision,
      sourceOccurrenceId === undefined
        ? undefined
        : topology.occurrences.find((occurrence) => occurrence.occurrenceId === sourceOccurrenceId)
            ?.additionalExits,
    );
    if (continuation?.kind === 'normal') active.add(continuation.target.occurrenceId);
    if (continuation?.kind === 'additional') active.add(continuation.exit.occurrenceId);
  }
  return active;
}

export function createWorkspaceBiomeOccurrenceAssemblyFacts(
  source: WorkspaceBiomeSource,
): WorkspaceBiomeOccurrenceAssemblyFacts {
  const active = authoredDetailsActiveOccurrenceIds(source.plan);
  const postOutgoingSettlementOwners = new Set<OccurrenceId>(
    (source.plan.topology?.decisions ?? []).flatMap((decision) =>
      decision.kind === 'exit' && decision.source.kind === 'occurrence'
        ? [decision.source.occurrenceId]
        : [],
    ),
  );
  const byOccurrence = new Map<OccurrenceId, WorkspaceOccurrenceAssemblyFact>();
  for (const occurrence of source.plan.topology?.occurrences ?? []) {
    if (byOccurrence.has(occurrence.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(source.biome, occurrence.occurrenceId))} has duplicate authored occurrence facts`,
      );
    }
    byOccurrence.set(
      occurrence.occurrenceId,
      Object.freeze({
        authoredAdditionalExitKeys: Object.freeze(
          (occurrence.additionalExits ?? []).map((additional) => additional.key),
        ),
        detailsActive: active.has(occurrence.occurrenceId),
        occurrenceId: occurrence.occurrenceId,
        postOutgoingSettlement: postOutgoingSettlementOwners.has(occurrence.occurrenceId),
      }),
    );
  }
  return Object.freeze({
    occurrence: (occurrenceId: OccurrenceId) => byOccurrence.get(occurrenceId),
  });
}
