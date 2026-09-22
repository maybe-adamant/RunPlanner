import { ordinaryPositionFor } from '../support/route-position';
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
  baseFacts,
  createBiomeAddress,
  createOccurrenceId,
  initializeTestRewardBranches,
  type RewardKernelFacts,
} from './shop-trait-purchase-support';
import { evaluateShopGenerationSupport } from '../../src/reward-kernel';
import {
  clearOfferedRewardTypes,
  offeredRewardTypeSet,
  publishOfferedRewardTypes,
} from '../../src/simulation/state/offered-rewards';
import { addHubBoardRewardLookup } from '../../src/simulation/state/reward-lookups';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from '../../src/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { simulateProject } from '../../src/simulation';
import { deriveTravelRefill } from '../../src/simulation/rewards/shop/derived-rewards';

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
      routePosition: ordinaryPositionFor(catalog, biome),
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

describe('World Shop transition offered rewards', () => {
  const spellOffer = Object.freeze({ rewardType: 'SpellDrop' as const });

  /** Exactly the authored inventory the ordinary World Shop's three slots hold. */
  const worldShopInventory = Object.freeze([
    Object.freeze({
      optionKey: 'Boon',
      offer: Object.freeze({
        rewardType: 'Boon' as const,
        payload: Object.freeze({ kind: 'BoonSource' as const, source: 'HeraUpgrade' }),
      }),
    }),
    Object.freeze({
      optionKey: 'WeaponUpgradeDrop',
      offer: Object.freeze({ rewardType: 'WeaponUpgradeDrop' as const }),
    }),
    Object.freeze({ optionKey: 'SpellDrop', offer: spellOffer }),
  ]);

  const shopFacts = (offeredRewardTypes: readonly string[]): RewardKernelFacts =>
    Object.freeze({
      ...baseFacts(),
      requirements: Object.freeze({
        ...baseFacts().requirements,
        records: Object.freeze({
          ...baseFacts().requirements.records,
          lootTypeHistory: Object.freeze({ HeraUpgrade: 0 }),
        }),
        offeredRewardTypes: new Set(offeredRewardTypes),
      }),
    });

  const spellSupported = (offeredRewardTypes: readonly string[]) =>
    evaluateShopGenerationSupport(
      catalog.rewards,
      catalog.rewards.shops.byKey.WorldShop!,
      worldShopInventory,
      shopFacts(offeredRewardTypes),
    ).unsupportedSlotIndexes.includes(2) === false;

  it('rejects the ordinary Shop Spell Drop when the transition into it offered one', () => {
    expect(spellSupported([])).toBe(true);
    expect(spellSupported(['SpellDrop'])).toBe(false);
  });

  it('keeps a different sibling reward and a rebuilt batch supported', () => {
    expect(spellSupported(['StackUpgrade'])).toBe(true);
    expect(spellSupported(['MaxManaDrop', 'RoomMoneyDrop'])).toBe(true);
    // Removing or changing the sibling republishes the set without that type.
    expect(spellSupported(['SpellDrop'])).toBe(false);
    expect(spellSupported([])).toBe(true);
  });

  it('publishes the completed batch, clears it at entry and never inherits it', () => {
    const initial = initializeTestRewardBranches()[0]!;
    expect(initial.state.offeredRewardTypes).toEqual([]);
    const published = publishOfferedRewardTypes(initial.state, ['StackUpgrade', 'SpellDrop']);
    // Sorted and deduplicated so branch equivalence compares a set.
    expect(published.offeredRewardTypes).toEqual(['SpellDrop', 'StackUpgrade']);
    expect(publishOfferedRewardTypes(published, ['SpellDrop', 'StackUpgrade'])).toBe(published);
    // An empty completed batch replaces rather than retains the prior value.
    expect(publishOfferedRewardTypes(published, []).offeredRewardTypes).toEqual([]);
    expect(clearOfferedRewardTypes(published).offeredRewardTypes).toEqual([]);
    expect(clearOfferedRewardTypes(initial.state)).toBe(initial.state);
  });

  it('keeps the persistent Hub lookup independent of the per-map reset', () => {
    const initial = initializeTestRewardBranches()[0]!;
    const withBoard = addHubBoardRewardLookup(
      publishOfferedRewardTypes(initial.state, ['SpellDrop']),
      'hubRewardLookup',
      ['SpellDrop'],
    );
    const entered = clearOfferedRewardTypes(withBoard);
    expect(entered.offeredRewardTypes).toEqual([]);
    expect(entered.rewardLookups.hubRewardLookup).toEqual(['SpellDrop']);
  });
});

describe('World Shop transition offered rewards on a real authored split', () => {
  const gBiome = createBiomeAddress('Underworld', 'G');
  const hBiome = createBiomeAddress('Underworld', 'H');
  /** The G batch that reaches `G_Shop01`; exit2 is its unchosen sibling door. */
  const gShopId = createOccurrenceId('golden-g-b5-e1');
  const gSiblingId = createOccurrenceId('golden-g-b5-e2');
  const hShopId = createOccurrenceId('golden-h-preboss-shop');

  const authorSpellSlot = (
    project: ReturnType<typeof createGoldenFGHProject>,
    biome: typeof gBiome,
    occurrenceId: typeof gShopId,
  ) =>
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer: createShopOfferAddress(biome, occurrenceId, 'Minor'),
      value: { optionKey: 'SpellDrop', offer: { rewardType: 'SpellDrop' } },
    });

  const withSibling = (rewardType: 'StackUpgrade' | 'SpellDrop') =>
    applyProjectCommand(authorSpellSlot(createGoldenFGHProject(), gBiome, gShopId), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(gBiome, gSiblingId),
      value: { rewardType },
    });

  const unavailableShopOffers = (project: ReturnType<typeof createGoldenFGHProject>) =>
    simulateProject(catalog, project)
      .findings.filter((finding) => finding.code === 'shopOfferUnavailable')
      .map((finding) => semanticAddressKey(finding.origin));

  it('blocks the reached Shop Spell Drop from an unchosen sibling door and repairs it', () => {
    const blockedKey = semanticAddressKey(createShopOfferAddress(gBiome, gShopId, 'Minor'));
    expect(unavailableShopOffers(withSibling('SpellDrop'))).toEqual([blockedKey]);
    // A different sibling reward leaves it supported, and changing the sibling
    // back restores support through the ordinary batch rebuild.
    expect(unavailableShopOffers(withSibling('StackUpgrade'))).toEqual([]);
  });

  it('does not inherit the offered set into a later map', () => {
    const later = authorSpellSlot(withSibling('SpellDrop'), hBiome, hShopId);
    // Only G's Shop is blocked: H's own batch republished its offers at entry.
    expect(unavailableShopOffers(later)).toEqual([
      semanticAddressKey(createShopOfferAddress(gBiome, gShopId, 'Minor')),
    ]);
  });
});

const goldenShopId = createOccurrenceId('golden-g-b5-e1');

describe('World Shop refill reads its own reached contact', () => {
  const worldShop = () => {
    const profile = catalog.rewards.shops.byKey.WorldShop;
    if (profile === undefined) throw new Error('missing WorldShop profile');
    return profile;
  };

  /** The Minor slot is the one holding the ordinary Spell Drop entry. */
  const minorSlotIndex = () =>
    worldShop().slots.values.findIndex((slot) => slot.groupKey === 'Minor');

  const refillRewardTypes = (offeredRewardTypes: readonly string[]) => {
    const base = initializeTestRewardBranches()[0]!;
    const branch = Object.freeze({
      ...base,
      state: publishOfferedRewardTypes(base.state, offeredRewardTypes),
    });
    const product = deriveTravelRefill({
      catalog,
      profile: worldShop(),
      branch,
      sourceOffer: {
        offerKey: 'Minor',
        offerOrigin: createShopOfferAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-b5-e1'),
          'Minor',
        ),
        optionKey: 'MaxManaDrop',
        offer: { rewardType: 'MaxManaDrop' },
      },
      slotIndex: minorSlotIndex(),
      excludedNames: new Set(['MaxManaDrop']),
      requirements: {},
      facts: (state) =>
        Object.freeze({
          ...baseFacts(),
          requirements: Object.freeze({
            ...baseFacts().requirements,
            records: Object.freeze({
              ...baseFacts().requirements.records,
              useRecord: Object.freeze({ SpellDrop: 0 }),
            }),
            offeredRewardTypes: offeredRewardTypeSet(state.offeredRewardTypes),
          }),
        }),
    });
    return product?.data.rewardTypes ?? [];
  };

  it("lets the Shop's own outgoing Spell Drop constrain a later refill", () => {
    // The refill is generated at the purchase, after this room republished its
    // own batch, so the batch it offered is a live fact for that generation.
    expect(refillRewardTypes([])).toContain('SpellDrop');
    expect(refillRewardTypes(['SpellDrop'])).not.toContain('SpellDrop');
    // Excluding the source name leaves Spell Drop as the only supported
    // replacement, so removing it falls back to the unexcluded slot domain.
    expect(refillRewardTypes([])).toEqual(['SpellDrop']);
    expect(refillRewardTypes(['SpellDrop'])).toEqual(['MaxManaDrop']);
  });

  it("leaves the same Shop's initial inventory unconstrained by its own batch", () => {
    // The other half of the asymmetry. No fixture room accepts an authored
    // Spell Drop on a Shop's own outgoing batch, so rather than fabricate one
    // this reads the ordering that makes the asymmetry hold out of the engine's
    // own composed history for the reached G Shop: the inventory materializes,
    // then the room is entered and the preceding set is cleared, and only then
    // does this Shop's outgoing batch republish one.
    const biomeHistory = simulateProject(catalog, createGoldenFGHProject()).route.biomes.find(
      (candidate) => candidate.biomeKey === 'G',
    );
    if (biomeHistory === undefined || !('history' in biomeHistory))
      throw new Error('golden G lost its composed history');
    const shopKey = semanticAddressKey(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), goldenShopId),
    );
    const sequenceOf = (kind: string) =>
      biomeHistory.history.events.find(
        (event) =>
          event.kind === kind &&
          'origin' in event &&
          semanticAddressKey(event.origin as never) === shopKey,
      )?.sequence;
    const inventory = sequenceOf('offerPointMaterialized');
    const entered = sequenceOf('roomEntered');
    const outgoing = sequenceOf('outgoingGenerationCheckpoint');
    expect([inventory, entered, outgoing].every((value) => value !== undefined)).toBe(true);
    expect(inventory!).toBeLessThan(entered!);
    expect(entered!).toBeLessThan(outgoing!);
  });
});
