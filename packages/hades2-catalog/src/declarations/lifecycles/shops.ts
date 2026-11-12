import type { RawRoomLifecycleProfileDeclaration } from './types';

export const shopsRoomLifecycleProfiles = [
  {
    key: 'WorldShopRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'], points: [] },
    offerPoint: { key: 'shopInventory', at: 'beforeEntry' },
    requiredObjects: false,
    generatesOutgoing: true,
    exitAcquisitionPoint: 'roomExit',
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
