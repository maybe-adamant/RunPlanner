import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type { LevelResolutionCandidateProjection } from '@planner/projections/candidates/candidateProjection';
import { projectLevelResolutionTargetPicker } from '@planner/projections/contextual/levelResolutionTargetPicker';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

function candidate(
  available: readonly string[],
  findings: readonly string[] = [],
): LevelResolutionCandidateProjection {
  return {
    surface: {
      effectKind: 'choice',
      levelCount: 1,
      requiredOfferCount: 2,
      eligibleTargetTraitKeys: ['A', 'B', 'C'],
    },
    evaluation: {
      supported: findings.length === 0,
      findings,
      rerolledScreenFindings: [],
      availableTargetTraitKeys: available,
    },
  };
}

const picker = (input: { candidate: LevelResolutionCandidateProjection; current: string | null }) =>
  projectLevelResolutionTargetPicker({
    ...input,
    traitLabel: (key) => `Trait ${key}`,
  });

const items = (model: ReturnType<typeof picker>) =>
  model.sections.flatMap((section) =>
    section.items.map((item) => [section.kind, item.value, item.disabled, item.selected]),
  );

describe('Pom target picker projection', () => {
  it('lets a slot keep its own target and disables targets another slot holds', () => {
    expect(items(picker({ candidate: candidate(['C']), current: 'B' }))).toEqual([
      ['category', 'A', true, false],
      ['category', 'B', false, true],
      ['category', 'C', false, false],
    ]);
  });

  it('pins a retained ineligible current target with its finding copy', () => {
    const model = picker({
      candidate: candidate(['A', 'B', 'C'], ['targetUnavailable']),
      current: 'Stale',
    });
    expect(model.sections[0]).toMatchObject({
      kind: 'selectedInvalid',
      items: [
        {
          value: 'Stale',
          disabled: false,
          explanations: ['Pom target unavailable'],
        },
      ],
    });
    expect(model.sections[0]?.items[0]?.status).toBeUndefined();
    expect(model.selected?.value).toBe('Stale');
  });

  it('carries the engine starting draft and available targets through the bound Pom', () => {
    const { workspace } = projectStructuredWorkspaceFixture(createGoldenFGHIProject());
    const interaction = [...workspace.interactions.levelResolutions.values()].find(
      (candidate) => candidate.value.kind === 'choice',
    );
    if (interaction === undefined) throw new Error('reached room Pom is missing');
    const loaded = interaction.load({
      kind: 'choice',
      offeredTraitKeys: [],
      selectedTraitKey: null,
    });
    const start = loaded?.surface.startingResolution;
    if (start?.kind !== 'choice') throw new Error('choice Pom has no starting draft');
    const started = interaction.load(start);
    expect(started?.evaluation).toMatchObject({ supported: true });
    const available = started?.evaluation.availableTargetTraitKeys;
    expect(available).toBeDefined();
    expect(start.offeredTraitKeys.some((key) => available?.includes(key))).toBe(false);
  });
});
