import { ordinaryPositionFor } from '../support/route-position';
import {
  catalog,
  createShopOfferAddress,
  createAcquisitionSiteAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  createRewardHistoryState,
  factsWithHistory,
  describe,
  expect,
  it,
  createDefaultRoomState,
  createTestArcanaFearState,
  initializeTestRewardBranches,
  createDefaultRoomEncounterState,
  createNormalDispositionByAcquisitionRole,
  createUnresolvedAcquisitionRewardState,
  materializeAuthoredRoom,
  createLevelResolutionCandidateArtifacts,
  processShopInventory,
  attachTraitHistory,
  simulateProject,
  createRepresentativeNOPQShopTraitProject,
  pBiome,
  pOccurrenceIds,
  biome,
  shopId,
  settleShop,
  baseFacts,
  pomTargetHistory,
  shopPomReward,
  shopBoonReward,
  completeWorldShopOffers,
  mergeRewardFindingEmissions,
} from './shop-trait-purchase-support';
import type { TraitOfferEvent } from './shop-trait-purchase-support';
import { ownerRegion } from '../../src/simulation/finding-regions';

describe('Shop trait acquisition processing', () => {
  it('returns unsupported inventory findings for the caller to merge at its chronology seam', () => {
    const room = catalog.rooms.byKey.F_Shop01;
    if (room === undefined) throw new Error('missing F Shop declaration');
    const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
    const active = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
      loadout,
    });
    if (active.kind !== 'shop' || active.shop === undefined) throw new Error('missing active Shop');
    const completeOffers = completeWorldShopOffers(active.shop, loadout);
    const state = Object.freeze({
      ...active,
      shop: Object.freeze({
        ...active.shop,
        offers: Object.freeze({
          ...completeOffers,
          Minor: Object.freeze({
            ...completeOffers.Minor!,
            optionKey: 'StackUpgrade',
          }),
        }),
      }),
    });
    const canonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        occurrenceId: createOccurrenceId('unsupported-inventory-emission'),
        gameName: room.gameName,
        state,
        acquisitionSites: Object.freeze({}),
        encounters: createDefaultRoomEncounterState(catalog, room, 'unsupported-inventory'),
        additionalExits: Object.freeze([]),
        roomActions: Object.freeze({ order: Object.freeze([]) }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const inventory = processShopInventory(initializeTestRewardBranches(), {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 1,
      facts: (history) => factsWithHistory(baseFacts(), history, new Set()),
      fail: (detail) => {
        throw new Error(detail);
      },
    });
    const findings = new Map();
    mergeRewardFindingEmissions(findings, inventory.findingEmissions);

    expect(inventory.branches).toEqual([]);
    expect([...findings.values()]).toEqual([
      expect.objectContaining({
        finding: expect.objectContaining({
          code: 'shopOfferUnavailable',
          origin: createShopOfferAddress(biome, canonical.origin.occurrenceId, 'Minor'),
        }),
        atomicRegion: ownerRegion(canonical.origin),
        chronology: { kind: 'history', sequence: 1, boundary: 'at' },
      }),
    ]);
  });

  it('folds a purchased random Shop Pom only at purchase, while unpurchased and dormant inventory stay inert', () => {
    const room = catalog.rooms.byKey.F_Shop01;
    if (room === undefined) throw new Error('missing F Shop declaration');
    const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
    const active = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
      loadout,
    });
    if (active.kind !== 'shop' || active.shop === undefined) throw new Error('missing active Shop');
    const minor = active.shop.offers.Minor;
    if (minor === undefined) throw new Error('missing Minor Shop offer');
    const pomReward = Object.freeze({
      offer: Object.freeze({ rewardType: 'StoreRewardRandomStack' as const }),
      dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(catalog, {
        rewardType: 'StoreRewardRandomStack',
      }),
      traitOffersByAcquisitionRole: Object.freeze({}),
      levelResolutionsByAcquisitionRole: Object.freeze({
        self: Object.freeze({
          kind: 'random' as const,
          targetTraitKey: 'ApolloWeaponBoon',
        }),
      }),
    });
    const pomState = Object.freeze({
      ...active,
      shop: Object.freeze({
        ...active.shop,
        offers: completeWorldShopOffers(active.shop, loadout, { Minor: pomReward }),
      }),
    });
    const occurrence = Object.freeze({
      occurrenceId: shopId,
      gameName: room.gameName,
      state: pomState,
      acquisitionSites: Object.freeze({}),
      encounters: createDefaultRoomEncounterState(catalog, room, 'pom-shop.encounters'),
      additionalExits: Object.freeze([]),
      roomActions: Object.freeze({ order: Object.freeze([]) }),
    });
    const canonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence,
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const facts = (history: ReturnType<typeof createRewardHistoryState>) =>
      factsWithHistory(
        {
          ...baseFacts(),
          requirements: {
            ...baseFacts().requirements,
            counters: { ...baseFacts().requirements.counters, upgradableTraitCount: 1 },
          },
        },
        history,
        new Set(),
      );
    const traitHistory = pomTargetHistory();
    const seeded = initializeTestRewardBranches().map((branch) =>
      Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: attachTraitHistory(branch.state.rewardHistory, traitHistory),
          traitHistory: traitHistory,
        }),
      }),
    );
    const inventory = processShopInventory(seeded, {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    }).branches;
    const unpurchased = settleShop(
      inventory,
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 2,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
    expect(inventory).not.toHaveLength(0);
    expect(unpurchased).not.toHaveLength(0);
    expect(unpurchased[0]?.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);

    const purchasedCanonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...pomState,
          shop: pomState.shop,
        }),
        roomActions: Object.freeze({
          order: Object.freeze([{ kind: 'interactShopOffer' as const, offerKey: 'Minor' }]),
        }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const purchasedInventory = processShopInventory(seeded, {
      catalog,
      room: purchasedCanonical,
      declaration: room,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    }).branches;
    const purchased = settleShop(
      purchasedInventory,
      {
        catalog,
        room: purchasedCanonical,
        declaration: room,
        historySequence: 2,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
    expect(purchased[0]?.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(2);

    const giftCanonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...pomState,
          shop: Object.freeze({
            ...pomState.shop!,
            offers: Object.freeze({
              ...pomState.shop!.offers,
              MajorNonBoon: Object.freeze({
                optionKey: null,
                reward: Object.freeze({
                  offer: Object.freeze({ rewardType: 'GiftDrop' }),
                  dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(catalog, {
                    rewardType: 'GiftDrop',
                  }),
                  traitOffersByAcquisitionRole: Object.freeze({}),
                }),
              }),
            }),
          }),
        }),
        roomActions: Object.freeze({
          order: Object.freeze([{ kind: 'interactShopOffer' as const, offerKey: 'MajorNonBoon' }]),
        }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const giftPurchased = settleShop(
      processShopInventory(seeded, {
        catalog,
        room: giftCanonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      }).branches,
      {
        catalog,
        room: giftCanonical,
        declaration: room,
        historySequence: 2,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
    expect(giftPurchased[0]?.state.rewardHistory.consumableRecord.GiftDrop).toBe(1);
    expect(giftPurchased[0]?.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
    expect(
      giftPurchased[0]?.state.traitHistory?.events.some((event) => event.kind === 'levelMutation'),
    ).toBe(false);

    const dormant = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: false,
      loadout,
    });
    expect(dormant).toEqual({ kind: 'shop' });
  });

  it('keeps a reached Pom with a missing authored child visible, candidate-backed, and inert', () => {
    const room = catalog.rooms.byKey.F_Shop01;
    if (room === undefined) throw new Error('missing F Shop declaration');
    const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
    const active = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
      loadout,
    });
    if (active.kind !== 'shop' || active.shop === undefined) throw new Error('missing active Shop');
    const occurrenceId = createOccurrenceId('missing-pom-child-shop');
    const minorOwner = createShopOfferAddress(biome, occurrenceId, 'Minor');
    const address = createLevelResolutionAddress(minorOwner, 'self');
    const missingPomReward = Object.freeze({
      offer: Object.freeze({ rewardType: 'StoreRewardRandomStack' as const }),
      dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(catalog, {
        rewardType: 'StoreRewardRandomStack',
      }),
      traitOffersByAcquisitionRole: Object.freeze({}),
      // Deliberately omit levelResolutionsByAcquisitionRole to witness
      // malformed-but-reached imported state at the simulation boundary.
    });
    const state = Object.freeze({
      ...active,
      shop: Object.freeze({
        ...active.shop,
        offers: completeWorldShopOffers(active.shop, loadout, { Minor: missingPomReward }),
      }),
    });
    const canonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        occurrenceId,
        gameName: room.gameName,
        state,
        acquisitionSites: Object.freeze({}),
        encounters: createDefaultRoomEncounterState(catalog, room, 'missing-pom.encounters'),
        additionalExits: Object.freeze([]),
        roomActions: Object.freeze({
          order: Object.freeze([{ kind: 'interactShopOffer' as const, offerKey: 'Minor' }]),
        }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const facts = (history: ReturnType<typeof createRewardHistoryState>) =>
      factsWithHistory(
        {
          ...baseFacts(),
          requirements: {
            ...baseFacts().requirements,
            counters: { ...baseFacts().requirements.counters, upgradableTraitCount: 1 },
          },
        },
        history,
        new Set(),
      );
    const seeded = initializeTestRewardBranches().map((branch) => {
      const traitHistory = pomTargetHistory();
      return Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: attachTraitHistory(branch.state.rewardHistory, traitHistory),
          traitHistory: traitHistory,
        }),
      });
    });
    const inventory = processShopInventory(seeded, {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    }).branches;
    const findings = new Map();
    const purchased = settleShop(
      inventory,
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 2,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      findings,
    );
    const branch = purchased[0];
    const evaluation = branch?.levelResolutionEvaluations?.[0];
    expect([...findings.values()].map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({ code: 'missingPomTarget', origin: address }),
    );
    expect(evaluation).toMatchObject({
      address,
      value: { kind: 'random', targetTraitKey: null },
      reached: true,
      findings: ['missingTarget'],
    });
    expect(branch?.state.traitHistory?.events.some((event) => event.kind === 'levelMutation')).toBe(
      false,
    );
    if (evaluation === undefined) throw new Error('missing retained Pom assessment');
    const capability = createLevelResolutionCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          [
            {
              address,
              before: evaluation.before,
              levelCount: evaluation.levelCount,
              effectKind: evaluation.effectKind,
            },
          ],
        ],
      ]),
    ).at(address);
    expect(capability?.branches).toEqual([
      {
        effectKind: 'random',
        levelCount: 1,
        eligibleTargetTraitKeys: ['ApolloWeaponBoon'],
      },
    ]);
  });

  it.each([
    ['Pom then replacement', ['Minor', 'Boon'], 'ApolloWeaponBoon', 'ZeusWeaponBoon', 2],
    ['replacement then Pom', ['Boon', 'Minor'], 'ZeusWeaponBoon', 'ZeusWeaponBoon', 2],
  ] as const)(
    'folds Shop Pom and Olympian replacement in authored acquisition order: %s',
    (_label, entryOrder, pomTarget, expectedTraitKey, expectedLevel) => {
      const room = catalog.rooms.byKey.F_Shop01;
      if (room === undefined) throw new Error('missing F Shop declaration');
      const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
      const active = createDefaultRoomState(catalog, room, {
        role: 'ordinary',
        entryActive: true,
        loadout,
      });
      if (active.kind !== 'shop' || active.shop === undefined)
        throw new Error('missing active Shop');
      const pom = active.shop.offers.Minor;
      const boon = active.shop.offers.Boon;
      if (pom === undefined || boon === undefined) throw new Error('missing Shop Pom or Boon slot');
      const state = Object.freeze({
        ...active,
        shop: Object.freeze({
          ...active.shop,
          offers: completeWorldShopOffers(active.shop, loadout, {
            Minor: shopPomReward(pomTarget),
            Boon: shopBoonReward('ZeusUpgrade', 'ZeusWeaponBoon'),
          }),
        }),
      });
      const canonical = materializeAuthoredRoom({
        routePosition: ordinaryPositionFor(catalog, biome),
        catalog,
        biome,
        room,
        occurrence: Object.freeze({
          occurrenceId: createOccurrenceId(`pom-replacement-${entryOrder.join('-')}`),
          gameName: room.gameName,
          state,
          acquisitionSites: Object.freeze({}),
          encounters: createDefaultRoomEncounterState(catalog, room, 'pom-replacement.encounters'),
          additionalExits: Object.freeze([]),
          roomActions: Object.freeze({
            order: Object.freeze(
              entryOrder.map((offerKey) => ({ kind: 'interactShopOffer' as const, offerKey })),
            ),
          }),
        }),
        role: 'ordinary',
        entered: true,
        lifecycleProfileKey: 'WorldShopRoom',
        loadout,
      });
      const facts = (history: ReturnType<typeof createRewardHistoryState>) =>
        factsWithHistory(
          {
            ...baseFacts(),
            requirements: {
              ...baseFacts().requirements,
              counters: { ...baseFacts().requirements.counters, upgradableTraitCount: 1 },
            },
          },
          history,
          new Set(),
        );
      const seeded = initializeTestRewardBranches(
        createTestArcanaFearState({ BoonSkipShrineUpgrade: 1 }),
      ).map((branch) => {
        const traitHistory = pomTargetHistory();
        return Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            rewardHistory: attachTraitHistory(branch.state.rewardHistory, traitHistory),
            traitHistory: traitHistory,
          }),
        });
      });
      const inventory = processShopInventory(seeded, {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      }).branches;
      const purchased = settleShop(
        inventory,
        {
          catalog,
          room: canonical,
          declaration: room,
          historySequence: 2,
          facts,
          fail: (detail) => {
            throw new Error(detail);
          },
        },
        new Map(),
      );
      const result = purchased[0]?.state.traitHistory;
      expect(result?.equippedTraits[expectedTraitKey]).toMatchObject({ level: expectedLevel });
      expect(result?.equippedTraits.ApolloWeaponBoon).toBeUndefined();
      expect(purchased[0]?.state.arcanaFear.fear.forfeitConsumed).toBe(false);
    },
  );

  it('folds a purchased P Shop Hammer at its exact shop owner and purchase lifecycle', () => {
    const project = createRepresentativeNOPQShopTraitProject();
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('valid');
    const surface = evaluation.route;
    const pEvaluation = surface?.biomes.find((biome) => biome.biomeKey === 'P');
    if (pEvaluation === undefined || !('rewards' in pEvaluation)) {
      throw new Error('complete Surface fixture did not evaluate P rewards');
    }
    const shopOffer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon');
    const trace = pEvaluation.rewards.selectedTraitOffers.find(
      (candidate) => semanticAddressKey(candidate.address.owner) === semanticAddressKey(shopOffer),
    );
    if (trace === undefined) throw new Error('purchased Shop Hammer trace is missing');
    expect(trace.address.owner).toEqual(shopOffer);
    expect(trace.acquisitionRole).toBe('weaponUpgrade');

    const branch = pEvaluation.rewards.branches[0];
    if (branch === undefined) throw new Error('complete Surface fixture has no P reward branch');
    const event = branch.state.traitHistory?.events.find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(shopOffer),
    );
    if (event?.kind !== 'traitOffer')
      throw new Error('purchased Shop Hammer fold event is missing');
    expect(event).toMatchObject({
      owner: shopOffer,
      acquisitionRole: 'weaponUpgrade',
      acquisitionPoint: 'purchase',
    });
    const selected =
      event.options[
        event.selectedOptionKey === 'option1' ? 0 : event.selectedOptionKey === 'option2' ? 1 : 2
      ];
    if (selected === undefined) throw new Error('purchased Shop Hammer selection is missing');
    expect(branch.state.traitHistory?.equippedTraits[selected.traitKey]).toMatchObject({
      traitKey: selected.traitKey,
      sourceRole: 'weaponUpgrade',
    });

    const purchase = branch.events.find(
      (candidate) =>
        candidate.kind === 'concreteAcquisition' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(shopOffer),
    );
    expect(purchase).toBeDefined();
    if (purchase?.kind === 'concreteAcquisition') {
      expect(purchase.acquisition.lifecyclePoint).toBe('purchase');
      expect(purchase.settlement?.site).toEqual(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
          'roomExit',
        ),
      );
    }
  });

  it('reports and withholds a persisted Hammer choice made stale by a loadout change', () => {
    const room = catalog.rooms.byKey.F_Shop01;
    if (room === undefined) throw new Error('missing F Shop declaration');
    const defaultWeapon = catalog.weapons.values.find((weapon) =>
      weapon.aspectKeys.includes(weapon.defaultAspectKey),
    );
    const replacementWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== defaultWeapon?.key,
    );
    if (defaultWeapon === undefined || replacementWeapon === undefined) {
      throw new Error('missing test loadout');
    }
    const oldLoadout = {
      weaponKey: defaultWeapon.key,
      aspectKey: defaultWeapon.defaultAspectKey,
    };
    const newLoadout = {
      weaponKey: replacementWeapon.key,
      aspectKey: replacementWeapon.defaultAspectKey,
    };
    const state = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
      loadout: oldLoadout,
    });
    if (state.kind !== 'shop' || state.shop === undefined) throw new Error('missing Shop state');
    const hammerTraitKeys = catalog.traitGivers.byKey.WeaponUpgrade?.traitKeys.filter(
      (traitKey) => {
        const compatibility = catalog.traits.byKey[traitKey]?.hammerCompatibility;
        return (
          compatibility?.weaponKey === oldLoadout.weaponKey &&
          compatibility.aspectKeys.includes(oldLoadout.aspectKey)
        );
      },
    );
    if (hammerTraitKeys === undefined || hammerTraitKeys.length < 3) {
      throw new Error('missing old-loadout Hammer fixture options');
    }
    const hammerBase = createUnresolvedAcquisitionRewardState(
      catalog,
      { rewardType: 'WeaponUpgradeDrop' },
      { kind: 'shopProfile', key: state.shop.profileKey },
    );
    const hammerReward = Object.freeze({
      ...hammerBase,
      traitOffersByAcquisitionRole: Object.freeze({
        weaponUpgrade: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'WeaponUpgrade',
          options: Object.freeze(
            hammerTraitKeys.slice(0, 3).map((traitKey) => Object.freeze({ traitKey })),
          ) as TraitOfferEvent['options'],
          selectedOptionKey: 'option1' as const,
        }),
      }),
    });
    const occurrence = {
      occurrenceId: shopId,
      gameName: room.gameName,
      state: Object.freeze({
        ...state,
        shop: Object.freeze({
          ...state.shop,
          offers: completeWorldShopOffers(state.shop, oldLoadout, {
            MajorNonBoon: hammerReward,
          }),
        }),
      }),
      acquisitionSites: Object.freeze({}),
      encounters: createDefaultRoomEncounterState(catalog, room, 'stale-shop.encounters'),
      additionalExits: Object.freeze([]),
      roomActions: Object.freeze({
        order: Object.freeze([{ kind: 'interactShopOffer' as const, offerKey: 'MajorNonBoon' }]),
      }),
    } as const;
    const canonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence,
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout: newLoadout,
    });
    const major = canonical.entryState?.offers.find((offer) => offer.offerKey === 'MajorNonBoon');
    if (major === undefined) throw new Error('missing materialized Hammer offer');
    expect(major.traitContext).toMatchObject(newLoadout);

    const facts = (history: ReturnType<typeof createRewardHistoryState>) =>
      factsWithHistory(baseFacts(), history, new Set());
    const inventoryFindings = new Map();
    const inventory = processShopInventory(initializeTestRewardBranches(), {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 1,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    });
    mergeRewardFindingEmissions(inventoryFindings, inventory.findingEmissions);
    expect(inventoryFindings).toHaveLength(0);
    expect(inventory.branches).not.toHaveLength(0);

    const purchaseFindings = new Map();
    const purchased = settleShop(
      inventory.branches,
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 2,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      purchaseFindings,
    );
    const purchasedBranch = purchased[0];
    expect([...purchaseFindings.values()].map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'wrongHammerLoadout',
        origin: expect.objectContaining({ owner: major.offerOrigin }),
      }),
    );
    expect(purchasedBranch?.state.traitHistory?.events).toHaveLength(0);
    const weaponUpgradeOffer = major.traitOffersByAcquisitionRole?.weaponUpgrade;
    if (weaponUpgradeOffer?.kind !== 'traits') throw new Error('weapon upgrade must offer traits');
    expect(
      purchasedBranch?.state.traitHistory?.equippedTraits[
        weaponUpgradeOffer.options[0]?.traitKey ?? ''
      ],
    ).toBeUndefined();
  });
});
