import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireRoom, type LocatedBiome } from './contract';
import { updateOccurrence } from './occurrence-mutation';
import type { SteadyGrowthCommand } from './types';
import { encounterBindingsBySlot } from '../room-state/encounter-envelope';

/** Stores only the exact random target. Reachability and target legality stay in simulation. */
export function applySteadyGrowthCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: SteadyGrowthCommand,
): ProjectDocument {
  const target = command.targetTraitKey;
  if (target !== null && catalog.traits.byKey[target] === undefined)
    failCommand(command, `unknown trait ${target}`);
  const occurrence = requireOccurrence(located.plan, command.outcome.owner.occurrenceId, command);
  const phaseKey = command.outcome.phaseKey;
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (!encounterBindingsBySlot(catalog, room, room.gameName).has(phaseKey))
    failCommand(command, `${room.gameName} has no encounter phase ${phaseKey}`);
  const current = occurrence.encounters.steadyGrowthTargetByPhase ?? {};
  if (current[phaseKey] === target) return document;
  const next = { ...current };
  if (target === null) delete next[phaseKey];
  else next[phaseKey] = target;
  const encounters =
    Object.keys(next).length === 0
      ? (() => {
          const { steadyGrowthTargetByPhase, ...rest } = occurrence.encounters;
          void steadyGrowthTargetByPhase;
          return rest;
        })()
      : { ...occurrence.encounters, steadyGrowthTargetByPhase: Object.freeze(next) };
  return updateOccurrence(document, located, {
    ...occurrence,
    encounters,
  });
}
