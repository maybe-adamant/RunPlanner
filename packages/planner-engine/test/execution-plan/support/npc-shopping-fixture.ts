import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { applyProjectCommand, createEncounterPhaseAddress } from '../../../src/authored-project';

export function npcShoppingProtectionProject() {
  return applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(4, 1) },
      'Encounter',
    ),
    encounterKey: 'NemesisCombatG',
  });
}
