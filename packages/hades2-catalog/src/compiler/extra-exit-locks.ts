import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterSet,
  ExtraExitLockCatalog,
  ExtraExitLockHostDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import type { RawExtraExitLockInput } from '../declarations/extra-exit-locks-types';
import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

function requireChance(value: number, path: string): number {
  if (typeof value !== 'number' || !(value > 0) || value > 1)
    fail(path, 'must be a chance above 0 and at most 1');
  return value;
}

/**
 * The locked-door fight is generated at the press, outside every encounter
 * set and room binding: one generated wave that counts encounter depth,
 * refuses a skip and draws a money store.
 */
function validateLockEncounter(
  path: string,
  encounterKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
): void {
  const definition = definitions.byKey[encounterKey];
  if (definition === undefined) fail(path, `undeclared encounter ${encounterKey}`);
  const bound =
    sets.values.some((set) => set.encounterDefinitionKeys.includes(encounterKey)) ||
    rooms.values.some((room) =>
      room.encounterSlotBindings.some(
        (binding) => binding.kind === 'fixed' && binding.encounterDefinitionKey === encounterKey,
      ),
    );
  if (bound) fail(path, `${encounterKey} is also a room encounter`);
  if (definition.kind !== 'combat') fail(path, `${encounterKey} must be a combat`);
  if (!definition.countsEncounterDepth || definition.canEncounterSkip)
    fail(path, `${encounterKey} must count encounter depth and refuse a skip`);
  if (definition.moneyStore === undefined) fail(path, `${encounterKey} must draw a money store`);
  const decisions = definition.customization ?? [];
  const selection = decisions[0]?.selection;
  if (decisions.length !== 1 || selection?.kind !== 'generated')
    fail(path, `${encounterKey} must declare one generated composition`);
  if (selection.waveCount.min !== 1 || selection.waveCount.max !== 1)
    fail(path, `${encounterKey} fights one wave`);
}

/**
 * Normalizes the rooms whose extra exits can lock. Every host exit is the
 * locking door type; the first door the game processes never locks
 * (`CheckExitPreUnlock` sets `FirstExitChosen` on it), so each later exit is
 * lockable at the door's chance.
 */
export function normalizeExtraExitLocks(
  raw: RawExtraExitLockInput,
  rooms: CatalogCollection<RoomDeclaration>,
  encounters: {
    readonly definitions: CatalogCollection<EncounterDefinition>;
    readonly sets: CatalogCollection<EncounterSet>;
  },
): ExtraExitLockCatalog {
  const path = 'extraExitLocks';
  const encounterKey = requireNonEmpty(raw.encounterKey, `${path}.encounterKey`);
  const doorType = requireNonEmpty(raw.doorType, `${path}.doorType`);
  const doorLockChance = requireChance(raw.doorLockChance, `${path}.doorLockChance`);
  validateLockEncounter(
    `${path}.encounterKey`,
    encounterKey,
    rooms,
    encounters.definitions,
    encounters.sets,
  );
  const hosts = raw.hosts.map((host, index): ExtraExitLockHostDeclaration => {
    const hostPath = `${path}.hosts[${index}]`;
    const room = rooms.byKey[host.gameName];
    if (room === undefined) fail(`${hostPath}.gameName`, `${host.gameName} is not a declared room`);
    const exits = [...room.exits].sort((left, right) => left.index - right.index);
    if (exits.length < 2) fail(hostPath, `${host.gameName} has no extra exit to lock`);
    exits.forEach((exit, position) => {
      if (exit.index !== position + 1)
        fail(hostPath, `${host.gameName} exits must be numbered from 1`);
      if (exit.type !== doorType)
        fail(hostPath, `${host.gameName} exit ${exit.index} is not a ${doorType}`);
    });
    return Object.freeze({
      gameName: host.gameName,
      chance: requireChance(host.chance, `${hostPath}.chance`),
      encounterKey,
      lockableExits: Object.freeze(
        exits.slice(1).map((exit) => Object.freeze({ index: exit.index, chance: doorLockChance })),
      ),
    });
  });
  return Object.freeze({
    hosts: createCollection(hosts, `${path}.hosts`, (host) => host.gameName, 'gameName'),
  });
}
