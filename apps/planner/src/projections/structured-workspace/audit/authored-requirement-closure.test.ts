import { catalog } from '@run-planner/hades2-catalog';
import {
  createLocalRewardAddress,
  semanticAddressKey,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../../test/fixtures/surfaceProject';
import { authoredWorkspaceLeafRequirements } from './authored-leaf-expectations';
import { assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements } from './authored-requirement-closure';
import type {
  WorkspaceBiomeOccurrenceAssemblyFacts,
  WorkspaceOccurrenceAssemblyFact,
} from '../occurrence-facts';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from '../occurrence-facts';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function nSource() {
  const project = createRepresentativeNOPQProject();
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.plan.biomeKey === 'N');
  if (source === undefined) throw new Error('Surface/N source is missing');
  return source;
}

function factsWithOccurrence(
  facts: WorkspaceBiomeOccurrenceAssemblyFacts,
  occurrenceId: OccurrenceId,
  transform: (fact: WorkspaceOccurrenceAssemblyFact) => WorkspaceOccurrenceAssemblyFact,
): WorkspaceBiomeOccurrenceAssemblyFacts {
  const occurrences = Object.freeze(
    facts.occurrences.map((fact) => (fact.occurrenceId === occurrenceId ? transform(fact) : fact)),
  );
  const leafFor = (address: SemanticAddress) => {
    const key = semanticAddressKey(address);
    return occurrences
      .flatMap((fact) => fact.leaves)
      .find((leaf) => semanticAddressKey(leaf.address) === key);
  };
  return Object.freeze({
    biome: facts.biome,
    occurrences,
    leafLifecycle: (address: SemanticAddress) => leafFor(address)?.lifecycle ?? 'absent',
    leafSurface: (address: SemanticAddress) => leafFor(address)?.surface ?? 'absent',
    occurrence: (id: OccurrenceId) => occurrences.find((fact) => fact.occurrenceId === id),
  });
}

function factsWithLeaf(
  facts: WorkspaceBiomeOccurrenceAssemblyFacts,
  occurrenceId: OccurrenceId,
  address: SemanticAddress,
  lifecycle: 'active' | 'dormant',
  surface: 'published' | 'withheld',
): WorkspaceBiomeOccurrenceAssemblyFacts {
  const addressKey = semanticAddressKey(address);
  return factsWithOccurrence(facts, occurrenceId, (fact) => {
    const leaves = Object.freeze(
      fact.leaves.map((leaf) =>
        semanticAddressKey(leaf.address) === addressKey ? { ...leaf, lifecycle, surface } : leaf,
      ),
    );
    const leafFor = (candidate: SemanticAddress) =>
      leaves.find((leaf) => semanticAddressKey(leaf.address) === semanticAddressKey(candidate));
    return Object.freeze({
      ...fact,
      leaves,
      leafLifecycle: (candidate: SemanticAddress) => leafFor(candidate)?.lifecycle ?? 'absent',
      leafSurface: (candidate: SemanticAddress) => leafFor(candidate)?.surface ?? 'absent',
    });
  });
}

describe('authored requirement closure', () => {
  it('rejects occurrence facts that disagree with independently expected authored leaves', () => {
    const source = nSource();
    const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(catalog, source);
    const requirements = authoredWorkspaceLeafRequirements(catalog, nBiome, source.plan);
    const activeEphyra = nOccurrenceId('combat05');
    const dormantEphyra = nOccurrenceId('combat10');
    const activeSideReward = createLocalRewardAddress(
      nBiome,
      activeEphyra,
      'sideRooms',
      'sideDoor1',
    );
    const dormantSideReward = createLocalRewardAddress(
      nBiome,
      dormantEphyra,
      'sideRooms',
      'sideDoor1',
    );

    expect(() =>
      assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
        factsWithOccurrence(facts, activeEphyra, (fact) => ({ ...fact, detailsActive: false })),
        source.plan,
        requirements,
      ),
    ).toThrow(/incorrect authored detail activation/);
    expect(() =>
      assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
        factsWithLeaf(facts, activeEphyra, activeSideReward, 'active', 'withheld'),
        source.plan,
        requirements,
      ),
    ).toThrow(/withheld authored occurrence leaf is unexpectedly required/);
    expect(() =>
      assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
        factsWithLeaf(facts, dormantEphyra, dormantSideReward, 'active', 'published'),
        source.plan,
        requirements,
      ),
    ).toThrow(
      /active authored occurrence leaf is absent from the independent closure requirements/,
    );
  });
});
