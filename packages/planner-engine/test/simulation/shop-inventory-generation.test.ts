import {
  catalog,
  describe,
  expect,
  it,
  createDefaultRoomState,
  createDefaultRoomEncounterState,
  materializeAuthoredRoom,
  biome,
  shopId,
} from './shop-trait-purchase-support';

describe('Shop trait acquisition processing', () => {
  it('projects only Purchased initial offers and gives them movement without generic membership proposals', () => {
    const room = catalog.rooms.byKey.F_Shop01;
    if (room === undefined) throw new Error('missing F Shop declaration');
    const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
    const state = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
      loadout,
    });
    if (state.kind !== 'shop' || state.shop === undefined) throw new Error('missing active Shop');
    const order = Object.freeze([
      Object.freeze({ kind: 'interactShopOffer' as const, offerKey: 'MajorNonBoon' }),
      Object.freeze({ kind: 'interactShopOffer' as const, offerKey: 'Minor' }),
    ]);
    const canonical = materializeAuthoredRoom({
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        occurrenceId: shopId,
        gameName: room.gameName,
        state,
        acquisitionSites: Object.freeze({}),
        encounters: createDefaultRoomEncounterState(catalog, room, 'purchased-shop.encounters'),
        additionalExits: Object.freeze([]),
        roomActions: Object.freeze({ order }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });

    expect(
      canonical.roomActionRoster.rows.flatMap((row) =>
        row.reference.kind === 'interactShopOffer' ? [row.reference.offerKey] : [],
      ),
    ).toEqual(['MajorNonBoon', 'Minor']);
    expect(
      canonical.roomLifecycleTimeline.repairRows.some(
        (row) => row.reference.kind === 'interactShopOffer',
      ),
    ).toBe(false);
    const purchaseProposals = canonical.roomActionRoster.proposals.filter(
      (proposal) => proposal.reference.kind === 'interactShopOffer',
    );
    expect(purchaseProposals.length).toBeGreaterThan(0);
    expect(purchaseProposals.every((proposal) => proposal.kind === 'move')).toBe(true);
  });
});
