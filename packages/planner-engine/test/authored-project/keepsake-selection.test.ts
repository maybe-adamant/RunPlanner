import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createCompletionRoomAddress,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';

describe('keepsake authored selections', () => {
  it('creates mandatory starting and retained Postboss defaults and round-trips replacements', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'keepsake-authored',
      name: 'Keepsake authored',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    expect(route?.loadout.startingKeepsakeKey).toBe('ManaOverTimeRefundKeepsake');
    expect(route?.biomes[0]?.postbossKeepsakeDisposition).toEqual({ kind: 'retain' });

    const selection: Extract<KeepsakeSelectionAddress, { readonly owner: object }> =
      createPostbossKeepsakeSelectionAddress(
        createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
      );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('rejects an unknown persisted selection while preserving legal context-invalid replacements', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'keepsake-codec',
      name: 'Keepsake codec',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: { routeKey: string; loadout: { startingKeepsakeKey: string } }[];
    };
    encoded.routes.find((route) => route.routeKey === 'Underworld')!.loadout.startingKeepsakeKey =
      'MissingKeepsake';
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'unknown keepsake MissingKeepsake',
    );
  });
});
