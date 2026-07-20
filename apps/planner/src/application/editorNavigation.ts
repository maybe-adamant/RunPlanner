import type { Catalog } from '@run-planner/core';

import { hasBiomeCapability, type PlannerCapabilities } from './capabilities';

export interface BiomeEditorNavigationItem {
  readonly biomeKey: string;
  readonly label: string;
}

export interface RouteEditorNavigation {
  readonly routeKey: string;
  readonly biomePanels: readonly BiomeEditorNavigationItem[];
  readonly configurablePrefixBiomePanels: readonly BiomeEditorNavigationItem[];
}

export interface EditorNavigation {
  readonly routes: Readonly<Record<string, RouteEditorNavigation>>;
}

export function createEditorNavigation(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): EditorNavigation {
  const routes = catalog.routes.values.map((route) => {
    const navigationItem = (biomeKey: string): BiomeEditorNavigationItem => {
      const biome = catalog.biomes.byKey[biomeKey];
      if (biome === undefined) {
        throw new Error(`${route.key} references unknown biome ${biomeKey}`);
      }
      return Object.freeze({ biomeKey, label: biome.label });
    };
    const biomePanels = route.biomeKeys
      .filter((biomeKey) => hasBiomeCapability(capabilities, biomeKey, 'editable'))
      .map(navigationItem);
    const configurablePrefixBiomePanels: BiomeEditorNavigationItem[] = [];
    for (const biomeKey of route.biomeKeys) {
      if (
        !hasBiomeCapability(capabilities, biomeKey, 'authorable') ||
        !hasBiomeCapability(capabilities, biomeKey, 'simulatable') ||
        !hasBiomeCapability(capabilities, biomeKey, 'editable')
      ) {
        break;
      }
      configurablePrefixBiomePanels.push(navigationItem(biomeKey));
    }
    return Object.freeze({
      routeKey: route.key,
      biomePanels: Object.freeze(biomePanels),
      configurablePrefixBiomePanels: Object.freeze(configurablePrefixBiomePanels),
    });
  });

  return Object.freeze({
    routes: Object.freeze(Object.fromEntries(routes.map((route) => [route.routeKey, route]))),
  });
}
