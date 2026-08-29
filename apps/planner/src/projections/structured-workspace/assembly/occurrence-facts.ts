import {
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  selectedExitContinuation,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import type {
  ChaosCandidateCapability,
  ZagreusContractCandidateCapability,
} from '@run-planner/engine/simulation';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceBiomeSource } from '../source-index';

/** The only biome-wide fact an occurrence package needs from authored topology. */
export interface WorkspaceOccurrenceAssemblyFact {
  readonly authoredAdditionalExitKeys: readonly string[];
  readonly detailsActive: boolean;
  readonly chaosPlacement?: ChaosCandidateCapability;
  readonly chaosGateForced: boolean;
  readonly zagreusContractPlacement?: ZagreusContractCandidateCapability;
  readonly occurrenceId: OccurrenceId;
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
    if (decision.kind === 'localVisit') {
      for (const occurrenceId of decision.visitOrder) active.add(occurrenceId);
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
  for (const link of topology.fixedRoomLinks) active.add(link.targetOccurrenceId);
  return active;
}

export function createWorkspaceBiomeOccurrenceAssemblyFacts(
  source: WorkspaceBiomeSource,
): WorkspaceBiomeOccurrenceAssemblyFacts {
  const active = authoredDetailsActiveOccurrenceIds(source.plan);
  const byOccurrence = new Map<OccurrenceId, WorkspaceOccurrenceAssemblyFact>();
  const topologyOccurrences = source.plan.topology?.occurrences ?? [];
  for (const occurrence of topologyOccurrences) {
    if (byOccurrence.has(occurrence.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(source.biome, occurrence.occurrenceId))} has duplicate authored occurrence facts`,
      );
    }
    const occurrenceAddress = createOccurrenceAddress(source.biome, occurrence.occurrenceId);
    const chaosPlacement = source.chaosAssessment(occurrenceAddress);
    const zagreusContractPlacement = source.zagreusContractAssessment(occurrenceAddress);
    byOccurrence.set(
      occurrence.occurrenceId,
      Object.freeze({
        authoredAdditionalExitKeys: Object.freeze(
          (occurrence.additionalExits ?? []).map((additional) => additional.key),
        ),
        detailsActive: active.has(occurrence.occurrenceId),
        ...(chaosPlacement === undefined ? {} : { chaosPlacement }),
        ...(zagreusContractPlacement === undefined ? {} : { zagreusContractPlacement }),
        chaosGateForced: source.chaosGateForced(occurrenceAddress),
        occurrenceId: occurrence.occurrenceId,
      }),
    );
  }
  return Object.freeze({
    occurrence: (occurrenceId: OccurrenceId) => byOccurrence.get(occurrenceId),
  });
}
