import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const uiRoot = join(repositoryRoot, 'apps/planner/src/ui');
const engineRoot = join(repositoryRoot, 'packages/planner-engine/src');
const structuredWorkspaceRoot = join(
  repositoryRoot,
  'apps/planner/src/projections/structured-workspace',
);

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

  it('keeps independently derived authored expectations free of workspace product authorities', () => {
    const expectedAuditSources = [
      join(structuredWorkspaceRoot, 'audit/authored-leaf-expectations.ts'),
      join(structuredWorkspaceRoot, 'audit/authored-interaction-expectations.ts'),
    ];
    const forbiddenImports = [
      /from\s+['"][^'"]*source-index['"]/,
      /from\s+['"][^'"]*occurrence-assembly['"]/,
      /from\s+['"][^'"]*occurrence-facts['"]/,
      /from\s+['"][^'"]*decision-assembly['"]/,
      /from\s+['"][^'"]*hub-assembly['"]/,
      /from\s+['"][^'"]*biome-semantic-assembly['"]/,
      /from\s+['"][^'"]*assembly-products['"]/,
      /from\s+['"][^'"]*marker-builder['"]/,
      /from\s+['"][^'"]*topology-presentation['"]/,
      /from\s+['"][^'"]*room-policy['"]/,
      /from\s+['"][^'"]*catalog-room['"]/,
      /from\s+['"][^'"]*inspector-[^'"]*['"]/,
      /from\s+['"][^'"]*interaction-binding['"]/,
      /from\s+['"][^'"]*projector['"]/,
    ];

    for (const path of expectedAuditSources) {
      const source = readFileSync(path, 'utf8');
      for (const forbiddenImport of forbiddenImports) {
        expect(
          source,
          `${relative(structuredWorkspaceRoot, path)} imports ${forbiddenImport}`,
        ).not.toMatch(forbiddenImport);
      }
    }
  });

  it('keeps final workspace presentation, interaction binding, and facade directional', () => {
    const presentationPath = join(structuredWorkspaceRoot, 'biome-presentation.ts');
    const interactionBindingPath = join(structuredWorkspaceRoot, 'interaction-binding.ts');
    const markerOwnershipPath = join(structuredWorkspaceRoot, 'marker-ownership.ts');
    const projectorPath = join(structuredWorkspaceRoot, 'projector.ts');
    const forbiddenPresentationImports = [
      /from\s+['"][^'"]*source-index['"]/,
      /from\s+['"][^'"]*audit\//,
      /from\s+['"][^'"]*interaction-binding['"]/,
      /from\s+['"][^'"]*occurrence-assembly['"]/,
      /from\s+['"][^'"]*decision-assembly['"]/,
      /from\s+['"][^'"]*hub-assembly['"]/,
      /from\s+['"][^'"]*topology-interaction-assembly['"]/,
      /from\s+['"][^'"]*marker-builder['"]/,
    ];
    const forbiddenInteractionBindingImports = [
      /from\s+['"][^'"]*biome-presentation['"]/,
      /from\s+['"][^'"]*inspector-defaults['"]/,
      /from\s+['"][^'"]*inspector-destinations['"]/,
    ];
    const forbiddenMarkerOwnershipImports = [
      /from\s+['"][^'"]*source-index['"]/,
      /from\s+['"][^'"]*occurrence-assembly['"]/,
      /from\s+['"][^'"]*decision-assembly['"]/,
      /from\s+['"][^'"]*hub-assembly['"]/,
      /from\s+['"][^'"]*biome-semantic-assembly['"]/,
      /from\s+['"][^'"]*biome-presentation['"]/,
      /from\s+['"][^'"]*topology-interaction-assembly['"]/,
      /from\s+['"][^'"]*marker-builder['"]/,
      /from\s+['"][^'"]*audit\//,
      /from\s+['"][^'"]*interaction-binding['"]/,
      /from\s+['"][^'"]*inspector-[^'"]*['"]/,
    ];
    const forbiddenFacadeImports = [
      /from\s+['"][^'"]*occurrence-assembly['"]/,
      /from\s+['"][^'"]*decision-assembly['"]/,
      /from\s+['"][^'"]*hub-assembly['"]/,
      /from\s+['"][^'"]*topology-interaction-assembly['"]/,
      /from\s+['"][^'"]*marker-(?:builder|ownership)['"]/,
      /from\s+['"][^'"]*inspector-defaults['"]/,
      /from\s+['"][^'"]*inspector-destinations['"]/,
    ];

    for (const [path, forbiddenImports] of [
      [presentationPath, forbiddenPresentationImports],
      [interactionBindingPath, forbiddenInteractionBindingImports],
      [markerOwnershipPath, forbiddenMarkerOwnershipImports],
      [projectorPath, forbiddenFacadeImports],
    ] as const) {
      const source = readFileSync(path, 'utf8');
      for (const forbiddenImport of forbiddenImports) {
        expect(
          source,
          `${relative(structuredWorkspaceRoot, path)} imports ${forbiddenImport}`,
        ).not.toMatch(forbiddenImport);
      }
    }
  });
});
