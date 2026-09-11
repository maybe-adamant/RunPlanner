import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  ExitTypeDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../../declarations/index';
import {
  normalizeRoomCoreFacts,
  normalizeRoomCounters,
  normalizeRoomEligibility,
  normalizeRoomForce,
  normalizeRoomIdentity,
} from './core-facts';
import { normalizeRoomEncounterFacts } from './encounter-facts';
import { normalizeRoomExitFacts } from './exit-facts';
import { normalizeRoomFieldsFacts } from './fields-facts';
import {
  normalizeRoomFeatureFacts,
  normalizeRoomInfernalContractFacts,
  normalizeRoomRequiredObjectFacts,
  normalizeRoomResourcePointSupport,
} from './feature-facts';
import {
  normalizeEnteredStoreHistory,
  normalizeRoomRewardFacts,
  normalizeRoomRewardStoreFacts,
} from './reward-facts';

/** Produces one fully normalized immutable room declaration from its raw declaration. */
export function normalizeRoom(
  room: RawRoomDeclaration,
  roomIndex: number,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): RoomDeclaration {
  const path = `rooms[${roomIndex}]`;

  const identity = normalizeRoomIdentity(room, path);
  const encounter = normalizeRoomEncounterFacts(
    room,
    encounterEnvelopes,
    encounterDefinitions,
    encounterSets,
    path,
  );
  const exits = normalizeRoomExitFacts(room, identity, encounter, exitTypes, rewards, path);
  const eligibility = normalizeRoomEligibility(room, rewards, path);
  const reward = normalizeRoomRewardFacts(room, rewards, path);
  const requiredObjects = normalizeRoomRequiredObjectFacts(room, path);
  const rewardStores = normalizeRoomRewardStoreFacts(room, reward, rewards, path);
  const infernalContract = normalizeRoomInfernalContractFacts(
    room,
    identity,
    reward,
    rewards,
    path,
  );
  const fields = normalizeRoomFieldsFacts(room, identity, reward.localChildren, rewards, path);
  const features = normalizeRoomFeatureFacts(room, path);

  // Preserve the original final declaration checks after local feature products.
  const core = normalizeRoomCoreFacts(room, path);
  const enteredRewardStoreHistory = normalizeEnteredStoreHistory(
    room.enteredRewardStoreHistory,
    rewards.stores,
    `${path}.enteredRewardStoreHistory`,
  );
  const counters = normalizeRoomCounters(room, path);
  const resourcePointSupport = normalizeRoomResourcePointSupport(room, path);
  const force =
    room.force === undefined ? undefined : normalizeRoomForce(room.force, rewards, `${path}.force`);

  return Object.freeze({
    gameName: identity.gameName,
    label: identity.label,
    roomSetKey: identity.roomSetKey,
    kind: identity.kind,
    mode: identity.mode,
    ...(core.lifecycleProfileKey === undefined
      ? {}
      : { lifecycleProfileKey: core.lifecycleProfileKey }),
    structuralTags: core.structuralTags,
    exits: exits.exits,
    additionalExits: exits.additionalExits,
    incomingReward: reward.incomingReward,
    effectNeutralRequiredReward: room.effectNeutralRequiredReward ?? false,
    offerRewardBinding: reward.offerRewardBinding,
    blockGiftBoons: identity.blockGiftBoons,
    hasKeepsakeRack: features.hasKeepsakeRack,
    hasRequiredFountain: features.hasRequiredFountain,
    ...(features.challengeSwitchAnchorCount === undefined
      ? {}
      : { challengeSwitchAnchorCount: features.challengeSwitchAnchorCount }),
    ...(features.purgingPool === undefined ? {} : { purgingPool: features.purgingPool }),
    ...(features.surfaceShop === undefined ? {} : { surfaceShop: features.surfaceShop }),
    ...(features.roomShop === undefined ? {} : { roomShop: features.roomShop }),
    ...(features.secretPointAnchorCount === undefined
      ? {}
      : { secretPointAnchorCount: features.secretPointAnchorCount }),
    blocksGorgon: identity.blocksGorgon,
    ...(features.boonRarityOverride === undefined
      ? {}
      : { boonRarityOverride: features.boonRarityOverride }),
    ...(reward.prebossBatchPolicy === undefined
      ? {}
      : { prebossBatchPolicy: reward.prebossBatchPolicy }),
    encounterEnvelopeKey: encounter.encounterEnvelopeKey,
    ...(encounter.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: encounter.unmodeledEncounterKeys }),
    advancesExperimentalHammerUses: identity.advancesExperimentalHammerUses,
    ignoreEncounterUses: identity.ignoreEncounterUses,
    advancesHermesShrineDeliveryUses: identity.advancesHermesShrineDeliveryUses,
    skipRoomsPerUpgrade: identity.skipRoomsPerUpgrade,
    skipTimedDropResources: identity.skipTimedDropResources,
    encounterSlotBindings: encounter.encounterSlotBindings,
    ...(rewardStores.forcedRewardStoreKey === undefined
      ? {}
      : { forcedRewardStoreKey: rewardStores.forcedRewardStoreKey }),
    ...(rewardStores.individualRewardStoreKey === undefined
      ? {}
      : { individualRewardStoreKey: rewardStores.individualRewardStoreKey }),
    enteredRewardStoreHistory,
    counters: counters.counters,
    caps: counters.caps,
    resourcePointSupport,
    ...eligibility,
    ...(force === undefined ? {} : { force }),
    ...(requiredObjects.requiredObjects === undefined
      ? {}
      : { requiredObjects: requiredObjects.requiredObjects }),
    localChildren: reward.localChildren,
    ...(fields.fieldsOptionalRewards === undefined
      ? {}
      : { fieldsOptionalRewards: fields.fieldsOptionalRewards }),
    ...(fields.fieldsSpatial === undefined ? {} : { fieldsSpatial: fields.fieldsSpatial }),
    ...(infernalContract.infernalContractReward === undefined
      ? {}
      : { infernalContractReward: infernalContract.infernalContractReward }),
  });
}
