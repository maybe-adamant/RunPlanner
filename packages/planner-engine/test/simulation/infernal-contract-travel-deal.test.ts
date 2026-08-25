import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import {
  evaluateShopGenerationSupport,
  findShopIndexedGenerationWitnesses,
  factsWithHistory,
  type AuthoredShopOffer,
  type RewardKernelFacts,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';
import { createDefaultRoomState } from '../../src/authored-project/room-state/defaults';
import { createDefaultRoomEncounterState } from '../../src/authored-project/room-state/encounters';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
} from '../../src/authored-project/shop';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms';
import {
  processShopInventory,
  settleShopAcquisitionSite,
} from '../../src/simulation/rewards/processing';
import { type RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { createDerivedAcquisitionEntryCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const biome = createBiomeAddress('Underworld', 'F');
const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' } as const;

const explicitShopOffers: Readonly<Record<string, ResolvedRewardOffer>> = Object.freeze({
  Boon: Object.freeze({
    rewardType: 'RandomLoot',
    payload: Object.freeze({ kind: 'BoonSource', source: 'ApolloUpgrade' }),
  }),
  MajorNonBoon: Object.freeze({ rewardType: 'MaxHealthDrop' }),
  Minor: Object.freeze({ rewardType: 'MaxManaDrop' }),
  BoostedBoon: Object.freeze({ rewardType: 'StackUpgradeBig' }),
  MixedProgress: Object.freeze({ rewardType: 'MaxHealthDrop' }),
  Survival: Object.freeze({ rewardType: 'HealBigDrop' }),
  PremiumProgress: Object.freeze({ rewardType: 'MaxHealthDropBig' }),
  MetaProgress: Object.freeze({ rewardType: 'CardUpgradePointsDrop' }),
  MixedProgress1: Object.freeze({ rewardType: 'MaxHealthDrop' }),
  MixedProgress2: Object.freeze({ rewardType: 'MaxManaDrop' }),
  LargeSurvival: Object.freeze({ rewardType: 'HealBigDrop' }),
});

function authoredShopReward(
  offer: ResolvedRewardOffer,
  profileKey: 'WorldShop' | 'I_WorldShop' | 'Q_WorldShop' = 'WorldShop',
): AuthoredRewardState {
  const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: profileKey,
  });
  const source = offer.payload?.kind === 'BoonSource' ? offer.payload.source : undefined;
  const traitOffer =
    offer.rewardType === 'SpellDrop'
      ? Object.freeze({
          kind: 'traits' as const,
          giverKey: 'SpellDrop',
          options: Object.freeze([
            { traitKey: 'SpellPolymorphTrait' },
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
          ] as const),
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
        })
      : source === 'ApolloUpgrade'
        ? Object.freeze({
            kind: 'traits' as const,
            giverKey: 'Apollo',
            options: Object.freeze([
              { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
              { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
              { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
            ] as const),
            selectedOptionKey: 'option1' as const,
            rarificationActions: Object.freeze([]),
          })
        : source === 'HestiaUpgrade'
          ? Object.freeze({
              kind: 'traits' as const,
              giverKey: 'Hestia',
              options: Object.freeze([
                { traitKey: 'HestiaWeaponBoon', rarity: 'Common' as const },
                { traitKey: 'HestiaSpecialBoon', rarity: 'Common' as const },
                { traitKey: 'HestiaCastBoon', rarity: 'Common' as const },
              ] as const),
              selectedOptionKey: 'option1' as const,
              rarificationActions: Object.freeze([]),
            })
          : source === 'ZeusUpgrade'
            ? Object.freeze({
                kind: 'traits' as const,
                giverKey: 'Zeus',
                options: Object.freeze([
                  { traitKey: 'ZeusWeaponBoon', rarity: 'Common' as const },
                  { traitKey: 'ZeusSpecialBoon', rarity: 'Common' as const },
                  { traitKey: 'ZeusCastBoon', rarity: 'Common' as const },
                ] as const),
                selectedOptionKey: 'option1' as const,
                rarificationActions: Object.freeze([]),
              })
            : undefined;
  return Object.freeze({
    ...state,
    traitOffersByAcquisitionRole: Object.freeze(
      Object.fromEntries(
        Object.entries(state.traitOffersByAcquisitionRole).map(([role, value]) => [
          role,
          value ?? traitOffer ?? null,
        ]),
      ),
    ),
    ...(state.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : {
          levelResolutionsByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.keys(state.levelResolutionsByAcquisitionRole).map((role) => [
                role,
                {
                  kind: 'choice' as const,
                  offeredTraitKeys: Object.freeze([]),
                  selectedTraitKey: null,
                },
              ]),
            ),
          ),
        }),
  });
}

function authoredDerivedReward(
  frontier: {
    readonly evaluateOffer?: (offer: ResolvedRewardOffer) => { readonly supported: boolean };
  },
  offer: ResolvedRewardOffer,
  profileKey: 'WorldShop' | 'I_WorldShop' | 'Q_WorldShop' = 'WorldShop',
): AuthoredRewardState {
  if (frontier.evaluateOffer?.(offer).supported !== true) {
    throw new Error(`explicit derived fixture offer ${offer.rewardType} is unsupported`);
  }
  return authoredShopReward(offer, profileKey);
}

function baseFacts(enteredBiomes = 4): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
        enteredBiomes,
        upgradableTraitCount: 1,
      },
      records: { biomeUseRecord: {}, lootTypeHistory: {}, roomsEntered: {}, useRecord: {} },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 8,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 3,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

function seededBranches(options: {
  readonly contract?: boolean;
  readonly echo?: boolean;
  readonly travel?: boolean;
  readonly timePiece?: boolean;
}) {
  const events = [
    ...(options.contract === true
      ? [
          {
            kind: 'directTraitGrant' as const,
            owner: { kind: 'project' as const },
            acquisitionRole: 'directTraitGrant' as const,
            sequence: 1,
            acquisitionPoint: 'seed',
            sourceTraitKey: 'InfernalContractBoon',
            traitKey: 'InfernalContractBoon',
          },
        ]
      : []),
    ...(options.travel === true
      ? [
          {
            kind: 'traitOffer' as const,
            owner: { kind: 'project' as const },
            acquisitionRole: 'seed',
            sequence: 2,
            giverKey: 'Hermes',
            options: Object.freeze([{ traitKey: 'RestockBoon', rarity: 'Epic' as const }] as const),
            selectedOptionKey: 'option1' as const,
            acquisitionPoint: 'seed',
          },
        ]
      : []),
    ...(options.echo === true
      ? [
          {
            kind: 'traitOffer' as const,
            owner: { kind: 'project' as const },
            acquisitionRole: 'seed',
            sequence: 3,
            giverKey: 'Echo',
            options: Object.freeze([{ traitKey: 'EchoDoubleShop' }] as const),
            selectedOptionKey: 'option1' as const,
            acquisitionPoint: 'seed',
            acquisitionIdentity: 'gate-b-echo',
          },
        ]
      : []),
  ];
  const traits = foldTraitHistoryEvents(catalog, events);
  return initializeTestRewardBranches().map((branch) =>
    Object.freeze({
      ...branch,
      history: attachTraitHistory(branch.history, traits),
      traitHistory: traits,
      ...(options.timePiece === true
        ? { keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear) }
        : {}),
    }),
  );
}

function settle(options: {
  readonly order: readonly string[];
  readonly contract?: boolean;
  readonly travel?: boolean;
  readonly travelChild?: AuthoredRewardState;
  readonly timePiece?: boolean;
  readonly contractRewardType?:
    'BlindBoxLoot' | 'StackUpgradeBig' | 'StackUpgrade' | 'TalentBigDrop' | 'TalentDrop';
  readonly contractGold?: boolean;
  readonly contractBlindBoxSource?: string;
  readonly divergentTravel?: boolean;
  readonly echo?: boolean;
  readonly echoDuplicateSourceKey?: string;
  readonly echoDuplicateChild?: AuthoredRewardState;
  readonly shopOfferOverrides?: Readonly<Record<string, AuthoredRewardState>>;
  readonly roomGameName?: 'F_PreBoss01' | 'I_PreBoss02' | 'Q_PreBoss01';
  readonly enteredBiomes?: number;
}) {
  const roomGameName = options.roomGameName ?? 'F_PreBoss01';
  const declaration = catalog.rooms.byKey[roomGameName];
  if (declaration?.infernalContractReward === undefined)
    throw new Error('missing F Preboss Contract declaration');
  const state = createDefaultRoomState(catalog, declaration, {
    role: 'prebossShop',
    entryActive: true,
    loadout,
  });
  if (state.kind !== 'shop' || state.shop === undefined) throw new Error('missing World Shop');
  const contractRewardType = options.contractRewardType ?? 'BlindBoxLoot';
  const rewardDeclaration = catalog.rewards.rewardTypes.byKey[contractRewardType];
  if (rewardDeclaration === undefined) throw new Error('missing Contract reward declaration');
  const selectedContractBase = authoredShopReward(
    Object.freeze({
      rewardType: contractRewardType,
      ...(contractRewardType === 'BlindBoxLoot'
        ? {
            payload: Object.freeze({
              kind: 'BoonSource' as const,
              source: options.contractBlindBoxSource ?? 'ApolloUpgrade',
            }),
          }
        : {}),
    }),
  );
  const selectedContract =
    options.contractGold !== true
      ? selectedContractBase
      : Object.freeze({
          ...selectedContractBase,
          dispositionByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.keys(selectedContractBase.dispositionByAcquisitionRole).map((role) => [
                role,
                { kind: 'timePiece' as const },
              ]),
            ),
          ),
        });
  const shopState = Object.freeze({
    ...state,
    shop: Object.freeze({
      ...state.shop,
      offers: Object.freeze(
        Object.fromEntries(
          Object.keys(state.shop.offers).map((key) => [
            key,
            Object.freeze({
              reward:
                options.shopOfferOverrides?.[key] ??
                authoredShopReward(
                  explicitShopOffers[key] ??
                    (() => {
                      throw new Error(`missing explicit Shop fixture offer for ${key}`);
                    })(),
                  state.shop!.profileKey as 'WorldShop' | 'I_WorldShop' | 'Q_WorldShop',
                ),
            }),
          ]),
        ),
      ),
    }),
  });
  const occurrence = Object.freeze({
    occurrenceId: createOccurrenceId('gate-b-f-preboss'),
    gameName: declaration.gameName,
    state: shopState,
    acquisitionSites: Object.freeze({
      roomExit: Object.freeze({
        pickupEntries: Object.freeze({
          infernalContractReward: selectedContract,
          ...(options.travelChild === undefined ? {} : { travelDealRefill: options.travelChild }),
          ...(options.echoDuplicateSourceKey === undefined ||
          options.echoDuplicateChild === undefined
            ? {}
            : {
                [ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY]: options.echoDuplicateChild,
              }),
        }),
      }),
    }),
    encounters: createDefaultRoomEncounterState(catalog, declaration, 'gate-b.encounters'),
    additionalExits: Object.freeze([]),
    roomActions: Object.freeze({
      order: Object.freeze(
        options.order.map((entryKey) =>
          shopState.shop?.offers[entryKey] !== undefined
            ? Object.freeze({ kind: 'interactShopOffer' as const, offerKey: entryKey })
            : Object.freeze({
                kind: 'interactAcquisitionEntry' as const,
                siteKey: 'roomExit',
                entryKey,
              }),
        ),
      ),
    }),
  });
  const canonical = materializeAuthoredRoom({
    catalog,
    biome:
      roomGameName === 'Q_PreBoss01'
        ? createBiomeAddress('Surface', 'Q')
        : roomGameName === 'I_PreBoss02'
          ? createBiomeAddress('Underworld', 'I')
          : biome,
    room: declaration,
    occurrence,
    role: 'prebossShop',
    entered: true,
    lifecycleProfileKey: 'PrebossShopRoom',
    loadout,
  });
  const facts = (
    history: RewardBranchState['history'],
    currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
  ) => factsWithHistory(baseFacts(options.enteredBiomes), history, currentRoomShopOptionNames);
  const sourceBranches =
    options.divergentTravel === true
      ? Object.freeze([
          ...seededBranches({ ...options, travel: true }),
          ...seededBranches({ ...options, travel: false }),
        ])
      : seededBranches(options);
  const findings = new Map();
  const inventory = processShopInventory(
    sourceBranches,
    {
      catalog,
      room: canonical,
      declaration,
      historySequence: 3,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    },
    findings,
  );
  const settlement = settleShopAcquisitionSite(
    inventory,
    {
      catalog,
      room: canonical,
      declaration,
      historySequence: 4,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    },
    findings,
  );
  return { canonical, findings, settlement };
}

describe('Infernal Contract and Travel Deal chronology', () => {
  it('publishes a stable placeholder before a normal purchase and excludes Contract as a trigger', () => {
    const empty = settle({ order: [], travel: true });
    expect(empty.settlement.derivedEntryFrontiers).toMatchObject([
      { kind: 'travelDealPlaceholder', address: { entryKey: 'travelDealRefill' } },
    ]);

    const contractOnly = settle({
      order: ['infernalContractReward'],
      contract: true,
      travel: true,
    });
    expect(contractOnly.settlement.branches).toHaveLength(1);
    expect(
      contractOnly.settlement.derivedEntryFrontiers?.filter(
        (entry) => entry.kind === 'travelDealRefill',
      ),
    ).toEqual([]);
    expect(contractOnly.settlement.roleFrontiers?.[0]?.source.instanceProvenance).toBe('free');
    expect(
      contractOnly.settlement.branches[0]?.traitHistory?.equippedTraits.InfernalContractBoon,
    ).not.toHaveProperty('rarity');
  });

  it('keeps Contract free and non-triggering before or after one paid normal purchase', () => {
    for (const order of [
      ['infernalContractReward', 'Minor'],
      ['Minor', 'infernalContractReward'],
    ] as const) {
      const result = settle({ order, contract: true, travel: true });
      expect(
        result.settlement.derivedEntryFrontiers?.find((entry) => entry.kind === 'travelDealRefill'),
      ).toMatchObject({ sourceOfferKey: 'Minor', slotIndex: 2 });
      expect(
        result.settlement.roleFrontiers?.find(
          (frontier) => frontier.settlement.entry.entryKey === 'infernalContractReward',
        )?.source.instanceProvenance,
      ).toBe('free');
      expect(
        result.settlement.roleFrontiers?.find(
          (frontier) => frontier.settlement.entry.entryKey === 'Minor',
        )?.source.instanceProvenance,
      ).toBe('paid');
    }
  });

  it('publishes the exact branch-attested five-reward Contract domain', () => {
    const result = settle({ order: [], contract: true });
    const contract = result.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'infernalContractReward',
    );
    expect(contract?.rewardTypes).toEqual([
      'BlindBoxLoot',
      'StackUpgradeBig',
      'StackUpgrade',
      'TalentBigDrop',
      'TalentDrop',
    ]);
    expect(contract?.evaluateOffer?.({ rewardType: 'StackUpgrade' }).supported).toBe(true);
    expect(contract?.evaluateOffer?.({ rewardType: 'MaxHealthDrop' }).supported).toBe(false);
  });

  it('derives one exact indexed fresh refill after the first paid offer and settles it as paid', () => {
    const derived = settle({ order: ['MajorNonBoon'], travel: true });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    expect(refill).toMatchObject({
      sourceOfferKey: 'MajorNonBoon',
      slotIndex: 1,
      address: { entryKey: 'travelDealRefill' },
    });
    if (refill === undefined) throw new Error('missing derived refill frontier');
    const refillReward = authoredDerivedReward(refill, { rewardType: 'RoomRewardHealDrop' });

    const purchased = settle({
      order: ['MajorNonBoon', 'travelDealRefill'],
      travel: true,
      travelChild: refillReward,
    });
    expect([...purchased.findings.values()]).toEqual([]);
    expect(purchased.settlement.branches).toHaveLength(1);
    expect(
      purchased.settlement.roleFrontiers?.find(
        (frontier) => frontier.settlement.entry.entryKey === 'travelDealRefill',
      )?.source.instanceProvenance,
    ).toBe('paid');
  });

  it('retains the exact refill frontier when the selected child is stale', () => {
    const staleChild = createUnresolvedAcquisitionRewardState(
      catalog,
      Object.freeze({
        rewardType: 'BlindBoxLoot' as const,
        payload: Object.freeze({ kind: 'BoonSource' as const, source: 'ApolloUpgrade' }),
      }),
      { kind: 'shopProfile', key: 'WorldShop' },
    );
    const result = settle({
      order: ['MajorNonBoon', 'travelDealRefill'],
      travel: true,
      travelChild: staleChild,
    });
    expect(
      result.settlement.derivedEntryFrontiers?.find((entry) => entry.kind === 'travelDealRefill'),
    ).toMatchObject({ sourceOfferKey: 'MajorNonBoon', slotIndex: 1 });
    expect([...result.findings.values()].map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'shopPurchaseUnavailable',
        origin: expect.objectContaining({ entryKey: 'travelDealRefill' }),
      }),
    );
  });

  it('rebinds the singleton source and indexed slot when a different normal purchase comes first', () => {
    const minor = settle({ order: ['Minor'], travel: true });
    const major = settle({ order: ['MajorNonBoon'], travel: true });
    expect(
      minor.settlement.derivedEntryFrontiers?.filter((entry) => entry.kind === 'travelDealRefill'),
    ).toMatchObject([
      { address: { entryKey: 'travelDealRefill' }, sourceOfferKey: 'Minor', slotIndex: 2 },
    ]);
    expect(
      major.settlement.derivedEntryFrontiers?.filter((entry) => entry.kind === 'travelDealRefill'),
    ).toMatchObject([
      {
        address: { entryKey: 'travelDealRefill' },
        sourceOfferKey: 'MajorNonBoon',
        slotIndex: 1,
      },
    ]);
  });

  it('keeps premature and missing selected refills exact at the singleton entry', () => {
    const derived = settle({ order: ['MajorNonBoon'], travel: true });
    const frontier = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (frontier === undefined) throw new Error('missing Travel frontier');
    const authoredReward = authoredDerivedReward(frontier, { rewardType: 'RoomRewardHealDrop' });
    for (const result of [
      settle({ order: ['travelDealRefill'], travel: true, travelChild: authoredReward }),
      settle({ order: ['MajorNonBoon', 'travelDealRefill'], travel: true }),
    ]) {
      expect([...result.findings.values()].map((entry) => entry.finding)).toContainEqual(
        expect.objectContaining({
          code: 'shopPurchaseUnavailable',
          origin: expect.objectContaining({ entryKey: 'travelDealRefill' }),
        }),
      );
    }
  });

  it('lets Spell trigger Travel while Echo stays armed for the next paid non-Spell purchase', () => {
    const spell = authoredShopReward(Object.freeze({ rewardType: 'SpellDrop' as const }));
    const derived = settle({
      order: ['Minor'],
      travel: true,
      echo: true,
      shopOfferOverrides: { Minor: spell },
    });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (refill === undefined) throw new Error('missing Spell-triggered refill');
    const refillReward = authoredDerivedReward(refill, { rewardType: 'MaxManaDrop' });
    expect(refill).toMatchObject({ sourceOfferKey: 'Minor', slotIndex: 2 });
    expect(
      derived.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeDefined();

    const source = derived.canonical.entryState?.offers.find(
      (offer) => offer.offerKey === 'MajorNonBoon',
    );
    if (source === undefined) throw new Error('missing Major non-boon Shop source');
    const duplicateOffer = echoShopDuplicateOffer(catalog, source.offer);
    if (duplicateOffer === null) throw new Error('ordinary source unexpectedly needs fresh detail');
    const duplicate = createUnresolvedAcquisitionRewardState(catalog, duplicateOffer, {
      kind: 'shopProfile',
      key: 'WorldShop',
    });
    const settled = settle({
      order: ['Minor', 'MajorNonBoon', 'echoDoubleShopReward', 'travelDealRefill'],
      travel: true,
      echo: true,
      travelChild: refillReward,
      echoDuplicateSourceKey: 'MajorNonBoon',
      echoDuplicateChild: duplicate,
      shopOfferOverrides: { Minor: spell },
    });
    expect([...settled.findings.values()]).toEqual([]);
    expect(
      settled.settlement.roleFrontiers?.map((frontier) => frontier.settlement.entry.entryKey),
    ).toEqual(['Minor', 'MajorNonBoon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY, 'travelDealRefill']);
    expect(
      settled.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
    expect(
      settled.settlement.derivedEntryFrontiers?.filter(
        (entry) => entry.kind === 'travelDealRefill',
      ),
    ).toHaveLength(1);
  });

  it('keeps Gold armed when the Travel paid entry fails indexed generation support', () => {
    const spell = authoredShopReward(Object.freeze({ rewardType: 'SpellDrop' as const }));
    const impossibleRefill = createUnresolvedAcquisitionRewardState(
      catalog,
      Object.freeze({ rewardType: 'MaxHealthDrop' as const }),
      { kind: 'shopProfile', key: 'WorldShop' },
    );
    const rejected = settle({
      order: ['Minor', 'travelDealRefill'],
      travel: true,
      echo: true,
      travelChild: impossibleRefill,
      shopOfferOverrides: { Minor: spell },
    });
    const travel = rejected.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );

    expect(travel?.evaluateOffer?.(impossibleRefill.offer)).toMatchObject({ supported: false });
    expect([...rejected.findings.values()].map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'shopPurchaseUnavailable',
        origin: expect.objectContaining({ entryKey: 'travelDealRefill' }),
        evidence: { kind: 'travelDealRefillUnavailable' },
      }),
    );
    expect(rejected.settlement.derivedEntryFrontiers ?? []).not.toContainEqual(
      expect.objectContaining({ kind: 'echoDoubleShopReward' }),
    );
    expect(
      travel?.branchesBeforeEntry[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeDefined();
    expect(
      travel?.branchesBeforeEntry[0]?.traitHistory?.events.filter(
        (event) => event.kind === 'traitRemoval',
      ),
    ).toEqual([]);
  });

  it('lets the Spell-triggered Travel refill own the later Gold duplicate pickup', () => {
    const spell = authoredShopReward(Object.freeze({ rewardType: 'SpellDrop' as const }));
    const derived = settle({
      order: ['Minor'],
      travel: true,
      echo: true,
      shopOfferOverrides: { Minor: spell },
    });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (refill === undefined) throw new Error('missing Spell-triggered refill');
    const refillReward = authoredDerivedReward(refill, { rewardType: 'MaxManaDrop' });
    const duplicate = createUnresolvedAcquisitionRewardState(
      catalog,
      echoShopDuplicateOffer(catalog, refillReward.offer)!,
      { kind: 'shopProfile', key: 'WorldShop' },
    );
    const settled = settle({
      order: ['Minor', 'travelDealRefill', 'echoDoubleShopReward'],
      travel: true,
      echo: true,
      travelChild: refillReward,
      echoDuplicateSourceKey: 'travelDealRefill',
      echoDuplicateChild: duplicate,
      shopOfferOverrides: { Minor: spell },
    });
    expect([...settled.findings.values()]).toEqual([]);
    expect(
      settled.settlement.roleFrontiers?.map((frontier) => frontier.settlement.entry.entryKey),
    ).toEqual(['Minor', 'travelDealRefill', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY]);
    expect(
      settled.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
  });

  it('freezes Travel after Gold materialization on the same non-Spell purchase', () => {
    const derived = settle({ order: ['Minor'], travel: true, echo: true });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (refill === undefined) throw new Error('missing Minor-triggered refill');
    const refillReward = authoredDerivedReward(refill, { rewardType: 'SpellDrop' });
    expect(
      refill.branchesBeforeEntry[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
    const source = derived.canonical.entryState?.offers.find((offer) => offer.offerKey === 'Minor');
    if (source === undefined) throw new Error('missing Minor Shop source');
    const duplicateOffer = echoShopDuplicateOffer(catalog, source.offer);
    if (duplicateOffer === null) throw new Error('ordinary source unexpectedly needs fresh detail');
    const duplicate = createUnresolvedAcquisitionRewardState(catalog, duplicateOffer, {
      kind: 'shopProfile',
      key: 'WorldShop',
    });
    const settled = settle({
      order: ['Minor', 'echoDoubleShopReward', 'travelDealRefill'],
      travel: true,
      echo: true,
      travelChild: refillReward,
      echoDuplicateSourceKey: 'Minor',
      echoDuplicateChild: duplicate,
    });
    expect([...settled.findings.values()]).toEqual([]);
    expect(
      settled.settlement.roleFrontiers?.map((frontier) => frontier.settlement.entry.entryKey),
    ).toEqual(['Minor', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY, 'travelDealRefill']);
    expect(
      settled.settlement.branches[0]?.traitHistory?.equippedTraits.EchoDoubleShop,
    ).toBeUndefined();
    expect(
      settled.settlement.derivedEntryFrontiers?.filter(
        (entry) => entry.kind === 'travelDealRefill',
      ),
    ).toHaveLength(1);
  });

  it('keeps the ordinary and boosted Q Travel refill witnesses separate', () => {
    const derived = settle({
      order: ['MixedProgress1'],
      travel: true,
      roomGameName: 'Q_PreBoss01',
    });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (refill === undefined) throw new Error('missing Q Travel frontier');
    const profile = catalog.rewards.shops.byKey.Q_WorldShop;
    if (profile === undefined) throw new Error('missing Q World Shop');
    expect(
      new Set(
        findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          0,
          Object.freeze({
            rewardType: 'RandomLoot' as const,
            payload: Object.freeze({ kind: 'BoonSource' as const, source: 'ApolloUpgrade' }),
          }),
          baseFacts(),
        ).map((witness) => witness.optionKeys[0]),
      ),
    ).toEqual(new Set(['RandomLoot', 'BoostedRandomLoot']));
    const refillReward = authoredDerivedReward(
      refill,
      Object.freeze({
        rewardType: 'RandomLoot' as const,
        payload: Object.freeze({ kind: 'BoonSource' as const, source: 'ApolloUpgrade' }),
      }),
      'Q_WorldShop',
    );
    const settled = settle({
      order: ['MixedProgress1', 'travelDealRefill'],
      travel: true,
      travelChild: refillReward,
      roomGameName: 'Q_PreBoss01',
    });
    expect([...settled.findings.values()]).toEqual([]);
    expect(settled.settlement.branches).toHaveLength(1);
    expect(
      settled.settlement.branches[0]?.traitEvaluations
        ?.filter((evaluation) => evaluation.acquisitionRole === 'source')
        .map((evaluation) => evaluation.context.boonRarityFacts?.itemOverride),
    ).toEqual([undefined, { Rare: 0.9, Epic: 0.25, Legendary: 0.1 }]);
  });

  it('withholds a derived refill capability when reached branches disagree', () => {
    const result = settle({ order: ['MajorNonBoon'], divergentTravel: true });
    const frontiers =
      result.settlement.derivedEntryFrontiers?.filter(
        (entry) => entry.kind === 'travelDealRefill',
      ) ?? [];
    expect(frontiers).toHaveLength(1);
    const address = frontiers[0]?.address;
    if (address === undefined) throw new Error('missing divergent Travel frontier');
    const artifacts = createDerivedAcquisitionEntryCandidateArtifacts(
      new Map([[semanticAddressKey(address), frontiers]]),
    );
    expect(artifacts.at(address)).toBeUndefined();
  });

  it('does not retroactively refill when the first paid purchase grants Travel Deal', () => {
    const hermesBase = createUnresolvedAcquisitionRewardState(
      catalog,
      Object.freeze({ rewardType: 'ShopHermesUpgrade' as const }),
      { kind: 'shopProfile', key: 'WorldShop' },
    );
    const hermesTravel = Object.freeze({
      ...hermesBase,
      traitOffersByAcquisitionRole: Object.freeze({
        hermes: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'Hermes',
          options: Object.freeze([
            { traitKey: 'RestockBoon', rarity: 'Epic' as const },
            { traitKey: 'HermesWeaponBoon', rarity: 'Epic' as const },
            { traitKey: 'HermesSpecialBoon', rarity: 'Epic' as const },
          ] as const),
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
        }),
      }),
    });
    const result = settle({ order: ['Boon'], shopOfferOverrides: { Boon: hermesTravel } });
    expect([...result.findings.values()]).toEqual([]);
    expect(result.settlement.branches[0]?.history.lootTypeHistory.HermesUpgrade).toBe(1);
    expect(result.settlement.branches[0]?.traitHistory?.equippedTraits.RestockBoon?.rarity).toBe(
      'Epic',
    );
    expect(
      result.settlement.derivedEntryFrontiers?.some(
        (entry) => entry.kind === 'travelDealRefill' || entry.kind === 'travelDealPlaceholder',
      ),
    ).toBe(false);
  });

  it.each(['StackUpgradeBig', 'StackUpgrade', 'TalentBigDrop', 'TalentDrop'] as const)(
    'lets Time Piece convert the free %s pedestal reward',
    (contractRewardType) => {
      const result = settle({
        order: ['infernalContractReward'],
        contract: true,
        timePiece: true,
        contractRewardType,
        contractGold: true,
      });
      expect([...result.findings.values()]).toEqual([]);
      expect(result.settlement.branches).toHaveLength(1);
      expect(result.settlement.branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(3);
      expect(result.settlement.branches[0]?.events).toContainEqual(
        expect.objectContaining({ kind: 'conversionToGold' }),
      );
    },
  );

  it('rejects Time Piece conversion for the free Contract Blind Box', () => {
    const result = settle({
      order: ['infernalContractReward'],
      contract: true,
      timePiece: true,
      contractRewardType: 'BlindBoxLoot',
      contractGold: true,
    });
    expect([...result.findings.values()].map((entry) => entry.finding.code)).toEqual([
      'timePieceConversionUnavailable',
      'timePieceConversionUnavailable',
    ]);
    expect(result.settlement.branches).toHaveLength(1);
    expect(result.settlement.branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(4);
    expect(
      result.settlement.branches[0]?.events.some((event) => event.kind === 'conversionToGold'),
    ).toBe(false);
  });

  it('does not let a Contract Blind Box resolve to Hermes', () => {
    const result = settle({
      order: ['infernalContractReward'],
      contract: true,
      contractRewardType: 'BlindBoxLoot',
      contractBlindBoxSource: 'HermesUpgrade',
    });
    expect(result.settlement.branches).toEqual([]);
    expect([...result.findings.values()].map((entry) => entry.finding.code)).toContain(
      'rewardAcquisitionUnavailable',
    );
  });

  it('applies raw-option exclusion identities and unrestricted fallback without conflation', () => {
    const profile = catalog.rewards.shops.byKey.WorldShop;
    if (profile === undefined) throw new Error('missing World Shop profile');
    const authored: readonly AuthoredShopOffer[] = profile.slots.values.map((slot) => ({
      offer: explicitShopOffers[slot.key]!,
    }));
    const facts = baseFacts();
    const hammerExcluded = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      facts,
      {},
      { excludedPurchaseInteractionNames: new Set(['WeaponUpgrade', 'WeaponUpgradeDrop']) },
    );
    expect(
      hammerExcluded.witnesses.every(
        (witness) => !witness.optionKeys.some((key) => key.startsWith('WeaponUpgradeDrop')),
      ),
    ).toBe(true);
    const hermesAuthored = authored.map((offer, index) =>
      index === 0 ? Object.freeze({ offer: { rewardType: 'ShopHermesUpgrade' } }) : offer,
    );
    const hermesExcluded = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      hermesAuthored,
      facts,
      {},
      { excludedPurchaseInteractionNames: new Set(['HermesUpgrade', 'HermesUpgradeDrop']) },
    );
    expect(
      hermesExcluded.witnesses.some((witness) => witness.optionKeys.includes('ShopHermesUpgrade')),
    ).toBe(true);
    const concreteGodExcluded = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      facts,
      {},
      { excludedPurchaseInteractionNames: new Set(['ApolloUpgrade', 'ApolloUpgradeDrop']) },
    );
    expect(
      concreteGodExcluded.witnesses.some((witness) => witness.optionKeys.includes('RandomLoot')),
    ).toBe(false);

    const majorGroup = profile.groups.byKey.MajorNonBoon;
    if (majorGroup === undefined) throw new Error('missing World Shop major group');
    const fullyExcluded = new Set(majorGroup.options.values.map((option) => option.rewardType));
    expect(
      evaluateShopGenerationSupport(
        catalog.rewards,
        profile,
        authored,
        facts,
        {},
        {
          excludedPurchaseInteractionNames: fullyExcluded,
        },
      ).witnesses,
    ).toEqual([]);
    expect(
      evaluateShopGenerationSupport(catalog.rewards, profile, authored, facts).witnesses.length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ['I_WorldShop', 0, 'BoostedRandomLoot'],
    ['Q_WorldShop', 0, 'BoostedRandomLoot'],
  ] as const)(
    'keeps the %s boosted wrapper available while excluding only its concrete source',
    (profileKey, slotIndex, optionKey) => {
      const profile = catalog.rewards.shops.byKey[profileKey];
      if (profile === undefined) throw new Error(`missing ${profileKey}`);
      const constraints = {
        excludedPurchaseInteractionNames: new Set(['ApolloUpgrade', 'ApolloUpgradeDrop']),
      };
      expect(
        findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          slotIndex,
          { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
          baseFacts(),
          {},
          constraints,
        ),
      ).toEqual([]);
      expect(
        findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          slotIndex,
          { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
          baseFacts(),
          {},
          constraints,
        ).some((witness) => witness.optionKeys[slotIndex] === optionKey),
      ).toBe(true);
    },
  );

  it('preserves Q MixedProgress exact indexes and group without-replacement witnesses', () => {
    const profile = catalog.rewards.shops.byKey.Q_WorldShop;
    if (profile === undefined) throw new Error('missing Q World Shop profile');
    const authored: readonly AuthoredShopOffer[] = profile.slots.values.map((slot) => ({
      offer: explicitShopOffers[slot.key]!,
    }));
    expect(profile.slots.values.slice(0, 2).map((slot) => slot.groupKey)).toEqual([
      'MixedProgress',
      'MixedProgress',
    ]);
    const support = evaluateShopGenerationSupport(catalog.rewards, profile, authored, baseFacts());
    expect(support.witnesses.length).toBeGreaterThan(0);
    expect(
      support.witnesses.every((witness) => witness.optionKeys[0] !== witness.optionKeys[1]),
    ).toBe(true);
  });

  it('regenerates a genuine Q Travel refill at the purchased index with fresh peers', () => {
    const maxHealth = createUnresolvedAcquisitionRewardState(
      catalog,
      Object.freeze({ rewardType: 'MaxHealthDrop' as const }),
      { kind: 'shopProfile', key: 'Q_WorldShop' },
    );
    const maxMana = createUnresolvedAcquisitionRewardState(
      catalog,
      Object.freeze({ rewardType: 'MaxManaDrop' as const }),
      { kind: 'shopProfile', key: 'Q_WorldShop' },
    );
    const derived = settle({
      order: ['MixedProgress1'],
      roomGameName: 'Q_PreBoss01',
      travel: true,
      shopOfferOverrides: { MixedProgress1: maxHealth, MixedProgress2: maxMana },
    });
    const refill = derived.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    expect(refill).toMatchObject({ sourceOfferKey: 'MixedProgress1', slotIndex: 0 });
    expect(refill?.rewardTypes).toContain('RandomLoot');
    if (refill === undefined) throw new Error('missing Q Travel refill');
    const refillReward = authoredDerivedReward(
      refill,
      {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
      'Q_WorldShop',
    );
    const settled = settle({
      order: ['MixedProgress1', 'travelDealRefill'],
      roomGameName: 'Q_PreBoss01',
      travel: true,
      travelChild: refillReward,
      shopOfferOverrides: { MixedProgress1: maxHealth, MixedProgress2: maxMana },
    });
    expect([...settled.findings.values()]).toEqual([]);
    expect(settled.settlement.branches).toHaveLength(1);
  });

  it.each([['Q Shop', 'Q_PreBoss01', 4, 'Survival', 'ArmorBigBoost']] as const)(
    'publishes the exact runtime Last Stand fallback for %s without changing the preferred purchase',
    (_label, roomGameName, enteredBiomes, offerKey, fallbackRewardType) => {
      const profileKey = roomGameName === 'Q_PreBoss01' ? 'Q_WorldShop' : 'I_WorldShop';
      const result = settle({
        order: [offerKey],
        roomGameName,
        enteredBiomes,
        shopOfferOverrides: {
          [offerKey]: authoredShopReward(
            Object.freeze({ rewardType: 'LastStandDrop' as const }),
            profileKey,
          ),
        },
      });
      expect(result.settlement.runtimeOfferFallbacks).toEqual([
        expect.objectContaining({
          address: expect.objectContaining({ kind: 'shopOffer', offerKey }),
          preferredRewardType: 'LastStandDrop',
          fallbackRewardType,
        }),
      ]);
      expect(result.settlement.branches[0]?.history.consumableRecord.LastStandDrop).toBe(1);
      expect(
        result.settlement.branches[0]?.history.consumableRecord[fallbackRewardType],
      ).toBeUndefined();
    },
  );

  it('publishes Travel Deal fallback at the later derived action, not the purchased Shop action', () => {
    const preferred = authoredShopReward(
      Object.freeze({ rewardType: 'LastStandDrop' as const }),
      'Q_WorldShop',
    );
    const initial = settle({
      order: ['Survival'],
      roomGameName: 'Q_PreBoss01',
      travel: true,
      shopOfferOverrides: { Survival: preferred },
    });
    const refill = initial.settlement.derivedEntryFrontiers?.find(
      (entry) => entry.kind === 'travelDealRefill',
    );
    if (refill === undefined) throw new Error('missing Travel Deal refill');
    const refillPreferred = authoredDerivedReward(
      refill,
      Object.freeze({ rewardType: 'ArmorBigBoost' as const }),
      'Q_WorldShop',
    );
    const settled = settle({
      order: ['Survival', 'travelDealRefill'],
      roomGameName: 'Q_PreBoss01',
      travel: true,
      travelChild: refillPreferred,
      shopOfferOverrides: { Survival: preferred },
    });
    expect(settled.settlement.runtimeOfferFallbacks).toEqual([
      expect.objectContaining({
        address: expect.objectContaining({ kind: 'shopOffer', offerKey: 'Survival' }),
        preferredRewardType: 'LastStandDrop',
        fallbackRewardType: 'ArmorBigBoost',
      }),
      expect.objectContaining({
        address: expect.objectContaining({
          kind: 'acquisitionEntry',
          entryKey: 'travelDealRefill',
        }),
        preferredRewardType: 'ArmorBigBoost',
        fallbackRewardType: 'HealBigDrop',
      }),
    ]);
  });
});
