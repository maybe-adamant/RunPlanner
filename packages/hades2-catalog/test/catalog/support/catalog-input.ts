import { declarations, type RawCatalogInput } from '../../../src/declarations';

/** Copies declarations for raw-boundary mutations without adding declaration policy to tests. */
export function cloneCatalogInput(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

export function requireRoom(input: RawCatalogInput, gameName: string) {
  const room = input.rooms.find((candidate) => candidate.gameName === gameName);
  if (room === undefined) throw new Error(`missing room fixture: ${gameName}`);
  return room;
}
