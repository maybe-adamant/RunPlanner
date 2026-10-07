import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type { LevelResolutionCandidateGroup } from '@planner/projections/candidates/candidateProjection';
import { projectLevelResolutionTargetPicker } from '@planner/projections/contextual/levelResolutionTargetPicker';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

function group(
  available: readonly string[],
  findings: readonly string[] = [],
): LevelResolutionCandidateGroup {
  return {
    key: 'branch-0',
    branchIndices: [0],
    surface: {
      effectKind: 'choice',
      levelCount: 1,
      requiredOfferCount: 2,
      eligibleTargetTraitKeys: ['A', 'B', 'C'],
    },
    evaluations: [
      {
        branchIndex: 0,
        supported: findings.length === 0,
        findings,
        availableTargetTraitKeys: available,
      },
    ],
  };
}

const picker = (input: { group: LevelResolutionCandidateGroup; current: string | null }) =>
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
    expect(items(picker({ group: group(['C']), current: 'B' }))).toEqual([
      ['category', 'A', true, false],
      ['category', 'B', false, true],
      ['category', 'C', false, false],
    ]);
  });

  it('pins a retained ineligible current target with its finding copy', () => {
    const model = picker({
      group: group(['A', 'B', 'C'], ['targetUnavailable']),
      current: 'Stale',
    });
    expect(model.sections[0]).toMatchObject({
      kind: 'selectedInvalid',
      items: [
        {
          value: 'Stale',
          disabled: false,
          status: 'Current · unavailable',
          explanation: 'Pom target unavailable',
        },
      ],
    });
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
    const start = loaded?.groups[0]?.surface.startingResolution;
    if (start?.kind !== 'choice') throw new Error('choice Pom has no starting draft');
    const startGroup = interaction.load(start)?.groups[0];
    expect(startGroup?.evaluations[0]).toMatchObject({ supported: true });
    const available = startGroup?.evaluations[0]?.availableTargetTraitKeys;
    expect(available).toBeDefined();
    expect(start.offeredTraitKeys.some((key) => available?.includes(key))).toBe(false);
  });
});
