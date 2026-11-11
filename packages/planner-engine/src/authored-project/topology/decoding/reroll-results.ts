import type { Catalog } from '../../../catalog-schema';
import { createBiomeAddress, semanticAddressKey } from '../../addresses';
import type { BiomeTopology } from '../../model';
import { unresolvedRerolledReward } from '../../rerolled-acquisition';
import type { ResolvedRoutePosition } from '../../route-context';
import {
  biomeRerolledOwners,
  biomeRerollPressesByOwner,
  heldRerolledRecords,
  hubRerollOwner,
  rerollResult,
  roomRerollOwner,
} from '../../rerolls';
import { failProjectDocument } from '../../validation';

/**
 * Reroll results live on the item they redraw, keyed by the press: every
 * press whose target can hold a result has exactly one, and every result names
 * a press of its owner. A press whose target room is gone holds none. The
 * outcomes are held exactly while a press of the owner is effective and the
 * owner can draw its recorded press's reward.
 */
export function validateRerollResults(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  biomeKey: string,
  topology: BiomeTopology,
  path: string,
): void {
  const biome = createBiomeAddress(routePosition.routeKey, biomeKey);
  const occurrence = (occurrenceId: string) =>
    topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  for (const [index, source] of topology.occurrences.entries())
    for (const press of source.roomActions.order) {
      if (press.kind !== 'reroll') continue;
      const target =
        press.target.kind === 'wheelOffer' ? source : occurrence(press.target.occurrenceId);
      if (
        target === undefined ||
        (press.target.kind === 'cage' && target.state.kind !== 'fieldsCombat')
      )
        continue;
      const owner = roomRerollOwner(biome, topology, source.occurrenceId, press);
      if (rerollResult(topology, owner, press.rerollId) === undefined)
        failProjectDocument(
          `${path}.occurrences[${index}].roomActions`,
          `reroll ${press.rerollId} has no result on its target`,
        );
    }
  for (const [index, decision] of topology.decisions.entries()) {
    if (decision.kind !== 'hub') continue;
    for (const press of decision.actions) {
      if (press.kind !== 'reroll') continue;
      const owner = hubRerollOwner(biome, decision, press);
      if (owner !== undefined && rerollResult(topology, owner, press.rerollId) === undefined)
        failProjectDocument(
          `${path}.decisions[${index}].actions`,
          `reroll ${press.rerollId} has no result on its slot's room`,
        );
    }
  }
  const presses = biomeRerollPressesByOwner(biome, topology);
  const effective = biomeRerolledOwners(biome, topology);
  for (const { owner, record } of heldRerolledRecords(biome, topology)) {
    const key = semanticAddressKey(owner);
    const at = `${path}.occurrences.${owner.occurrenceId}`;
    const named = new Set(presses.get(key)?.rerollIds ?? []);
    for (const rerollId of Object.keys(record.results))
      if (!named.has(rerollId))
        failProjectDocument(at, `holds a result for ${rerollId}, which no press of it names`);
    const drawn =
      effective.has(key) &&
      unresolvedRerolledReward(
        catalog,
        routePosition,
        occurrence(owner.occurrenceId)!,
        owner,
        record.results[record.pressId]!,
      ) !== undefined;
    if (drawn && record.acquisition === undefined)
      failProjectDocument(at, `rerolled ${semanticAddressKey(owner)} must hold its outcomes`);
    if (!drawn && record.acquisition !== undefined)
      failProjectDocument(
        at,
        `rerolled ${semanticAddressKey(owner)} holds outcomes no effective press draws`,
      );
  }
}
