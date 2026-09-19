import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createProjectDocument,
  decodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

export const fBiome = createBiomeAddress('Underworld', 'F');
export const gBiome = createBiomeAddress('Underworld', 'G');
export const hBiome = createBiomeAddress('Underworld', 'H');
export const iBiome = createBiomeAddress('Underworld', 'I');
export const nBiome = createBiomeAddress('Surface', 'N');
export const oBiome = createBiomeAddress('Surface', 'O');
export const qBiome = createBiomeAddress('Surface', 'Q');

/** Command fixtures that author a custom entry begin from a valid imported null topology. */
export function withUnstartedBiome(project: ProjectDocument, biomeKey: string): ProjectDocument {
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((biome) =>
          biome.biomeKey === biomeKey ? { ...biome, topology: null } : biome,
        ),
      },
    },
    catalog,
  );
}

export function fProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'commands-f',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
}

export function gProject(): ProjectDocument {
  return withUnstartedBiome(
    createProjectDocument(catalog, {
      projectId: 'commands-g',
      routeKey: 'Underworld',
      configuredBiomeCount: 2,
    }),
    'G',
  );
}

export function hProject(): ProjectDocument {
  return withUnstartedBiome(
    createProjectDocument(catalog, {
      projectId: 'commands-h',
      routeKey: 'Underworld',
      configuredBiomeCount: 3,
    }),
    'H',
  );
}

export function iProject(): ProjectDocument {
  return withUnstartedBiome(
    createProjectDocument(catalog, {
      projectId: 'commands-i',
      routeKey: 'Underworld',
      configuredBiomeCount: 4,
    }),
    'I',
  );
}

export function nProject(): ProjectDocument {
  return withUnstartedBiome(
    createProjectDocument(catalog, {
      projectId: 'commands-n',
      routeKey: 'Surface',
      configuredBiomeCount: 1,
    }),
    'N',
  );
}

export function surfaceProject(configuredBiomeCount: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `commands-surface-${configuredBiomeCount}`,
    routeKey: 'Surface',
    configuredBiomeCount: configuredBiomeCount,
  });
}

export function fTopology(project: ProjectDocument) {
  const topology = project.route?.biomes[0]?.topology;
  if (topology === null || topology === undefined) throw new Error('missing F topology');
  return topology;
}
