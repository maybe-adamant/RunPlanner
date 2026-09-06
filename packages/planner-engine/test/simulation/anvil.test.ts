import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, resolveAcquisitionRole } from '@run-planner/engine/reward-kernel';

import { createTestArcanaFearState, initializeTestRewardBranches } from '../support/arcana-fear';
import { baseFacts } from './shop-trait-purchase-support';
import { applyProducerRoleHistory } from '../../src/simulation/rewards/acquisition-settlement';
import { createAnvilCandidateCapability } from '../../src/simulation/rewards/anvil-settlement';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';

const context = Object.freeze({
  weaponKey: 'WeaponStaffSwing',
  aspectKey: 'BaseStaffAspect',
});

function historyWithHammers(...traitKeys: readonly string[]) {
  return foldTraitHistoryEvents(
    catalog,
    traitKeys.map((traitKey, index) =>
      Object.freeze({
        kind: 'traitOffer' as const,
        owner: Object.freeze({ kind: 'project' as const }),
        acquisitionRole: `hammer${index + 1}`,
        sequence: index + 1,
        giverKey: 'WeaponUpgrade',
        options: Object.freeze([
          Object.freeze({ traitKey }),
          Object.freeze({ traitKey: 'StaffLongAttackTrait' }),
          Object.freeze({ traitKey: 'StaffJumpSpecialTrait' }),
        ]) as readonly [
          { readonly traitKey: string },
          { readonly traitKey: string },
          { readonly traitKey: string },
        ],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'pickup',
      }),
    ),
  );
}

function branchWithHammerFrontier(traitKey: string, experimentalHammerTraitKey?: string) {
  const branch = initializeTestRewardBranches(createTestArcanaFearState())[0]!;
  const traitHistory = historyWithHammers(
    traitKey,
    ...(experimentalHammerTraitKey === undefined ? [] : [experimentalHammerTraitKey]),
  );
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    ...(experimentalHammerTraitKey === undefined
      ? {}
      : {
          keepsakes: Object.freeze({
            ...branch.keepsakes,
            experimentalHammers: Object.freeze([
              Object.freeze({
                traitKey: experimentalHammerTraitKey,
                remainingUses: 7,
                acquisitionIdentity: 'keepsake:experimental-hammer',
                active: true,
              }),
            ]),
          }),
        }),
  });
}

function anvilCapabilityFor(branch: ReturnType<typeof branchWithHammerFrontier>) {
  const biome = createBiomeAddress('Surface', 'Q');
  const occurrence = createOccurrenceAddress(biome, createOccurrenceId('anvil-candidates'));
  const site = createAcquisitionSiteAddress(occurrence, 'shopPurchase');
  const entry = createAcquisitionEntryAddress(site, 'anvil');
  return createAnvilCandidateCapability(catalog, [
    Object.freeze({
      address: createAcquisitionRoleAddress(entry, 'self'),
      branchesBeforeRole: Object.freeze([branch]),
      source: Object.freeze({
        offer: Object.freeze({ rewardType: 'ChaosWeaponUpgrade' }),
        traitContext: context,
      }),
    }),
  ]);
}

describe('Anvil of Fates acquisition settlement', () => {
  it('atomically removes the authored permanent Hammer and adds two distinct legal Hammers', () => {
    const biome = createBiomeAddress('Surface', 'Q');
    const occurrence = createOccurrenceAddress(biome, createOccurrenceId('anvil-shop'));
    const owner = createShopOfferAddress(biome, occurrence.occurrenceId, 'PremiumProgress');
    const site = createAcquisitionSiteAddress(occurrence, 'shopPurchase');
    const entry = createAcquisitionEntryAddress(site, 'anvil');
    const offer = Object.freeze({ rewardType: 'ChaosWeaponUpgrade' as const });
    const role = resolveAcquisitionRole(catalog.rewards, offer, 'self', 'purchase');
    const beforeTraits = historyWithHammers('StaffDoubleAttackTrait');
    const branches = initializeTestRewardBranches(createTestArcanaFearState()).map((branch) =>
      Object.freeze({
        ...branch,
        history: attachTraitHistory(branch.history, beforeTraits),
        traitHistory: beforeTraits,
      }),
    );
    const findings = new Map();
    const result = applyProducerRoleHistory(
      catalog,
      branches,
      Object.freeze({
        origin: owner,
        offer,
        producerLifecycleKey: 'Q_WorldShop',
        instanceProvenance: 'paid' as const,
        traitContext: context,
        dispositionByAcquisitionRole: Object.freeze({ self: Object.freeze({ kind: 'normal' }) }),
        anvilResult: Object.freeze({
          kind: 'anvilOfFates' as const,
          removedTraitKey: 'StaffDoubleAttackTrait',
          addedTraitKeys: Object.freeze([
            'StaffLongAttackTrait',
            'StaffJumpSpecialTrait',
          ]) as readonly [string, string],
        }),
      }),
      Object.freeze({ ...role, historySequence: 2 }),
      (history) => factsWithHistory(baseFacts(), history, new Set()),
      findings,
      undefined,
      undefined,
      Object.freeze({ site, entry }),
    );

    expect(findings.size).toBe(0);
    expect(result).toHaveLength(1);
    expect(result[0]?.traitHistory?.equippedTraits).toMatchObject({
      StaffLongAttackTrait: { hammerRank: 'RankI' },
      StaffJumpSpecialTrait: { hammerRank: 'RankI' },
    });
    expect(result[0]?.traitHistory?.equippedTraits.StaffDoubleAttackTrait).toBeUndefined();
  });

  it('leaves the acquisition unresolved when the authored result is absent', () => {
    const biome = createBiomeAddress('Surface', 'Q');
    const occurrence = createOccurrenceAddress(biome, createOccurrenceId('anvil-missing'));
    const owner = createShopOfferAddress(biome, occurrence.occurrenceId, 'PremiumProgress');
    const site = createAcquisitionSiteAddress(occurrence, 'shopPurchase');
    const entry = createAcquisitionEntryAddress(site, 'anvil');
    const offer = Object.freeze({ rewardType: 'ChaosWeaponUpgrade' as const });
    const role = resolveAcquisitionRole(catalog.rewards, offer, 'self', 'purchase');
    const findings = new Map();
    const result = applyProducerRoleHistory(
      catalog,
      initializeTestRewardBranches(),
      Object.freeze({
        origin: owner,
        offer,
        producerLifecycleKey: 'Q_WorldShop',
        instanceProvenance: 'paid' as const,
        traitContext: context,
        dispositionByAcquisitionRole: Object.freeze({ self: Object.freeze({ kind: 'normal' }) }),
        anvilResult: null,
      }),
      Object.freeze({ ...role, historySequence: 2 }),
      (history) => factsWithHistory(baseFacts(), history, new Set()),
      findings,
      undefined,
      undefined,
      Object.freeze({ site, entry }),
    );

    expect(result).toHaveLength(0);
    expect(findings.size).toBeGreaterThan(0);
  });

  it('excludes an active Experimental Hammer from removal and re-addition domains', () => {
    const capability = anvilCapabilityFor(
      branchWithHammerFrontier('StaffDoubleAttackTrait', 'StaffJumpSpecialTrait'),
    );

    expect(capability?.removableTraitKeys).toEqual(['StaffDoubleAttackTrait']);
    expect(capability?.addedTraitKeysFor('StaffDoubleAttackTrait', [])).not.toContain(
      'StaffJumpSpecialTrait',
    );
  });

  it('rebuilds its candidate domains from an earlier Hammer frontier edit', () => {
    const before = anvilCapabilityFor(branchWithHammerFrontier('StaffDoubleAttackTrait'));
    const after = anvilCapabilityFor(branchWithHammerFrontier('StaffLongAttackTrait'));

    expect(before?.removableTraitKeys).toEqual(['StaffDoubleAttackTrait']);
    expect(after?.removableTraitKeys).toEqual(['StaffLongAttackTrait']);
    expect(before?.addedTraitKeysFor('StaffDoubleAttackTrait', [])).toContain(
      'StaffLongAttackTrait',
    );
    expect(after?.addedTraitKeysFor('StaffLongAttackTrait', [])).toContain(
      'StaffDoubleAttackTrait',
    );
  });
});
