import type { Catalog } from '@run-planner/core';

import { hasBiomeCapability, type PlannerCapabilities } from './capabilities';

export interface BiomeEditorNavigationItem {
  readonly biomeStepKey: string;
  readonly label: string;
}

export interface RouteEditorNavigation {
  readonly routeKey: string;
  readonly biomePanels: readonly BiomeEditorNavigationItem[];
}

export interface EditorNavigation {
  readonly routes: Readonly<Record<string, RouteEditorNavigation>>;
}

const biomePanelLabels: Readonly<Record<string, string>> = Object.freeze({
  Underworld_F: 'Erebus',
});

export function createEditorNavigation(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): EditorNavigation {
  const routes = catalog.routes.values.map((route) => {
    const biomePanels = route.biomeSteps
      .filter((step) => hasBiomeCapability(capabilities, step.key, 'editable'))
      .map((step) =>
        Object.freeze({
          biomeStepKey: step.key,
          label: biomePanelLabels[step.key] ?? step.biome,
        }),
      );
    return Object.freeze({
      routeKey: route.key,
      biomePanels: Object.freeze(biomePanels),
    });
  });

  return Object.freeze({
    routes: Object.freeze(Object.fromEntries(routes.map((route) => [route.routeKey, route]))),
  });
}
