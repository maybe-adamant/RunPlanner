import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

describe('Shop room-state decoder', () => {
  it('preserves dormant Shop inventory while requiring inventory for an active entry', () => {
    const declaration = room('F_Shop01');
    const dormant = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: false,
    });
    const active = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: true,
    });
    expect(
      decodeRoomState(
        dormant,
        catalog,
        declaration,
        { role: 'ordinary', entryActive: false },
        path,
      ),
    ).toEqual(dormant);
    expect(
      decodeRoomState(active, catalog, declaration, { role: 'ordinary', entryActive: false }, path),
    ).toEqual(active);
    expect(() =>
      decodeRoomState(dormant, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop: is required for an entered shop occurrence');
  });

  it('rejects the superseded Shop-local acquisition chronology field', () => {
    const declaration = room('F_Shop01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, { role: 'ordinary', entryActive: true }),
    );
    const shop = raw.shop as Record<string, unknown>;
    shop.legacyOrder = ['Unknown'];
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.legacyOrder: is not a project document field');
    delete shop.legacyOrder;
    const offers = shop.offers as Record<string, Record<string, unknown>>;
    offers.Boon!.reward = {
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      traitOffersByAcquisitionRole: { source: null },
      purchased: false,
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.offers.Boon.reward: unexpected key purchased');
  });

  it('rejects a Pom child on the Shop GiftDrop producer', () => {
    const declaration = room('F_Shop01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, { role: 'ordinary', entryActive: true }),
    );
    const offers = (raw.shop as Record<string, unknown>).offers as Record<
      string,
      Record<string, unknown>
    >;
    const major = offers.MajorNonBoon;
    if (major === undefined) throw new Error('missing MajorNonBoon shop offer');
    major.reward = {
      offer: { rewardType: 'GiftDrop' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {},
      levelResolutionsByAcquisitionRole: { self: { kind: 'random', targetTraitKey: null } },
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: Pom resolutions are not supported');
  });

  it('rejects malformed Preboss role state at the exact persisted kind path', () => {
    expect(() =>
      decodeRoomState(
        { kind: 'terminalShop' },
        catalog,
        room('F_PreBoss01'),
        { role: 'prebossShop', entryActive: false },
        path,
      ),
    ).toThrow('$.room.state.kind: expected shop, received terminalShop');
  });
});
