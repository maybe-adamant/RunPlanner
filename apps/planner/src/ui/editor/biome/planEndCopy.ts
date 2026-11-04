import type {
  WorkspaceHubDecisionNode,
  WorkspacePlanEndRelation,
} from '@planner/projections/structured-workspace';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

/** A room's, visit's or biome's place against the plan end, in words. */
export function planEndLabel(relation: WorkspacePlanEndRelation): string {
  return relation === 'end' ? 'Plan ends here' : 'Past the plan end';
}

/** Why a Hub's visit order cannot change yet; a Hub the plan ends in keeps its visits. */
export function hubVisitOrderWaitingHint(node: WorkspaceHubDecisionNode): string {
  return node.planEnd === 'end' ? 'Remove the plan end to change visits.' : candidateWaitingHint;
}
