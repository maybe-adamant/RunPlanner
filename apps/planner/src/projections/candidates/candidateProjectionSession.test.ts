import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createTargetAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  discoverAuthoredTraitCarrierChildren,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';
import { candidateSupport, createCandidateSessionFactory } from './candidateProjection';
import { createCandidateProjectionCore } from './candidateProjectionSession';
import { createTraitCandidateAdapters } from './candidateTraitAdapters';

function fPlan(project: ReturnType<typeof createGoldenFGHIProject>) {
  const plan = project.route.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan?.topology === null || plan === undefined) throw new Error('F topology is missing');
  return plan;
}

describe('candidate projection session core', () => {
  it('caches child domains by complete draft and child within the exact assembly', () => {
    const project = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const factory = createCandidateProjectionCore(catalog, {});
    const core = { ...factory.bind(assembly) };
    const evaluate = vi.spyOn(core, 'evaluate');
    const session = createTraitCandidateAdapters(core);
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      'source',
    );
    // Context-invalid drafts still own repairable children and use the same cache boundary.
    const draft: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Hera',
      options: [
        { traitKey: 'AllElementalBoon', rarity: 'Legendary' },
        { traitKey: 'HeraManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    };
    const children = discoverAuthoredTraitCarrierChildren(catalog, trait, draft);
    const earth = children[0]!;
    const fire = children[1]!;
    expect(evaluate).not.toHaveBeenCalled();
    const first = session.traitCarrierChildDomain(trait, draft, earth);
    expect(session.traitCarrierChildDomain(trait, draft, earth)).toBe(first);
    expect(evaluate).toHaveBeenCalledTimes(1);
    session.traitCarrierChildDomain(trait, draft, fire);
    expect(evaluate).toHaveBeenCalledTimes(2);
    const siblingEdit: AuthoredTraitOfferTraits = {
      ...draft,
      options: [draft.options[0], { traitKey: 'HeraSprintBoon', rarity: 'Common' }],
    };
    session.traitCarrierChildDomain(trait, siblingEdit, earth);
    expect(evaluate).toHaveBeenCalledTimes(3);
    const next = createTraitCandidateAdapters(
      factory.bind(simulateProjectAssembly(catalog, project)),
    );
    expect(next.traitCarrierChildDomain(trait, draft, earth)).not.toBe(first);
  });

  it('keeps one bound session and one cached query domain per assembly identity', () => {
    const project = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const observeCandidateEvaluation = vi.fn();
    const factory = createCandidateSessionFactory(catalog, { observeCandidateEvaluation });
    const session = factory.bind(assembly);

    expect(factory.bind(assembly)).toBe(session);

    const first = fPlan(project).topology!.decisions.find((decision) => decision.kind === 'exit');
    if (first?.kind !== 'exit' || first.normal.kind !== 'batch') {
      throw new Error('F first batch is missing');
    }
    const target = first.normal.targets[0];
    if (target === undefined) throw new Error('F first target is missing');
    const address = createTargetAddress(
      createBiomeAddress('Underworld', 'F'),
      first.source,
      target.exitKey,
    );
    const rooms = [catalog.rooms.byKey.F_Combat02!];

    const one = session.roomTargets(address, rooms);
    const two = session.roomTargets(address, rooms);

    expect(one).toBe(two);
    expect(one[0]?.evaluation.kind).toBe('roomTarget');
    expect(candidateSupport(one[0])).toBe('possible');
    expect(observeCandidateEvaluation).toHaveBeenCalledTimes(1);
  });
});
