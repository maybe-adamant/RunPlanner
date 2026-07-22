import {
  createProjectDocument,
  decodeProjectDocument,
  parseProjectDocument,
  type CreateProjectDocumentOptions,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';

import { requireBiomeCapability, type PlannerCapabilities } from './capabilities';

export function requireRoutePrefixAuthorable(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
  routeKey: string,
  configuredBiomeCount: number,
  path: string,
): void {
  const route = catalog.routes.byKey[routeKey];
  if (
    route === undefined ||
    !Number.isInteger(configuredBiomeCount) ||
    configuredBiomeCount < 0 ||
    configuredBiomeCount > route.biomeKeys.length
  ) {
    return;
  }
  for (const [index, biomeKey] of route.biomeKeys.slice(0, configuredBiomeCount).entries()) {
    requireBiomeCapability(capabilities, biomeKey, 'authorable', `${path}[${index}]`);
  }
}

function requireConfiguredPrefixesAuthorable(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
  configuredBiomeCounts: Readonly<Record<string, number | undefined>>,
): void {
  for (const [routeKey, configuredCount] of Object.entries(configuredBiomeCounts)) {
    if (configuredCount === undefined) {
      continue;
    }
    requireRoutePrefixAuthorable(
      catalog,
      capabilities,
      routeKey,
      configuredCount,
      `configuredBiomeCounts.${routeKey}`,
    );
  }
}

export function requireProjectAuthorable(
  project: ProjectDocument,
  capabilities: PlannerCapabilities,
): void {
  for (const [routeIndex, route] of project.routes.entries()) {
    for (const [biomeIndex, biome] of route.biomes.entries()) {
      requireBiomeCapability(
        capabilities,
        biome.biomeKey,
        'authorable',
        `project.routes[${routeIndex}].biomes[${biomeIndex}]`,
      );
    }
  }
}

export function createAuthorableProjectDocument(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
  options: CreateProjectDocumentOptions,
): ProjectDocument {
  requireConfiguredPrefixesAuthorable(catalog, capabilities, options.configuredBiomeCounts ?? {});
  const project = createProjectDocument(catalog, options);
  requireProjectAuthorable(project, capabilities);
  return project;
}

export function decodeAuthorableProjectDocument(
  value: unknown,
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): ProjectDocument {
  const project = decodeProjectDocument(value, catalog);
  requireProjectAuthorable(project, capabilities);
  return project;
}

export function parseAuthorableProjectDocument(
  json: string,
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): ProjectDocument {
  const project = parseProjectDocument(json, catalog);
  requireProjectAuthorable(project, capabilities);
  return project;
}
