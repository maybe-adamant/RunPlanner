// Loaded through Vite's module runner by the schema tests: the engine, catalog and
// fixture helpers are TypeScript sources.

export {
  applyProjectCommand,
  createBiomeAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  encodeProjectDocument,
  parseProjectDocument,
} from '@run-planner/engine/authored-project';
export { catalog } from '@run-planner/hades2-catalog';
export { legacySchema99Body } from '../../test/fixtures/authored-project/legacy-schema-99.ts';
export { legacySchema100Body } from '../../test/fixtures/authored-project/legacy-schema-100.ts';
