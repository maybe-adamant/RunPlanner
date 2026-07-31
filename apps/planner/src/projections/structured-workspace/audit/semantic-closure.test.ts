import { catalog } from '@run-planner/hades2-catalog';
import {
  createLocalChildAddress,
  createLocalRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject, type SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../../test/fixtures/surfaceProject';
import { createCandidateSessionFactory } from '../../candidateProjection';
import { createContextualOptionResolver } from '../../contextualOptions';
import { createContextualPickerProjection } from '../../contextualPicker';
import { createRewardPickerProjection } from '../../rewardPicker';
import { createStructuredWorkspaceProjection } from '../projector';
import { authoredWorkspaceLeafRequirements } from './authored-leaf-expectations';
import {
  assertAuthoredWorkspaceLeafProjectionClosure,
  assertWorkspaceProjectionClosure,
} from './semantic-closure';

const projection = createStructuredWorkspaceProjection(catalog, {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker: createContextualPickerProjection(createContextualOptionResolver(catalog)),
  rewardPicker: createRewardPickerProjection(
    catalog,
    createContextualPickerProjection(createContextualOptionResolver(catalog)),
  ),
});

describe('workspace semantic closure', () => {
  it('rejects omitted expected leaves and withheld fine-grained finding owners', () => {
    const project = createRepresentativeNOPQProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const reward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor2',
    );
    const requirement = authoredWorkspaceLeafRequirements(catalog, nBiome, plan).find(
      (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(reward),
    );
    if (requirement === undefined) throw new Error('N side-room reward requirement is missing');

    const projected = projection.project(project, simulateProject(catalog, project));
    const biome = projected.routes
      .flatMap((route) => route.biomes)
      .find((candidate) => candidate.biomeKey === 'N');
    if (biome === undefined) throw new Error('projected N biome is missing');

    expect(() =>
      assertAuthoredWorkspaceLeafProjectionClosure(
        [requirement],
        projected.focusByOwner,
        biome.nodes.filter((node) => node.kind !== 'occurrenceWorkbench'),
      ),
    ).toThrow(/required authored leaf has no workspace marker/);

    const withheldFinding = {
      code: 'sideRoomGenerationUnavailable',
      evidence: {},
      origin: createLocalChildAddress(nBiome, nOccurrenceId('combat10'), 'sideRooms', 'sideDoor1'),
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;
    expect(() =>
      assertWorkspaceProjectionClosure(
        nBiome,
        [withheldFinding],
        projected.focusByOwner,
        plan,
        biome.nodes,
      ),
    ).toThrow(/finding has no exact workspace marker/);
  });
});
