import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

export const fBiome = createBiomeAddress('Underworld', 'F');
export const gBiome = createBiomeAddress('Underworld', 'G');
export const hBiome = createBiomeAddress('Underworld', 'H');
export const iBiome = createBiomeAddress('Underworld', 'I');
export const nBiome = createBiomeAddress('Surface', 'N');
export const oBiome = createBiomeAddress('Surface', 'O');
export const qBiome = createBiomeAddress('Surface', 'Q');

export function fProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-f',
    name: 'Commands F',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

export function gProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-g',
    name: 'Commands G',
    configuredBiomeCounts: { Underworld: 2 },
  });
}

export function hProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-h',
    name: 'Commands H',
    configuredBiomeCounts: { Underworld: 3 },
  });
}

export function iProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-i',
    name: 'Commands I',
    configuredBiomeCounts: { Underworld: 4 },
  });
}

export function nProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-n',
    name: 'Commands N',
    configuredBiomeCounts: { Surface: 1 },
  });
}

export function surfaceProject(configuredBiomeCount: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `commands-surface-${configuredBiomeCount}`,
    name: 'Commands Surface',
    configuredBiomeCounts: { Surface: configuredBiomeCount },
  });
}

export function fTopology(project: ProjectDocument) {
  const topology = project.routes[0]?.biomes[0]?.topology;
  if (topology === null || topology === undefined) throw new Error('missing F topology');
  return topology;
}
