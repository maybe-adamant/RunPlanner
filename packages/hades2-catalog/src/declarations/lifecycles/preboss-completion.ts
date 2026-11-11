import type { RawRoomLifecycleProfileDeclaration } from './types';

/**
 * Preboss takeover rooms and their fixed Boss/Postboss successors share the
 * same lifecycle declaration family. They are ordinary topology occurrences.
 */
export const prebossCompletionRoomLifecycleProfiles = [
  {
    key: 'PrebossFreeRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'runEncounterScripts' },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'PrebossShopRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'], points: [] },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      {
        kind: 'materializeOfferPoint',
        offerPoint: 'shopInventory',
        effects: ['recordOfferPoint'],
      },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'settleAcquisitionPoint', point: 'roomExit', effects: ['recordAcquisitionPoint'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'BossRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'runEncounterScripts' },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'PostBossRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'runEncounterScripts' },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
