import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  ExitTypeDeclaration,
  RoomDeclaration,
  RoomRouteOverlay,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../../declarations/index';
import type { RawRoomRouteOverlay } from '../../declarations/rooms/types';
import { fail } from '../errors';
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
import { normalizeEntryContextualEncounterRules } from './starting-room-facts';

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
  const entryContextualEncounterRules = normalizeEntryContextualEncounterRules(
    room,
    encounterEnvelopes,
    encounterDefinitions,
    path,
  );

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

  const declaration: RoomDeclaration = Object.freeze({
    gameName: identity.gameName,
    ...(encounter.cocoonRewardPointIds === undefined
      ? {}
      : { cocoonRewardPointIds: encounter.cocoonRewardPointIds }),
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
    ...entryContextualEncounterRules,
    effectNeutralRequiredReward: room.effectNeutralRequiredReward ?? false,
    offerRewardBinding: reward.offerRewardBinding,
    blockGiftBoons: identity.blockGiftBoons,
    hasKeepsakeRack: features.hasKeepsakeRack,
    ...(features.keepsakeRackExcludedRouteKeys === undefined
      ? {}
      : { keepsakeRackExcludedRouteKeys: features.keepsakeRackExcludedRouteKeys }),
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
    nextRoomSet: identity.nextRoomSet,
    ...(features.boonRarityOverride === undefined
      ? {}
      : { boonRarityOverride: features.boonRarityOverride }),
    ...(features.firstRunOffer === undefined ? {} : { firstRunOffer: features.firstRunOffer }),
    ...(features.erisHost === undefined ? {} : { erisHost: features.erisHost }),
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
    skipTimedDropResourcesInDream: identity.skipTimedDropResourcesInDream,
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
  if (room.routeOverlays === undefined) return declaration;
  const routeOverlays = room.routeOverlays.map((overlay, overlayIndex) =>
    normalizeRoomRouteOverlay(
      room,
      declaration,
      overlay,
      (raw) =>
        normalizeRoom(
          raw,
          roomIndex,
          rewards,
          encounterEnvelopes,
          encounterDefinitions,
          encounterSets,
          exitTypes,
        ),
      `${path}.routeOverlays[${overlayIndex}]`,
    ),
  );
  if (new Set(routeOverlays.map((overlay) => overlay.routeKey)).size !== routeOverlays.length)
    fail(`${path}.routeOverlays`, 'must name each route once');
  return Object.freeze({ ...declaration, routeOverlays: Object.freeze(routeOverlays) });
}

const overlaidRoomFields = [
  'label',
  'kind',
  'mode',
  'lifecycleProfileKey',
  'incomingReward',
  'offerRewardBinding',
  'encounterSlotBindings',
] as const;

/**
 * Normalizes the overlaid room as a complete declaration so every room
 * contract applies, then keeps only the overlaid fields; any other derived
 * difference is a declaration error.
 */
function normalizeRoomRouteOverlay(
  room: RawRoomDeclaration,
  declaration: RoomDeclaration,
  overlay: RawRoomRouteOverlay,
  normalize: (raw: RawRoomDeclaration) => RoomDeclaration,
  path: string,
): RoomRouteOverlay {
  const overlaidKeys = [
    'routeKey',
    'label',
    'kind',
    'mode',
    'incomingReward',
    'encounterSlotBindings',
  ];
  if (Object.keys(overlay).some((key) => !overlaidKeys.includes(key)))
    fail(path, 'may change only the room kind, template, reward binding and encounter');
  const { lifecycleProfileKey: _lifecycle, routeOverlays: _overlays, ...base } = room;
  void _lifecycle;
  void _overlays;
  const overlaid = normalize({
    ...base,
    label: overlay.label,
    kind: overlay.kind,
    mode: overlay.mode,
    incomingReward: overlay.incomingReward,
    encounterSlotBindings: overlay.encounterSlotBindings,
  });
  const retained = (value: RoomDeclaration) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !(overlaidRoomFields as readonly string[]).includes(key),
        ),
      ),
    );
  if (retained(overlaid) !== retained(declaration))
    fail(path, 'may change only the room kind, template, reward binding and encounter');
  return Object.freeze({
    routeKey: overlay.routeKey,
    label: overlaid.label,
    kind: overlaid.kind,
    mode: overlaid.mode,
    incomingReward: overlaid.incomingReward,
    offerRewardBinding: overlaid.offerRewardBinding,
    encounterSlotBindings: overlaid.encounterSlotBindings,
  });
}
