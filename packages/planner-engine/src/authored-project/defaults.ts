import type { Catalog } from '../catalog-schema';
import { createInitialBiomeState } from './biomeState';
import { decodeProjectDocument } from './codec';
import { PROJECT_DOCUMENT_SCHEMA_VERSION, type ProjectDocument } from './model';
import { ProjectDocumentContractError } from './validation';
import { createDefaultRouteLoadout } from './loadout';
import { postbossCapabilities } from './postboss-capabilities';

export interface CreateProjectDocumentOptions {
  readonly projectId: string;
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
    if (configuredCount > route.biomeKeys.length) {
      throw new ProjectDocumentContractError(
        `configuredBiomeCounts.${route.key}`,
        `exceeds the ${route.biomeKeys.length}-biome route`,
      );
    }

    return {
      routeKey: route.key,
      loadout: createDefaultRouteLoadout(catalog),
      biomes: route.biomeKeys.slice(0, configuredCount).map((biomeKey) => {
        const layout = catalog.biomeLayouts.byKey[biomeKey];
        if (layout === undefined) {
          throw new ProjectDocumentContractError(
            `configuredBiomeCounts.${route.key}`,
            `${biomeKey} has no authored plan initializer`,
          );
        }
        const postboss = postbossCapabilities(catalog, biomeKey);
        return {
          biomeKey,
          state: createInitialBiomeState(layout),
          topology: null,
          ...(postboss.hasKeepsakeRack
            ? {
                postbossKeepsakeDisposition: { kind: 'retain' as const },
              }
            : {}),
          ...(postboss.hasRoomActions
            ? {
                postbossRoomActions: {
                  order: postboss.hasPostbossRoom ? [{ kind: 'useFountain' as const }] : [],
                },
              }
            : {}),
        };
      }),
    };
  });

  return decodeProjectDocument(
    {
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      projectId: options.projectId,
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
  });
}
