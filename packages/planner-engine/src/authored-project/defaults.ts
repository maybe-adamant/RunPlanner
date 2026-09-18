import type { Catalog } from '../catalog-schema';
import { createInitialBiomeState } from './biomeState';
import { decodeProjectDocument } from './codec';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
  type ResourcePlacements,
} from './model';
import { ProjectDocumentContractError } from './validation';
import { createDefaultRouteLoadout } from './loadout';

export interface CreateProjectDocumentOptions {
  readonly projectId: string;
  readonly routeKey: string;
  /** Internal complete itinerary; ordinary presets always use their declaration order. */
  readonly itineraryBiomeKeys?: readonly string[];
  readonly configuredBiomeCount?: number;
}

/** Explicit empty route resource record for direct, route-less evaluation adapters. */
export const EMPTY_RESOURCE_PLACEMENTS: ResourcePlacements = Object.freeze({
  Pickaxe: null,
  Exorcism: null,
  Shovel: null,
  Fishing: null,
});

export function createProjectDocument(
  catalog: Catalog,
  options: CreateProjectDocumentOptions,
): ProjectDocument {
  const route = catalog.routes.byKey[options.routeKey];
  if (route === undefined) {
    throw new ProjectDocumentContractError('routeKey', `unknown route ${options.routeKey}`);
  }
  const configuredCount = options.configuredBiomeCount ?? 0;
  const itineraryBiomeKeys = options.itineraryBiomeKeys ?? route.biomeKeys;
  if (itineraryBiomeKeys.length === 0) {
    throw new ProjectDocumentContractError('itineraryBiomeKeys', 'must not be empty');
  }
  if (!Number.isInteger(configuredCount) || configuredCount < 0) {
    throw new ProjectDocumentContractError(
      'configuredBiomeCount',
      'must be a non-negative integer',
    );
  }
  if (configuredCount > itineraryBiomeKeys.length) {
    throw new ProjectDocumentContractError(
      'configuredBiomeCount',
      `exceeds the ${itineraryBiomeKeys.length}-biome route`,
    );
  }
  if (
    route.key !== 'Dream' &&
    (itineraryBiomeKeys.length !== route.biomeKeys.length ||
      itineraryBiomeKeys.some((biomeKey, index) => biomeKey !== route.biomeKeys[index]))
  ) {
    throw new ProjectDocumentContractError(
      'itineraryBiomeKeys',
      'must equal the route preset declaration',
    );
  }
  const routePlan = (() => {
    const loadout = createDefaultRouteLoadout(catalog);
    return {
      routeKey: route.key,
      itineraryBiomeKeys: Object.freeze([...itineraryBiomeKeys]),
      loadout,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      biomes: itineraryBiomeKeys.slice(0, configuredCount).map((biomeKey) => {
        const layout = catalog.biomeLayouts.byKey[biomeKey];
        if (layout === undefined) {
          throw new ProjectDocumentContractError(
            `configuredBiomeCount`,
            `${biomeKey} has no authored plan initializer`,
          );
        }
        return {
          biomeKey,
          state: createInitialBiomeState(layout),
          topology: null,
        };
      }),
    };
  })();

  return decodeProjectDocument(
    {
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      projectId: options.projectId,
      catalogVersion: catalog.version,
      route: routePlan,
    },
    catalog,
  );
}

export function createEmptyProjectDocument(
  catalog: Catalog,
  options: CreateProjectDocumentOptions,
): ProjectDocument {
  return createProjectDocument(catalog, options);
}
