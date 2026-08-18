import { catalog } from '@run-planner/hades2-catalog';
import {
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
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
import {
  assessArtificerConversion,
  initializeRewardBranches,
  settleArtificerReplacementAcquisition,
  settleOwnedAcquisitionSite,
  type RewardBranchState,
} from '../../src/simulation/rewards/processing';

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
  rewardType: 'MaxHealthDrop' | 'MaxManaDrop' | 'RoomMoneyDrop' | 'WeaponUpgrade',
) {
  return createUnresolvedAcquisitionRewardState(
    catalog,
    { rewardType },
    {
      kind: 'producerLifecycle',
      key: 'RoomReward',
    },
  );
}

function initialBranches(): readonly RewardBranchState[] {
  const arcanaFear = createArcanaFearState(catalog, artificerLoadout);
  return initializeRewardBranches(
    undefined,
    arcanaFear,
    catalog,
    catalog.defaultStartingKeepsakeKey,
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
