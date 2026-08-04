import type { Catalog, CompletionDescriptor, RoomDeclaration } from '../../catalog-schema';
import { createCompletionRoomAddress, type BiomeAddress } from '../../authored-project/addresses';
import { createDefaultRoomEncounterState } from '../../authored-project/room-state/encounters';
import { alwaysActiveEncounterSlotKeys, resolveEncounterPhases } from '../encounters';
import type { CanonicalCompletionRoom } from './model';

export type CompletionEnteredStorePolicy =
  | {
      readonly kind: 'declared';
      readonly resolvedOfferStoreKey?: string;
    }
  | { readonly kind: 'noneOnly' };

interface CompletionMaterializationOptions {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  readonly completion: CompletionDescriptor;
  readonly enteredStorePolicy: CompletionEnteredStorePolicy;
  readonly lifecycleProducerPolicy: 'encounterCompatible' | 'noneOnly';
  readonly fail: (detail: string) => never;
}

const completionKinds = {
  boss: { roomKind: 'Boss', lifecycleProfileKey: 'BossRoom' },
  postboss: { roomKind: 'PostBoss', lifecycleProfileKey: 'PostBossRoom' },
} as const;

function enteredRewardStoreKey(
  room: RoomDeclaration,
  policy: CompletionEnteredStorePolicy,
  fail: (detail: string) => never,
): string | undefined {
  if (policy.kind === 'noneOnly') {
    return undefined;
  }

  switch (room.enteredRewardStoreHistory.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return room.enteredRewardStoreHistory.storeKey;
    case 'resolvedOffer':
      if (policy.resolvedOfferStoreKey === undefined) {
        fail(`${room.gameName} cannot resolve its completion offer store`);
      }
      return policy.resolvedOfferStoreKey;
  }
}

export function materializeCompletionRooms({
  catalog,
  biome,
  completion,
  enteredStorePolicy,
  lifecycleProducerPolicy,
  fail,
}: CompletionMaterializationOptions): readonly CanonicalCompletionRoom[] {
  return Object.freeze(
    completion.rooms.map((descriptor): CanonicalCompletionRoom => {
      const room = catalog.rooms.byKey[descriptor.roomGameName];
      const expected = completionKinds[descriptor.role];
      if (room === undefined) {
        return fail(
          `${descriptor.roomGameName} is not a supported ${descriptor.role} completion room`,
        );
      }
      if (
        room.mode.kind !== 'derived' ||
        room.mode.classification !== 'completion' ||
        room.kind !== expected.roomKind ||
        room.incomingReward.kind !== 'none'
      ) {
        fail(`${descriptor.roomGameName} is not a supported ${descriptor.role} completion room`);
      }
      if (
        enteredStorePolicy.kind === 'noneOnly' &&
        room.enteredRewardStoreHistory.kind !== 'none'
      ) {
        fail(`${room.gameName} is not a supported ${descriptor.role} completion room`);
      }
      const profile = catalog.roomLifecycleProfiles.byKey[expected.lifecycleProfileKey];
      if (
        profile === undefined ||
        !profile.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey) ||
        (lifecycleProducerPolicy === 'noneOnly' && profile.producer.kind !== 'none')
      ) {
        fail(`${room.gameName} cannot use lifecycle ${expected.lifecycleProfileKey}`);
      }
      const resolvedStoreKey = enteredRewardStoreKey(room, enteredStorePolicy, fail);
      return Object.freeze({
        kind: 'completion',
        origin: createCompletionRoomAddress(biome, descriptor.role),
        role: descriptor.role,
        gameName: room.gameName,
        encounterEnvelopeKey: room.encounterEnvelopeKey,
        encounterPhases: resolveEncounterPhases(
          catalog,
          room,
          createDefaultRoomEncounterState(catalog, room, `${room.gameName}.encounters`),
          alwaysActiveEncounterSlotKeys(catalog, room, room.gameName),
          room.gameName,
        ),
        lifecycleProfileKey: expected.lifecycleProfileKey,
        counterEffects: room.counters,
        ...(resolvedStoreKey === undefined ? {} : { enteredRewardStoreKey: resolvedStoreKey }),
        entered: true,
      });
    }),
  );
}
