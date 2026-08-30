import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const plannerSourceRoot = join(repositoryRoot, 'apps/planner/src');
const uiRoot = join(repositoryRoot, 'apps/planner/src/ui');
const engineRoot = join(repositoryRoot, 'packages/planner-engine/src');

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSources(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('unified workspace ownership boundary', () => {
  it('acquires biome completeness only at the structured-workspace source boundary', () => {
    const importerPaths = productionSources(plannerSourceRoot).filter((path) =>
      readFileSync(path, 'utf8').includes('evaluateBiomeCompleteness'),
    );
    const importers = importerPaths.map((path) =>
      relative(plannerSourceRoot, path).replaceAll('\\', '/'),
    );

    expect(importers).toEqual(['projections/structured-workspace/source-index.ts']);
    expect([
      ...readFileSync(importerPaths[0]!, 'utf8').matchAll(/\bevaluateBiomeCompleteness\s*\(/g),
    ]).toHaveLength(1);
  });

  it('keeps topology-impact calculation out of React components', () => {
    const forbiddenAuthorities = [
      'applyProjectCommand',
      'applyTopologyRemovalImpact',
      'describeClearTopologyImpact',
      'describeExitDecisionRemovalImpact',
      'describeHubSlotClosureImpact',
      'describeTopologyRemovalImpact',
      'removeDownstreamDecisions',
    ];

    for (const path of productionSources(uiRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const authority of forbiddenAuthorities) {
        expect(source, `${relative(uiRoot, path)} imports ${authority}`).not.toContain(authority);
      }
    }
  });

  it('keeps workspace presentation models out of the pure planner engine', () => {
    const presentationModels = [
      'ContextualOption',
      'EditorSession',
      'InspectorDestination',
      'WorkspaceBiome',
      'WorkspaceInteractionCatalog',
      'WorkspaceNode',
    ];
    for (const path of productionSources(engineRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const presentationModel of presentationModels) {
        expect(source, `${relative(engineRoot, path)} owns ${presentationModel}`).not.toContain(
          presentationModel,
        );
      }
    }
  });
});
