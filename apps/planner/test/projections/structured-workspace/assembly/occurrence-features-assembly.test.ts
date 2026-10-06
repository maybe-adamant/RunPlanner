import { describe, expect, it } from 'vitest';
import {
  assemble,
  catalog,
  createCompleteFGProject,
  createGoldenFGHIProject,
  createOccurrenceId,
  loadSurfaceNOPProject,
  oOccurrenceIds,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

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
    const midshop = createOccurrenceId('golden-g-b5-e1');
    const contractFeature = (
      zagreusContractAssessment?: () => {
        readonly placementEligible: boolean;
        readonly failedConditions: readonly ('enteredContractCap' | 'sourceRequirement')[];
        readonly enteredContractCount: number;
        readonly maximumEnteredThisRoute: number;
      },
    ) =>
      assemble(
        createCompleteFGProject(),
        'Underworld',
        'G',
        midshop,
        undefined,
        undefined,
        undefined,
        undefined,
        catalog,
        (source) =>
          zagreusContractAssessment === undefined
            ? source
            : Object.freeze({ ...source, zagreusContractAssessment }),
      ).assembly.node.room.workbench.features.find((feature) => feature.kind === 'zagreusContract');

    // The engine's entry-consumed policy reports the earlier Contract; the app omits the door.
    expect(
      contractFeature(() => ({
        placementEligible: false,
        failedConditions: ['enteredContractCap'],
        enteredContractCount: 1,
        maximumEnteredThisRoute: 0,
      })),
    ).toBeUndefined();
    // No earlier Contract: the reached Midshop offers its door.
    expect(contractFeature()).toMatchObject({
      action: 'add',
      presence: { kind: 'optionalAbsent', enabled: true },
    });
  });
});
