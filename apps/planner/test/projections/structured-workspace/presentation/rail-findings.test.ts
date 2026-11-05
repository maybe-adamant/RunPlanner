import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteAddress,
  semanticAddressKey,
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

  it("marks the Chaos room a decision takes with its reward's unchosen trait offer", () => {
    const biome = createBiomeAddress('Surface', 'N');
    const additional = createAdditionalExitAddress(
      biome,
      createOccurrenceId('surface-n-opening'),
      'chaos',
    );
    const withChaos = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: createOccurrenceId('rail-findings-chaos'),
    });
    const application = createOpenTestApplication();
    application.store.dispatch(authoredProjectReplaced(withChaos));
    const select = application
      .selectStructuredWorkspace(application.store.getState())
      ?.interactions.chaosExits.get(semanticAddressKey(additional))?.selectIntent.command;
    if (select === undefined) throw new Error('N Opening Chaos exit is missing');
    application.store.dispatch(
      authoredProjectReplaced(applyProjectCommand(withChaos, catalog, select)),
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const rail = workspace?.route.biomes.find((candidate) => candidate.biomeKey === 'N')?.rail;
    const chaosStop = rail?.find(
      (entry) => entry.kind === 'node' && entry.selectedTarget?.roomIcon.kind === 'chaos',
    );
    if (chaosStop === undefined) throw new Error('N Chaos rail stop is missing');
    // The finding belongs to the trait offer of the Chaos room's own reward.
    expect(chaosStop.marker.findingCount).toBe(1);
  });
});
