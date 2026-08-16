import {
  createAllTogetherSetAddress,
  createBiomeAddress,
  createCompletionRoomAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createKeepsakeEquipResultAddress,
  createLocalChildAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { WorkspaceInspectorDestination, WorkspaceRoute } from '../contract';
import {
  assertFineGrainedFindingDestination,
  isFineGrainedFindingOwner,
  registerWorkspaceFindingDestinations,
} from './finding-routing';

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

  it('accepts an exact fine owner rendered by the active authoring frontier', () => {
    const frontierKey = 'active-authoring-frontier';
    const frontierRoutes = [
      {
        biomes: [
          {
            biomeKey: biome.biomeKey,
            frontier: { marker: { focusKey: frontierKey } },
            nodes: [],
          },
        ],
        routeKey: biome.routeKey,
      },
    ] as unknown as readonly WorkspaceRoute[];
    expect(() =>
      assertFineGrainedFindingDestination(
        owner,
        destination({
          inspectorSubject: { kind: 'frontier', frontierFocusKey: frontierKey },
          nodeKey: semanticAddressKey(owner),
        }),
        frontierRoutes,
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

  it('treats a live fine-grained finding without its exact destination as a projection contract failure', () => {
    const finding = {
      code: 'rewardBagEntryUnavailable',
      evidence: {},
      origin: owner,
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;

    expect(() => registerWorkspaceFindingDestinations([finding], new Map(), routes)).toThrow(
      /finding has no exact workspace destination/,
    );
  });

  it('requires an exact destination for an active encounter-phase finding', () => {
    const phase = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('finding-routing-encounter') },
      'Combat2',
    );
    const finding = {
      code: 'encounterSlotActivationUnavailable',
      evidence: {},
      origin: phase,
      phase: 'encounterResolution',
      severity: 'error',
    } as const satisfies SemanticFinding;

    expect(() => registerWorkspaceFindingDestinations([finding], new Map(), routes)).toThrow(
      /finding has no exact workspace destination/,
    );
  });

  it('treats an All Together set as an exact fine-grained trait child', () => {
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('all-together-finding')),
      'source',
    );
    const set = createAllTogetherSetAddress(trait, 'option1', 'earth');
    const exact = destination({
      focusAddress: set,
      focusKey: semanticAddressKey(set),
      ownerAddress: set,
      traitDialogTarget: trait,
    });
    const finding = {
      code: 'allTogetherResultUnavailable',
      evidence: {},
      origin: set,
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;
    const focusByOwner = new Map([[semanticAddressKey(set), exact]]);

    expect(isFineGrainedFindingOwner(set)).toBe(true);
    expect(() =>
      registerWorkspaceFindingDestinations([finding], focusByOwner, routes),
    ).not.toThrow();
    expect(focusByOwner.get(semanticAddressKey(set))?.traitDialogTarget).toEqual(trait);
  });

  it('routes a Gorgon finding to its exact Gorgon phase owner', () => {
    const phase = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('finding-routing-gorgon') },
      'Combat',
    );
    const finding = {
      code: 'rewardAcquisitionUnavailable',
      evidence: {},
      origin: createGorgonPhaseAddress(phase),
      phase: 'rewardGeneration',
      severity: 'error',
    } as const satisfies SemanticFinding;
    const exact = destination({
      focusAddress: phase,
      focusKey: semanticAddressKey(phase),
      ownerAddress: finding.origin,
    });
    const focusByOwner = new Map([[semanticAddressKey(finding.origin), exact]]);
    registerWorkspaceFindingDestinations([finding], focusByOwner, routes);
    expect(focusByOwner.get(semanticAddressKey(finding.origin))).toEqual(exact);
  });

  it('requires a Postboss equip result to route through its exact completion inspector', () => {
    const selection = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(biome, 'postboss'),
    );
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
    const finding = {
      code: 'keepsakeEquipResultMissing',
      evidence: {},
      origin: result,
      phase: 'completeness',
      severity: 'error',
    } as const satisfies SemanticFinding;
    const exact = destination({
      focusAddress: selection,
      focusKey: semanticAddressKey(selection),
      ownerAddress: result,
    });
    const focusByOwner = new Map([[semanticAddressKey(result), exact]]);

    expect(isFineGrainedFindingOwner(result)).toBe(true);
    expect(
      isFineGrainedFindingOwner(
        createKeepsakeEquipResultAddress(
          createRouteStartKeepsakeSelectionAddress('Surface'),
          'experimentalHammer',
        ),
      ),
    ).toBe(false);
    registerWorkspaceFindingDestinations([finding], focusByOwner, routes);
    expect(focusByOwner.get(semanticAddressKey(result))).toEqual(exact);
    expect(() => registerWorkspaceFindingDestinations([finding], new Map(), routes)).toThrow(
      /finding has no exact workspace destination/,
    );
  });

  it('requires every live coarse finding to receive an exact fallback destination', () => {
    const hub = createHubDecisionAddress(biome, 'hub');
    const finding = {
      code: 'hubOpenSetIncomplete',
      evidence: {},
      origin: hub,
      phase: 'completeness',
      severity: 'error',
    } as const satisfies SemanticFinding;

    expect(() => registerWorkspaceFindingDestinations([finding], new Map(), routes)).toThrow(
      /finding has no exact workspace destination/,
    );

    const fallback = destination({
      focusAddress: biome,
      focusKey: semanticAddressKey(biome),
      ownerAddress: biome,
    });
    const focusByOwner = new Map([[semanticAddressKey(biome), fallback]]);
    registerWorkspaceFindingDestinations([finding], focusByOwner, routes);

    expect(focusByOwner.get(semanticAddressKey(hub))?.ownerAddress).toEqual(hub);
  });
});
