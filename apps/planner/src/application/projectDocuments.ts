import {
  createProjectDocument,
  decodeProjectDocument,
  parseProjectDocument,
  type Catalog,
  type CreateProjectDocumentOptions,
  type ProjectDocument,
} from '@run-planner/core';

import { requireBiomeCapability, type PlannerCapabilities } from './capabilities';

function requireConfiguredPrefixesAuthorable(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
  configuredBiomeCounts: Readonly<Record<string, number | undefined>>,
): void {
  for (const [routeKey, configuredCount] of Object.entries(configuredBiomeCounts)) {
    const route = catalog.routes.byKey[routeKey];
    if (
      route === undefined ||
      configuredCount === undefined ||
      !Number.isInteger(configuredCount) ||
      configuredCount < 0 ||
      configuredCount > route.biomeSteps.length
    ) {
      continue;
    }
    for (const [index, step] of route.biomeSteps.slice(0, configuredCount).entries()) {
      requireBiomeCapability(
        capabilities,
        step.key,
        'authorable',
        `configuredBiomeCounts.${routeKey}[${index}]`,
      );
    }
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
        biome.biomeStepKey,
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
