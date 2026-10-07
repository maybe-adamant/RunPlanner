import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createRouteAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

describe('route loadout edit domain', () => {
  it('publishes the engine Arcana toggles and Vow ranks for the authored loadout', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'LimitGraspShrineUpgrade',
      rank: 2,
    });
    const domain = projectStructuredWorkspaceFixture(project).workspace.route.loadoutEditDomain;
    expect(domain.fearVows.find((vow) => vow.key === 'LimitGraspShrineUpgrade')).toMatchObject({
      rank: 2,
      maximum: 4,
    });
    const toggle = domain.manualArcana[0];
    expect(toggle?.arcanaKeys.includes(toggle.key)).toBe(!toggle?.selected);
    expect(domain.manualArcana.some((card) => card.key === 'BonusRarity')).toBe(false);
  });
});
