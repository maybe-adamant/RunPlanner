import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from '@planner/projections/candidateProjection';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceCandidateInteraction, WorkspaceInteractionChoice } from '../contract';
import { workspaceInteractionKey } from '../contract';

function candidateInteraction<T>(
  owner: SemanticAddress,
  choices: readonly WorkspaceInteractionChoice<T>[],
  selected: T | undefined,
  load: () => readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
  key = workspaceInteractionKey(owner),
): WorkspaceCandidateInteraction<T> {
  return Object.freeze({
    choices: Object.freeze([...choices]),
    key,
    load,
    owner,
    ...(selected === undefined ? {} : { selected }),
  });
}

export { candidateInteraction };
