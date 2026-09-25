import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createRouteStartKeepsakeSelectionAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNProject, nBiome, nVisitSlotKeys } from '@run-planner/test-fixtures/surface';

/** Room visits completed before the Hub fountain use in the Phial fixture. */
export const phialFountainPrecedingVisits = 3;
/** The Common Pre-Hub Ares boon; the Opening reward is the Common Apollo boon. */
export const phialFountainTargetTraitKey = 'AresSpecialBoon';

/** Surface N with Aromatic Phial, used at the Hub after three visits on the Pre-Hub boon. */
export function surfaceNPhialIntermediateFountainProject(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Surface'),
    keepsakeKey: 'FountainRarityKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    actions: hubVisitActions(nVisitSlotKeys, phialFountainPrecedingVisits),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(createHubFountainAddress(nBiome, 'hub')),
    targetTraitKey: phialFountainTargetTraitKey,
  });
}
