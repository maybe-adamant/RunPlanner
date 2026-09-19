import type { Catalog, CatalogCollection } from '@run-planner/engine/catalog-schema';
import type { AuthoredRoutePlan } from '@run-planner/engine/authored-project';

export interface BiomeEditorNavigationItem {
  readonly biomeKey: string;
  readonly label: string;
}

export interface RouteEditorNavigation {
  readonly routeKey: string;
  readonly label: string;
  readonly biomePanels: readonly BiomeEditorNavigationItem[];
  readonly itinerarySelectionRequired: boolean;
}

export interface EditorNavigation {
  readonly routes: CatalogCollection<RouteEditorNavigation>;
}

/** Current-project navigation follows its full itinerary, not its configured prefix. */
export function projectRouteNavigation(
  catalog: Catalog,
  route: Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'>,
): RouteEditorNavigation {
  const declaration = catalog.routes.byKey[route.routeKey];
  if (declaration === undefined) throw new Error(`Unknown route ${route.routeKey}`);
  return Object.freeze({
    routeKey: route.routeKey,
    label: declaration.label,
    itinerarySelectionRequired: declaration.dreamItinerary !== undefined,
    biomePanels: Object.freeze(
      route.itineraryBiomeKeys.map((biomeKey) => {
        const biome = catalog.biomes.byKey[biomeKey];
        if (biome === undefined) throw new Error(`Unknown biome ${biomeKey}`);
        return Object.freeze({ biomeKey, label: biome.label });
      }),
    ),
  });
}

export function createEditorNavigation(catalog: Catalog): EditorNavigation {
  const routes = catalog.routes.values
    .filter(
      (route) => route.key === 'Underworld' || route.key === 'Surface' || route.key === 'Dream',
    )
    .map((route) =>
      projectRouteNavigation(catalog, {
        routeKey: route.key,
        itineraryBiomeKeys: route.biomeKeys,
      }),
    );

  return Object.freeze({
    routes: Object.freeze({
      values: Object.freeze(routes),
      byKey: Object.freeze(Object.fromEntries(routes.map((route) => [route.routeKey, route]))),
    }),
  });
}
