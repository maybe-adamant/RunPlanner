import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { ProjectEvaluation } from '@run-planner/engine/simulation';

import { createCandidateProjectionService } from '../../src/projections/candidateProjection';
import { createContextualOptionResolver } from '../../src/projections/contextualOptions';
import { createContextualPickerProjection } from '../../src/projections/contextualPicker';
import { createRewardPickerProjection } from '../../src/projections/rewardPicker';
import { createStructuredWorkspaceProjection } from '../../src/projections/structuredWorkspace';

export function createStructuredWorkspaceTestServices(
  evaluateProject: (project: ProjectDocument) => ProjectEvaluation,
) {
  const candidateProjection = createCandidateProjectionService(catalog, evaluateProject);
  const contextualPicker = createContextualPickerProjection(
    createContextualOptionResolver(catalog),
  );
  const rewardPicker = createRewardPickerProjection(catalog, contextualPicker);
  return Object.freeze({
    candidateProjection,
    structuredWorkspace: createStructuredWorkspaceProjection(catalog, {
      candidateProjection,
      contextualPicker,
      rewardPicker,
    }),
  });
}
