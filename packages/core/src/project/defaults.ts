import type { Catalog } from '../catalog';
import { decodeProjectDocument } from './codec';
import { PROJECT_DOCUMENT_SCHEMA_VERSION, type ProjectDocument } from './model';
import { ProjectDocumentContractError } from './validation';

export interface CreateProjectDocumentOptions {
  readonly projectId: string;
  readonly name: string;
  readonly configuredBiomeCounts?: Readonly<Record<string, number | undefined>>;
}

export function createProjectDocument(
  catalog: Catalog,
  options: CreateProjectDocumentOptions,
): ProjectDocument {
  const configuredBiomeCounts = options.configuredBiomeCounts ?? {};

  for (const routeKey of Object.keys(configuredBiomeCounts)) {
    if (catalog.routes.byKey[routeKey] === undefined) {
      throw new ProjectDocumentContractError(
        `configuredBiomeCounts.${routeKey}`,
        `unknown route ${routeKey}`,
      );
    }
  }

  const routes = catalog.routes.values.map((route) => {
    const configuredCount = configuredBiomeCounts[route.key] ?? 0;
    if (!Number.isInteger(configuredCount) || configuredCount < 0) {
      throw new ProjectDocumentContractError(
        `configuredBiomeCounts.${route.key}`,
        'must be a non-negative integer',
      );
    }
    if (configuredCount > route.biomeSteps.length) {
      throw new ProjectDocumentContractError(
        `configuredBiomeCounts.${route.key}`,
        `exceeds the ${route.biomeSteps.length}-step route`,
      );
    }

    return {
      routeKey: route.key,
      biomes: route.biomeSteps.slice(0, configuredCount).map((step) => ({
        kind: 'LinearBiome',
        biomeStepKey: step.key,
        topology: null,
      })),
    };
  });

  return decodeProjectDocument(
    {
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      projectId: options.projectId,
      name: options.name,
      catalogVersion: catalog.version,
      routes,
    },
    catalog,
  );
}

export function createEmptyProjectDocument(
  catalog: Catalog,
  options: Omit<CreateProjectDocumentOptions, 'configuredBiomeCounts'>,
): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: options.projectId,
    name: options.name,
  });
}
