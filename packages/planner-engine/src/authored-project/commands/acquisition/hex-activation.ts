import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';
import { hexActivationRoles } from '../../acquisition/reward-state';
import { decodeHexActivation } from '../../room-state/decoding/reward-acquisition-codec';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from '../contract';
import type { HexActivationCommand } from '../types';
import { locateReward, replaceOwnedReward } from './reward-source';

/** Persists one Path screen's selected nodes on the reward role that opens the screen. */
export function applyHexActivationCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: HexActivationCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.acquisition.owner;
  if (
    owner.routeKey !== command.acquisition.routeKey ||
    owner.biomeKey !== command.acquisition.biomeKey
  )
    failCommand(command, 'acquisition owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase' || owner.kind === 'gorgonPhase')
    failCommand(command, 'encounter phases do not own Path rewards');
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
  if (reward === undefined) failCommand(command, 'Path screen selection requires a reward');
  const role = command.acquisition.acquisitionRole;
  if (!hexActivationRoles(catalog, reward.offer).includes(role))
    failCommand(command, `role ${role} does not open a Path screen`);
  const value = decodeHexActivation(command.value, '$.value');
  if (JSON.stringify(reward.hexActivationsByAcquisitionRole?.[role]) === JSON.stringify(value))
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
      hexActivationsByAcquisitionRole: Object.freeze({
        ...(reward.hexActivationsByAcquisitionRole ?? {}),
        [role]: value,
      }),
    }),
  );
}
