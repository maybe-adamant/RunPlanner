import {
  createBiomeAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import type { WorkspaceInspectorDestination, WorkspaceRoute } from '../contract';
import { assertFineGrainedFindingDestination } from './finding-routing';

const biome = createBiomeAddress('Surface', 'N');
const owner = createLocalChildAddress(
  biome,
  createOccurrenceId('finding-routing-room'),
  'sideRooms',
  'A',
);

function destination(
  overrides: Partial<WorkspaceInspectorDestination> = {},
): WorkspaceInspectorDestination {
  return {
    biomeKey: biome.biomeKey,
    focusAddress: owner,
    focusKey: semanticAddressKey(owner),
    inspectorSubject: { kind: 'node', nodeKey: 'containing-node' },
    nodeKey: 'containing-node',
    ownerAddress: owner,
    region: 'structure',
    routeKey: biome.routeKey,
    ...overrides,
  };
}

const routes = [
  {
    biomes: [{ biomeKey: biome.biomeKey, nodes: [{ key: 'containing-node' }] }],
    routeKey: biome.routeKey,
  },
] as unknown as readonly WorkspaceRoute[];

describe('fine-grained finding routing', () => {
  it('requires an exact final structural inspector subject, not a default fallback', () => {
    expect(() => assertFineGrainedFindingDestination(owner, destination(), routes)).not.toThrow();

    expect(() =>
      assertFineGrainedFindingDestination(
        owner,
        destination({ inspectorSubject: { kind: 'node', nodeKey: 'default-node' } }),
        routes,
      ),
    ).toThrow(/finding has no exact workspace inspector destination/);
  });

  it('accepts an exact fine owner redirected to its containing Hub subject', () => {
    const reward = createIncomingRewardAddress(biome, createOccurrenceId('redirected-Hub-reward'));
    const hub = createHubDecisionAddress(biome, 'hub');

    expect(() =>
      assertFineGrainedFindingDestination(
        reward,
        destination({
          focusAddress: hub,
          focusKey: semanticAddressKey(hub),
          ownerAddress: reward,
        }),
        routes,
      ),
    ).not.toThrow();
  });

  it('requires the exact subject node to exist in the routed biome', () => {
    expect(() =>
      assertFineGrainedFindingDestination(
        owner,
        destination({
          nodeKey: 'missing-node',
          inspectorSubject: { kind: 'node', nodeKey: 'missing-node' },
        }),
        routes,
      ),
    ).toThrow(/finding has no exact workspace inspector destination/);
  });
});
