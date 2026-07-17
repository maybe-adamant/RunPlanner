export interface BiomeStepDeclaration {
  readonly key: string;
  readonly biome: string;
}

export interface RouteDeclaration {
  readonly key: string;
  readonly label: string;
  readonly biomeSteps: readonly BiomeStepDeclaration[];
}

export interface Catalog {
  readonly version: string;
  readonly routes: readonly RouteDeclaration[];
}

export interface CatalogSummary {
  readonly version: string;
  readonly routeCount: number;
  readonly biomeStepCount: number;
}

export function summarizeCatalog(catalog: Catalog): CatalogSummary {
  return {
    version: catalog.version,
    routeCount: catalog.routes.length,
    biomeStepCount: catalog.routes.reduce((count, route) => count + route.biomeSteps.length, 0),
  };
}
