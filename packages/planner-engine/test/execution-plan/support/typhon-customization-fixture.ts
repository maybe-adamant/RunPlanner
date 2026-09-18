import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
} from '../../../src/authored-project';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

export function typhonCustomizationProject() {
  let project = loadSurfaceNOPQProject();
  const boss = project.route.biomes
    .find((biome) => biome.biomeKey === 'Q')
    ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'Q_Boss01');
  if (boss === undefined) throw new Error('Typhon fixture is missing its normal Head occurrence');
  const phase = createEncounterPhaseAddress(
    createBiomeAddress('Surface', 'Q'),
    { kind: 'occurrence', occurrenceId: boss.occurrenceId },
    'Encounter',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'firstEggWave',
    value: { kind: 'single', choiceKey: 'eidolons' },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'secondEggWave',
    value: { kind: 'single', choiceKey: 'lurkers' },
  });
}
