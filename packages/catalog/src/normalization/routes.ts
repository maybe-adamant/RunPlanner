import type { CatalogCollection, RouteDeclaration } from '@run-planner/core';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

export function normalizeRoutes(
  rawRoutes: readonly RouteDeclaration[],
): CatalogCollection<RouteDeclaration> {
  const seenSteps = new Set<string>();
  const routes = rawRoutes.map((route, routeIndex) => {
    const routePath = `routes[${routeIndex}]`;
    requireNonEmpty(route.key, `${routePath}.key`);
    requireNonEmpty(route.label, `${routePath}.label`);

    const biomeSteps = route.biomeSteps.map((step, stepIndex) => {
      const stepPath = `${routePath}.biomeSteps[${stepIndex}]`;
      requireNonEmpty(step.key, `${stepPath}.key`);
      requireNonEmpty(step.biome, `${stepPath}.biome`);
      if (seenSteps.has(step.key)) {
        fail(`${stepPath}.key`, `duplicates biome step ${step.key}`);
      }
      seenSteps.add(step.key);
      return Object.freeze({ key: step.key, biome: step.biome });
    });

    return Object.freeze({
      key: route.key,
      label: route.label,
      biomeSteps: Object.freeze(biomeSteps),
    });
  });

  return createCollection(routes, 'routes', (route) => route.key);
}
