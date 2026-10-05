import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';
import { createUnresolvedAnvilResults } from '../../acquisition/reward-state';
import { decodeAnvilResult } from '../../room-state/decoding/reward-acquisition-codec';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from '../contract';
import type { AnvilResultCommand } from '../types';
import { locateReward, replaceOwnedReward } from './reward-source';

/** Persists the Anvil result on the reward role that carries the Anvil, wherever it is settled. */
export function applyAnvilResultCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: AnvilResultCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.acquisition.owner;
  if (
    owner.routeKey !== command.acquisition.routeKey ||
    owner.biomeKey !== command.acquisition.biomeKey
  )
    failCommand(command, 'acquisition owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase' || owner.kind === 'gorgonPhase')
    failCommand(command, 'encounter phases do not own Anvil rewards');
  const occurrenceId =
    owner.kind === 'acquisitionEntry'
      ? owner.site.owner.kind === 'occurrence'
        ? owner.site.owner.occurrenceId
        : failCommand(command, 'acquisition entry is not occurrence-owned')
      : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const reward = locateReward(
    document,
    catalog,
    located.routePosition,
    occurrence,
    occurrence.state,
    owner,
    command,
  )?.reward;
  if (reward === undefined) failCommand(command, 'acquisition effect result requires a reward');
  const role = command.acquisition.acquisitionRole;
  if (createUnresolvedAnvilResults(catalog, reward.offer)?.[role] !== null)
    failCommand(command, `role ${role} has no declared Anvil of Fates pickup effect`);
  const value = decodeAnvilResult(command.value, '$.value');
  if (JSON.stringify(reward.anvilResultsByAcquisitionRole?.[role]) === JSON.stringify(value))
    return document;
  return replaceOwnedReward(
    document,
    catalog,
    located,
    topology,
    occurrence,
    owner,
    command,
    Object.freeze({
      ...reward,
      anvilResultsByAcquisitionRole: Object.freeze({
        ...(reward.anvilResultsByAcquisitionRole ?? {}),
        [role]: value,
      }),
    }),
  );
}
