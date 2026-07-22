import type { Catalog, CatalogCollection } from '@run-planner/engine/catalog-schema';

export interface BiomeEditorNavigationItem {
  readonly biomeKey: string;
  readonly label: string;
}

export interface RouteEditorNavigation {
  readonly routeKey: string;
  readonly label: string;
  readonly biomePanels: readonly BiomeEditorNavigationItem[];
}

export interface EditorNavigation {
  readonly routes: CatalogCollection<RouteEditorNavigation>;
}

export function createEditorNavigation(catalog: Catalog): EditorNavigation {
  const routes = catalog.routes.values.map((route) => {
    const navigationItem = (biomeKey: string): BiomeEditorNavigationItem => {
      const biome = catalog.biomes.byKey[biomeKey];
      if (biome === undefined) {
        throw new Error(`${route.key} references unknown biome ${biomeKey}`);
      }
      return Object.freeze({ biomeKey, label: biome.label });
    };
    const biomePanels = route.biomeKeys.map(navigationItem);
    return Object.freeze({
      routeKey: route.key,
      label: route.label,
      biomePanels: Object.freeze(biomePanels),
    });
  });

  return Object.freeze({
    routes: Object.freeze({
      values: Object.freeze(routes),
      byKey: Object.freeze(Object.fromEntries(routes.map((route) => [route.routeKey, route]))),
    }),
  });
}
