// Loaded by `migrate-project.js` through Vite's module runner, since the engine and
// catalog packages are TypeScript sources.

import {
  fillSchema100NemesisBetOutcomes,
  migrateRewardWheelOffersToSideOrder,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { normalizeUnpushedSchema100 } from '../apps/planner/src/persistence/project-99-to-100.js';

/**
 * Completes a schema-100 document as the application loader does before strict
 * parsing: a document saved at 100 is reshaped first, then every unstored
 * Nemesis kill race is filled with a win and every wheel valid only with its
 * offers the other way round has them exchanged.
 */
export function completeSchema100Document(document, sourceSchemaVersion) {
  const reshaped = sourceSchemaVersion === 100 ? normalizeUnpushedSchema100(document) : document;
  return migrateRewardWheelOffersToSideOrder(
    fillSchema100NemesisBetOutcomes(reshaped, catalog),
    catalog,
    (project) => simulateProject(catalog, project).issue,
  );
}
