import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const testInclude = Object.freeze([
  'packages/*/test/**/*.test.ts',
  'apps/*/src/**/*.test.{ts,tsx}',
  'apps/*/test/**/*.test.{ts,tsx}',
]);

export const heavyTestFiles = Object.freeze([
  'apps/planner/src/projections/structured-workspace/assembly/biome-semantic-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/decision-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-actions-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-facts.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-features-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-reward-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-room-facts.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-room-workbench.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-interaction-requirements.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/topology-interaction-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/navigation/inspector-defaults.test.ts',
  'apps/planner/src/projections/structured-workspace/source-index.test.ts',
  'apps/planner/src/state/projectWorkspaceSlice.test.ts',
  'apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx',
  'apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/HubDecisionWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceEncounterWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceRoomActions.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceRoomFeatures.test.tsx',
  'apps/planner/src/ui/editor/rewards/PomResolutionEditor.test.tsx',
  'apps/planner/src/ui/editor/rewards/TraitOfferEditor.test.tsx',
  'apps/planner/src/ui/shell/App.test.tsx',
  'apps/planner/test/architecture/candidateRenderPurity.interaction.test.tsx',
  'apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx',
  'apps/planner/test/product-loops/RunStateProductLoop.interaction.test.tsx',
  'packages/planner-engine/test/simulation/biomes/q/simulation.test.ts',
  'packages/planner-engine/test/simulation/encounter-authoring-domain.test.ts',
  'packages/planner-engine/test/simulation/experimental-hammer.test.ts',
  'packages/planner-engine/test/simulation/field-npc-encounters.test.ts',
  'packages/planner-engine/test/simulation/fig-leaf.test.ts',
  'packages/planner-engine/test/simulation/pom-level-resolution.test.ts',
  'packages/planner-engine/test/simulation/project.test.ts',
  'packages/planner-engine/test/simulation/reward-authoring-domain.test.ts',
  'packages/planner-engine/test/simulation/unified-biome.test.ts',
]);

export const performanceTestFiles = Object.freeze([
  'apps/planner/test/product-loops/UnifiedBiomePerformance.test.ts',
]);

const explicitTestFiles = Object.freeze([...heavyTestFiles, ...performanceTestFiles]);

if (new Set(explicitTestFiles).size !== explicitTestFiles.length) {
  throw new Error('Explicit Vitest lanes contain a duplicate file');
}

for (const testFile of explicitTestFiles) {
  if (!existsSync(fileURLToPath(new URL(testFile, import.meta.url)))) {
    throw new Error(`Explicit Vitest lane references a missing file: ${testFile}`);
  }
}
