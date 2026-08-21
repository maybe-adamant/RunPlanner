import {
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredBiomePlan,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject, nBiome } from '@run-planner/test-fixtures/surface';
import { expectedWorkspaceTopologyManifest } from './expected-topology';

describe('structured workspace topology expectations', () => {
  it('derives structural owners without turning orphan records into workspace owners', () => {
    const project = loadSurfaceNProject();
    const plan = project.routes
      .find((route) => route.routeKey === nBiome.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === nBiome.biomeKey);
    if (plan?.topology === null || plan === undefined) {
      throw new Error('Surface/N topology fixture is missing');
    }
    const orphan = plan.topology.occurrences[0];
    if (orphan === undefined) throw new Error('Surface/N occurrence fixture is missing');
    const planWithOrphan: AuthoredBiomePlan = {
      ...plan,
      topology: {
        ...plan.topology,
        occurrences: Object.freeze([
          ...plan.topology.occurrences,
          Object.freeze({
            ...orphan,
            occurrenceId: createOccurrenceId('expected-topology-orphan'),
          }),
        ]),
      },
    };

    const expected = expectedWorkspaceTopologyManifest(nBiome, planWithOrphan);
    const hub = plan.topology.decisions.find((decision) => decision.kind === 'hub');
    const firstTarget = hub?.openTargets[0];
    const firstVisit = hub?.visitOrder[0];
    if (hub === undefined || firstTarget === undefined || firstVisit === undefined) {
      throw new Error('Surface/N Hub owner fixture is missing');
    }

    expect(
      expected.occurrences.some((owner) => owner.occurrenceId === 'expected-topology-orphan'),
    ).toBe(false);
    expect(expected.hubSlots).toContainEqual({
      address: createHubSlotAddress(nBiome, hub.hubKey, firstTarget.hubSlotKey),
      hubAddress: expected.hubDecisions[0]?.address,
      hubSlotKey: firstTarget.hubSlotKey,
      occurrenceId: firstTarget.occurrenceId,
    });
    expect(expected.hubVisits).toContainEqual({
      address: createHubVisitAddress(nBiome, hub.hubKey, 1),
      hubAddress: expected.hubDecisions[0]?.address,
      hubSlotKey: firstVisit,
      visitIndex: 1,
    });
    expect(
      new Set(expected.occurrences.map((owner) => semanticAddressKey(owner.address))).size,
    ).toBe(expected.occurrences.length);
  });
});
