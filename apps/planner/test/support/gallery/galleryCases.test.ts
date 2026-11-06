import { describe, expect, it } from 'vitest';

import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { galleryCases } from './cases';
import { buildGalleryProject, filterGalleryCases } from './galleryCase';

describe('Timeline gallery cases', () => {
  it('name each case once, safely for a file name', () => {
    const ids = galleryCases.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !/^[a-z0-9-]+$/.test(id))).toEqual([]);
  });

  it.each(galleryCases.map((entry) => [entry.id, entry] as const))(
    '%s builds and opens a projected room or Hub',
    (_id, entry) => {
      const { workspace } = projectStructuredWorkspaceFixture(buildGalleryProject(entry));
      const biome = workspace.route.biomes.find(
        (candidate) => candidate.biomeKey === entry.target.biomeKey,
      );
      expect(biome).toBeDefined();
      const nodes = [...biome!.nodes, ...biome!.completionOutline];
      const target = entry.target;
      const opened =
        target.kind === 'hub'
          ? nodes.some((node) => node.kind === 'hubDecision')
          : nodes.some(
              (node) =>
                node.kind === 'occurrenceWorkbench' &&
                node.room.occurrenceId === target.occurrenceId,
            );
      expect(opened).toBe(true);
    },
  );

  it('filters by id or label substrings', () => {
    expect(filterGalleryCases(galleryCases, '')).toBe(galleryCases);
    expect(filterGalleryCases(galleryCases, 'HUB-').map((entry) => entry.id)).toEqual(
      galleryCases.filter((entry) => entry.id.startsWith('hub-')).map((entry) => entry.id),
    );
    expect(filterGalleryCases(galleryCases, 'pool-sell, eris').map((entry) => entry.id)).toEqual([
      'eris',
      'pool-sell',
    ]);
  });
});
