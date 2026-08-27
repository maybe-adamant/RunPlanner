import { catalog } from '@run-planner/hades2-catalog';
import {
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createDefaultAuthoredHexTree,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  applyConcreteAcquisition,
  factsWithHistory,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits';
import {
  artificerStatus,
  createArcanaFearState,
  promoteArcana,
} from '../../src/simulation/arcana-fear';
import { initializeRewardBranches } from '../../src/simulation/rewards/processing';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
  settleArtificerReplacementAcquisition,
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
} from '../../src/simulation/rewards/acquisition-settlement';
import { type RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { createAcquisitionConversionCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { createTraitHistoryState } from '../../src/simulation/traits';
import { installHexTree } from '../../src/simulation/hex-progress';

const biome = createBiomeAddress('Underworld', 'H');
const loadout = createDefaultRouteLoadout(catalog);
const artificerLoadout = Object.freeze({
  ...loadout,
  manualArcanaKeys: Object.freeze(['MetaToRunUpgrade']),
});

function facts(enteredBiomes = 3): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes,
        upgradableTraitCount: 0,
      },
      records: { biomeUseRecord: {}, lootTypeHistory: {}, roomsEntered: {}, useRecord: {} },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 1,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 1,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

function replacement(
  rewardType:
    'MaxHealthDrop' | 'MaxManaDrop' | 'RoomMoneyDrop' | 'WeaponUpgrade' | 'Boon' | 'HermesUpgrade',
) {
  const offer =
    rewardType === 'Boon'
      ? { rewardType, payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' } }
      : { rewardType };
  const unresolved = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'producerLifecycle',
    key: 'RoomReward',
  });
  return rewardType === 'Boon'
    ? Object.freeze({
        ...unresolved,
        traitOffersByAcquisitionRole: Object.freeze({
          ...unresolved.traitOffersByAcquisitionRole,
          source: Object.freeze({
            kind: 'traits' as const,
            giverKey: 'Apollo',
            options: Object.freeze([
              { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
              { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
              { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
      })
    : unresolved;
}

function settleOrdinaryBoon(
  branches: readonly RewardBranchState[],
  index: number,
  traitKey: 'ApolloWeaponBoon' | 'ApolloSpecialBoon',
) {
  const occurrenceId = createOccurrenceId(`ordinary-forfeit-${index}`);
  const origin = createIncomingRewardAddress(biome, occurrenceId);
  const siteOwner = createOccurrenceAddress(biome, occurrenceId);
  const offer = {
    rewardType: 'Boon' as const,
    payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
  };
  const reward = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'producerLifecycle',
    key: 'RoomReward',
  });
  const findings = new Map();
  const settled = settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'source',
      historySequence: index + 1,
      source: {
        origin,
        offer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        roomRewardForfeitEligible: true,
        traitOffersByAcquisitionRole: Object.freeze({
          source: Object.freeze({
            kind: 'traits' as const,
            giverKey: 'Apollo',
            options: Object.freeze([
              { traitKey, rarity: 'Common' as const },
              { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
              { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
        dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole,
        traitContext: artificerLoadout,
      },
    },
    (history) => factsWithHistory(facts(), history, new Set()),
    findings,
  );
  return Object.freeze({ settled, findings, origin });
}

function initialBranches(forfeit = false): readonly RewardBranchState[] {
  const arcanaFear = createArcanaFearState(catalog, {
    ...artificerLoadout,
    fearRanks: Object.freeze({
      ...artificerLoadout.fearRanks,
      ...(forfeit ? { BoonSkipShrineUpgrade: 1 } : {}),
    }),
  });
  return initializeRewardBranches(
    undefined,
    arcanaFear,
    catalog,
    catalog.defaultStartingKeepsakeKey,
  );
}

function withSeaStarAndTimePiece(
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) =>
      Object.freeze({
        ...branch,
        keepsakes: Object.freeze({
          ...branch.keepsakes,
          fatedStatus: 'Fated' as const,
          timePiece: Object.freeze({ remainingCharges: 1 }),
        }),
        traitHistory: Object.freeze({
          ...createTraitHistoryState(),
          equippedTraits: Object.freeze({
            DoubleRewardBoon: Object.freeze({
              traitKey: 'DoubleRewardBoon',
              giverKey: 'Poseidon',
              providerKind: 'olympian' as const,
              rarity: 'Common' as const,
              sourceRole: 'selection' as const,
            }),
          }),
        }),
      }),
    ),
  );
}

function convert(
  branches: readonly RewardBranchState[],
  index: number,
  rewardType: Parameters<typeof replacement>[0],
  deferArtificerReplacement = false,
  enteredBiomes = 3,
) {
  const occurrenceId = createOccurrenceId(`artificer-${index}`);
  const origin = createIncomingRewardAddress(biome, occurrenceId);
  const siteOwner = createOccurrenceAddress(biome, occurrenceId);
  const sourceReward = createUnresolvedAcquisitionRewardState(
    catalog,
    { rewardType: 'GiftDrop' },
    { kind: 'producerLifecycle', key: 'RoomReward' },
  );
  const authored = Object.freeze({
    ...sourceReward,
    dispositionByAcquisitionRole: Object.freeze({
      self: Object.freeze({ kind: 'artificer' as const }),
    }),
  });
  const replacementReward = replacement(rewardType);
  const replacementSite = artificerAcquisitionSite(siteOwner, origin);
  const findings = new Map();
  const generated = settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      historySequence: index + 1,
      source: {
        origin,
        offer: authored.offer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        dispositionByAcquisitionRole: authored.dispositionByAcquisitionRole,
        artificerReplacementByAcquisitionRole: Object.freeze({ self: replacementReward }),
        artificerReplacementSiteByAcquisitionRole: Object.freeze({ self: replacementSite }),
        traitContext: artificerLoadout,
      },
      deferArtificerReplacement: true,
    },
    (history) => factsWithHistory(facts(enteredBiomes), history, new Set()),
    findings,
  );
  const product = deferArtificerReplacement
    ? generated
    : settleArtificerReplacementAcquisition(
        catalog,
        generated.branches,
        {
          siteOwner: replacementSite.owner,
          pointKey: replacementSite.pointKey,
          sourceEntryKey: semanticAddressKey(origin),
          sourceOrigin: origin,
          sourceReward: authored,
          replacement: replacementReward,
          acquisitionRole: 'self',
          participation: 'mandatory',
          historySequence: index + 1,
          facts: (history) => factsWithHistory(facts(enteredBiomes), history, new Set()),
          traitContext: artificerLoadout,
        },
        findings,
      );
  return {
    authored,
    findings,
    origin,
    product,
    replacement: replacementReward,
    replacementSite,
    siteOwner,
  };
}

describe('The Artificer', () => {
  it('keeps Sea Star eligibility at the exact normal duplicate-capable source frontier', () => {
    const [base] = initialBranches();
    const branch = Object.freeze({
      ...base!,
      traitHistory: Object.freeze({
        ...createTraitHistoryState(),
        equippedTraits: Object.freeze({
          DoubleRewardBoon: Object.freeze({
            traitKey: 'DoubleRewardBoon',
            giverKey: 'Poseidon',
            providerKind: 'olympian' as const,
            rarity: 'Common' as const,
            sourceRole: 'selection',
          }),
        }),
      }),
    });
    const source = (
      rewardType: string,
      disposition: 'normal' | 'timePiece' | 'artificer' = 'normal',
      role = 'self',
      instanceProvenance: 'free' | 'paid' = 'free',
    ) =>
      Object.freeze({
        origin: createIncomingRewardAddress(biome, createOccurrenceId(`sea-star-${rewardType}`)),
        offer: Object.freeze({ rewardType }),
        producerLifecycleKey: 'RoomReward',
        instanceProvenance,
        dispositionByAcquisitionRole: Object.freeze({
          [role]: Object.freeze({ kind: disposition }),
        }),
      });
    const resolution = Object.freeze({ role: 'self', lifecyclePoint: 'roomRewardPickup' as const });

    expect(assessSeaStarDuplication(catalog, branch, source('GiftDrop'), resolution)).toMatchObject(
      {
        supported: true,
      },
    );
    expect(
      [branch, base!].map((candidate) =>
        assessSeaStarDuplication(catalog, candidate, source('GiftDrop'), resolution),
      ),
    ).toMatchObject([{ supported: true }, { supported: false }]);
    expect(
      assessSeaStarDuplication(catalog, branch, source('GiftDrop', 'timePiece'), resolution),
    ).toMatchObject({ supported: false, evidence: { normalDisposition: false } });
    expect(
      assessSeaStarDuplication(catalog, branch, source('GiftDrop', 'artificer'), resolution),
    ).toMatchObject({ supported: false, evidence: { normalDisposition: false } });
    expect(
      assessSeaStarDuplication(
        catalog,
        branch,
        source('StackUpgrade', 'normal', 'self', 'paid'),
        resolution,
      ),
    ).toMatchObject({ supported: false, evidence: { instanceProvenance: 'paid' } });
    expect(
      assessSeaStarDuplication(
        catalog,
        branch,
        Object.freeze({
          ...source('Boon', 'normal', 'source'),
          offer: Object.freeze({
            rewardType: 'Boon',
            payload: Object.freeze({ kind: 'BoonSource', source: 'AphroditeUpgrade' }),
          }),
        }),
        Object.freeze({ role: 'source', lifecyclePoint: 'roomRewardPickup' as const }),
      ),
    ).toMatchObject({ supported: false, evidence: { canDuplicate: false } });
    expect(
      assessSeaStarDuplication(
        catalog,
        branch,
        Object.freeze({ ...source('GiftDrop'), blocksSeaStarDuplication: true as const }),
        resolution,
      ),
    ).toMatchObject({ supported: false, evidence: { blocksSeaStarDuplication: true } });
  });

  it('settles the retained Sea Star object as its own optional second pickup and blocks recursion', () => {
    const occurrenceId = createOccurrenceId('sea-star-retained');
    const siteOwner = createOccurrenceAddress(biome, occurrenceId);
    const site = createAcquisitionSiteAddress(siteOwner, 'seaStarDuplicate:test:self');
    const retained = createUnresolvedAcquisitionRewardState(
      catalog,
      { rewardType: 'GiftDrop' },
      { kind: 'producerLifecycle', key: 'RoomReward' },
    );
    const product = settlePickupAcquisitionSite(
      catalog,
      initialBranches(),
      {
        siteOwner,
        site,
        entries: Object.freeze({ seaStarDuplicate: retained }),
        order: Object.freeze(['seaStarDuplicate']),
        producerLifecycleKey: 'RoomReward',
        requiredEntryKeys: new Set(),
        seaStarDuplicateEntryKeys: new Set(['seaStarDuplicate']),
        historySequence: 1,
        facts: (history) => factsWithHistory(facts(), history, new Set()),
      },
      new Map(),
    );
    expect(product.entries[0]?.participation).toBe('optional');
    expect(product.branches[0]?.history.consumableRecord.GiftDrop).toBe(1);
    expect(product.roleFrontiers?.[0]?.source.blocksSeaStarDuplication).toBe(true);
  });

  it('settles a picked Sea Star-recreated Path reward through the shared concrete acquisition', () => {
    const occurrenceId = createOccurrenceId('sea-star-talent-duplicate');
    const siteOwner = createOccurrenceAddress(biome, occurrenceId);
    const site = createAcquisitionSiteAddress(siteOwner, 'seaStarDuplicate:talent:self');
    const retained = createUnresolvedAcquisitionRewardState(
      catalog,
      { rewardType: 'TalentDrop' },
      { kind: 'producerLifecycle', key: 'RoomReward' },
    );
    const [initial] = initialBranches();
    const product = settlePickupAcquisitionSite(
      catalog,
      [
        installHexTree(
          catalog,
          initial!,
          'SpellPolymorphTrait',
          createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait'),
        ),
      ],
      {
        siteOwner,
        site,
        entries: Object.freeze({ seaStarDuplicate: retained }),
        order: Object.freeze(['seaStarDuplicate']),
        producerLifecycleKey: 'RoomReward',
        requiredEntryKeys: new Set(),
        seaStarDuplicateEntryKeys: new Set(['seaStarDuplicate']),
        historySequence: 1,
        facts: (history) => factsWithHistory(facts(), history, new Set()),
      },
      new Map(),
    );
    expect(product.entries[0]?.participation).toBe('optional');
    expect(product.branches[0]?.hexProgress).toMatchObject({
      bankedPathPoints: 0,
      investedPathPoints: 3,
    });
  });

  it('keeps a Sea Star-retained Buried Treasure Bones pickup on its parent lifecycle', () => {
    const occurrenceId = createOccurrenceId('sea-star-buried-bones');
    const siteOwner = createOccurrenceAddress(biome, occurrenceId);
    const site = createAcquisitionSiteAddress(siteOwner, 'seaStarDuplicate:buried-bones:self');
    const retained = createUnresolvedAcquisitionRewardState(
      catalog,
      { rewardType: 'MetaCurrencyDrop' },
      { kind: 'producerLifecycle', key: 'GeneratedTraitPickup' },
    );
    const product = settlePickupAcquisitionSite(
      catalog,
      initialBranches(),
      {
        siteOwner,
        site,
        entries: Object.freeze({ seaStarDuplicate: retained }),
        order: Object.freeze(['seaStarDuplicate']),
        producerLifecycleKey: 'GeneratedTraitPickup',
        requiredEntryKeys: new Set(),
        seaStarDuplicateEntryKeys: new Set(['seaStarDuplicate']),
        historySequence: 1,
        facts: (history) => factsWithHistory(facts(), history, new Set()),
      },
      new Map(),
    );
    const frontier = product.roleFrontiers?.[0];
    if (frontier === undefined) throw new Error('missing retained Bones role frontier');
    expect(frontier.source.producerLifecycleKey).toBe('GeneratedTraitPickup');
    expect(
      assessArtificerConversion(catalog, frontier.branchesBeforeRole[0]!, frontier.source, {
        role: frontier.address.acquisitionRole,
        lifecyclePoint: frontier.lifecyclePoint,
        blocksArtificerConversion: true,
      }),
    ).toMatchObject({ supported: false, evidence: { blocksArtificerConversion: true } });
    const timePieceBranch = Object.freeze({
      ...frontier.branchesBeforeRole[0]!,
      keepsakes: Object.freeze({
        ...frontier.branchesBeforeRole[0]!.keepsakes,
        fatedStatus: 'Fated' as const,
        timePiece: Object.freeze({ remainingCharges: 1 }),
      }),
    });
    expect(
      assessTimePieceConversion(
        catalog,
        timePieceBranch,
        frontier.source,
        frontier.address.acquisitionRole,
        frontier.lifecyclePoint,
      ),
    ).toMatchObject({ supported: true });
  });

  it('requires an exact eligible free source and honors producer overrides', () => {
    const branch = initialBranches()[0]!;
    const origin = createIncomingRewardAddress(biome, createOccurrenceId('artificer-source'));
    const resolution = { role: 'self', lifecyclePoint: 'roomRewardPickup' as const };
    const source = (rewardType: string, instanceProvenance: 'free' | 'paid' = 'free') =>
      Object.freeze({
        origin,
        offer: Object.freeze({ rewardType }),
        producerLifecycleKey: 'RoomReward',
        instanceProvenance,
      });

    expect(
      assessArtificerConversion(catalog, branch, source('GiftDrop'), resolution),
    ).toMatchObject({ supported: true });
    expect(
      assessArtificerConversion(catalog, branch, source('GiftDrop', 'paid'), resolution),
    ).toMatchObject({ supported: false, evidence: { instanceProvenance: 'paid' } });
    expect(
      assessArtificerConversion(catalog, branch, source('RoomMoneyDrop'), resolution),
    ).toMatchObject({
      supported: false,
      evidence: { artificerConversionEligible: false },
    });
    expect(
      assessArtificerConversion(catalog, branch, source('GiftDrop'), {
        ...resolution,
        blocksArtificerConversion: true,
      }),
    ).toMatchObject({
      supported: false,
      evidence: { blocksArtificerConversion: true },
    });
  });

  it.each([0, 1, 2, 3] as const)(
    'owns exact Epic capacity three and preserves %i spent uses when Lazuli adds one capacity',
    (spent) => {
      let branches = initialBranches();
      expect(artificerStatus(catalog, branches[0]!.arcanaFear)).toEqual({
        rarity: 'Epic',
        capacity: 3,
        spent: 0,
        remaining: 3,
      });

      for (const [index, rewardType] of (['MaxHealthDrop', 'MaxManaDrop', 'RoomMoneyDrop'] as const)
        .slice(0, spent)
        .entries()) {
        branches = convert(branches, index, rewardType).product.branches;
      }
      expect(artificerStatus(catalog, branches[0]!.arcanaFear)).toMatchObject({
        capacity: 3,
        spent,
        remaining: 3 - spent,
      });

      const promoted = promoteArcana(catalog, branches[0]!.arcanaFear, ['MetaToRunUpgrade'], {
        owner: createOccurrenceAddress(biome, createOccurrenceId('lazuli')),
        sequence: 100,
      });
      expect(promoted.legal).toBe(true);
      if (!promoted.legal) throw new Error('Lazuli promotion unexpectedly failed');
      expect(artificerStatus(catalog, promoted.state)).toEqual({
        rarity: 'Heroic',
        capacity: 4,
        spent,
        remaining: 4 - spent,
      });
    },
  );

  it('consumes exact RunProgress entries and uses while destroying the source acquisition', () => {
    let branches = initialBranches();
    for (const [index, rewardType] of (
      ['MaxHealthDrop', 'MaxManaDrop', 'RoomMoneyDrop'] as const
    ).entries()) {
      const conversion = convert(branches, index, rewardType);
      expect(conversion.findings.size).toBe(0);
      branches = conversion.product.branches;
    }
    const branch = branches[0]!;
    expect(artificerStatus(catalog, branch.arcanaFear)).toMatchObject({
      capacity: 3,
      spent: 3,
      remaining: 0,
    });
    expect(branch.history.consumableRecord.GiftDrop).toBeUndefined();
    expect(branch.history.consumableRecord).toMatchObject({
      MaxHealthDrop: 1,
      MaxManaDrop: 1,
      RoomMoneyDrop: 1,
    });
    expect(branch.events.filter((event) => event.kind === 'artificerConversion')).toHaveLength(3);
    expect(branch.bags.RunProgress).toBeDefined();

    const exhausted = convert(branches, 4, 'MaxHealthDrop');
    expect([...exhausted.findings.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          finding: expect.objectContaining({ code: 'artificerConversionUnavailable' }),
        }),
      ]),
    );
    expect(exhausted.product.branches[0]?.history.consumableRecord.GiftDrop).toBe(1);
  });

  it.each(['Boon', 'HermesUpgrade'] as const)(
    'forfeits an Artificer-generated %s as a concrete Red Onion after spending both ledgers',
    (replacementType) => {
      const conversion = convert(initialBranches(true), 0, replacementType);
      expect(conversion.findings.size).toBe(0);
      const branch = conversion.product.branches[0];
      if (branch === undefined) throw new Error('Artificer Forfeit branch is missing');

      expect(artificerStatus(catalog, branch.arcanaFear)).toMatchObject({ spent: 1 });
      expect(branch.arcanaFear.fear.forfeitConsumed).toBe(true);
      expect(branch.history.consumableRecord.Boon).toBeUndefined();
      expect(branch.history.consumableRecord.RoomRewardConsolationPrize).toBe(1);
      expect(branch.events).toContainEqual(
        expect.objectContaining({
          kind: 'rewardOffered',
          offer: expect.objectContaining({ rewardType: replacementType }),
        }),
      );
      expect(branch.events).toContainEqual(
        expect.objectContaining({
          kind: 'rewardForfeited',
          rewardType: replacementType,
          replacementRewardType: 'RoomRewardConsolationPrize',
        }),
      );
      expect(branch.events).toContainEqual(
        expect.objectContaining({
          kind: 'concreteAcquisition',
          acquisition: expect.objectContaining({
            acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
          }),
        }),
      );
      expect(branch.events.filter((event) => event.kind === 'artificerConversion')).toHaveLength(1);
    },
  );

  it('projects Time Piece and Sea Star from an ordinary forfeited Red Onion frontier', () => {
    const ordinary = settleOrdinaryBoon(
      withSeaStarAndTimePiece(initialBranches(true)),
      0,
      'ApolloWeaponBoon',
    );
    const frontier = ordinary.settled.roleFrontiers?.find(
      (candidate) => candidate.realizedAcquisitionByBranch !== undefined,
    );
    if (frontier === undefined) throw new Error('ordinary Red Onion frontier is missing');
    const candidates = createAcquisitionConversionCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(frontier.address), [frontier]]]),
    );

    expect(candidates.at(frontier.address)).toMatchObject({
      realizedAcquisition: {
        acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
      },
      timePieceAssessments: [{ supported: true }],
      seaStarAssessments: [{ supported: true }],
    });
  });

  it('projects Time Piece and Sea Star from an Artificer-forfeited Red Onion frontier', () => {
    const conversion = convert(withSeaStarAndTimePiece(initialBranches(true)), 0, 'Boon');
    const frontier = conversion.product.roleFrontiers?.find(
      (candidate) => candidate.realizedAcquisitionByBranch !== undefined,
    );
    if (frontier === undefined) throw new Error('Artificer Red Onion frontier is missing');
    const candidates = createAcquisitionConversionCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(frontier.address), [frontier]]]),
    );

    expect(candidates.at(frontier.address)).toMatchObject({
      realizedAcquisition: {
        acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
      },
      timePieceAssessments: [{ supported: true }],
      seaStarAssessments: [{ supported: true }],
    });
  });

  it('does not substitute either Devotion acquisition role when the RoomReward lane is marked', () => {
    const occurrenceId = createOccurrenceId('devotion-forfeit');
    const siteOwner = createOccurrenceAddress(biome, occurrenceId);
    const site = createAcquisitionSiteAddress(siteOwner, 'roomRewardPickup');
    const entry = createAcquisitionEntryAddress(site, 'source');
    const offer = {
      rewardType: 'Devotion' as const,
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    const reward = createUnresolvedAcquisitionRewardState(catalog, offer, {
      kind: 'producerLifecycle',
      key: 'RoomReward',
    });
    const findings = new Map();
    const seeded = initialBranches(true).map((branch) =>
      Object.freeze({
        ...branch,
        history: Object.freeze({
          ...branch.history,
          lootTypeHistory: Object.freeze({ ApolloUpgrade: 1, ZeusUpgrade: 1 }),
        }),
      }),
    );
    const devotionFacts = (history: Parameters<typeof factsWithHistory>[1]) => {
      const base = facts();
      return factsWithHistory(
        Object.freeze({
          ...base,
          requirements: Object.freeze({ ...base.requirements, offeredExitCount: 2 }),
        }),
        history,
        new Set(),
      );
    };
    const settled = settleOwnedAcquisitionSite(
      catalog,
      seeded,
      {
        siteOwner,
        pointKey: 'roomRewardPickup',
        entryKey: 'source',
        historySequence: 1,
        source: {
          origin: entry,
          offer,
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          roomRewardForfeitEligible: true,
          traitOffersByAcquisitionRole: {
            chosenSource: {
              kind: 'traits',
              giverKey: 'Apollo',
              options: [
                { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
                { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
                { traitKey: 'ApolloCastBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
            },
            spurnedSource: {
              kind: 'traits',
              giverKey: 'Zeus',
              options: [
                { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
                { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
                { traitKey: 'ZeusCastBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
            },
          },
          dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole,
          traitContext: artificerLoadout,
        },
      },
      devotionFacts,
      findings,
    );
    const branch = settled.branches[0];
    if (branch === undefined) throw new Error('Devotion Forfeit branch is missing');
    expect(branch.arcanaFear.fear.forfeitConsumed).toBe(false);
    expect(branch.events.filter((event) => event.kind === 'rewardForfeited')).toEqual([]);
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          ['ApolloUpgrade', 'ZeusUpgrade'].includes(event.acquisition.acquisition.gameName),
      ),
    ).toHaveLength(2);
  });

  it('consumes one Forfeit use across either chronological order of ordinary and Artificer rewards', () => {
    const ordinaryFirst = settleOrdinaryBoon(initialBranches(true), 0, 'ApolloWeaponBoon');
    expect(ordinaryFirst.findings.size).toBe(0);
    const artificerAfter = convert(ordinaryFirst.settled.branches, 1, 'Boon');
    expect(artificerAfter.findings.size).toBe(0);
    const ordinaryFirstBranch = artificerAfter.product.branches[0]!;
    expect(
      ordinaryFirstBranch.events.filter((event) => event.kind === 'rewardForfeited'),
    ).toHaveLength(1);
    expect(ordinaryFirstBranch.arcanaFear.fear.forfeitConsumed).toBe(true);

    const artificerFirst = convert(initialBranches(true), 0, 'Boon');
    expect(artificerFirst.findings.size).toBe(0);
    const ordinaryAfter = settleOrdinaryBoon(
      artificerFirst.product.branches,
      1,
      'ApolloSpecialBoon',
    );
    expect(ordinaryAfter.findings.size).toBe(0);
    const artificerFirstBranch = ordinaryAfter.settled.branches[0]!;
    expect(
      artificerFirstBranch.events.filter((event) => event.kind === 'rewardForfeited'),
    ).toHaveLength(1);
    expect(artificerFirstBranch.arcanaFear.fear.forfeitConsumed).toBe(true);
    expect(artificerFirstBranch.history.consumableRecord.RoomRewardConsolationPrize).toBe(1);
  });

  it('appends one full RunProgress set without discarding excluded leftovers', () => {
    const store = catalog.rewards.stores.byKey.RunProgress;
    if (store === undefined) throw new Error('RunProgress store is missing');
    const before = Object.freeze(
      store.entries.map((entry) =>
        entry.rewardType === 'Devotion' ? 2 : entry.rewardType === 'SpellDrop' ? 3 : 0,
      ),
    );
    const seeded = initialBranches().map((branch) =>
      Object.freeze({
        ...branch,
        bags: Object.freeze({
          ...branch.bags,
          RunProgress: Object.freeze({ remainingEntryCounts: before }),
        }),
      }),
    );

    const converted = convert(seeded, 0, 'RoomMoneyDrop');
    expect([...converted.findings.values()]).toEqual([]);
    const branch = converted.product.branches[0];
    if (branch === undefined) throw new Error('Artificer refill branch is missing');
    const selectedIndex = store.entries.findIndex(
      (entry) => entry.rewardType === 'RoomMoneyDrop' && entry.requirement === undefined,
    );
    if (selectedIndex < 0) throw new Error('base Room Money entry is missing');
    const expected = before.map((count, index) => count + 1 - (index === selectedIndex ? 1 : 0));

    expect(branch.bags.RunProgress?.remainingEntryCounts).toEqual(expected);
    for (const excluded of ['Devotion', 'SpellDrop'] as const) {
      const index = store.entries.findIndex((entry) => entry.rewardType === excluded);
      expect(branch.bags.RunProgress?.remainingEntryCounts[index]).toBe(before[index]! + 1);
      expect(branch.events).not.toContainEqual(
        expect.objectContaining({ kind: 'rewardOffered', offer: { rewardType: excluded } }),
      );
    }
    expect(branch.events).toContainEqual(
      expect.objectContaining({ kind: 'rewardOffered', offer: { rewardType: 'RoomMoneyDrop' } }),
    );
    expect(branch.history.consumableRecord.RoomMoneyDrop).toBe(1);
  });

  it('rejects a Hammer replacement after an earlier Hammer entered acquisition history', () => {
    const seeded = initialBranches().map((branch) =>
      Object.freeze({
        ...branch,
        history: applyConcreteAcquisition(catalog.rewards, branch.history, {
          kind: 'loot',
          gameName: 'WeaponUpgrade',
        }),
      }),
    );
    expect(seeded[0]?.history.lootTypeHistory.WeaponUpgrade).toBe(1);

    const denied = convert(seeded, 1, 'WeaponUpgrade', false, 1);
    expect([...denied.findings.values()]).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'artificerReplacementUnavailable' }),
      }),
    );
    expect(denied.product.branches[0]?.history.lootTypeHistory.WeaponUpgrade).toBe(1);
    expect(
      denied.product.branches[0]?.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          event.acquisition.acquisition.gameName === 'WeaponUpgrade',
      ),
    ).toEqual([]);
  });

  it('separates generation from a later dependent pickup checkpoint', () => {
    const conversion = convert(initialBranches(), 0, 'MaxHealthDrop', true);
    const generated = conversion.product.branches[0]!;
    expect(generated.history.consumableRecord.GiftDrop).toBeUndefined();
    expect(generated.history.consumableRecord.MaxHealthDrop).toBeUndefined();
    expect(artificerStatus(catalog, generated.arcanaFear)?.spent).toBe(1);

    const acquired = settleArtificerReplacementAcquisition(
      catalog,
      conversion.product.branches,
      {
        siteOwner: conversion.replacementSite.owner,
        pointKey: conversion.replacementSite.pointKey,
        sourceEntryKey: semanticAddressKey(conversion.origin),
        sourceOrigin: conversion.origin,
        sourceReward: conversion.authored,
        replacement: conversion.replacement,
        acquisitionRole: 'self',
        participation: 'mandatory',
        historySequence: 2,
        facts: (history) => factsWithHistory(facts(), history, new Set()),
      },
      conversion.findings,
    );
    expect(acquired.branches[0]?.history.consumableRecord.MaxHealthDrop).toBe(1);
    expect(acquired.entries[0]?.address).toEqual(
      createAcquisitionEntryAddress(
        conversion.replacementSite,
        artificerReplacementEntryKey(conversion.origin, 'self'),
      ),
    );
    expect(acquired.entries[0]?.participation).toBe('mandatory');
  });
});
