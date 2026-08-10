import { catalog } from '@run-planner/hades2-catalog';
import { createOccurrenceId, type ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

import {
  createCandidateSessionFactory,
  type CandidateSessionFactoryOptions,
} from '@planner/projections/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { createTraitDomainProjection } from '@planner/projections/traitDomainProjection';
import {
  createStructuredWorkspaceProjection,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
} from '@planner/projections/structured-workspace';

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
  let nextOccurrence = 1;
  const allocateOccurrenceId = () =>
    createOccurrenceId(`structured-workspace-test-${nextOccurrence++}`);
  const candidateSessions = createCandidateSessionFactory(catalog, options);
  const contextualPicker = createContextualPickerProjection(
    createContextualOptionResolver(catalog),
  );
  const rewardPicker = createRewardPickerProjection(catalog, contextualPicker);
  const traitDomain = createTraitDomainProjection(catalog, contextualPicker);
  return Object.freeze({
    candidateSessions,
    structuredWorkspace: createStructuredWorkspaceProjection(
      catalog,
      {
        candidateSessions,
        contextualPicker,
        rewardPicker,
        traitDomain,
      },
      allocateOccurrenceId,
    ),
  });
}

export function projectStructuredWorkspaceFixture(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  const evaluation = assembly.evaluation;
  const workspace = createStructuredWorkspaceTestServices().structuredWorkspace.project(assembly);
  return Object.freeze({ assembly, evaluation, workspace });
}
