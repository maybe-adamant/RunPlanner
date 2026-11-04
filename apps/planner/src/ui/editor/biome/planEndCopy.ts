import type { WorkspacePlanEndRelation } from '@planner/projections/structured-workspace';

/** A room's, visit's or biome's place against the plan end, in words. */
export function planEndLabel(relation: WorkspacePlanEndRelation): string {
  return relation === 'end' ? 'Plan ends here' : 'Past the plan end';
}
