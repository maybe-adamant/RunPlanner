// Loaded by `migrate-project.js` through Vite's module runner: the transitions from
// schema 100 on and the settlement of a plan saved before schema 103 reach the engine and
// catalog, which are TypeScript sources.

export { PROJECT_TRANSITION_STEPS } from '../apps/planner/src/persistence/project-transitions.js';
export {
  OUTPUT_SCHEMA_VERSION as UPGRADE_SETTLEMENT_SCHEMA_VERSION,
  settleUpgradedProject,
} from '../apps/planner/src/persistence/project-102-to-103.js';
export { encodeProjectDocument, parseProjectDocument } from '@run-planner/engine/authored-project';
export { catalog } from '@run-planner/hades2-catalog';
