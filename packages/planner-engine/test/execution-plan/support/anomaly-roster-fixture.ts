import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '../../../src/authored-project';
import { createCompleteFGAnomalyProject } from '@run-planner/test-fixtures/underworld';

export const anomalyRosterPhase = createEncounterPhaseAddress(
  createBiomeAddress('Underworld', 'G'),
  { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-g-b3-e2') },
  'Encounter',
);

/** The native-realizable order: the SpreadShot elite does not block its normal type. */
export const anomalyRosterTypeKeys = Object.freeze([
  'SpreadShotUnit_Elite',
  'SpreadShotUnit',
  'BloodlessPitcher',
]);

/** The G Anomaly with an explicit ordered infinite-spawn roster. */
export function anomalyRosterProject(
  typeKeys: readonly string[] = anomalyRosterTypeKeys,
): ProjectDocument {
  return applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: anomalyRosterPhase,
    decisionKey: 'infiniteRoster',
    value: { kind: 'infiniteRoster', typeKeys },
  });
}
