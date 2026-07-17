import type { BiomeStepDeclaration, Catalog, RouteDeclaration } from '@run-planner/core';

export interface CatalogInput {
  readonly version: string;
  readonly routes: readonly RouteDeclaration[];
}

export class CatalogContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CatalogContractError';
  }
}

function requireNonEmpty(value: string, path: string): void {
  if (value.trim().length === 0) {
    throw new CatalogContractError(`${path} must not be empty`);
  }
}

function freezeBiomeStep(step: BiomeStepDeclaration): BiomeStepDeclaration {
  requireNonEmpty(step.key, 'biome step key');
  requireNonEmpty(step.biome, `biome step ${step.key} biome`);

  return Object.freeze({
    key: step.key,
    biome: step.biome,
  });
}

function freezeRoute(route: RouteDeclaration): RouteDeclaration {
  requireNonEmpty(route.key, 'route key');
  requireNonEmpty(route.label, `route ${route.key} label`);

  const seenSteps = new Set<string>();
  const biomeSteps = route.biomeSteps.map((step) => {
    if (seenSteps.has(step.key)) {
      throw new CatalogContractError(`route ${route.key} repeats biome step ${step.key}`);
    }

    seenSteps.add(step.key);
    return freezeBiomeStep(step);
  });

  return Object.freeze({
    key: route.key,
    label: route.label,
    biomeSteps: Object.freeze(biomeSteps),
  });
}

export function createCatalog(input: CatalogInput): Catalog {
  requireNonEmpty(input.version, 'catalog version');

  const seenRoutes = new Set<string>();
  const routes = input.routes.map((route) => {
    if (seenRoutes.has(route.key)) {
      throw new CatalogContractError(`catalog repeats route ${route.key}`);
    }

    seenRoutes.add(route.key);
    return freezeRoute(route);
  });

  return Object.freeze({
    version: input.version,
    routes: Object.freeze(routes),
  });
}
