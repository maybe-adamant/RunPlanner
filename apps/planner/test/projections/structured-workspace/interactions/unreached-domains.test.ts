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

  it('marks the Nemesis families not evaluated while the event context is unreached', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const event = createNemesisRandomEventAddress(
      createEncounterPhaseAddress(goldenHBiome, { kind: 'occurrence', occurrenceId }, 'Passive'),
    );
    const families = (project: ReturnType<typeof loadNemesisFieldsCheckpoint>) =>
      projectStructuredWorkspaceFixture(project)
        .workspace.interactions.nemesisEvents.get(semanticAddressKey(event))!
        .familyPicker.sections.map((section) => section.kind);
    expect(families(loadNemesisFieldsCheckpoint())).not.toContain('unassessed');
    expect(
      families(
        applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
          kind: 'ReplaceFieldsSpatialPoint',
          spatial: createFieldsSpatialAddress(createOccurrenceAddress(goldenHBiome, occurrenceId), {
            kind: 'entry',
          }),
          pointId: null,
        }),
      ),
    ).toEqual(['unassessed']);
  });
});
