import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
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
    const forbiddenImports = [
      /from\s+['"]@radix-ui\//,
      /from\s+['"]react(?:\/|['"])/,
      /from\s+['"]react-redux['"]/,
    ];

    for (const path of productionSources(engineRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const presentationModel of presentationModels) {
        expect(source, `${relative(engineRoot, path)} owns ${presentationModel}`).not.toContain(
          presentationModel,
        );
      }
      for (const forbiddenImport of forbiddenImports) {
        expect(source, `${relative(engineRoot, path)} imports a UI library`).not.toMatch(
          forbiddenImport,
        );
      }
    }
  });
});
