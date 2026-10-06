// @vitest-environment jsdom

import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { cleanup, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { staticWorkspaceFixture } from '@planner-test/support/biome-workbench';
import {
  loadNemesisFieldsCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';

afterEach(cleanup);

const canonicalOrder = [
  'encounters',
  'contents',
  'additionalExits',
  'objects',
  'resources',
  'npcs',
] as const;

/** Renders every occurrence Overview in one biome and returns each room's section keys. */
function overviewSections(project: ProjectDocument, biomeKey: string): string[][] {
  const { store, workspace } = staticWorkspaceFixture(project);
  const biome = workspace.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${biomeKey} has no workspace biome`);
  const rooms: string[][] = [];
  for (const node of [...biome.nodes, ...biome.completionOutline]) {
    if (node.kind !== 'occurrenceWorkbench') continue;
    const view = render(
      <Provider store={store}>
        <FindingTargetScope
          authoringReadiness={workspace.authoringReadiness}
          findings={workspace.findingsByRepairTarget}
        >
          <OccurrenceWorkbench
            interactions={workspace.interactions}
            room={(node as WorkspaceOccurrenceWorkbenchNode).room}
          />
        </FindingTargetScope>
      </Provider>,
    );
    rooms.push(
      [...view.container.querySelectorAll<HTMLElement>('[data-overview-section]')]
        .filter((slot) => slot.childElementCount > 0)
        .map((slot) => slot.dataset.overviewSection!),
    );
    view.unmount();
  }
  return rooms;
}

describe('Room Overview section order', () => {
  it('renders every room kind’s sections in the one canonical order', () => {
    const witnesses: readonly (readonly [() => ProjectDocument, string])[] = [
      [loadNemesisFieldsCheckpoint, 'F'],
      [loadNemesisFieldsCheckpoint, 'H'],
      [loadUnderworldWorldShopTravelDealCheckpoint, 'F'],
      [loadUnderworldFStygianWellCheckpoint, 'F'],
      [loadSurfaceScheduledLifecycleCheckpoint, 'O'],
      [createFreshFileRouteProject, 'G'],
    ];
    const seen = new Set<string>();
    for (const [load, biomeKey] of witnesses) {
      const rooms = overviewSections(load(), biomeKey);
      expect(rooms.length, biomeKey).toBeGreaterThan(0);
      for (const sections of rooms) {
        const positions = sections.map((key) =>
          canonicalOrder.indexOf(key as (typeof canonicalOrder)[number]),
        );
        expect(positions, sections.join(' > ')).not.toContain(-1);
        expect(positions, sections.join(' > ')).toEqual([...positions].sort((a, b) => a - b));
        for (const key of sections) seen.add(key);
      }
    }
    expect([...seen].sort()).toEqual([...canonicalOrder].sort());
  });
});
