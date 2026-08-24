import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, type LocatedBiome } from './contract';
import { updateOccurrence } from './occurrence-mutation';
import type { JudgmentArcanaCommand } from './types';
import { assembleRoomActionDomain } from '../room-action-domain';
import { createBiomeAddress } from '../addresses';

/** Stores only a declaration-canonical set; progressive state determines whether it is active. */
export function applyJudgmentArcanaCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: JudgmentArcanaCommand,
): ProjectDocument {
  const seen = new Set<string>();
  for (const key of command.arcanaKeys) {
    if (catalog.arcanaCards.byKey[key] === undefined || seen.has(key))
      failCommand(command, `invalid Boss Judgment Arcana ${key}`);
    seen.add(key);
  }
  const arcanaKeys = Object.freeze(
    catalog.arcanaCards.values.filter((card) => seen.has(card.key)).map((card) => card.key),
  );
  const boss = requireOccurrence(located.plan, command.judgment.occurrenceId, command);
  const room = catalog.rooms.byKey[boss.gameName];
  if (room?.mode.kind !== 'automatic' || room.mode.role !== 'boss')
    failCommand(command, 'Judgment must be owned by this biome automatic Boss');
  const lifecycle = assembleRoomActionDomain({
    catalog,
    biome: createBiomeAddress(command.judgment.routeKey, command.judgment.biomeKey),
    occurrence: boss,
  }).lifecycleStructure;
  if (
    !lifecycle.points.some(
      (point) => point.kind === 'bossDefeated' && point.phaseKey === command.judgment.phaseKey,
    )
  )
    failCommand(command, 'Judgment phase is not an active Boss-defeated phase');
  const current = boss.encounters.judgmentArcanaKeysByPhase?.[command.judgment.phaseKey] ?? [];
  if (
    arcanaKeys.length === current.length &&
    arcanaKeys.every((key, index) => key === current[index])
  )
    return document;
  return updateOccurrence(document, located, {
    ...boss,
    encounters: Object.freeze({
      ...boss.encounters,
      judgmentArcanaKeysByPhase: Object.freeze({
        ...boss.encounters.judgmentArcanaKeysByPhase,
        [command.judgment.phaseKey]: arcanaKeys,
      }),
    }),
  });
}
