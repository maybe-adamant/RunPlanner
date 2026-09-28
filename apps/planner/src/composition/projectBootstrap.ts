import type { Catalog } from '@run-planner/engine/catalog-schema';
import { createProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

export function createInitialProject(
  catalog: Catalog,
  options: {
    readonly projectId: string;
    readonly routeKey: string;
    readonly itineraryBiomeKeys?: readonly string[];
  },
): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: options.projectId,
    routeKey: options.routeKey,
    ...(options.itineraryBiomeKeys === undefined
      ? {}
      : { itineraryBiomeKeys: options.itineraryBiomeKeys }),
    configuredBiomeCount: 1,
  });
}
