import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';

import {
  createCandidateSessionFactory,
  type CandidateSessionFactoryOptions,
} from '../../src/projections/candidateProjection';
import { createContextualOptionResolver } from '../../src/projections/contextualOptions';
import { createContextualPickerProjection } from '../../src/projections/contextualPicker';
import { createRewardPickerProjection } from '../../src/projections/rewardPicker';
import {
  createStructuredWorkspaceProjection,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
} from '../../src/projections/structured-workspace';

export function requireWorkspaceBiome(
  workspace: StructuredWorkspaceProjection,
  biomeKey: string,
): WorkspaceBiome {
  const biome = workspace.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${biomeKey} has no workspace projection`);
  return biome;
}

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

export function projectStructuredWorkspaceFixture(project: ProjectDocument) {
  const evaluation = simulateProject(catalog, project);
  const workspace = createStructuredWorkspaceTestServices().structuredWorkspace.project(
    project,
    evaluation,
  );
  return Object.freeze({ evaluation, workspace });
}
