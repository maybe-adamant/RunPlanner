import type { RawRoomDeclaration } from '../types';
import { nResourcePointSupport } from '../../resources';
import { chaosExit } from './shared';

const openingReward = {
  kind: 'countedChoice' as const,
  storeKeys: ['RunProgress'],
  eligibleRewardTypes: [],
  ineligibleRewardTypes: ['Devotion', 'RoomMoneyDrop', 'MaxHealthDrop', 'MaxManaDrop'],
  producerLifecycleKey: 'RoomReward',
};

const nStartingRoomProfiles = {
  routeFirst: {
    templateKey: 'FixedOpening' as const,
    incomingReward: openingReward,
    lifecycleProfileKey: 'OpeningRewardRoom',
    enteredRewardStoreHistory: { kind: 'none' as const },
    forcedRewardStoreKey: 'RunProgress',
    dreamEncounterDefinitionKey: 'OpeningEmpty',
  },
  routeLater: {
    templateKey: 'FixedIntro' as const,
    incomingReward: { kind: 'none' as const },
    lifecycleProfileKey: 'RewardlessCombatRoom',
    enteredRewardStoreHistory: { kind: 'none' as const },
    dreamEncounterDefinitionKey: 'OpeningEmpty',
  },
};

export const nFixedRouteRooms = [
  {
    gameName: 'N_Opening01',
    resourcePointSupport: nResourcePointSupport(['Pickaxe', 'Exorcism', 'Shovel', 'Fishing']),
    label: 'Opening',
    roomSetKey: 'N',
    advancesExperimentalHammerUses: true,
    kind: 'Opening',
    mode: { kind: 'authored', templateKey: 'FixedOpening' },
    lifecycleProfileKey: 'OpeningRewardRoom',
    additionalExits: [chaosExit],
    structuralTags: [],
    exits: [{ index: 1, type: 'N_OpeningDoor' }],
    incomingReward: {
      kind: 'countedChoice',
      storeKeys: ['RunProgress'],
      eligibleRewardTypes: [],
      ineligibleRewardTypes: ['Devotion', 'RoomMoneyDrop', 'MaxHealthDrop', 'MaxManaDrop'],
      producerLifecycleKey: 'RoomReward',
    },
    startingRoomProfiles: nStartingRoomProfiles,
    forcedRewardStoreKey: 'RunProgress',
    enteredRewardStoreHistory: { kind: 'none' },
    encounterEnvelopeKey: 'SingleEncounter',
    encounterSlotBindings: [
      {
        slotKey: 'Encounter',
        kind: 'fixed',
        encounterDefinitionKey: 'OpeningGeneratedN',
      },
    ],
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
  },
  {
    gameName: 'N_PreHub01',
    resourcePointSupport: nResourcePointSupport(['Pickaxe', 'Exorcism', 'Shovel']),
    label: 'Pre-Hub',
    roomSetKey: 'N',
    advancesExperimentalHammerUses: true,
    kind: 'PreHub',
    mode: { kind: 'authored', templateKey: 'FixedPreHub' },
    structuralTags: [],
    exits: [{ index: 1, type: 'EphyraExitDoorReturn' }],
    incomingReward: {
      kind: 'countedChoice',
      storeKeys: ['RunProgress'],
      eligibleRewardTypes: [],
      ineligibleRewardTypes: ['Devotion', 'RoomMoneyDrop', 'MaxHealthDrop', 'MaxManaDrop'],
      producerLifecycleKey: 'RoomReward',
    },
    forcedRewardStoreKey: 'RunProgress',
    enteredRewardStoreHistory: { kind: 'none' },
    encounterEnvelopeKey: 'SingleEncounter',
    encounterSlotBindings: [
      {
        slotKey: 'Encounter',
        kind: 'fixed',
        encounterDefinitionKey: 'PreHubGeneratedN',
      },
    ],
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
    eligibility: {
      kind: 'counterRange',
      axis: 'biomeDepthCache',
      range: { min: 1, max: 1 },
    },
  },
] satisfies readonly RawRoomDeclaration[];
