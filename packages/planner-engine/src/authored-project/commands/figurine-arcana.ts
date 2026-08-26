import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress } from '../addresses';
import { assembleRoomActionDomain } from '../room-action-domain';
import type { ProjectDocument } from '../model';
import type { FigurineArcanaCommand } from './types';
import { failCommand, requireOccurrence, type LocatedBiome } from './contract';
import { updateOccurrence } from './occurrence-mutation';

/** Stores only a declaration-canonical set; the reached post-Judgment domain remains engine-owned. */
export function applyFigurineArcanaCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: FigurineArcanaCommand,
): ProjectDocument {
  const seen = new Set<string>();
  for (const key of command.arcanaKeys) {
    if (catalog.arcanaCards.byKey[key] === undefined || seen.has(key))
      failCommand(command, `invalid Crystal Figurine Arcana ${key}`);
    seen.add(key);
  }
  const arcanaKeys = Object.freeze(
    catalog.arcanaCards.values.filter((card) => seen.has(card.key)).map((card) => card.key),
  );
  const boss = requireOccurrence(located.plan, command.figurine.occurrenceId, command);
  const room = catalog.rooms.byKey[boss.gameName];
  if (room?.mode.kind !== 'automatic' || room.mode.role !== 'boss')
    failCommand(command, 'Crystal Figurine must be owned by this biome automatic Boss');
  const lifecycle = assembleRoomActionDomain({
    catalog,
    biome: createBiomeAddress(command.figurine.routeKey, command.figurine.biomeKey),
    occurrence: boss,
  }).lifecycleStructure;
  if (
    !lifecycle.points.some(
      (point) => point.kind === 'bossDefeated' && point.phaseKey === command.figurine.phaseKey,
    )
  )
    failCommand(command, 'Crystal Figurine phase is not an active Boss-defeated phase');
  const current = boss.encounters.figurineArcanaKeysByPhase?.[command.figurine.phaseKey] ?? [];
  if (
    arcanaKeys.length === current.length &&
    arcanaKeys.every((key, index) => key === current[index])
  )
    return document;
  return updateOccurrence(document, located, {
    ...boss,
    encounters: Object.freeze({
      ...boss.encounters,
      figurineArcanaKeysByPhase: Object.freeze({
        ...boss.encounters.figurineArcanaKeysByPhase,
        [command.figurine.phaseKey]: arcanaKeys,
      }),
    }),
  });
}
