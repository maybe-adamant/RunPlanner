import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

describe('declared domains without a reached context', () => {
  it('lists every declared keepsake as not evaluated at an unreached Postboss rack', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    const { workspace } = projectStructuredWorkspaceFixture(project);
    const postboss = [...workspace.interactions.keepsakeSelections.values()].filter(
      (interaction) => interaction.owner.owner !== 'routeStart',
    );
    expect(postboss.length).toBeGreaterThan(0);
    for (const interaction of postboss) {
      const model = interaction.load();
      expect(model.sections.map((section) => section.kind)).toEqual(['unassessed']);
      expect(model.sections[0]!.items.map((item) => item.value)).toEqual(
        catalog.keepsakes.values.map((keepsake) => keepsake.key),
      );
    }
  });

  it('marks the Nemesis families not evaluated only while her room is unentered', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const event = createNemesisRandomEventAddress(
      createEncounterPhaseAddress(goldenHBiome, { kind: 'occurrence', occurrenceId }, 'Passive'),
    );
    const families = (project: ReturnType<typeof loadNemesisFieldsCheckpoint>) =>
      projectStructuredWorkspaceFixture(project)
        .workspace.interactions.nemesisEvents.get(semanticAddressKey(event))!
        .familyPicker.sections.map((section) => section.kind);
    // A cage point another cage already holds blocks that room's Overview.
    const collideCage = (room: string, pointId: number) =>
      applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(
          createOccurrenceAddress(goldenHBiome, createOccurrenceId(room)),
          { kind: 'cage', slotKey: 'cage2' },
        ),
        pointId,
      });
    expect(families(loadNemesisFieldsCheckpoint())).not.toContain('unassessed');
    // Her event is an entry fact beside the blocking one, never waiting on it or her row.
    expect(families(collideCage('golden-h-combat05', 573087))).not.toContain('unassessed');
    expect(families(collideCage('golden-h-combat02', 621502))).toEqual(['unassessed']);
  });

  it('reaches a Nemesis family with her room and its details only with her row', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const event = createNemesisRandomEventAddress(phase);
    const selected = applyProjectCommand(
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'NemesisRandomEvent',
      }),
      catalog,
      { kind: 'SelectNemesisRandomEventFamily', event, family: 'goldTrade' },
    );
    const interaction = projectStructuredWorkspaceFixture(
      selected,
    ).workspace.interactions.nemesisEvents.get(semanticAddressKey(event))!;
    expect(interaction.familyPicker.sections.map((section) => section.kind)).not.toContain(
      'unassessed',
    );
    expect(interaction.contextReached).toBe(false);
  });
});
