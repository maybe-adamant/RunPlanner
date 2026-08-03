import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  semanticAddressKey,
  type HubDecision,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNProject } from '@run-planner/test-fixtures';
import { expectedWorkspaceStructuralControls } from './expected-structural-controls';

const biome = createBiomeAddress('Surface', 'N');

function nPlan() {
  const plan = createRepresentativeNProject()
    .routes.find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan === undefined) throw new Error('Surface/N fixture is missing');
  return plan;
}

describe('structured workspace structural-control expectations', () => {
  it('derives Hub slot controls and one decision-owned visit-order interaction', () => {
    const plan = nPlan();
    const controls = expectedWorkspaceStructuralControls(catalog, biome, plan);
    const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
    if (layout?.progression.kind !== 'hub' || plan.topology === null) {
      throw new Error('Surface/N Hub fixture is missing');
    }

    expect(controls.filter((control) => control.kind === 'hubSlot')).toHaveLength(
      layout.progression.slots.length,
    );
    const hub = plan.topology.decisions.find(
      (decision): decision is HubDecision => decision.kind === 'hub',
    );
    if (hub === undefined) throw new Error('Surface/N authored Hub is missing');
    expect(controls.filter((control) => control.kind === 'hubVisitOrder')).toHaveLength(1);

    const slot = createHubSlotAddress(biome, layout.progression.hubKey, 'combat05');
    const hubOwner = createHubDecisionAddress(biome, layout.progression.hubKey);
    expect(controls).toContainEqual({
      key: semanticAddressKey(slot),
      kind: 'hubSlot',
      owner: slot,
    });
    expect(controls).toContainEqual({
      key: semanticAddressKey(hubOwner),
      kind: 'hubVisitOrder',
      owner: hubOwner,
    });
  });
});
