import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  semanticAddressKey,
  type HubDecision,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNProject } from '../fixtures/surfaceProject';
import { expectedWorkspaceStructuralControls } from './structuredWorkspaceStructuralControls';

const biome = createBiomeAddress('Surface', 'N');

function nPlan() {
  const plan = createRepresentativeNProject()
    .routes.find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan === undefined) throw new Error('Surface/N fixture is missing');
  return plan;
}

describe('structured workspace structural-control expectations', () => {
  it('derives Hub slot and next-visit interaction identities from authored state', () => {
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
    expect(controls.filter((control) => control.kind === 'hubVisit')).toHaveLength(
      Math.min(layout.progression.requiredVisits, hub.visitOrder.length + 1),
    );

    const slot = createHubSlotAddress(biome, layout.progression.hubKey, 'combat05');
    const visit = createHubVisitAddress(biome, layout.progression.hubKey, 1);
    expect(controls).toContainEqual({
      key: semanticAddressKey(slot),
      kind: 'hubSlot',
      owner: slot,
    });
    expect(controls).toContainEqual({
      key: semanticAddressKey(visit),
      kind: 'hubVisit',
      owner: visit,
    });
  });
});
