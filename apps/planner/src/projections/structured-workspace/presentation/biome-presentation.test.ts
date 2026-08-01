import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubVisitAddress,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  nBiome,
} from '@run-planner/test-fixtures';
import { appendCompleteN, nOccurrenceId, nVisitSlotKeys } from '@run-planner/test-fixtures';
import type { WorkspaceBiome, WorkspaceRailEntry } from '../contract';
import { workspaceDecisionOwnedMarkers } from '../navigation/marker-ownership';
import { presentWorkspaceBiome } from './biome-presentation';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

function biomeSource(
  project: ProjectDocument,
  routeKey: 'Surface' | 'Underworld',
  biomeKey: string,
): WorkspaceBiomeSource {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function present(project: ProjectDocument, routeKey: 'Surface' | 'Underworld', biomeKey: string) {
  const assembly = assembleWorkspaceBiomeSemantics(
    catalog,
    biomeSource(project, routeKey, biomeKey),
  );
  return { assembly, presentation: presentWorkspaceBiome(assembly) };
}

function railShape(biome: WorkspaceBiome): readonly string[] {
  return biome.rail.map((entry) => {
    if (entry.kind === 'frontier') return `frontier:${entry.frontier.kind}`;
    if (entry.kind === 'hubGroup') return 'hub';
    return entry.node.kind === 'occurrenceWorkbench'
      ? `room:${entry.node.room.gameName}`
      : entry.node.kind;
  });
}

function hubRailEntry(rail: readonly WorkspaceRailEntry[]) {
  const entry = rail.find(
    (candidate): candidate is Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }> =>
      candidate.kind === 'hubGroup',
  );
  if (entry === undefined) throw new Error('Hub rail entry is missing');
  return entry;
}

describe('structured workspace biome presentation', () => {
  it('presents the Hub outline after its frontier, then nests only authored visit workbenches', () => {
    const empty = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      name: 'Empty N presentation',
      projectId: 'empty-n-presentation',
    });
    const emptyPresentation = present(empty, 'Surface', 'N');

    expect(emptyPresentation.assembly.progressionKind).toBe('hub');
    expect(railShape(emptyPresentation.presentation.biome)).toEqual(['frontier:start', 'hub']);
    expect(emptyPresentation.presentation.biome.defaultInspectorDestination).toMatchObject({
      kind: 'frontier',
      frontierFocusKey: emptyPresentation.presentation.biome.frontier?.marker.focusKey,
    });

    const completePresentation = present(appendCompleteN(empty), 'Surface', 'N');
    const biome = completePresentation.presentation.biome;
    const hub = hubRailEntry(biome.rail);

    expect(railShape(biome)).toEqual([
      'room:N_Opening01',
      'room:N_PreHub01',
      'hub',
      'room:N_PreBoss01',
    ]);
    expect(
      biome.rail.some((entry) => entry.kind === 'node' && entry.node.kind === 'linkedExit'),
    ).toBe(false);
    expect(
      biome.rail.some(
        (entry) =>
          entry.kind === 'node' &&
          (entry.node.kind === 'ordinaryBatch' ||
            entry.node.kind === 'mixedBatch' ||
            entry.node.kind === 'takeoverBatch') &&
          entry.node.owner.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(hub.visits.map((visit) => visit.node.room.occurrenceId)).toEqual(
      nVisitSlotKeys.map(nOccurrenceId),
    );
    expect(hub.visits.every((visit) => visit.node.inspectorPresentation === 'hubRoomLocal')).toBe(
      true,
    );

    const firstVisit = hub.visits[0];
    if (firstVisit === undefined) throw new Error('first Hub visit is missing');
    expect(
      completePresentation.presentation.focusDestinations.get(firstVisit.node.room.marker.focusKey),
    ).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: firstVisit.node.key },
      selectedRailKey: firstVisit.marker.focusKey,
    });
  });

  it('uses the generated semantic rail policy for ordinary decisions and exact destinations', () => {
    const { assembly, presentation } = present(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = presentation.biome.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof presentation.biome.nodes)[number],
        { readonly kind: 'ordinaryBatch' }
      > => node.kind === 'ordinaryBatch' && node.targets.length > 0,
    );
    if (decision === undefined) throw new Error('F ordinary decision is missing');
    const rail = presentation.biome.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === decision.key,
    );
    if (rail === undefined) throw new Error('F ordinary decision rail entry is missing');

    expect(assembly.progressionKind).toBe('generated');
    expect(rail.label).toBe('Decision 1');
    const ownedMarkers = new Map(
      workspaceDecisionOwnedMarkers(decision).map((marker) => [marker.focusKey, marker]),
    );
    expect(rail.marker.findingCount).toBe(
      [...ownedMarkers.values()].reduce((total, marker) => total + marker.findingCount, 0),
    );
    expect(presentation.focusDestinations.get(decision.selection.focusKey)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: decision.key },
      selectedRailKey: rail.marker.focusKey,
    });
  });

  it('presents every generated biome as entry, numbered decision stops, and bounded Preboss', () => {
    const underworld = createGoldenFGHIProject();
    const surface = createRepresentativeNOPQProject();
    const expected = {
      F: {
        decisions: 10,
        entry: 'Opening',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      G: {
        decisions: 7,
        entry: 'Entrance',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      H: {
        decisions: 4,
        entry: 'Entrance',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      I: {
        decisions: 6,
        entry: 'Entrance',
        preboss: false,
        project: underworld,
        route: 'Underworld',
      },
      O: { decisions: 6, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
      P: { decisions: 8, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
      Q: { decisions: 6, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
    } as const;

    for (const [biomeKey, contract] of Object.entries(expected)) {
      const biome = present(contract.project, contract.route, biomeKey).presentation.biome;
      const entries = biome.rail.filter(
        (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
          entry.kind === 'node',
      );
      expect(entries.map((entry) => entry.label)).toEqual([
        contract.entry,
        ...Array.from({ length: contract.decisions }, (_, index) => `Decision ${index + 1}`),
        ...(contract.preboss ? ['Preboss'] : []),
      ]);
      expect(
        entries.some(
          (entry) =>
            entry.node.kind === 'occurrenceWorkbench' && entry.node.key !== biome.entry?.key,
        ),
      ).toBe(false);
    }
  });

  it('keeps completion landmarks outside an incomplete biome rail', () => {
    const empty = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Presentation completion outline',
      projectId: 'presentation-completion-outline',
    });
    const biome = present(empty, 'Underworld', 'F').presentation.biome;

    expect(railShape(biome)).toEqual(['frontier:start']);
    expect(biome.completionOutline.map((node) => node.label)).toEqual(['Hecate', 'Postboss']);
  });

  it('reprojects only authored Hub visit children after replacement and truncation', () => {
    const initial = appendCompleteN(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Hub visit presentation',
        projectId: 'hub-visit-presentation',
      }),
      { includePreboss: false, visitSlotKeys: nVisitSlotKeys.slice(0, 3) },
    );
    const labels = (project: ProjectDocument) =>
      hubRailEntry(present(project, 'Surface', 'N').presentation.biome.rail).visits.map(
        (visit) => visit.label,
      );

    expect(labels(initial)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Satyr Champion',
      'Visit 3 · Combat 02',
    ]);
    const replaced = applyProjectCommand(initial, catalog, {
      hubSlotKey: 'combat10',
      kind: 'ReplaceHubVisit',
      visit: createHubVisitAddress(nBiome, 'hub', 2),
    });
    expect(labels(replaced)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Combat 10',
      'Visit 3 · Combat 02',
    ]);
    const truncated = applyProjectCommand(replaced, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 2),
    });
    expect(labels(truncated)).toEqual(['Visit 1 · Combat 05']);
  });
});
