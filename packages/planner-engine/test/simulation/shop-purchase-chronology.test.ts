import {
  catalog,
  applyProjectHistoryCommand,
  createAcquisitionRoleAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createLevelResolutionAddress,
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

describe('Echo Gate D Gold Gold Gold', () => {
  it('applies and consumes Well Yarn and Hymn on a paid World Shop Boon screen', () => {
    const reward = shopBoonReward('HeraUpgrade', 'HeraWeaponBoon');
    const initial = initializeTestRewardBranches()[0]!;
    const traits = pomTargetHistory();
    const result = echoGoldShop(['Boon'], {
      initialBranches: [
        Object.freeze({
          ...initial,
          history: attachTraitHistory(initial.history, traits),
          traitHistory: traits,
          stygianWell: Object.freeze({ ...initial.stygianWell, yarnUses: 1, hymnUses: 1 }),
        }),
      ],
      offerOverrides: { Boon: reward.offer },
      rewardOverrides: { Boon: reward },
    });
    const branch = result.settlement.branches[0];
    expect(branch?.stygianWell).toMatchObject({ yarnUses: 0, hymnUses: 0 });
    expect(branch?.traitEvaluations?.at(-1)?.context).toMatchObject({
      temporaryBoonRarityUses: 1,
      limitedSwapUses: 1,
    });
    expect(branch?.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
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
      expect(branch.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
      expect(
        branch.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
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
      expect(branch.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
      expect(
        branch.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
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
      const history = recordLootTypeHistorySource(branch.history, 'ZeusUpgrade');
      return Object.freeze({
        ...branch,
        history: attachTraitHistory(history, traits),
        traitHistory: traits,
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
    expect(result.settlement.branches[0]?.traitHistory?.equippedTraits).toMatchObject({
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
    expect(result.settlement.branches[0]?.traitHistory?.equippedTraits).toMatchObject({
      ZeusWeaponBoon: { level: 3 },
    });
    expect(
      result.settlement.branches[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon,
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
    expect(branch?.history.consumableRecord).toMatchObject({ SpellDrop: 1 });
    expect(branch?.hexProgress.bankedPathPoints).toBe(1);
    expect(branch?.traitHistory?.equippedTraits.EchoDoubleShop).toBeUndefined();
    expect(branch?.traitHistory?.events.filter((event) => event.kind === 'traitRemoval')).toEqual([
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
    expect(empty.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop).toBeDefined();
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
      missing.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();

    const settledLater = echoGoldShop(['Minor'], {
      includeDuplicate: true,
      initialBranches: empty.settlement.branches,
      occurrenceId: createOccurrenceId('echo-gold-later-complete-world-shop'),
    });
    expect(settledLater.settlement.branches[0]?.history.consumableRecord.MaxManaDrop).toBe(2);
    expect(
      settledLater.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
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
      frontier?.branchesBeforeEntry[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
  });

  it('uses fresh loot detail and lets Time Piece convert only the free duplicate', () => {
    const fresh = echoGoldShop(['Boon'], {
      includeDuplicate: true,
      duplicateSelectOption2: true,
    });
    const equipped = fresh.settlement.branches[0]?.traitHistory?.equippedTraits ?? {};
    const apolloTraits = Object.values(equipped).filter((trait) => trait.giverKey === 'Apollo');
    expect(apolloTraits).toHaveLength(2);

    const converted = echoGoldShop(['Minor'], {
      includeDuplicate: true,
      duplicateConversion: 'gold',
      timePiece: true,
    });
    expect(converted.settlement.branches[0]?.history.consumableRecord.MaxManaDrop).toBe(1);
    expect(converted.settlement.branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(3);
    expect(converted.settlement.branches[0]?.events).toContainEqual(
      expect.objectContaining({
        kind: 'conversionToGold',
        settlement: expect.objectContaining({
          entry: expect.objectContaining({ entryKey: converted.duplicateKey }),
        }),
      }),
    );
    expect(
      converted.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
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
        .map((evaluation) => evaluation.context.boonRarityFacts?.itemOverride),
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
    'publishes I World Shop %s Last Stand fallback while preserving the preferred purchase',
    (_phase, enteredBiomes, fallbackKey, extraOverrides) => {
      const result = echoGoldShop(['Survival'], {
        roomGameName: 'I_PreBoss02',
        enteredBiomes,
        offerOverrides: {
          Survival: Object.freeze({ rewardType: 'LastStandDrop' as const }),
          ...extraOverrides,
        },
      });
      expect(result.settlement.runtimeOfferFallbacks).toEqual([
        expect.objectContaining({
          address: expect.objectContaining({ kind: 'shopOffer', offerKey: 'Survival' }),
          preferredRewardType: 'LastStandDrop',
          fallbackRewardType: fallbackKey,
        }),
      ]);
      expect(result.settlement.branches[0]?.history.consumableRecord.LastStandDrop).toBe(1);
      expect(result.settlement.branches[0]?.history.consumableRecord[fallbackKey]).toBeUndefined();
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
    expect(branch?.history.consumableRecord.BlindBoxLoot).toBe(2);
    expect(
      branch?.traitHistory?.events
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
    expect(result.settlement.derivedEntryFrontiers?.[0]).toMatchObject({
      sourceOfferKey: 'Boon',
      rewardTypes: ['BlindBoxLoot'],
    });
    expect(branch?.traitHistory?.equippedTraits.EchoDoubleShop).toBeUndefined();
  });

  it('keeps provider force through a paid Mystery Boon but spends it when a paid Blind Box unwraps', () => {
    const pressuredBranches = () =>
      initializeTestRewardBranches().map((branch) =>
        Object.freeze({
          ...branch,
          keepsakes: createKeepsakeState(catalog, 'ForceApolloBoonKeepsake', branch.arcanaFear),
        }),
      );

    const paidMysteryBoon = echoGoldShop(['Boon'], {
      initialBranches: pressuredBranches(),
      rewardOverrides: { Boon: shopBoonReward('ApolloUpgrade', 'ApolloWeaponBoon') },
    }).settlement.branches[0];
    expect(
      paidMysteryBoon?.keepsakes.olympianSources.find((source) => source.providerKey === 'Apollo')
        ?.remainingForceUses,
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
      paidBlindBox?.keepsakes.olympianSources.find((source) => source.providerKey === 'Apollo')
        ?.remainingForceUses,
    ).toBe(0);
  });

  it('duplicates Shop Nectar without inheriting Echo Reward Pom semantics', () => {
    const result = echoGoldShop(['MajorNonBoon'], {
      offerOverrides: { MajorNonBoon: { rewardType: 'GiftDrop' } },
      includeDuplicate: true,
      withPomTarget: true,
    });
    const branch = result.settlement.branches[0];
    expect(branch?.history.consumableRecord.GiftDrop).toBe(2);
    expect(branch?.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
    expect(branch?.traitHistory?.events.some((event) => event.kind === 'levelMutation')).toBe(
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
    expect(conversionFrontier?.roleFrontiers).toEqual([
      expect.objectContaining({
        address: expect.objectContaining({
          owner: conversionFrontier?.address,
          acquisitionRole: 'self',
        }),
      }),
    ]);
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

  it('atomically persists a dormant Gold boon edit without selecting its chronology', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrenceId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopOccurrenceId),
      'roomExit',
    );
    const duplicate = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    const shopOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);
    const source =
      shopOccurrence?.state.kind === 'shop' ? shopOccurrence.state.shop?.offers.Boon : undefined;
    if (source === undefined || source.reward === null) throw new Error('missing Shop source');
    const edited = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'EditDerivedShopEntry',
      site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'Boon',
      edit: {
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
      },
    });
    const occurrence = (document: typeof project) =>
      document.routes
        .flatMap((route) => route.biomes)
        .find((candidate) => candidate.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);

    expect(occurrence(edited.present)?.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: {
        echoDoubleShopReward: {
          offer: { rewardType: 'RandomLoot' },
          traitOffersByAcquisitionRole: {
            source: { selectedOptionKey: 'option2' },
          },
        },
      },
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(edited.present)), catalog),
    ).toEqual(edited.present);
    const undone = undoProjectHistory(edited);
    expect(
      occurrence(undone.present)?.acquisitionSites?.roomExit?.pickupEntries?.[
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
      ],
    ).toBeUndefined();
    expect(
      occurrence(undone.present)?.acquisitionSites?.roomExit?.pickupEntries?.infernalContractReward,
    ).toBeDefined();
    expect(redoProjectHistory(undone).present).toEqual(edited.present);
  });

  it('atomically persists dormant Gold Pom and Time Piece edits before pickup', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrenceId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopOccurrenceId),
      'roomExit',
    );
    const duplicate = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    const occurrence = (document: typeof project) =>
      document.routes
        .flatMap((route) => route.biomes)
        .find((candidate) => candidate.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);

    const pomSource = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, shopOccurrenceId, 'Minor'),
      value: { rewardType: 'StackUpgrade' },
    });
    const pom = applyProjectHistoryCommand(pomSource, catalog, {
      kind: 'EditDerivedShopEntry',
      site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'Minor',
      edit: {
        kind: 'ReplaceLevelResolution',
        levelResolution: createLevelResolutionAddress(duplicate, 'self'),
        value: {
          kind: 'choice',
          offeredTraitKeys: ['ApolloSpecialBoon'],
          selectedTraitKey: 'ApolloSpecialBoon',
        },
      },
    });
    expect(occurrence(pom.present)?.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: {
        echoDoubleShopReward: {
          levelResolutionsByAcquisitionRole: {
            self: { selectedTraitKey: 'ApolloSpecialBoon' },
          },
        },
      },
    });

    const converted = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'EditDerivedShopEntry',
      site,
      entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      sourceOfferKey: 'Minor',
      edit: {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(duplicate, 'self'),
        value: { kind: 'timePiece' },
      },
    });
    expect(occurrence(converted.present)?.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: {
        echoDoubleShopReward: { dispositionByAcquisitionRole: { self: { kind: 'timePiece' } } },
      },
    });
    expect(undoProjectHistory(converted).present).toEqual(project);
    expect(redoProjectHistory(undoProjectHistory(converted)).present).toEqual(converted.present);
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
    const shopAfterReplacement = history.present.routes
      .flatMap((route) => route.biomes)
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId);
    const blindBox =
      shopAfterReplacement?.state.kind === 'shop'
        ? shopAfterReplacement.state.shop?.offers.Boon?.reward
        : undefined;
    if (blindBox === undefined) throw new Error('missing Blind Box source');
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'SelectDerivedShopEntry',
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
    const shop = history.present.routes
      .flatMap((route) => route.biomes)
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
    const travel = createAcquisitionEntryAddress(site, 'travelDealRefill');
    const duplicate = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    let history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: travel,
      value: {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const travelDefault = history.present.routes
      .flatMap((route) => route.biomes)
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopOccurrenceId)
      ?.acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill;
    if (travelDefault === undefined) throw new Error('missing Travel child');
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'SelectDerivedShopEntry',
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
      document.routes
        .flatMap((route) => route.biomes)
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
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: travel,
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      occurrence(history.present)?.acquisitionSites?.roomExit?.pickupEntries?.[
        ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
      ],
    ).toBeDefined();
  });
});
