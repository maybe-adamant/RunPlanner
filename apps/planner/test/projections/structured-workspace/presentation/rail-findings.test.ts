import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { goldenFBiome, loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';

describe('rail room findings', () => {
  it("marks the Boss stop with its unchosen Judgment's finding", () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['CastCount'],
    });
    const application = createOpenTestApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const biome = application
      .selectStructuredWorkspace(application.store.getState())
      ?.route.biomes.find((candidate) => candidate.biomeKey === 'N');
    const boss = biome?.completionOutline.find((node) => node.room.kind === 'Boss');
    if (boss?.room.judgment === undefined) throw new Error('N Boss Judgment is missing');
    // The finding belongs to the Judgment, a room-local owner, not to the room itself.
    expect(boss.room.judgment.marker.findingCount).toBe(1);
    expect(boss.marker.findingCount).toBe(0);
    expect(boss.railMarker?.findingCount).toBe(1);
    expect(boss.railMarker?.focusKey).toBe(boss.marker.focusKey);
  });

  it("marks the Postboss stop with its keepsake's unchosen equip result", () => {
    const postboss = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const project = applyProjectCommand(
      authorLegalTraitOffers(loadUnderworldFGProject()),
      catalog,
      {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(postboss),
        keepsakeKey: 'HadesAndPersephoneKeepsake',
      },
    );
    const application = createOpenTestApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const biome = application
      .selectStructuredWorkspace(application.store.getState())
      ?.route.biomes.find((candidate) => candidate.biomeKey === 'F');
    const node = biome?.completionOutline.find((candidate) => candidate.room.kind === 'PostBoss');
    const selection = node?.room.keepsakeSelection;
    if (node === undefined || selection === undefined)
      throw new Error('F Postboss rack is missing');
    // The finding belongs to the swap's equip result, a room-local owner of the rack.
    expect(selection.equipResult?.marker.findingCount).toBe(1);
    expect(node.marker.findingCount).toBe(0);
    expect(node.railMarker?.findingCount).toBe(1);
  });
});
