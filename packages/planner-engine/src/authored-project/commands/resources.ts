import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { ProjectCommandContractError } from './contract';
import type { ResourcePlacementCommand } from './types';

export function applyResourcePlacementCommand(
  document: ProjectDocument,
  _catalog: Catalog,
  command: ResourcePlacementCommand,
): ProjectDocument {
  if (document.route.routeKey !== command.route.routeKey)
    throw new ProjectCommandContractError(command.kind, command.route, 'unknown route');
  const route = document.route;
  if (command.value !== null) {
    const biome = route.biomes.find((candidate) => candidate.biomeKey === command.value!.biomeKey);
    if (biome === undefined)
      throw new ProjectCommandContractError(
        command.kind,
        command.route,
        'target biome is not configured',
      );
    const present =
      biome.topology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === command.value!.occurrenceId,
      ) === true;
    if (!present)
      throw new ProjectCommandContractError(
        command.kind,
        command.route,
        'target occurrence does not exist',
      );
  }
  const resourcePlacements = Object.freeze({
    ...route.resourcePlacements,
    [command.family]: command.value === null ? null : Object.freeze({ ...command.value }),
  });
  return Object.freeze({
    ...document,
    route: Object.freeze({ ...route, resourcePlacements }),
  });
}
