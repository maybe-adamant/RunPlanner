import { catalog } from '@run-planner/hades2-catalog';
import {
  acquisitionSiteStorageKey,
  applyProjectHistoryCommand,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionRoleAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
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
} from '@run-planner/engine/authored-project';
import {
  createRewardHistoryState,
  factsWithHistory,
  recordLootTypeHistorySource,
  type ResolvedRewardOffer,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';
import { createDefaultRoomState } from '../../src/authored-project/room-state/defaults';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createTestArcanaFearState, initializeTestRewardBranches } from '../support/arcana-fear';
import { createDefaultRoomEncounterState } from '../../src/authored-project/room-state/encounters';
import { createNormalDispositionByAcquisitionRole } from '../../src/authored-project/reward-state';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
} from '../../src/authored-project/shop';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms';
import {
  createDerivedAcquisitionEntryCandidateArtifacts,
  createLevelResolutionCandidateArtifacts,
} from '../../src/simulation/candidate-artifacts';
import {
  processShopInventory,
  settleShopAcquisitionSite,
} from '../../src/simulation/rewards/processing';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitOfferEvent,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { simulateProject } from '../../src/simulation';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  createRepresentativeNOPQShopTraitProject,
  createGoldenFGHIProject,
  goldenFBiome,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';

const explicitWorldShopOffers: Readonly<Record<string, ResolvedRewardOffer>> = Object.freeze({
  Boon: Object.freeze({
    rewardType: 'RandomLoot',
    payload: Object.freeze({ kind: 'BoonSource', source: 'ApolloUpgrade' }),
  }),
  MajorNonBoon: Object.freeze({ rewardType: 'MaxHealthDrop' }),
  Minor: Object.freeze({ rewardType: 'MaxManaDrop' }),
});

const biome = createBiomeAddress('Underworld', 'F');
const shopId = createOccurrenceId('stale-purchased-hammer-shop');

const settleShop = (
  branches: Parameters<typeof settleShopAcquisitionSite>[0],
  context: Parameters<typeof settleShopAcquisitionSite>[1],
  findings: Parameters<typeof settleShopAcquisitionSite>[2],
) => settleShopAcquisitionSite(branches, context, findings).branches;

function baseFacts(): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: {},
        lootTypeHistory: {},
        roomsEntered: {},
        useRecord: {},
      },
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

function pomTargetHistory() {
  const event: TraitOfferEvent = {
    kind: 'traitOffer',
    owner: { kind: 'project' },
    acquisitionRole: 'seed',
    sequence: 1,
    giverKey: 'Apollo',
    options: Object.freeze([
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]) as TraitOfferEvent['options'],
    selectedOptionKey: 'option1',
    acquisitionPoint: 'seed',
  };
  return foldTraitHistoryEvents(catalog, [event]);
}

function echoGoldHistory() {
  return foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'echoSelection',
      sequence: 1,
      giverKey: 'Echo',
      options: Object.freeze([{ traitKey: 'EchoDoubleShop' }]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'encounterCompleted',
      acquisitionIdentity: 'echo-gold-use',
    }),
  ]);
}

const allTogetherResult = Object.freeze({
  earth: 'ElementalOlympianDamageBoon',
  fire: 'ElementalBaseDamageBoon',
  air: 'ElementalDamageFloorBoon',
  water: 'ElementalHealthBoon',
});

function allTogetherOffer() {
  return Object.freeze({
    kind: 'traits' as const,
    giverKey: 'Hera',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'AllElementalBoon',
        rarity: 'Legendary' as const,
        allTogetherResult,
      }),
      Object.freeze({ traitKey: 'HeraManaBoon', rarity: 'Rare' as const }),
      Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Rare' as const }),
    ]) as TraitOfferEvent['options'],
    selectedOptionKey: 'option1' as const,
    rarificationActions: Object.freeze([]),
  });
}

function allTogetherReward() {
  const offer = Object.freeze({
    rewardType: 'RandomLoot' as const,
    payload: Object.freeze({ kind: 'BoonSource' as const, source: 'HeraUpgrade' }),
  });
  const base = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: 'WorldShop',
  });
  return Object.freeze({
    ...base,
    traitOffersByAcquisitionRole: Object.freeze({ source: allTogetherOffer() }),
  });
}

function shopPomReward(targetTraitKey: string) {
  const offer = Object.freeze({ rewardType: 'StackUpgrade' as const });
  const base = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: 'WorldShop',
  });
  return Object.freeze({
    ...base,
    traitOffersByAcquisitionRole: Object.freeze({}),
    levelResolutionsByAcquisitionRole: Object.freeze({
      self: Object.freeze({
        kind: 'choice' as const,
        offeredTraitKeys: Object.freeze([targetTraitKey]),
        selectedTraitKey: targetTraitKey,
      }),
    }),
  });
}

function shopBoonReward(source: string, traitKey: string) {
  const giverKey = source.replace('Upgrade', '');
  const optionKeys = [
    `${giverKey}WeaponBoon`,
    `${giverKey}SpecialBoon`,
    `${giverKey}CastBoon`,
  ] as const;
  const selectedOptionKey = `option${(optionKeys as readonly string[]).indexOf(traitKey) + 1}` as
    'option1' | 'option2' | 'option3';
  const offer = Object.freeze({
    rewardType: 'RandomLoot' as const,
    payload: Object.freeze({ kind: 'BoonSource' as const, source }),
  });
  const base = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: 'WorldShop',
  });
  return Object.freeze({
    ...base,
    traitOffersByAcquisitionRole: Object.freeze({
      source: Object.freeze({
        kind: 'traits' as const,
        giverKey,
        options: Object.freeze([
          Object.freeze({ traitKey: optionKeys[0], rarity: 'Rare' as const }),
          Object.freeze({ traitKey: optionKeys[1], rarity: 'Rare' as const }),
          Object.freeze({ traitKey: optionKeys[2], rarity: 'Rare' as const }),
        ]) as TraitOfferEvent['options'],
        selectedOptionKey,
      }),
    }),
  });
}

function blindBoxReward(
  source: string,
  traitKeys: readonly [string, string, string],
  selectedOptionKey: 'option1' | 'option2' | 'option3',
) {
  const offer = Object.freeze({
    rewardType: 'BlindBoxLoot' as const,
    payload: Object.freeze({ kind: 'BoonSource' as const, source }),
  });
  const base = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: 'WorldShop',
  });
  return Object.freeze({
    ...base,
    traitOffersByAcquisitionRole: Object.freeze({
      hiddenSource: Object.freeze({
        kind: 'traits' as const,
        giverKey: source.replace('Upgrade', ''),
        options: Object.freeze(
          traitKeys.map((traitKey) => Object.freeze({ traitKey, rarity: 'Common' as const })),
        ) as TraitOfferEvent['options'],
        selectedOptionKey,
      }),
    }),
  });
}

function completeShopFixtureReward(
  offer: ResolvedRewardOffer,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  profileKey = 'WorldShop',
) {
  if (offer.rewardType === 'RandomLoot' && offer.payload?.kind === 'BoonSource') {
    const giverKey = offer.payload.source.replace('Upgrade', '');
    return shopBoonReward(offer.payload.source, `${giverKey}WeaponBoon`);
  }
  const base = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'shopProfile',
    key: profileKey,
  });
  return Object.freeze({
    ...base,
    ...(base.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : {
          levelResolutionsByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.keys(base.levelResolutionsByAcquisitionRole).map((role) => [
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

function completeWorldShopOffers(
  shop: NonNullable<Extract<ReturnType<typeof createDefaultRoomState>, { kind: 'shop' }>['shop']>,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  overrides: Readonly<
    Record<string, ReturnType<typeof createUnresolvedAcquisitionRewardState>>
  > = {},
) {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(shop.offers).map((offerKey) => {
        const override = overrides[offerKey];
        const offer = explicitWorldShopOffers[offerKey];
        if (override === undefined && offer === undefined) {
          throw new Error(`missing complete fixture reward for Shop offer ${offerKey}`);
        }
        return [
          offerKey,
          Object.freeze({
            reward: override ?? completeShopFixtureReward(offer!, loadout, shop.profileKey),
          }),
        ];
      }),
    ),
  ) as typeof shop.offers;
}

function allTogetherHistory(withEarth: boolean, withEcho: boolean): TraitHistoryState {
  const event = (sequence: number, giverKey: string, traitKey: string): TraitOfferEvent =>
    Object.freeze({
      kind: 'traitOffer',
      owner: { kind: 'project' as const },
      acquisitionRole: 'seed',
      sequence,
      giverKey,
      options: Object.freeze([{ traitKey, rarity: 'Common' }]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: `seed:${sequence}`,
    });
  return foldTraitHistoryEvents(catalog, [
    ...(withEcho ? echoGoldHistory().events : []),
    event(2, 'Hera', 'HeraWeaponBoon'),
    event(3, 'Hera', 'CommonGlobalDamageBoon'),
    event(4, 'Hera', 'DamageSharePotencyBoon'),
    ...(withEarth ? [event(5, 'Hephaestus', 'HephaestusManaBoon')] : []),
  ]);
}

function divergentAllTogetherBranches(withEcho: boolean, lootSources: readonly string[]) {
  const initial = initializeTestRewardBranches()[0]!;
  return [allTogetherHistory(false, withEcho), allTogetherHistory(true, withEcho)].map((traits) => {
    const rewardHistory = lootSources.reduce(
      (history, source) => recordLootTypeHistorySource(history, source),
      initial.history,
    );
    return Object.freeze({
      ...initial,
      history: attachTraitHistory(rewardHistory, traits),
      traitHistory: traits,
    });
  });
}

function echoGoldShop(
  order: readonly string[],
  options: {
    readonly replaceMinorWithSpell?: boolean;
    readonly includeDuplicate?: boolean;
    readonly duplicateConversion?: 'normal' | 'gold' | 'artificer';
    readonly duplicateSelectOption2?: boolean;
    readonly timePiece?: boolean;
    readonly initialBranches?: Parameters<typeof processShopInventory>[0];
    readonly occurrenceId?: ReturnType<typeof createOccurrenceId>;
    readonly offerOverrides?: Readonly<Record<string, ResolvedRewardOffer>>;
    readonly duplicateOffer?: ResolvedRewardOffer;
    readonly duplicateRewardOverride?: ReturnType<typeof createUnresolvedAcquisitionRewardState>;
    readonly rewardOverrides?: Readonly<
      Record<string, ReturnType<typeof createUnresolvedAcquisitionRewardState>>
    >;
    readonly duplicateTraitKeys?: readonly [string, string, string];
    readonly withPomTarget?: boolean;
  } = {},
) {
  const room = catalog.rooms.byKey.F_Shop01;
  if (room === undefined) throw new Error('missing F Shop declaration');
  const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
  const baseState = createDefaultRoomState(catalog, room, {
    role: 'ordinary',
    entryActive: true,
    loadout,
  });
  if (baseState.kind !== 'shop' || baseState.shop === undefined)
    throw new Error('missing active Shop');
  const spellOffer = Object.freeze({ rewardType: 'SpellDrop' as const });
  const offerOverrides: Readonly<Record<string, ResolvedRewardOffer>> = {
    ...(options.replaceMinorWithSpell ? { Minor: spellOffer } : {}),
    ...(options.offerOverrides ?? {}),
  };
  const shop: NonNullable<typeof baseState.shop> = Object.freeze({
    ...baseState.shop,
    offers: Object.freeze(
      Object.fromEntries(
        Object.entries(baseState.shop.offers).map(([key]) => {
          const override = offerOverrides[key];
          const rewardOverride = options.rewardOverrides?.[key];
          const explicitOffer = override ?? explicitWorldShopOffers[key];
          if (rewardOverride === undefined && explicitOffer === undefined) {
            throw new Error(`missing explicit World Shop fixture offer for ${key}`);
          }
          return [
            key,
            rewardOverride === undefined
              ? Object.freeze({
                  reward: completeShopFixtureReward(
                    explicitOffer!,
                    loadout,
                    baseState.shop!.profileKey,
                  ),
                })
              : Object.freeze({ reward: rewardOverride }),
          ];
        }),
      ),
    ),
  });
  const sourceKey = order.find((key) => shop.offers[key]?.reward?.offer.rewardType !== 'SpellDrop');
  const duplicateKey = sourceKey === undefined ? undefined : ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY;
  const source = sourceKey === undefined ? undefined : shop.offers[sourceKey]?.reward;
  const duplicateOffer =
    source === undefined || source === null
      ? undefined
      : (options.duplicateOffer ?? echoShopDuplicateOffer(catalog, source.offer));
  const duplicate =
    options.duplicateRewardOverride ??
    (duplicateOffer === undefined || duplicateOffer === null
      ? undefined
      : completeShopFixtureReward(duplicateOffer, loadout, shop.profileKey));
  const selectedDuplicate =
    duplicate === undefined || options.duplicateSelectOption2 !== true
      ? duplicate
      : Object.freeze({
          ...duplicate,
          traitOffersByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.entries(duplicate.traitOffersByAcquisitionRole).map(([role, offer]) => [
                role,
                offer?.kind === 'traits' && offer.options[1] !== undefined
                  ? Object.freeze({
                      ...offer,
                      options: Object.freeze(
                        (
                          options.duplicateTraitKeys ?? [
                            'ApolloManaBoon',
                            'ApolloSpecialBoon',
                            'ApolloCastBoon',
                          ]
                        ).map((traitKey) => Object.freeze({ traitKey, rarity: 'Common' as const })),
                      ) as typeof offer.options,
                      selectedOptionKey: 'option2' as const,
                    })
                  : offer,
              ]),
            ),
          ),
        });
  const duplicateValue =
    selectedDuplicate === undefined || options.duplicateConversion === undefined
      ? selectedDuplicate
      : Object.freeze({
          ...selectedDuplicate,
          dispositionByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.keys(selectedDuplicate.dispositionByAcquisitionRole).map((role) => [
                role,
                options.duplicateConversion === 'gold'
                  ? ({ kind: 'timePiece' } as const)
                  : options.duplicateConversion === 'artificer'
                    ? ({ kind: 'artificer' } as const)
                    : ({ kind: 'normal' } as const),
              ]),
            ),
          ),
        });
  const occurrenceId = options.occurrenceId ?? shopId;
  const occurrenceAddress = createOccurrenceAddress(biome, occurrenceId);
  const duplicateSource = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(occurrenceAddress, 'roomExit'),
    ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  );
  const replacementSite = artificerAcquisitionSite(occurrenceAddress, duplicateSource);
  const replacementSiteKey = acquisitionSiteStorageKey(replacementSite);
  const replacementKey = artificerReplacementEntryKey(duplicateSource, 'self');
  const replacement = createUnresolvedAcquisitionRewardState(
    catalog,
    { rewardType: 'MaxHealthDrop' },
    { kind: 'producerLifecycle', key: 'RoomReward' },
  );
  const authoredOrder =
    options.includeDuplicate !== true || duplicateKey === undefined || order.includes(duplicateKey)
      ? order
      : (() => {
          const sourceIndex = order.indexOf(sourceKey!);
          return Object.freeze([
            ...order.slice(0, sourceIndex + 1),
            duplicateKey,
            ...order.slice(sourceIndex + 1),
          ]);
        })();
  const occurrence = Object.freeze({
    occurrenceId,
    gameName: room.gameName,
    state: Object.freeze({ ...baseState, shop }),
    acquisitionSites: Object.freeze({
      roomExit: Object.freeze({
        ...(options.includeDuplicate !== true ||
        duplicateKey === undefined ||
        duplicateValue === undefined
          ? {}
          : { pickupEntries: Object.freeze({ [duplicateKey]: duplicateValue }) }),
      }),
      ...(options.duplicateConversion !== 'artificer'
        ? {}
        : {
            [replacementSiteKey]: Object.freeze({
              pickupEntries: Object.freeze({ [replacementKey]: replacement }),
            }),
          }),
    }),
    encounters: createDefaultRoomEncounterState(catalog, room, 'echo-gold-shop.encounters'),
    additionalExits: Object.freeze([]),
    roomActions: Object.freeze({
      order: Object.freeze(
        authoredOrder.map((entryKey) =>
          shop.offers[entryKey] !== undefined
            ? { kind: 'interactShopOffer' as const, offerKey: entryKey }
            : { kind: 'interactAcquisitionEntry' as const, siteKey: 'roomExit', entryKey },
        ),
      ),
    }),
  });
  const canonical = materializeAuthoredRoom({
    catalog,
    biome,
    room,
    occurrence,
    role: 'ordinary',
    entered: true,
    lifecycleProfileKey: 'WorldShopRoom',
    loadout,
  });
  const echoTraits = echoGoldHistory();
  const traits =
    options.withPomTarget === true
      ? foldTraitHistoryEvents(catalog, [...echoTraits.events, ...pomTargetHistory().events])
      : echoTraits;
  const seeded =
    options.initialBranches ??
    initializeTestRewardBranches(
      options.duplicateConversion === 'artificer'
        ? createArcanaFearState(catalog, {
            ...createDefaultRouteLoadout(catalog),
            manualArcanaKeys: Object.freeze(['MetaToRunUpgrade']),
          })
        : undefined,
    ).map((branch) =>
      Object.freeze({
        ...branch,
        history: attachTraitHistory(branch.history, traits),
        traitHistory: traits,
        ...(options.timePiece
          ? { keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear) }
          : {}),
      }),
    );
  const facts = (
    history: ReturnType<typeof createRewardHistoryState>,
    currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
  ) => factsWithHistory(baseFacts(), history, currentRoomShopOptionNames);
  const inventoryFindings = new Map();
  const inventory = processShopInventory(
    seeded,
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
    inventoryFindings,
  );
  const findings = new Map();
  const settlement = settleShopAcquisitionSite(
    inventory,
    {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 3,
      order: authoredOrder,
      facts,
      fail: (detail) => {
        throw new Error(detail);
      },
    },
    findings,
  );
  return {
    canonical,
    duplicateKey,
    replacementKey,
    findings,
    inventory,
    inventoryFindings,
    settlement,
  };
}

describe('Echo Gate D Gold Gold Gold', () => {
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
      includeDuplicate: true,
      duplicateSelectOption2: true,
    });
    const branch = result.settlement.branches[0];
    expect(branch?.history.consumableRecord).toMatchObject({ SpellDrop: 1 });
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
        : result.canonical.pickupSite?.entries[result.duplicateKey]?.traitOffersByAcquisitionRole
            .hiddenSource,
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

describe('Shop trait acquisition processing', () => {
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
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
      }),
    );
    const inventory = processShopInventory(
      seeded,
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
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
    expect(unpurchased[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);

    const purchasedCanonical = materializeAuthoredRoom({
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
    const purchasedInventory = processShopInventory(
      seeded,
      {
        catalog,
        room: purchasedCanonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
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
    expect(purchased[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(2);

    const giftCanonical = materializeAuthoredRoom({
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
      processShopInventory(
        seeded,
        {
          catalog,
          room: giftCanonical,
          declaration: room,
          historySequence: 1,
          facts,
          fail: (detail) => {
            throw new Error(detail);
          },
        },
        new Map(),
      ),
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
    expect(giftPurchased[0]?.history.consumableRecord.GiftDrop).toBe(1);
    expect(giftPurchased[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
    expect(
      giftPurchased[0]?.traitHistory?.events.some((event) => event.kind === 'levelMutation'),
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
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
      });
    });
    const inventory = processShopInventory(
      seeded,
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      new Map(),
    );
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
    expect(branch?.traitHistory?.events.some((event) => event.kind === 'levelMutation')).toBe(
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
          history: attachTraitHistory(branch.history, traitHistory),
          traitHistory,
        });
      });
      const inventory = processShopInventory(
        seeded,
        {
          catalog,
          room: canonical,
          declaration: room,
          historySequence: 1,
          facts,
          fail: (detail) => {
            throw new Error(detail);
          },
        },
        new Map(),
      );
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
      const result = purchased[0]?.traitHistory;
      expect(result?.equippedTraits[expectedTraitKey]).toMatchObject({ level: expectedLevel });
      expect(result?.equippedTraits.ApolloWeaponBoon).toBeUndefined();
      expect(purchased[0]?.arcanaFear.fear.forfeitConsumed).toBe(false);
    },
  );

  it('folds a purchased P Shop Hammer at its exact shop owner and purchase lifecycle', () => {
    const project = createRepresentativeNOPQShopTraitProject();
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('valid');
    const surface = evaluation.routes.find((route) => route.routeKey === 'Surface');
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
    const event = branch.traitHistory?.events.find(
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
    expect(branch.traitHistory?.equippedTraits[selected.traitKey]).toMatchObject({
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
  }, 10_000);

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
    const inventory = processShopInventory(
      initializeTestRewardBranches(),
      {
        catalog,
        room: canonical,
        declaration: room,
        historySequence: 1,
        facts,
        fail: (detail) => {
          throw new Error(detail);
        },
      },
      inventoryFindings,
    );
    expect(inventoryFindings).toHaveLength(0);
    expect(inventory).not.toHaveLength(0);

    const purchaseFindings = new Map();
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
      purchaseFindings,
    );
    const purchasedBranch = purchased[0];
    expect([...purchaseFindings.values()].map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'wrongHammerLoadout',
        origin: expect.objectContaining({ owner: major.offerOrigin }),
      }),
    );
    expect(purchasedBranch?.traitHistory?.events).toHaveLength(0);
    const weaponUpgradeOffer = major.traitOffersByAcquisitionRole?.weaponUpgrade;
    if (weaponUpgradeOffer?.kind !== 'traits') throw new Error('weapon upgrade must offer traits');
    expect(
      purchasedBranch?.traitHistory?.equippedTraits[weaponUpgradeOffer.options[0]?.traitKey ?? ''],
    ).toBeUndefined();
  });
});
