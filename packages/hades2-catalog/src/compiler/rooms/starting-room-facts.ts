import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  RoomDeclaration,
  StartingRoomProfile,
  StartingRoomProfiles,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration, RawStartingRoomProfile } from '../../declarations';
import { requireNonEmpty } from '../common';
import { fail } from '../errors';
import { normalizeRewardBinding, requireRewardStoreKey } from '../rewards/bindings';
import { normalizeEnteredStoreHistory } from './reward-facts';

function normalizeProfile(
  raw: RawStartingRoomProfile,
  room: RawRoomDeclaration,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  path: string,
): StartingRoomProfile {
  const incomingReward = normalizeRewardBinding(
    raw.incomingReward,
    rewards,
    `${path}.incomingReward`,
  );
  if (raw.templateKey === 'FixedOpening' && incomingReward.kind !== 'countedChoice') {
    fail(`${path}.incomingReward.kind`, 'FixedOpening requires a countedChoice producer');
  }
  if (raw.templateKey === 'FixedIntro' && incomingReward.kind !== 'none') {
    fail(`${path}.incomingReward.kind`, 'FixedIntro requires no incoming producer');
  }
  const lifecycleProfileKey = requireNonEmpty(
    raw.lifecycleProfileKey,
    `${path}.lifecycleProfileKey`,
  );
  const forcedRewardStoreKey =
    raw.forcedRewardStoreKey === undefined
      ? undefined
      : requireRewardStoreKey(
          raw.forcedRewardStoreKey,
          rewards.stores,
          `${path}.forcedRewardStoreKey`,
        );
  if (
    forcedRewardStoreKey !== undefined &&
    (incomingReward.kind !== 'countedChoice' ||
      !incomingReward.storeKeys.includes(forcedRewardStoreKey))
  ) {
    fail(`${path}.forcedRewardStoreKey`, 'is not accepted by the contextual incoming producer');
  }
  const dreamEncounterDefinitionKey = raw.dreamEncounterDefinitionKey;
  if (dreamEncounterDefinitionKey !== undefined) {
    const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
    if (envelope?.slots.length !== 1 || envelope.slots[0]?.key !== 'Encounter') {
      fail(`${path}.dreamEncounterDefinitionKey`, 'requires a single Encounter slot');
    }
    if (encounterDefinitions.byKey[dreamEncounterDefinitionKey] === undefined) {
      fail(
        `${path}.dreamEncounterDefinitionKey`,
        `unknown encounter ${dreamEncounterDefinitionKey}`,
      );
    }
  }
  return Object.freeze({
    templateKey: raw.templateKey,
    incomingReward,
    lifecycleProfileKey,
    enteredRewardStoreHistory: normalizeEnteredStoreHistory(
      raw.enteredRewardStoreHistory,
      rewards.stores,
      `${path}.enteredRewardStoreHistory`,
    ),
    ...(forcedRewardStoreKey === undefined ? {} : { forcedRewardStoreKey }),
    ...(dreamEncounterDefinitionKey === undefined ? {} : { dreamEncounterDefinitionKey }),
  });
}

/** Normalizes the position-based starting profile and its optional Dream encounter override. */
export function normalizeStartingRoomProfiles(
  room: RawRoomDeclaration,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  path: string,
): Pick<RoomDeclaration, 'startingRoomProfiles'> {
  const profiles = room.startingRoomProfiles;
  if (profiles === undefined) return Object.freeze({});
  const routeFirst = normalizeProfile(
    profiles.routeFirst,
    room,
    rewards,
    encounterEnvelopes,
    encounterDefinitions,
    `${path}.startingRoomProfiles.routeFirst`,
  );
  const routeLater = normalizeProfile(
    profiles.routeLater,
    room,
    rewards,
    encounterEnvelopes,
    encounterDefinitions,
    `${path}.startingRoomProfiles.routeLater`,
  );
  return Object.freeze({
    startingRoomProfiles: Object.freeze({
      routeFirst,
      routeLater,
    } satisfies StartingRoomProfiles),
  });
}
