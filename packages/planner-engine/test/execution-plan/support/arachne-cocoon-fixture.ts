import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';

export const arachneCocoonPhases = Object.freeze({
  F: createEncounterPhaseAddress(
    createBiomeAddress('Underworld', 'F'),
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b5-e1') },
    'Encounter',
  ),
  G: createEncounterPhaseAddress(
    createBiomeAddress('Underworld', 'G'),
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-g-b4-e1') },
    'Encounter',
  ),
} satisfies Record<'F' | 'G', EncounterPhaseAddress>);

/** Entered F and G Arachne combats: F draws exactly 11 cocoons, G keeps the native draw. */
export function underworldArachneCocoonProject(): ProjectDocument {
  let project = createCompleteFGProject();
  for (const [biomeKey, encounterKey] of [
    ['F', 'ArachneCombatF'],
    ['G', 'ArachneCombatG'],
  ] as const)
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: arachneCocoonPhases[biomeKey],
      encounterKey,
    });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonCount',
    value: { kind: 'cocoonCount', count: 11 },
  });
}
