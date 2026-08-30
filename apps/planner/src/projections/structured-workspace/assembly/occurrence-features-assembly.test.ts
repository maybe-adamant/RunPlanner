import { describe, expect, it } from 'vitest';
import {
  assemble,
  createGoldenFGHIProject,
  createOccurrenceId,
  loadSurfaceNOPProject,
  oOccurrenceIds,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';
import { createGContractAvailabilityProject } from '@run-planner/test-fixtures/underworld';

describe('structured workspace features assembly', () => {
  it('projects declared Stygian Well features for an F Postboss room', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const room = assemble(createGoldenFGHIProject(), 'Underworld', 'F', postbossId).assembly.node
      .room;

    expect(room.workbench.features).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'stygianWell' })]),
    );
    expect(room.workbench.features.find((feature) => feature.kind === 'stygianWell')).toMatchObject(
      { presence: { kind: 'forcedPresent' } },
    );
  });

  it('keeps an unassessed Shrine visible without a presence mutation intent', () => {
    const room = assemble(loadSurfaceNOPProject(), 'Surface', 'O', oOccurrenceIds.combat01).assembly
      .node.room;
    const shrine = room.workbench.features.find((feature) => feature.kind === 'hermesShrine');

    expect(shrine).toMatchObject({
      assessment: 'unassessed',
      presence: { kind: 'optionalAbsent', enabled: false },
    });
    expect(shrine).not.toHaveProperty('presenceInteractionKey');
  });

  it('omits Chaos authoring on a host-only room', () => {
    const project = createGoldenFGHIProject();
    const intro = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'H_Intro');
    if (intro === undefined) throw new Error('H Intro is missing');

    const room = assemble(project, 'Underworld', 'H', intro.occurrenceId).assembly.node.room;

    expect(room.chaosSpawn).toBeUndefined();
    expect(room.workbench.features.some((feature) => feature.kind === 'chaos')).toBe(false);
  });

  it('omits a consumed Contract and enables one after an earlier offer was skipped', () => {
    const entered = createGContractAvailabilityProject(true);
    const enteredRoom = assemble(entered.project, 'Underworld', 'G', entered.laterShop).assembly
      .node.room;
    expect(
      enteredRoom.workbench.features.some((feature) => feature.kind === 'zagreusContract'),
    ).toBe(false);

    const skipped = createGContractAvailabilityProject(false);
    const skippedRoom = assemble(skipped.project, 'Underworld', 'G', skipped.laterShop).assembly
      .node.room;
    expect(
      skippedRoom.workbench.features.find((feature) => feature.kind === 'zagreusContract'),
    ).toMatchObject({
      action: 'add',
      presence: { kind: 'optionalAbsent', enabled: true },
    });
  });
});
