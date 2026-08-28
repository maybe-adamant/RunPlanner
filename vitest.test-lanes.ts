import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const testInclude = Object.freeze([
  'packages/*/test/**/*.test.ts',
  'apps/*/src/**/*.test.{ts,tsx}',
  'apps/*/test/**/*.test.{ts,tsx}',
]);

export const heavyTestFiles = Object.freeze([
  'apps/planner/src/projections/structured-workspace/interactions/acquisition-conversion-interactions.test.ts',
  'apps/planner/src/projections/structured-workspace/interactions/reward-payload-interactions.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/biome-semantic-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/decision-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-action-row-projection.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-facts.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-features-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-reward-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-room-facts.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-room-workbench.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/occurrence-interaction-requirements.test.ts',
  'apps/planner/src/projections/structured-workspace/assembly/topology-interaction-assembly.test.ts',
  'apps/planner/src/projections/structured-workspace/navigation/inspector-defaults.test.ts',
  'apps/planner/src/projections/structured-workspace/source-index.test.ts',
  'apps/planner/src/projections/structuredWorkspace.contract.test.ts',
  'apps/planner/src/projections/structuredWorkspace.test.ts',
  'apps/planner/src/state/projectWorkspaceSlice.test.ts',
  'apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx',
  'apps/planner/src/ui/editor/biome/BiomeInspectorControls.test.tsx',
  'apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/HubCompletionHandoff.test.tsx',
  'apps/planner/src/ui/editor/biome/HubDecisionWorkbench.interaction.test.tsx',
  'apps/planner/src/ui/editor/biome/HubMembershipBoard.test.tsx',
  'apps/planner/src/ui/editor/biome/HubRoomCards.test.tsx',
  'apps/planner/src/ui/editor/biome/HubVisitRanking.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceEncounterWorkbench.test.tsx',
  'apps/planner/src/ui/editor/biome/RoomActionTimeline.test.tsx',
  'apps/planner/src/ui/editor/biome/OccurrenceRoomFeatures.test.tsx',
  'apps/planner/src/ui/editor/rewards/PomResolutionEditor.test.tsx',
  'apps/planner/src/ui/editor/rewards/RewardEditors.test.tsx',
  'apps/planner/src/ui/editor/rewards/TraitOfferEditor.test.tsx',
  'apps/planner/src/ui/editor/rewards/TraitOfferResolution.test.tsx',
  'apps/planner/src/ui/editor/rewards/TraitOfferSelectedSpecialOutcomes.test.tsx',
  'apps/planner/src/ui/editor/rewards/TraitOfferShell.test.tsx',
  'apps/planner/src/ui/shell/App.test.tsx',
  'apps/planner/src/ui/shell/RouteOverview.test.tsx',
  'apps/planner/src/ui/shell/RouteWorkspace.test.tsx',
  'apps/planner/test/architecture/candidateRenderPurity.interaction.test.tsx',
  'apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx',
  'apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx',
  'apps/planner/test/product-loops/ProperUpbringingProductLoop.interaction.test.tsx',
  'apps/planner/test/product-loops/RunStateProductLoop.interaction.test.tsx',
  'packages/planner-engine/test/simulation/biomes/q/simulation.test.ts',
  'packages/planner-engine/test/simulation/encounter-authoring-domain.test.ts',
  'packages/planner-engine/test/simulation/echo-gift-keepsake.test.ts',
  'packages/planner-engine/test/simulation/experimental-hammer.test.ts',
  'packages/planner-engine/test/simulation/field-npc-encounters.test.ts',
  'packages/planner-engine/test/simulation/fig-leaf.test.ts',
  'packages/planner-engine/test/simulation/gorgon-amulet.test.ts',
  'packages/planner-engine/test/simulation/keepsake-selection-candidates.test.ts',
  'packages/planner-engine/test/simulation/pom-level-resolution.test.ts',
  'packages/planner-engine/test/simulation/project.test.ts',
  'packages/planner-engine/test/simulation/progressive-assembly.test.ts',
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
