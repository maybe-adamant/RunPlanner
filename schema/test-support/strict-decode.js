// Loaded through Vite's module runner by the schema tests: the engine, catalog and
// fixture helpers are TypeScript sources.

export {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  encodeProjectDocument,
  parseProjectDocument,
  roomActionKey,
} from '@run-planner/engine/authored-project';
export {
  simulateProjectAssembly,
  unlockExitEncounterSupportForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
export { catalog } from '@run-planner/hades2-catalog';
export { legacySchema99Body } from '../../test/fixtures/authored-project/legacy-schema-99.ts';
export { legacySchema100Body } from '../../test/fixtures/authored-project/legacy-schema-100.ts';
export { legacySchema101Body } from '../../test/fixtures/authored-project/legacy-schema-101.ts';
