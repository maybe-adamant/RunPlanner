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
import { createDefaultRoomEncounterState } from '../../src/authored-project/room-state/encounter-envelope';
import { createNormalDispositionByAcquisitionRole } from '../../src/authored-project/reward-state';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
} from '../../src/authored-project/shop';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms';
import { createDerivedAcquisitionEntryCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { createLevelResolutionCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import {
  processShopInventory,
  settleShopAcquisitionSite,
} from '../../src/simulation/rewards/shop-settlement';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/selected-trait-products';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitOfferEvent,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { simulateProject } from '../../src/simulation';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import {
  createRepresentativeNOPQShopTraitProject,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
export {
  catalog,
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
  createRewardHistoryState,
  factsWithHistory,
  recordLootTypeHistorySource,
  describe,
  expect,
  it,
  createDefaultRoomState,
  createDefaultRouteLoadout,
  createTestArcanaFearState,
  initializeTestRewardBranches,
  createDefaultRoomEncounterState,
  createNormalDispositionByAcquisitionRole,
  createUnresolvedAcquisitionRewardState,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
  materializeAuthoredRoom,
  createDerivedAcquisitionEntryCandidateArtifacts,
  createLevelResolutionCandidateArtifacts,
  processShopInventory,
  settleShopAcquisitionSite,
  selectedTraitOfferProducts,
  attachTraitHistory,
  foldTraitHistoryEvents,
  createKeepsakeState,
  simulateProject,
  createArcanaFearState,
  createGoldenFGHIProject,
  goldenFBiome,
  createRepresentativeNOPQShopTraitProject,
  pBiome,
  pOccurrenceIds,
};
export type { ResolvedRewardOffer, RewardKernelFacts, TraitOfferEvent, TraitHistoryState };

export const explicitWorldShopOffers: Readonly<Record<string, ResolvedRewardOffer>> = Object.freeze(
  {
    Boon: Object.freeze({
      rewardType: 'RandomLoot',
      payload: Object.freeze({ kind: 'BoonSource', source: 'ApolloUpgrade' }),
    }),
    MajorNonBoon: Object.freeze({ rewardType: 'MaxHealthDrop' }),
    Minor: Object.freeze({ rewardType: 'MaxManaDrop' }),
  },
);
export const explicitIWorldShopOffers: Readonly<Record<string, ResolvedRewardOffer>> =
  Object.freeze({
    BoostedBoon: Object.freeze({
      rewardType: 'RandomLoot',
      payload: Object.freeze({ kind: 'BoonSource', source: 'ApolloUpgrade' }),
    }),
    MixedProgress: Object.freeze({ rewardType: 'MaxHealthDrop' }),
    Survival: Object.freeze({ rewardType: 'HealBigDrop' }),
    PremiumProgress: Object.freeze({ rewardType: 'MaxHealthDropBig' }),
    MetaProgress: Object.freeze({ rewardType: 'CardUpgradePointsDrop' }),
  });

export const biome = createBiomeAddress('Underworld', 'F');
export const shopId = createOccurrenceId('stale-purchased-hammer-shop');

export const settleShop = (
  branches: Parameters<typeof settleShopAcquisitionSite>[0],
  context: Parameters<typeof settleShopAcquisitionSite>[1],
  findings: Parameters<typeof settleShopAcquisitionSite>[2],
) => settleShopAcquisitionSite(branches, context, findings).branches;

export function baseFacts(): RewardKernelFacts {
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

export function pomTargetHistory() {
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

export function echoGoldHistory() {
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

export const allTogetherResult = Object.freeze({
  earth: 'ElementalOlympianDamageBoon',
  fire: 'ElementalBaseDamageBoon',
  air: 'ElementalDamageFloorBoon',
  water: 'ElementalHealthBoon',
});

export function allTogetherOffer() {
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

export function allTogetherReward() {
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

export function shopPomReward(targetTraitKey: string) {
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

export function shopBoonReward(source: string, traitKey: string) {
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

export function blindBoxReward(
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

export function completeShopFixtureReward(
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
    ...(offer.rewardType !== 'SpellDrop'
      ? {}
      : {
          traitOffersByAcquisitionRole: Object.freeze({
            self: Object.freeze({
              kind: 'traits' as const,
              giverKey: 'SpellDrop',
              options: Object.freeze([
                { traitKey: 'SpellPolymorphTrait' },
                { traitKey: 'SpellMeteorTrait' },
                { traitKey: 'SpellTransformTrait' },
              ] as const),
              selectedOptionKey: 'option1' as const,
              rarificationActions: Object.freeze([]),
            }),
          }),
        }),
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

export function completeWorldShopOffers(
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

export function allTogetherHistory(withEarth: boolean, withEcho: boolean): TraitHistoryState {
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

export function divergentAllTogetherBranches(withEcho: boolean, lootSources: readonly string[]) {
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

export function echoGoldShop(
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
    readonly roomGameName?: 'F_Shop01' | 'I_PreBoss02';
    readonly enteredBiomes?: number;
  } = {},
) {
  const room = catalog.rooms.byKey[options.roomGameName ?? 'F_Shop01'];
  if (room === undefined) throw new Error('missing F Shop declaration');
  const roomBiome = room.gameName === 'I_PreBoss02' ? createBiomeAddress('Underworld', 'I') : biome;
  const loadout = { weaponKey: 'WeaponStaff', aspectKey: 'StaffBase' };
  const baseState = createDefaultRoomState(catalog, room, {
    role: room.gameName === 'I_PreBoss02' ? 'prebossShop' : 'ordinary',
    entryActive: true,
    loadout,
  });
  if (baseState.kind !== 'shop' || baseState.shop === undefined)
    throw new Error('missing active Shop');
  const spellOffer = Object.freeze({ rewardType: 'SpellDrop' as const });
  const spellReward =
    options.replaceMinorWithSpell === true
      ? completeShopFixtureReward(spellOffer, loadout, baseState.shop.profileKey)
      : undefined;
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
          const rewardOverride =
            options.rewardOverrides?.[key] ?? (key === 'Minor' ? spellReward : undefined);
          const explicitOffer =
            override ??
            (room.gameName === 'I_PreBoss02'
              ? explicitIWorldShopOffers[key]
              : explicitWorldShopOffers[key]);
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
  const occurrenceAddress = createOccurrenceAddress(roomBiome, occurrenceId);
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
    biome: roomBiome,
    room,
    occurrence,
    role: room.gameName === 'I_PreBoss02' ? 'prebossShop' : 'ordinary',
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
  ) =>
    factsWithHistory(
      room.gameName === 'I_PreBoss02'
        ? {
            ...baseFacts(),
            requirements: {
              ...baseFacts().requirements,
              counters: {
                ...baseFacts().requirements.counters,
                enteredBiomes: options.enteredBiomes ?? 3,
              },
            },
          }
        : baseFacts(),
      history,
      currentRoomShopOptionNames,
    );
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
