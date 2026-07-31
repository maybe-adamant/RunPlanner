import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { StructuredWorkspaceProjectionContractError } from './contract';

/** Resolve one declaration-owned room for workspace assembly and binding. */
export function requireWorkspaceRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}
