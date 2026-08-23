import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { SteadyGrowthCommand } from './types';
import { encounterBindingsBySlot } from '../room-state/encounters';

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
  if (command.outcome.owner.kind === 'completionRoom') {
    if (command.outcome.owner.role !== 'boss')
      failCommand(command, 'Steady Growth Boss outcome is invalid');
    const descriptor = located.layout.completion.rooms.find((room) => room.role === 'boss');
    if (descriptor === undefined) failCommand(command, 'biome has no Boss completion room');
    const room = catalog.rooms.byKey[descriptor.roomGameName];
    if (
      room === undefined ||
      room.roomSetKey !== located.layout.biomeKey ||
      room.mode.kind !== 'derived' ||
      room.mode.classification !== 'completion' ||
      room.kind !== 'Boss'
    )
      failCommand(command, `${descriptor.roomGameName} is not this biome's Boss completion room`);
    const phaseKeys = [...encounterBindingsBySlot(catalog, room, room.gameName).keys()];
    if (phaseKeys.length !== 1 || phaseKeys[0] !== command.outcome.phaseKey)
      failCommand(
        command,
        `${room.gameName} has no Boss encounter phase ${command.outcome.phaseKey}`,
      );
    const current = located.plan.bossCompletionSteadyGrowthTarget ?? null;
    if (current === target) return document;
    if (target === null) {
      const { bossCompletionSteadyGrowthTarget, ...plan } = located.plan;
      void bossCompletionSteadyGrowthTarget;
      return withBiome(document, located, plan);
    }
    return withBiome(document, located, {
      ...located.plan,
      bossCompletionSteadyGrowthTarget: target,
    });
  }
  const topology = requireTopology(located.plan, command);
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
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, {
      ...occurrence,
      encounters,
    }),
  );
}
