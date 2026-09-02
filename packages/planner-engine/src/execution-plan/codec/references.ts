import { fail } from './primitives';
import { validateExecutionGraph } from '../graph-validation';
import type { ExecutionPlan } from '../model';

export function validateExecutionReferences(plan: ExecutionPlan): void {
  validateExecutionGraph(plan, fail);
}
