import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createKeepsakeEquipResultAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGIxionChaosProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

import { routeResourceAuthoring } from '../../src/simulation/resources';
import { equivalenceCorpus } from '../equivalence/corpus';
import { createHammerBridgeRouteProject } from '../equivalence/corpus-support';

function freshlyDecoded(entryCatalog: Catalog, project: ProjectDocument): ProjectDocument {
  return decodeProjectDocument(JSON.parse(encodeProjectDocument(project)) as unknown, entryCatalog);
}

/** Freshly decoded plans share no identity with any cached evaluation. */
function simulatesAsCold(entryCatalog: Catalog, project: ProjectDocument): boolean {
  const fresh = decodeProjectDocument(
    JSON.parse(encodeProjectDocument(project)) as unknown,
    entryCatalog,
  );
  return isDeepStrictEqual(
    simulateProject(entryCatalog, project),
    simulateProject(entryCatalog, fresh),
  );
}

function biomes(project: ProjectDocument) {
  return simulateProject(catalog, project).route.biomes;
}

/** Each route family, a practice start, an incomplete route, forced Chaos and resource placements. */
const representativeCorpus = new Set([
  'execution/underworld-fghi',
  'execution/surface-nopq',
  'execution/dream-mixed-prefix',
  'execution/fresh-file-fghi',
  'execution/underworld-start-i-preboss',
  'underworld/hammerBridgeRoute',
  'execution/fg-ixion-chaos',
  'checkpoint/underworld-twist-scylla',
  'checkpoint/surface-p-steady-growth-shrine-frontier',
]);

describe('biome evaluation cache', () => {
  it('names only corpus projects', () => {
    const names = new Set(equivalenceCorpus().map((entry) => entry.name));
    expect([...representativeCorpus].filter((name) => !names.has(name))).toEqual([]);
  });

  it.each(
    equivalenceCorpus()
      .filter((entry) => representativeCorpus.has(entry.name))
      .map((entry) => [entry.name, entry] as const),
  )('%s simulates identically from a warm prefix and cold', (_name, entry) => {
    const project = entry.project();
    const primed = simulateProject(entry.catalog, {
      ...project,
      route: { ...project.route, biomes: project.route.biomes.slice(0, -1) },
    }).route.biomes;
    const warm = simulateProject(entry.catalog, project).route.biomes;
    if (primed.length > 0 && warm.length > 0) expect(warm[0]).toBe(primed[0]);
    expect(simulatesAsCold(entry.catalog, project)).toBe(true);
  });

  it('reuses the biomes before an edit and re-simulates the edited biome onwards', () => {
    const before = createGoldenFGHIProject();
    const first = biomes(before);
    const edited = applyProjectCommand(before, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const second = biomes(edited);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[2]).not.toBe(first[2]);
    expect(second[3]).not.toBe(first[3]);
    expect(simulatesAsCold(catalog, edited)).toBe(true);

    // Undo restores the earlier document, whose biomes are all still cached.
    const undone = biomes(before);
    for (const [index, evaluation] of undone.entries()) expect(evaluation).toBe(first[index]);
  });

  it('re-simulates the biome whose resource placement changed and its successors', () => {
    const before = createGoldenFGHIProject();
    const first = biomes(before);
    const target = routeResourceAuthoring(catalog, before.route).legalTargetsByFamily.Pickaxe.find(
      (placement) => placement.biomeKey === 'G',
    );
    if (target === undefined) throw new Error('golden G has no legal Pickaxe target');
    const placed = applyProjectCommand(before, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: createRouteAddress('Underworld'),
      family: 'Pickaxe',
      value: target,
    });
    expect(placed.route.biomes[1]).toBe(before.route.biomes[1]);
    const second = biomes(placed);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[2]).not.toBe(first[2]);
    expect(simulatesAsCold(catalog, placed)).toBe(true);
  });

  it('re-simulates the biomes whose forced Chaos changed', () => {
    const before = createCompleteFGIxionChaosProject();
    const first = biomes(before);
    const withoutPurchase = applyProjectCommand(before, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId('golden-f-preboss-shop:postboss'),
      ),
      generationKey: 'initial:secondLeft',
      purchased: false,
    });
    const second = biomes(withoutPurchase);
    expect(second[0]).not.toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(simulatesAsCold(catalog, withoutPurchase)).toBe(true);
    expect(simulatesAsCold(catalog, before)).toBe(true);
  });

  it('keeps route-start keepsake candidates exact across warm rebuilds and loadout edits', () => {
    const project = createHammerBridgeRouteProject();
    const routeStart = createRouteStartKeepsakeSelectionAddress('Underworld');
    const routeStartCandidates = (document: ProjectDocument) => {
      const session = createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, document),
      );
      return [
        session.evaluate({ kind: 'keepsakeSelection', selection: routeStart }),
        session.evaluate({
          kind: 'keepsakeEquipResult',
          result: createKeepsakeEquipResultAddress(routeStart, 'experimentalHammer'),
        }),
      ];
    };
    const first = biomes(project);
    const warm = routeStartCandidates(project);
    expect(warm.map((result) => result.kind)).toEqual(['keepsakeSelection', 'keepsakeEquipResult']);
    const rebuilt = biomes(project);
    for (const [index, evaluation] of rebuilt.entries()) expect(evaluation).toBe(first[index]);
    expect(warm).toEqual(routeStartCandidates(freshlyDecoded(catalog, project)));

    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: routeStart,
      keepsakeKey: 'ManaOverTimeRefundKeepsake',
    });
    const second = biomes(replaced);
    for (const [index, evaluation] of second.entries()) expect(evaluation).not.toBe(first[index]);
    expect(simulatesAsCold(catalog, replaced)).toBe(true);

    // Undo restores the earlier loadout, whose biomes are all still cached.
    const undone = biomes(project);
    for (const [index, evaluation] of undone.entries()) expect(evaluation).toBe(first[index]);
    expect(routeStartCandidates(project)).toEqual(warm);
  });
});
