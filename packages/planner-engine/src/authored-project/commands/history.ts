import type { Catalog } from '../../catalog-schema';
import { createInitialBiomeState } from '../biomeState';
import type { ProjectDocument } from '../model';

import { failCommand } from './contract';
import type { ProjectCommand, ProjectMetadataCommand } from './types';

function configureRoutePrefix(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<ProjectCommand, { readonly kind: 'ConfigureRoutePrefix' }>,
): ProjectDocument {
  const routeDeclaration = catalog.routes.byKey[command.route.routeKey];
  if (routeDeclaration === undefined) {
    failCommand(command, `unknown route ${command.route.routeKey}`);
  }
  const configuredBiomeCount = command.configuredBiomeCount;
  if (!Number.isInteger(configuredBiomeCount) || configuredBiomeCount < 0) {
    failCommand(command, 'configuredBiomeCount must be a non-negative integer');
  }
  if (configuredBiomeCount > routeDeclaration.biomeKeys.length) {
    failCommand(
      command,
      `configuredBiomeCount exceeds the ${routeDeclaration.biomeKeys.length}-biome route`,
    );
  }
  const routeIndex = document.routes.findIndex(
    (route) => route.routeKey === command.route.routeKey,
  );
  if (routeIndex < 0) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  if (route.biomes.length === configuredBiomeCount) {
    return document;
  }

  const retainedBiomes = route.biomes.slice(0, configuredBiomeCount);
  const addedBiomes = routeDeclaration.biomeKeys
    .slice(route.biomes.length, configuredBiomeCount)
    .map((biomeKey) => {
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (layout === undefined) {
        failCommand(command, `${biomeKey} has no authored plan initializer`);
      }
      return {
        biomeKey,
        state: createInitialBiomeState(layout),
        topology: null,
      };
    });
  const replacement = { ...route, biomes: [...retainedBiomes, ...addedBiomes] };
  return {
    ...document,
    routes: document.routes.map((candidate, index) =>
      index === routeIndex ? replacement : candidate,
    ),
  };
}

export function applyProjectMetadataCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectMetadataCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'RenameProject':
      return command.name === document.name ? document : { ...document, name: command.name };
    case 'ConfigureRoutePrefix':
      return configureRoutePrefix(document, catalog, command);
  }
}
