import type { RawRoomLifecycleProfileDeclaration } from './types';

export const standardRoomLifecycleProfiles = [
  {
    key: 'StandardRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
  {
    key: 'OpeningRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
  {
    key: 'OpeningRewardNoEncounterRoom',
    encounterEnvelopeKeys: ['EmptyEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
  {
    key: 'RewardlessCombatRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
  {
    key: 'PCombatRoom',
    encounterEnvelopeKeys: ['PEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];

export const specializedRewardRoomLifecycleProfiles = [
  {
    key: 'StoryPickupRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
    exitAcquisitionPoint: 'roomExit',
  },
  {
    key: 'DevotionRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
