import { catalog } from '@run-planner/hades2-catalog';
import {
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { beforeAll, describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { createCandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import { createTraitDomainProjection } from './traitDomainProjection';
import {
  createStructuredWorkspaceProjection,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceNode,
} from './structured-workspace';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const projection = createStructuredWorkspaceProjection(
  catalog,
  {
    candidateSessions: createCandidateSessionFactory(catalog),
    contextualPicker,
    rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
    traitDomain: createTraitDomainProjection(catalog, contextualPicker),
  },
  () => createOccurrenceId('structured-workspace-facade-start'),
);

function project(project: ReturnType<typeof createProjectDocument>): StructuredWorkspaceProjection {
  return projection.project(simulateProjectAssembly(catalog, project));
}

function biome(workspace: StructuredWorkspaceProjection, biomeKey: string): WorkspaceBiome {
  const result = workspace.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (result === undefined) throw new Error(`${biomeKey} workspace biome is missing`);
  return result;
}

let representativeWorkspaces:
  | Readonly<{
      underworld: StructuredWorkspaceProjection;
      surface: StructuredWorkspaceProjection;
    }>
  | undefined;

function representativeWorkspacePair() {
  representativeWorkspaces ??= Object.freeze({
    underworld: project(createGoldenFGHIProject()),
    surface: project(loadSurfaceNOPQProject()),
  });
  return representativeWorkspaces;
}

beforeAll(() => {
  representativeWorkspacePair();
});

/*
 * A15.2 inventory of the former umbrella cases and their focused owners:
 *  1 facade envelope/node union -> retained here
 *  2 generic topology removals -> topology-interaction assembly
 *  3 declaration/canonical decision order -> source index
 *  4 selected-subtree order -> source index
 *  5 ordinary decision rail -> biome presentation
 *  6 completion landmarks -> biome presentation
 *  7 physical target order/selection -> decision assembly
 *  8 Hub node/slots/visits -> Hub assembly
 *  9 Ephyra position proposals -> occurrence assembly + interaction binding
 * 10 dormant Ephyra withholding -> occurrence facts + expected-leaf closure
 * 11 invalid active Ephyra publication -> occurrence assembly
 * 12 Hub visit replacement/truncation -> biome presentation
 * 13 unauthored Hub absence -> Hub assembly
 * 14 terminal Hub decision rail placement -> biome presentation
 * 15 completed-Hub handoff -> topology-interaction assembly
 * 16 invalid Hub/retained visit suffix -> Hub assembly
 * 17 creation frontiers -> topology-interaction assembly + interaction binding
 * 18 next missing target picker -> decision assembly
 * 19 batch-setup gating -> decision assembly
 * 20 blocked Fields cage outcome -> Fields cage counts
 * 21 Hub slots/next visit frontier -> Hub assembly
 * 22 authored-first Hub controls -> Hub assembly
 * 23 ninth-slot Hub handoff scope -> topology-interaction assembly
 * 24 F-Q takeover ownership -> topology-interaction assembly
 * 25 takeover labels/command identities -> interaction binding
 * 26 O/Q fixed width-one takeovers -> topology-interaction assembly
 * 27 non-takeover classification -> topology-interaction assembly
 * 28 declaration reward domains -> occurrence assembly
 * 29 returned reward binding -> interaction binding; representative facade witness retained
 * 30 start/target/frontier binding -> interaction binding; representative facade witness retained
 * 31 compact reward summaries -> biome presentation
 * 32 immutable Fields/Ship/Shop leaves -> occurrence assembly
 * 33 dormant Shop withholding -> occurrence facts + occurrence assembly
 * 34 selected blocked Shop editing -> occurrence assembly + interaction binding
 * 35 missing hard-required interaction -> contract leaf/control closure
 * 36 removals/frontier capability closure -> contract structural-control closure
 * 37 biome/fixed/start controls -> biome-semantic + occurrence assembly + binding
 * 38 target identity/takeover commands -> interaction binding
 * 39 command-owned removal intent -> topology-interaction assembly + interaction binding
 * 40 unavailable-batch repair intent -> decision assembly
 * 41 takeover creation/repair command -> topology-interaction assembly + interaction binding
 * 42 incomplete/blocked start frontier -> biome-semantic assembly
 * 43 partial versus complete-invalid state -> biome-semantic assembly
 * 44 retained decisions after incomplete prefix -> source index + decision assembly
 * 45 reward-invalid authored peer -> decision assembly
 * 46 exact finding owner/fallback -> finding routing; coarse facade witness retained
 */

const workspaceNodeKinds: Readonly<Record<WorkspaceNode['kind'], true>> = Object.freeze({
  completion: true,
  hubDecision: true,
  mixedBatch: true,
  occurrenceWorkbench: true,
  ordinaryBatch: true,
  takeoverBatch: true,
});

describe('unified structured workspace projection facade', () => {
  it('assembles one frozen public workspace envelope across every supported biome family', () => {
    const { underworld, surface } = representativeWorkspacePair();

    for (const route of [...underworld.routes, ...surface.routes]) {
      expect(Object.isFrozen(route.biomes)).toBe(true);
      for (const projectedBiome of route.biomes) {
        expect('kind' in projectedBiome).toBe(false);
        expect(Object.isFrozen(projectedBiome.nodes)).toBe(true);
        expect(projectedBiome.nodes.every((node) => node.kind in workspaceNodeKinds)).toBe(true);
        expect(projectedBiome.marker.address).toEqual({
          biomeKey: projectedBiome.biomeKey,
          kind: 'biome',
          routeKey: route.routeKey,
        });
      }
    }

    expect(biome(underworld, 'F').nodes.some((node) => node.kind === 'takeoverBatch')).toBe(true);
    expect(biome(underworld, 'I').nodes.some((node) => node.kind === 'mixedBatch')).toBe(true);
    expect(biome(surface, 'N').nodes.some((node) => node.kind === 'hubDecision')).toBe(true);
    expect(biome(surface, 'Q').nodes.some((node) => node.kind === 'ordinaryBatch')).toBe(true);
  });

  it('hands representative sibling assembly products to presentation, focus, and binding', () => {
    const { underworld, surface } = representativeWorkspacePair();
    const ordinary = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' && node.targets.length > 0,
    );
    const hub = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    const target = ordinary?.targets[0];
    const reward = target?.room.rewardControls[0];
    const slot = hub?.slots[0];
    if (
      ordinary === undefined ||
      target === undefined ||
      reward === undefined ||
      hub === undefined ||
      slot === undefined
    ) {
      throw new Error('representative sibling workspace products are missing');
    }

    expect(underworld.focusByOwner.get(target.marker.focusKey)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: ordinary.key },
      nodeKey: ordinary.key,
    });
    expect(
      underworld.interactions.rooms.get(semanticAddressKey(target.marker.address)),
    ).toMatchObject({ owner: target.marker.address });
    expect(
      underworld.interactions.rewards.get(semanticAddressKey(reward.owner.address)),
    ).toMatchObject({ owner: reward.owner.address });
    expect(surface.focusByOwner.get(slot.marker.focusKey)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: hub.key },
      nodeKey: hub.key,
    });
    expect(surface.interactions.hubSlots.get(slot.marker.focusKey)).toMatchObject({
      owner: slot.marker.address,
    });
  });

  it('caches only the exact project-evaluation assembly identity', () => {
    const authored = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, authored);
    const first = projection.project(assembly);

    expect(projection.project(assembly)).toBe(first);
    expect(projection.project(simulateProjectAssembly(catalog, authored))).not.toBe(first);
  });

  it('rejects cloned and mixed assemblies at application boundaries', () => {
    const authored = createGoldenFGHIProject();
    const exact = simulateProjectAssembly(catalog, authored);
    const other = simulateProjectAssembly(catalog, loadSurfaceNOPQProject());
    const cloned = Object.freeze({ ...exact });
    const mixed = Object.freeze({ ...exact, evaluation: other.evaluation });

    expect(() => projection.project(cloned)).toThrow(/not produced by this simulator execution/);
    expect(() => createCandidateSessionFactory(catalog).bind(mixed)).toThrow(
      /not produced by this simulator execution/,
    );
  });

  it('registers a coarse finding against only its owning biome shell', () => {
    const authored = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      projectId: 'facade-finding-routing',
    });
    const assembly = simulateProjectAssembly(catalog, authored);
    const evaluation = assembly.evaluation;
    const finding = evaluation.findings[0];
    if (finding === undefined) throw new Error('empty Surface fixture has no finding');
    const workspace = projection.project(assembly);

    expect(workspace.focusByOwner.get(semanticAddressKey(finding.origin))).toMatchObject({
      biomeKey: 'N',
      ownerAddress: finding.origin,
      routeKey: 'Surface',
    });
  });
});
