import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RoomOccurrence } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import { legalTopologyOccurrenceRoom } from '../topology/room-ownership';
import type { IncomingRewardCommand } from './types';
import { createDefaultLevelResolutions, createDefaultTraitOffers } from '../traits';
import { incomingLevelEffectSource } from '../room-state/level-effects';

export function applyIncomingRewardCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: IncomingRewardCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.reward.occurrenceId, command);
  const room = legalTopologyOccurrenceRoom(
    catalog,
    located.layout,
    current,
    occurrence.occurrenceId,
  );
  if (room === undefined) {
    failCommand(command, `${occurrence.gameName} is not a legal topology room occurrence`);
  }
  const levelEffectSource = incomingLevelEffectSource(catalog, occurrence);
  if (levelEffectSource === undefined)
    failCommand(command, `${room.gameName} has no reward binding`);
  if (
    'reward' in occurrence.state &&
    sameOccurrenceValue(occurrence.state.reward.offer, command.value)
  )
    return document;
  let state: RoomOccurrence['state'];
  const loadout = located.loadout;
  if (occurrence.state.kind === 'fixed') {
    if (
      room.incomingReward.kind !== 'fixed' ||
      command.value.rewardType !== room.incomingReward.offer.rewardType
    ) {
      failCommand(command, `${occurrence.gameName} has a fixed reward type`);
    }
    state = Object.freeze({
      kind: 'fixed',
      reward: Object.freeze({
        offer: command.value,
        traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, command.value, loadout),
        ...(createDefaultLevelResolutions(catalog, command.value, levelEffectSource) === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                catalog,
                command.value,
                levelEffectSource,
              ),
            }),
      }),
    });
  } else if (
    occurrence.state.kind === 'counted' ||
    occurrence.state.kind === 'anomaly' ||
    occurrence.state.kind === 'freeReward' ||
    occurrence.state.kind === 'ephyraCombat'
  ) {
    state = Object.freeze({
      ...occurrence.state,
      reward: Object.freeze({
        offer: command.value,
        traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, command.value, loadout),
        ...(createDefaultLevelResolutions(catalog, command.value, levelEffectSource) === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                catalog,
                command.value,
                levelEffectSource,
              ),
            }),
      }),
    });
  } else {
    failCommand(command, `${occurrence.gameName} has no replaceable incoming reward`);
  }
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(current, { ...occurrence, state }),
  );
}
