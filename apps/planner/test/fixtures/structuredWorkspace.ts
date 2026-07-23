import { catalog } from '@run-planner/hades2-catalog';

import {
  createCandidateSessionFactory,
  type CandidateSessionFactoryOptions,
} from '../../src/projections/candidateProjection';
import { createContextualOptionResolver } from '../../src/projections/contextualOptions';
import { createContextualPickerProjection } from '../../src/projections/contextualPicker';
import { createRewardPickerProjection } from '../../src/projections/rewardPicker';
import { createStructuredWorkspaceProjection } from '../../src/projections/structuredWorkspace';

export function createStructuredWorkspaceTestServices(
  options: CandidateSessionFactoryOptions = {},
) {
  const candidateSessions = createCandidateSessionFactory(catalog, options);
  const contextualPicker = createContextualPickerProjection(
    createContextualOptionResolver(catalog),
  );
  const rewardPicker = createRewardPickerProjection(catalog, contextualPicker);
  return Object.freeze({
    candidateSessions,
    structuredWorkspace: createStructuredWorkspaceProjection(catalog, {
      candidateSessions,
      contextualPicker,
      rewardPicker,
    }),
  });
}
