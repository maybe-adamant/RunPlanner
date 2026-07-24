import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createApplication,
  type PlannerApplication,
} from '../../src/composition/createApplication';
import * as candidateProjection from '../../src/projections/candidateProjection';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const uiRoot = join(repositoryRoot, 'apps/planner/src/ui');

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('candidate application boundary', () => {
  let application: PlannerApplication | undefined;

  afterEach(() => {
    application?.dispose();
    application = undefined;
  });

  it('exports the structured workspace without candidate authorities', () => {
    application = createApplication();

    expect(Object.keys(application).sort()).toEqual([
      'catalog',
      'catalogSummary',
      'dispose',
      'editorNavigation',
      'projectOperations',
      'store',
      'structuredWorkspace',
    ]);
    expect(Object.keys(candidateProjection).sort()).toEqual([
      'candidateSupport',
      'createCandidateSessionFactory',
      'presentCandidateLabel',
    ]);
  });

  it('keeps workspace loading inside the single React interaction adapter', () => {
    const loaderCallers = sourceFiles(uiRoot)
      .filter((path) => /\.load\s*\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(uiRoot, path));

    expect(loaderCallers).toEqual(['controls/useWorkspaceInteraction.ts']);
  });

  it('keeps candidate and simulation authorities out of production React sources', () => {
    const forbiddenAuthorities = [
      'createCandidateSessionFactory',
      'createContextualOptionResolver',
      'createContextualPickerProjection',
      'createPreparedProjectCandidateSession',
      'createRewardPickerProjection',
      'createStructuredWorkspaceProjection',
      'projectClockworkTopology',
      'projectLinearBatchState',
      'simulateProject',
    ];

    for (const path of sourceFiles(uiRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const authority of forbiddenAuthorities) {
        expect(source, `${relative(uiRoot, path)} imports ${authority}`).not.toContain(authority);
      }
    }
  });
});
