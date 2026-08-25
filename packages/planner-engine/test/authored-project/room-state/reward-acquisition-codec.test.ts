import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeRewardState } from '../../../src/authored-project/room-state/reward-acquisition-codec';
import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

describe('reward acquisition decoder', () => {
  it('owns the exact Boon acquisition and payload shape', () => {
    const value = {
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      traitOffersByAcquisitionRole: { source: null },
    };

    expect(
      decodeRewardState(value, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toMatchObject({ offer: { rewardType: 'Boon' } });
    expect(() =>
      decodeRewardState({ ...value, unknown: true }, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toThrow('$.reward: unexpected key unknown');
  });

  it('decodes the declaration-bounded Fields optional inventory', () => {
    const declaration = room('H_Combat02');
    const context = { role: 'ordinary' as const, entryActive: true, activeCageCount: 2 };
    const state = mutable(createDefaultRoomState(catalog, declaration, context));
    state.optionalRewardCount = 0;
    expect(decodeRoomState(state, catalog, declaration, context, path)).toMatchObject({
      kind: 'fieldsCombat',
      optionalRewardCount: 0,
      optionalRewards: {
        optional1: expect.any(Object),
        optional2: expect.any(Object),
        optional3: expect.any(Object),
      },
    });
    state.optionalRewardCount = 4;
    expect(() => decodeRoomState(state, catalog, declaration, context, path)).toThrow(
      'must be within 0..3',
    );
  });

  it('requires the exact closed Pom role map and rejects it on non-Pom rewards', () => {
    const declaration = room('F_Combat04');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
        resolvedStoreKey: 'RunProgress',
      }),
    );
    raw.reward = {
      offer: { rewardType: 'StackUpgrade' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {},
    };
    const reward = raw.reward as Record<string, unknown>;
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: is required for this Pom reward');
    reward.levelResolutionsByAcquisitionRole = { self: { kind: 'random', targetTraitKey: null } };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow(
      'levelResolutionsByAcquisitionRole.self.targetTraitKey: is not a project document field',
    );
    reward.levelResolutionsByAcquisitionRole = {
      self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      extra: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('must contain exactly every Pom acquisition role');
    reward.offer = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } };
    reward.traitOffersByAcquisitionRole = {
      source: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    };
    reward.levelResolutionsByAcquisitionRole = {};
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: Pom resolutions are not supported');
  });
});
