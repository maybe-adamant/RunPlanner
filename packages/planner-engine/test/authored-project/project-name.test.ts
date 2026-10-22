import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectAddress,
  createProjectDocument,
  DEFAULT_PROJECT_NAME,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectCommandContractError,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const project = (name?: string) =>
  createProjectDocument(catalog, {
    projectId: 'named',
    routeKey: 'Underworld',
    configuredBiomeCount: 0,
    ...(name === undefined ? {} : { name }),
  });
const rename = (document: ProjectDocument, name: string) =>
  applyProjectCommand(document, catalog, {
    kind: 'RenameProject',
    project: createProjectAddress(),
    name,
  });

describe('plan name', () => {
  it('is the default for a new project and saved right after its id', () => {
    expect(project().name).toBe(DEFAULT_PROJECT_NAME);
    expect(Object.keys(JSON.parse(encodeProjectDocument(project('Staff run'))))).toEqual([
      'schemaVersion',
      'schemaRevision',
      'projectId',
      'name',
      'catalogVersion',
      'route',
    ]);
    expect(parseProjectDocument(encodeProjectDocument(project('Staff run')), catalog).name).toBe(
      'Staff run',
    );
  });

  it('is renamed trimmed, keeping the route, and unchanged by the same name', () => {
    const original = project();
    const renamed = rename(original, '  Staff run ');
    expect(renamed.name).toBe('Staff run');
    expect(renamed.route).toBe(original.route);
    expect(rename(renamed, 'Staff run')).toBe(renamed);
  });

  it('refuses a blank or overlong name', () => {
    for (const name of ['', '   ', '🎲'.repeat(201)])
      expect(() => rename(project(), name)).toThrow(ProjectCommandContractError);
    expect(rename(project(), '🎲'.repeat(200)).name).toBe('🎲'.repeat(200));
  });
});
