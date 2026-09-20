import {
  catalog,
  applyProjectHistoryCommand,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  undoProjectHistory,
  recordLootTypeHistorySource,
  describe,
  expect,
  it,
  initializeTestRewardBranches,
  createKeepsakeState,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  createDerivedAcquisitionEntryCandidateArtifacts,
  selectedTraitOfferProducts,
  attachTraitHistory,
  foldTraitHistoryEvents,
  createGoldenFGHIProject,
  goldenFBiome,
  pomTargetHistory,
  echoGoldHistory,
  allTogetherReward,
  shopPomReward,
  shopBoonReward,
  blindBoxReward,
  divergentAllTogetherBranches,
  echoGoldShop,
} from './shop-trait-purchase-support';
import type { TraitOfferEvent } from './shop-trait-purchase-support';

describe('Gold Gold Gold Shop pickups', () => {
  it.each([
    {
      name: 'Boon',
      slot: 'Boon',
      reward: shopBoonReward('ApolloUpgrade', 'ApolloWeaponBoon'),
      required: true,
    },
    { name: 'Pom', slot: 'Minor', reward: shopPomReward('ApolloWeaponBoon'), required: true },
    {
      name: 'Mystery Boon',
      slot: 'Boon',
      reward: blindBoxReward(
        'ApolloUpgrade',
        ['ApolloManaBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
        'option1',
      ),
      required: false,
    },
  ])(
    'requires placement of native loot, not unopened consumables: $name',
    ({ slot, reward, required }) => {
      const result = echoGoldShop([slot], {
        rewardOverrides: { [slot]: reward },
        withPomTarget: slot === 'Minor',
        completeAfterOrder: true,
      });
      const capability = result.settlement.derivedEntryFrontiers?.find(
        (entry) => entry.kind === 'echoDoubleShopReward',
      );
      expect(capability?.participation).toBe(required ? 'required' : 'optional');
      expect(capability?.roleFrontiers).toBeUndefined();
      const findings = [...result.findings.values()].map((emission) => emission.finding);
      expect(findings).toEqual(
        required
          ? [
              expect.objectContaining({
                code: 'echoGoldPickupPlacementRequired',
                origin: capability!.address,
              }),
            ]
          : [],
      );
    },
  );

  it('applies and consumes Well Yarn and Hymn on a paid World Shop Boon screen', () => {
    const reward = shopBoonReward('HeraUpgrade', 'HeraWeaponBoon');
    const initial = initializeTestRewardBranches()[0]!;
    const traits = pomTargetHistory();
    const result = echoGoldShop(['Boon'], {
      initialBranches: [
        Object.freeze({
          ...initial,
          state: Object.freeze({
            ...initial.state,
            rewardHistory: attachTraitHistory(initial.state.rewardHistory, traits),
            traitHistory: traits,
            stygianWell: Object.freeze({ ...initial.state.stygianWell, yarnUses: 1, hymnUses: 1 }),
          }),
        }),
      ],
      offerOverrides: { Boon: reward.offer },
      rewardOverrides: { Boon: reward },
    });
    const branch = result.settlement.branches[0];
    expect(branch?.state.stygianWell).toMatchObject({ yarnUses: 0, hymnUses: 0 });
    expect(branch?.traitEvaluations?.at(-1)?.state.stygianWell).toMatchObject({
      yarnUses: 1,
      hymnUses: 1,
    });
    expect(branch?.state.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
      level: 3,
      rarity: 'Rare',
    });
  });

  it('settles paid All Together atomically across the complete divergent Shop cohort', () => {
    const reward = allTogetherReward();
    const result = echoGoldShop(['Boon'], {
      initialBranches: divergentAllTogetherBranches(false, ['HeraUpgrade']),
      offerOverrides: { Boon: reward.offer },
      rewardOverrides: { Boon: reward },
    });
    expect([...result.inventoryFindings.values()].map((entry) => entry.finding)).toEqual([]);
    expect(result.inventory).toHaveLength(2);
    expect(result.settlement.branches).toHaveLength(2);
    expect(result.settlement.traitChildSettlements).toEqual([]);
    for (const branch of result.settlement.branches) {
      expect(branch.state.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
      expect(
        branch.state.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
      ).toHaveLength(4);
    }
  });

  it('settles an Echo-derived All Together duplicate atomically across its divergent cohort', () => {
    const duplicate = allTogetherReward();
    const result = echoGoldShop(['Boon'], {
      includeDuplicate: true,
      initialBranches: divergentAllTogetherBranches(true, ['ApolloUpgrade', 'HeraUpgrade']),
      rewardOverrides: { Boon: duplicate },
    });
    expect([...result.inventoryFindings.values()].map((entry) => entry.finding)).toEqual([]);
    expect(result.inventory).toHaveLength(2);
    expect(result.settlement.branches).toHaveLength(2);
    expect(result.settlement.traitChildSettlements).toEqual([]);
    for (const branch of result.settlement.branches) {
      expect(branch.state.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
      expect(
        branch.state.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
      ).toHaveLength(4);
    }
  });

  it('keeps a materialized Gold Pom on its source-time frontier while every source target remains', () => {
    const sourcePom = shopPomReward('ApolloWeaponBoon');
    const duplicatePom = shopPomReward('ZeusSpecialBoon');
    const traits = foldTraitHistoryEvents(catalog, [
      ...echoGoldHistory().events,
      ...pomTargetHistory().events,
    ]);
    const initialBranches = initializeTestRewardBranches().map((branch) => {
      const history = recordLootTypeHistorySource(branch.state.rewardHistory, 'ZeusUpgrade');
      return Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: attachTraitHistory(history, traits),
          traitHistory: traits,
        }),
      });
    });
    const result = echoGoldShop(['Minor', 'Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches,
      rewardOverrides: {
        Minor: sourcePom,
        Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon'),
      },
      duplicateRewardOverride: duplicatePom,
    });

    expect([...result.findings.values()].map((entry) => entry.finding.code)).toContain(
      'pomTargetUnavailable',
    );
    expect(result.settlement.branches[0]?.state.traitHistory?.equippedTraits).toMatchObject({
      ApolloWeaponBoon: { level: 2 },
      ZeusSpecialBoon: { level: 1 },
    });
  });

  it('regenerates a materialized Gold Pom only after a source-time eligible target disappears', () => {
    const sourcePom = shopPomReward('ApolloWeaponBoon');
    const duplicatePom = shopPomReward('ZeusWeaponBoon');
    const result = echoGoldShop(['Minor', 'Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      withPomTarget: true,
      rewardOverrides: {
        Minor: sourcePom,
        Boon: shopBoonReward('ZeusUpgrade', 'ZeusWeaponBoon'),
      },
      duplicateRewardOverride: duplicatePom,
    });

    expect([...result.findings.values()].map((entry) => entry.finding.code)).not.toContain(
      'pomTargetUnavailable',
    );
    expect(result.settlement.branches[0]?.state.traitHistory?.equippedTraits).toMatchObject({
      ZeusWeaponBoon: { level: 3 },
    });
    expect(
      result.settlement.branches[0]?.state.traitHistory?.equippedTraits.ApolloWeaponBoon,
    ).toBeUndefined();
  });

  it('skips SpellDrop, materializes at the first later purchase, and settles the ordered pickup', () => {
    const result = echoGoldShop(['Minor', 'Boon', 'MajorNonBoon'], {
      replaceMinorWithSpell: true,
      spellSelectOption2: true,
      includeDuplicate: true,
      duplicateSelectOption2: true,
    });
    const branch = result.settlement.branches[0];
    expect(branch?.state.rewardHistory.consumableRecord).toMatchObject({ SpellDrop: 1 });
    expect(branch?.state.hexProgress.bankedPathPoints).toBe(1);
    expect(branch?.state.traitHistory?.equippedTraits.EchoDoubleShop).toBeUndefined();
    expect(
      branch?.state.traitHistory?.events.filter((event) => event.kind === 'traitRemoval'),
    ).toEqual([
      expect.objectContaining({
        traitKey: 'EchoDoubleShop',
        acquisitionIdentity: 'echo-gold-use',
      }),
    ]);
    expect(
      branch?.events.flatMap((event) =>
        event.kind !== 'concreteAcquisition' || event.settlement === undefined
          ? []
          : [event.settlement.entry.entryKey],
      ),
    ).toEqual(['Minor', 'Boon', result.duplicateKey, 'MajorNonBoon']);
    expect(result.settlement.entries.map((entry) => entry.address.entryKey)).toEqual([
      'Minor',
      'Boon',
      result.duplicateKey,
      'MajorNonBoon',
    ]);
    expect(result.settlement.derivedEntryFrontiers?.[0]).toMatchObject({
      address: { entryKey: result.duplicateKey },
      sourceOfferKey: 'Boon',
    });
    expect([...result.findings.values()]).toEqual([]);
  });

  it('publishes a placeholder without a source and consumes Gold when the active pickup is skipped', () => {
    const empty = echoGoldShop([], {
      occurrenceId: createOccurrenceId('echo-gold-empty-world-shop'),
    });
    expect(
      empty.settlement.branches[0]?.state.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeDefined();
    expect(empty.settlement.derivedEntryFrontiers).toMatchObject([
      { kind: 'echoDoubleShopPlaceholder' },
    ]);

    const missing = echoGoldShop(['Minor'], {
      initialBranches: empty.settlement.branches,
      occurrenceId: createOccurrenceId('echo-gold-later-world-shop'),
    });
    expect([...missing.findings.values()]).toEqual([]);
    expect(missing.settlement.derivedEntryFrontiers?.[0]).toMatchObject({
      kind: 'echoDoubleShopReward',
      sourceOfferKey: 'Minor',
      rewardTypes: ['MaxManaDrop'],
    });
    expect(
      missing.settlement.branches[0]?.state.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();

    const settledLater = echoGoldShop(['Minor'], {
      includeDuplicate: true,
      initialBranches: empty.settlement.branches,
      occurrenceId: createOccurrenceId('echo-gold-later-complete-world-shop'),
    });
    expect(
      settledLater.settlement.branches[0]?.state.rewardHistory.consumableRecord.MaxManaDrop,
    ).toBe(2);
    expect(
      settledLater.settlement.branches[0]?.state.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
  });

  it('keeps the materialized Gold repair frontier when later paid-source detail is invalid', () => {
    const invalidSource = echoGoldShop(['Boon'], {
      withPomTarget: true,
      rewardOverrides: { Boon: shopBoonReward('ApolloUpgrade', 'ApolloWeaponBoon') },
    });
    const frontier = invalidSource.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'echoDoubleShopReward',
    );

    expect([...invalidSource.findings.values()].map((entry) => entry.finding.code)).toContain(
      'alreadyEquipped',
    );
    expect(frontier).toMatchObject({ sourceOfferKey: 'Boon' });
    expect(
      frontier?.branchesBeforeEntry[0]?.state.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
  });

  it('uses fresh loot detail and lets Time Piece convert only the free duplicate', () => {
    const fresh = echoGoldShop(['Boon'], {
      includeDuplicate: true,
      duplicateSelectOption2: true,
    });
    const equipped = fresh.settlement.branches[0]?.state.traitHistory?.equippedTraits ?? {};
    const apolloTraits = Object.values(equipped).filter((trait) => trait.giverKey === 'Apollo');
    expect(apolloTraits).toHaveLength(2);

    const converted = echoGoldShop(['Minor'], {
      includeDuplicate: true,
      duplicateConversion: 'gold',
      timePiece: true,
    });
    expect(converted.settlement.branches[0]?.state.rewardHistory.consumableRecord.MaxManaDrop).toBe(
      1,
    );
    expect(converted.settlement.branches[0]?.state.keepsakes.timePiece?.remainingCharges).toBe(3);
    expect(converted.settlement.branches[0]?.events).toContainEqual(
      expect.objectContaining({
        kind: 'conversionToGold',
        settlement: expect.objectContaining({
          entry: expect.objectContaining({ entryKey: converted.duplicateKey }),
        }),
      }),
    );
    expect(
      converted.settlement.branches[0]?.state.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
  });

  it('preserves the exact boosted paid-item rarity context for the Echo Gold duplicate', () => {
    const result = echoGoldShop(['BoostedBoon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      roomGameName: 'I_PreBoss02',
      includeDuplicate: true,
      duplicateSelectOption2: true,
    });
    expect([...result.findings.values()]).toEqual([]);
    expect(
      result.settlement.branches[0]?.traitEvaluations
        ?.filter((evaluation) => evaluation.acquisitionRole === 'source')
        .map((evaluation) => evaluation.source.boonRarityFacts?.itemOverride),
    ).toEqual([
      { Rare: 0.9, Epic: 0.25, Legendary: 0.1 },
      { Rare: 0.9, Epic: 0.25, Legendary: 0.1 },
    ]);
  });

  it.each([
    [
      'first half',
      1,
      'ArmorBoost',
      Object.freeze({
        PremiumProgress: Object.freeze({
          rewardType: 'RandomLoot' as const,
          payload: Object.freeze({ kind: 'BoonSource' as const, source: 'ZeusUpgrade' }),
        }),
      }),
    ],
    ['second half', 3, 'ArmorBigBoost', Object.freeze({})],
  ] as const)(
    'preserves I World Shop %s Last Stand purchase',
    (_phase, enteredBiomes, _fallbackKey, extraOverrides) => {
      const result = echoGoldShop(['Survival'], {
        roomGameName: 'I_PreBoss02',
        enteredBiomes,
        offerOverrides: {
          Survival: Object.freeze({ rewardType: 'LastStandDrop' as const }),
          ...extraOverrides,
        },
      });
      expect(
        result.settlement.branches[0]?.state.rewardHistory.consumableRecord.LastStandDrop,
      ).toBe(1);
    },
  );

  it('lets Artificer convert the free Echo Gold duplicate and materialize its exact replacement', () => {
    const result = echoGoldShop(['MajorNonBoon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      duplicateConversion: 'artificer',
      offerOverrides: { MajorNonBoon: { rewardType: 'GiftDrop' } },
    });
    const branch = result.settlement.branches[0];
    expect([...result.findings.values()]).toEqual([]);
    expect(branch?.events).toContainEqual(
      expect.objectContaining({
        kind: 'artificerConversion',
        settlement: expect.objectContaining({
          entry: expect.objectContaining({ entryKey: result.duplicateKey }),
        }),
      }),
    );
    expect(branch?.events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardOffered',
        origin: expect.objectContaining({
          kind: 'acquisitionEntry',
          entryKey: result.replacementKey,
        }),
      }),
    );
  });

  it('resolves a paid Apollo Blind Box and its free duplicate as a fresh Hestia box', () => {
    const freeHestia = {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
    } as const;
    const result = echoGoldShop(['Boon'], {
      rewardOverrides: {
        Boon: blindBoxReward(
          'ApolloUpgrade',
          ['ApolloManaBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
          'option1',
        ),
      },
      duplicateOffer: freeHestia,
      duplicateRewardOverride: blindBoxReward(
        'HestiaUpgrade',
        ['HestiaSpecialBoon', 'HestiaCastBoon', 'HestiaSprintBoon'],
        'option2',
      ),
      includeDuplicate: true,
    });
    expect(
      result.duplicateKey === undefined
        ? undefined
        : result.canonical.acquisitionSites.roomExit?.entries[result.duplicateKey]
            ?.traitOffersByAcquisitionRole.hiddenSource,
    ).toMatchObject({ giverKey: 'Hestia', selectedOptionKey: 'option2' });
    const branch = result.settlement.branches[0];
    expect([...result.findings.values()]).toEqual([]);
    expect(branch?.state.rewardHistory.consumableRecord.BlindBoxLoot).toBe(2);
    expect(
      branch?.state.traitHistory?.events
        .filter(
          (event): event is TraitOfferEvent =>
            event.kind === 'traitOffer' && event.giverKey !== 'Echo',
        )
        .map((event) => [
          event.owner.kind === 'acquisitionEntry' || event.owner.kind === 'shopOffer'
            ? event.owner.kind === 'acquisitionEntry'
              ? event.owner.entryKey
              : event.owner.offerKey
            : undefined,
          event.giverKey,
        ]),
    ).toEqual([
      ['Boon', 'Apollo'],
      [result.duplicateKey, 'Hestia'],
    ]);
    expect(
      result.settlement.derivedEntryFrontiers?.find(
        (entry) => entry.kind === 'echoDoubleShopReward',
      ),
    ).toMatchObject({
      sourceOfferKey: 'Boon',
      rewardTypes: ['BlindBoxLoot'],
    });
    expect(branch?.state.traitHistory?.equippedTraits.EchoDoubleShop).toBeUndefined();
  });

  it('keeps provider force through a paid Mystery Boon but spends it when a paid Blind Box unwraps', () => {
    const pressuredBranches = () =>
      initializeTestRewardBranches().map((branch) =>
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            keepsakes: createKeepsakeState(
              catalog,
              'ForceApolloBoonKeepsake',
              branch.state.arcanaFear,
            ),
          }),
        }),
      );

    const paidMysteryBoon = echoGoldShop(['Boon'], {
      initialBranches: pressuredBranches(),
      rewardOverrides: { Boon: shopBoonReward('ApolloUpgrade', 'ApolloWeaponBoon') },
    }).settlement.branches[0];
    expect(
      paidMysteryBoon?.state.keepsakes.olympianSources.find(
        (source) => source.providerKey === 'Apollo',
      )?.remainingForceUses,
    ).toBe(1);

    const paidBlindBox = echoGoldShop(['Boon'], {
      initialBranches: pressuredBranches(),
      rewardOverrides: {
        Boon: blindBoxReward(
          'ApolloUpgrade',
          ['ApolloManaBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
          'option1',
        ),
      },
    }).settlement.branches[0];
    expect(
      paidBlindBox?.state.keepsakes.olympianSources.find(
        (source) => source.providerKey === 'Apollo',
      )?.remainingForceUses,
    ).toBe(0);
  });

  it('duplicates Shop Nectar without inheriting Echo Reward Pom semantics', () => {
    const result = echoGoldShop(['MajorNonBoon'], {
      offerOverrides: { MajorNonBoon: { rewardType: 'GiftDrop' } },
      includeDuplicate: true,
      withPomTarget: true,
    });
    const branch = result.settlement.branches[0];
    expect(branch?.state.rewardHistory.consumableRecord.GiftDrop).toBe(2);
    expect(branch?.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
    expect(branch?.state.traitHistory?.events.some((event) => event.kind === 'levelMutation')).toBe(
      false,
    );
    expect(result.settlement.derivedEntryFrontiers?.[0]).toMatchObject({
      sourceOfferKey: 'MajorNonBoon',
      rewardTypes: ['GiftDrop'],
    });
    expect([...result.findings.values()]).toEqual([]);
  });

  it('publishes one agreed derived capability across branches and withholds disagreement', () => {
    const pending = echoGoldShop([], {
      occurrenceId: createOccurrenceId('echo-gold-frontier-seed'),
    }).settlement.branches[0];
    if (pending === undefined) throw new Error('missing pending Echo branch');
    const reached = echoGoldShop(['Minor'], {
      initialBranches: [pending, pending],
      occurrenceId: createOccurrenceId('echo-gold-frontier-agreement'),
    });
    const frontiers = reached.settlement.derivedEntryFrontiers ?? [];
    expect(frontiers).toHaveLength(2);
    const address = frontiers[0]?.address;
    if (address === undefined) throw new Error('missing derived frontier address');
    const key = semanticAddressKey(address);
    const agreed = createDerivedAcquisitionEntryCandidateArtifacts(new Map([[key, frontiers]]));
    expect(agreed.at(address)).toMatchObject({ sourceOfferKey: 'Minor' });
    expect(agreed.entriesAt(address.site)).toHaveLength(1);

    const second = frontiers[1];
    if (second === undefined) throw new Error('missing second derived frontier');
    const divergent = Object.freeze({
      ...second,
      rewardTypes: Object.freeze(['MaxHealthDrop']),
    });
    const withheld = createDerivedAcquisitionEntryCandidateArtifacts(
      new Map([[key, Object.freeze([frontiers[0]!, divergent])]]),
    );
    expect(withheld.at(address)).toBeUndefined();
    expect(withheld.entriesAt(address.site)).toEqual([]);
  });

  it('copies ordinary Gold source identity while leaving fresh children unresolved', () => {
    const boon = echoGoldShop(['Boon'], {
      rewardOverrides: { Boon: shopBoonReward('ApolloUpgrade', 'ApolloWeaponBoon') },
    });
    const boonFrontier = boon.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'echoDoubleShopReward',
    );
    if (boonFrontier === undefined) throw new Error('missing dormant Gold boon frontier');
    expect(boonFrontier.fixedReward).toMatchObject({
      offer: {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
      traitOffersByAcquisitionRole: { source: null },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
    });
    const boonProducts = selectedTraitOfferProducts(boon.settlement.branches);
    expect(
      boonProducts.selectedTraitOffers.find(
        (offer) =>
          semanticAddressKey(offer.address.owner) === semanticAddressKey(boonFrontier.address),
      ),
    ).toBeUndefined();

    const pom = echoGoldShop(['Minor'], {
      withPomTarget: true,
      rewardOverrides: { Minor: shopPomReward('ApolloWeaponBoon') },
    });
    const pomFrontier = pom.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'echoDoubleShopReward',
    );
    if (pomFrontier === undefined) throw new Error('missing dormant Gold Pom frontier');
    expect(pomFrontier.fixedReward).toMatchObject({
      offer: { rewardType: 'StackUpgrade' },
      levelResolutionsByAcquisitionRole: {
        self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
    });
    const pomProducts = selectedTraitOfferProducts(pom.settlement.branches);
    expect(
      pomProducts.selectedLevelResolutions.find(
        (level) =>
          semanticAddressKey(level.address.owner) === semanticAddressKey(pomFrontier.address),
      ),
    ).toBeUndefined();

    const converted = echoGoldShop(['Minor'], { timePiece: true });
    const conversionFrontier = converted.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'echoDoubleShopReward',
    );
    expect(conversionFrontier).toBeDefined();
    expect(conversionFrontier?.roleFrontiers).toBeUndefined();
  });

  it('keeps a Gold Blind Box source unresolved until its fresh hidden source is authored', () => {
    const result = echoGoldShop(['Boon'], {
      rewardOverrides: {
        Boon: blindBoxReward(
          'ApolloUpgrade',
          ['ApolloManaBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
          'option1',
        ),
      },
    });
    const frontier = result.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'echoDoubleShopReward',
    );
    expect(frontier).toMatchObject({
      sourceOfferKey: 'Boon',
      rewardTypes: ['BlindBoxLoot'],
    });
    expect(frontier?.fixedReward).toBeUndefined();
    expect(frontier?.roleFrontiers).toBeUndefined();
  });

  it('places an unresolved Gold pickup before its ordinary outcome edits and preserves Undo', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrenceId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopOccurrenceId),
      'roomExit',
    );
    const duplicate = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    const occurrence = (document: typeof project) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'F')!
        .topology!.occurrences.find((room) => room.occurrenceId === shopOccurrenceId)!;
    const placed = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'PlaceEchoGoldPickup',
      site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'Boon',
    });
    expect(
      occurrence(placed.present).acquisitionSites?.roomExit?.pickupEntries?.[
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
      ],
    ).toMatchObject({ traitOffersByAcquisitionRole: { source: null } });
    expect(occurrence(placed.present).roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
    });
    const edited = applyProjectHistoryCommand(placed, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(duplicate, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(edited.present)), catalog),
    ).toEqual(edited.present);
    expect(undoProjectHistory(edited).present).toEqual(placed.present);
    expect(undoProjectHistory(placed).present).toEqual(project);
    expect(redoProjectHistory(undoProjectHistory(edited)).present).toEqual(edited.present);
  });

  it('round-trips an independently resolved hidden source on a derived Blind Box', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrenceId = createOccurrenceId('golden-f-preboss-shop');
    const shopOffer = createShopOfferAddress(goldenFBiome, shopOccurrenceId, 'Boon');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenFBiome, shopOccurrenceId),
        'roomExit',
      ),
      ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
    );
    let history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceShopOffer',
      offer: shopOffer,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const shopAfterReplacement = history.present.route.biomes
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);
    const blindBox =
      shopAfterReplacement?.state.kind === 'shop'
        ? shopAfterReplacement.state.shop?.offers.Boon?.reward
        : undefined;
    if (blindBox === undefined) throw new Error('missing Blind Box source');
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'PlaceEchoGoldPickup',
      site: entry.site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'Boon',
    });
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaCastBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    const shop = history.present.route.biomes
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);
    expect(
      shop?.acquisitionSites?.roomExit?.pickupEntries?.[ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY],
    ).toMatchObject({
      offer: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
      traitOffersByAcquisitionRole: { hiddenSource: { giverKey: 'Hestia' } },
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(history.present)), catalog),
    ).toEqual(history.present);
  });

  it('round-trips an Echo duplicate sourced from the singleton Travel refill', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrenceId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopOccurrenceId),
      'roomExit',
    );
    const travel = createShopOfferAddress(goldenFBiome, shopOccurrenceId, 'travelDealRefill');
    const duplicate = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    let history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceShopOffer',
      offer: travel,
      value: {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'PlaceEchoGoldPickup',
      site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'travelDealRefill',
    });
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(duplicate, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    const occurrence = (document: typeof project) =>
      document.route.biomes
        .find((candidate) => candidate.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);
    expect(
      occurrence(history.present)?.acquisitionSites?.roomExit?.pickupEntries?.[
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
      ],
    ).toMatchObject({
      offer: { rewardType: 'RandomLoot' },
      traitOffersByAcquisitionRole: { source: { selectedOptionKey: 'option2' } },
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(history.present)), catalog),
    ).toEqual(history.present);

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceShopOffer',
      offer: travel,
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      occurrence(history.present)?.acquisitionSites?.roomExit?.pickupEntries?.[
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
      ],
    ).toBeDefined();
  });
});
