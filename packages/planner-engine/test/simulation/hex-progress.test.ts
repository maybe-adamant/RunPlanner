import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createDefaultAuthoredHexTree,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { evaluateBiome, simulateProject } from '@run-planner/engine/simulation';
import type { RewardHistoryState, RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import type { HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import { createTestArcanaFearState } from '../support/arcana-fear';
import {
  aspectSkyFallClosureCheckpoint,
  normalOption3LungClosureCheckpoint,
} from './support/hex-progress-checkpoints';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  bankPathPoints,
  hexEffectiveCapacity,
  installHexTree,
  maybeAddGodSent,
  settlePathScreen,
} from '../../src/simulation/hex-progress';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
} from '../../src/simulation/traits';
import {
  applyMoonBeamEquip,
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';

describe('minimal Hex progress', () => {
  it('keeps the normal selected-option-3 Lung checkpoint within its finite capacity', () => {
    const checkpoint = normalOption3LungClosureCheckpoint();
    expect(checkpoint.afterOption3Bank.hexProgress).toMatchObject({
      spellTraitKey: 'SpellTimeSlowTrait',
      tree: { layoutKey: 'Lung' },
      bankedPathPoints: 2,
      investedPathPoints: 0,
    });
    expect(checkpoint.closed.hexProgress).toMatchObject({
      spellTraitKey: 'SpellTimeSlowTrait',
      bankedPathPoints: 0,
      investedPathPoints: 16,
      talentDropsClosed: true,
    });
    expect(checkpoint.closed.hexProgress.investedPathPoints).toBeLessThanOrEqual(16);
  });

  it('keeps the Aspect Sky Fall checkpoint concrete, closed, and capacity-clamped', () => {
    const checkpoint = aspectSkyFallClosureCheckpoint();
    expect(checkpoint.afterSpellDrop.hexProgress).toMatchObject({
      spellTraitKey: 'SpellMoonBeamTrait',
      tree: { layoutKey: 'Lung' },
      bankedPathPoints: 0,
      investedPathPoints: 3,
    });
    expect(checkpoint.closed.hexProgress).toMatchObject({
      spellTraitKey: 'SpellMoonBeamTrait',
      bankedPathPoints: 0,
      investedPathPoints: 16,
      talentDropsClosed: true,
    });
    expect(checkpoint.closed.hexProgress.investedPathPoints).toBeLessThanOrEqual(16);
  });

  const withTree = (
    branch: ReturnType<typeof initializeRewardBranches>[number],
    layoutKey: HexLayoutKey = 'Lung',
  ) =>
    installHexTree(
      catalog,
      branch,
      'SpellPolymorphTrait',
      createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait', layoutKey),
    );
  const facts = (history: RewardHistoryState): RewardKernelFacts => ({
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: history.biomeUseRecord,
        lootTypeHistory: history.lootTypeHistory,
        roomsEntered: {},
        useRecord: history.useRecord,
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 1,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 2,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  });

  it('preserves full semantic Path grants and transfers banked points at a writable screen', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const banked = bankPathPoints(withTree(initial), 2);
    const settled = settlePathScreen(catalog, banked, 3);
    expect(settled.hexProgress).toMatchObject({ bankedPathPoints: 0, investedPathPoints: 5 });
    expect(publicRewardBranch(settled).hexProgress).toEqual({
      ...settled.hexProgress,
    });
  });

  it('rejects a Path screen without a settled Hex tree', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    expect(() => settlePathScreen(catalog, initial, 3)).toThrow(/installed Hex tree/);
  });

  it.each([
    ['Lung', 16],
    ['Pyramid', 18],
    ['Maze', 22],
    ['Nacelle', 18],
  ] as const)('clamps %s Path settlement at its finite base capacity', (layoutKey, capacity) => {
    const initial = withTree(
      initializeRewardBranches(
        undefined,
        createTestArcanaFearState(),
        catalog,
        'ManaOverTimeRefundKeepsake',
      )[0]!,
      layoutKey,
    );
    let branch = initial;
    for (let index = 0; index < 8; index += 1) branch = settlePathScreen(catalog, branch, 3);
    expect(branch.hexProgress.investedPathPoints).toBe(capacity);
    expect(branch.hexProgress.talentDropsClosed).toBe(true);
  });

  it('retains raw bonus bank when a closed tree receives a normal Path screen', () => {
    const initial = withTree(
      initializeRewardBranches(
        undefined,
        createTestArcanaFearState(),
        catalog,
        'ManaOverTimeRefundKeepsake',
      )[0]!,
    );
    const full = Object.freeze({
      ...initial,
      hexProgress: Object.freeze({
        ...initial.hexProgress,
        investedPathPoints: 16,
        talentDropsClosed: true,
      }),
    });
    expect(settlePathScreen(catalog, full, 3).hexProgress).toMatchObject({
      investedPathPoints: 16,
      bankedPathPoints: 2,
      talentDropsClosed: true,
    });
  });

  it('carries an incoming closed-tree seed into the next biome reward-generation frontier', () => {
    const project = createGoldenFGHProject();
    const routePlan = project.routes.find((route) => route.routeKey === 'Underworld');
    const gPlan = routePlan?.biomes.find((biome) => biome.biomeKey === 'G');
    const f = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (
      routePlan === undefined ||
      gPlan === undefined ||
      f?.authoring !== 'complete' ||
      f.validity !== 'valid'
    ) {
      throw new Error('expected a complete valid F predecessor for the incoming-seed witness');
    }
    const seededBranch = Object.freeze({
      ...f.rewards.branches[0]!,
      hexProgress: Object.freeze({
        ...f.rewards.branches[0]!.hexProgress,
        talentDropsClosed: true,
      }),
    });
    const evaluated = evaluateBiome(catalog, 'Underworld', gPlan, {
      enteredBiomeCount: 2,
      loadout: routePlan.loadout,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      seed: { history: f.history, rewardBranches: [seededBranch] },
    });
    if (evaluated.authoring !== 'complete' || evaluated.validity !== 'valid') {
      throw new Error('closed-tree G seed did not reach complete reward generation');
    }
    expect(evaluated.rewards.targetHistory).not.toHaveLength(0);
    expect(
      evaluated.rewards.targetHistory.every((checkpoint) =>
        checkpoint.allSpellInvested.every(Boolean),
      ),
    ).toBe(true);
  });

  it('adds the linked keepsake God Sent pair once, persists it after removal, and never reopens closure', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const installed = withTree(initial);
    expect(installed.hexProgress.godSentAdded).toBe(true);
    const closed = Object.freeze({
      ...installed,
      hexProgress: Object.freeze({
        ...installed.hexProgress,
        investedPathPoints: 18,
        talentDropsClosed: true,
      }),
      keepsakes: Object.freeze({ ...installed.keepsakes, olympianSources: Object.freeze([]) }),
    });
    const reevaluated = maybeAddGodSent(catalog, closed);
    expect(reevaluated.hexProgress).toMatchObject({ godSentAdded: true, talentDropsClosed: true });
    expect(hexEffectiveCapacity(catalog, reevaluated.hexProgress)).toBe(18);
  });

  it('does not add God Sent before a linked source exists, then adds two capacity after closure without reopening', () => {
    const ordinary = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const installed = withTree(ordinary);
    expect(installed.hexProgress.godSentAdded).toBe(false);
    const closed = Object.freeze({
      ...installed,
      hexProgress: Object.freeze({
        ...installed.hexProgress,
        investedPathPoints: 16,
        talentDropsClosed: true,
      }),
    });
    const forceZeus = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const late = maybeAddGodSent(
      catalog,
      Object.freeze({
        ...closed,
        keepsakes: Object.freeze({
          ...closed.keepsakes,
          olympianSources: forceZeus.keepsakes.olympianSources,
        }),
      }),
    );
    expect(late.hexProgress).toMatchObject({ godSentAdded: true, talentDropsClosed: true });
    expect(hexEffectiveCapacity(catalog, late.hexProgress)).toBe(18);
  });

  it('adds God Sent only for the currently held linked provider, then retains its insertion after removal', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const acquired: TraitHistoryEvent = Object.freeze({
      kind: 'traitOffer',
      owner: { kind: 'project' as const },
      acquisitionRole: 'test',
      sequence: 1,
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
    });
    const removed: TraitHistoryEvent = Object.freeze({
      kind: 'traitRemoval',
      owner: { kind: 'project' as const },
      acquisitionRole: 'testRemoval',
      sequence: 2,
      acquisitionPoint: 'test',
      match: 'currentTraitKey',
      traitKey: 'ZeusWeaponBoon',
    });
    const heldHistory = foldTraitHistoryEvents(catalog, [acquired]);
    const removedHistory = foldTraitHistoryEvents(catalog, [acquired, removed]);
    const withHistory = (traitHistory: typeof heldHistory) =>
      Object.freeze({
        ...initial,
        history: attachTraitHistory(initial.history, traitHistory),
        traitHistory,
      });

    expect(withTree(withHistory(removedHistory)).hexProgress.godSentAdded).toBe(false);

    const inserted = withTree(withHistory(heldHistory));
    expect(inserted.hexProgress.godSentAdded).toBe(true);

    const afterRemoval = maybeAddGodSent(catalog, withHistory(removedHistory));
    expect(
      maybeAddGodSent(
        catalog,
        Object.freeze({
          ...inserted,
          history: attachTraitHistory(inserted.history, removedHistory),
          traitHistory: removedHistory,
        }),
      ).hexProgress.godSentAdded,
    ).toBe(true);
    expect(afterRemoval.hexProgress.godSentAdded).toBeUndefined();
  });

  it('applies Moon Beam points and exact priority at each ordinary source frontier', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'SpellTalentKeepsake',
    )[0]!;
    expect(initial.hexProgress).toEqual({ bankedPathPoints: 5, investedPathPoints: 0 });
    expect(initial.rewardPriorities).toEqual(['SpellDrop']);

    const afterSpell = Object.freeze({
      ...initial,
      history: Object.freeze({ ...initial.history, useRecord: Object.freeze({ SpellDrop: 1 }) }),
    });
    const ordinary = applyMoonBeamEquip(catalog, afterSpell, 'SpellTalentKeepsake', 'Heroic');
    expect(ordinary.hexProgress.bankedPathPoints).toBe(12);
    expect(ordinary.rewardPriorities).toEqual(['SpellDrop', 'TalentDrop']);

    const postboss = applyMoonBeamEquip(catalog, afterSpell, 'SpellTalentKeepsake', 'Epic', true);
    expect(postboss.rewardPriorities).toEqual(['SpellDrop', 'TalentBigDrop']);
  });

  it.each([
    ['MinorTalentDrop', 1],
    ['TalentDrop', 3],
    ['TalentBigDrop', 5],
  ] as const)('settles %s only at the shared acquisition frontier', (rewardType, grant) => {
    const initial = bankPathPoints(
      withTree(
        initializeRewardBranches(
          undefined,
          createTestArcanaFearState(),
          catalog,
          'ManaOverTimeRefundKeepsake',
        )[0]!,
      ),
      2,
    );
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('hex-path'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
        },
      },
      facts,
      new Map(),
    );
    expect(settlement.branches[0]?.hexProgress).toMatchObject({
      bankedPathPoints: 0,
      investedPathPoints: grant + 2,
    });
  });

  it('banks the ordinary ordered SpellDrop bonus only after its selected spell installs', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('hex-spell'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settleSpell = (
      selectedOptionKey: 'option1' | 'option2' | 'option3',
      options: readonly [
        { readonly traitKey: string },
        { readonly traitKey: string },
        { readonly traitKey: string },
      ] = Object.freeze([
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ] as const),
    ) =>
      settleOwnedAcquisitionSite(
        catalog,
        [initial],
        {
          siteOwner: occurrence,
          pointKey: 'roomRewardPickup',
          entryKey: selectedOptionKey,
          historySequence: 1,
          source: {
            origin: createAcquisitionEntryAddress(site, selectedOptionKey),
            offer: { rewardType: 'SpellDrop' },
            producerLifecycleKey: 'RoomReward',
            instanceProvenance: 'free',
            traitOffersByAcquisitionRole: {
              self: {
                kind: 'traits',
                giverKey: 'SpellDrop',
                options,
                selectedOptionKey,
              },
            },
          },
        },
        facts,
        new Map(),
      ).branches[0]!;
    expect(settleSpell('option1').hexProgress.bankedPathPoints).toBe(0);
    expect(settleSpell('option2').hexProgress.bankedPathPoints).toBe(1);
    expect(settleSpell('option3').hexProgress.bankedPathPoints).toBe(2);
    // The bonus is owned by the selected row, not by a spell identity.
    expect(
      settleSpell(
        'option1',
        Object.freeze([
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
        ] as const),
      ).hexProgress.bankedPathPoints,
    ).toBe(0);
    expect(
      settleSpell(
        'option3',
        Object.freeze([
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
        ] as const),
      ).hexProgress.bankedPathPoints,
    ).toBe(2);

    const missingChild = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'missing',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'missing'),
          offer: { rewardType: 'SpellDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: { self: null },
        },
      },
      facts,
      new Map(),
    );
    expect(missingChild.branches).toEqual([]);
  });

  it('routes Aspect of Selene SpellDrop through the three-point Path settlement without a spell child', () => {
    const loadout = {
      ...createDefaultRouteLoadout(catalog),
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
      aspectHexTree: createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait'),
    };
    const initial = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      'ManaOverTimeRefundKeepsake',
      undefined,
      'Underworld',
      loadout,
    )[0]!;
    expect(initial.hexProgress).toMatchObject({ bankedPathPoints: 0, investedPathPoints: 0 });
    expect(initial.traitHistory?.equippedSlots.Spell?.traitKey).toBe('SpellMoonBeamTrait');
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'Q'),
      createOccurrenceId('hex-aspect-spell'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settled = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType: 'SpellDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitContext: { aspectKey: 'SuitHexAspect' },
        },
      },
      facts,
      new Map(),
    ).branches[0]!;
    expect(settled.history.useRecord.SpellDrop).toBe(1);
    expect(settled.hexProgress).toMatchObject({ bankedPathPoints: 0, investedPathPoints: 3 });
    expect(settled.traitHistory?.events.some((event) => event.kind === 'traitOffer')).toBe(false);

    const laterBig = settleOwnedAcquisitionSite(
      catalog,
      [settled],
      {
        siteOwner: occurrence,
        pointKey: 'laterBig',
        entryKey: 'self',
        historySequence: 2,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType: 'TalentBigDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
        },
      },
      facts,
      new Map(),
    ).branches[0]!;
    expect(laterBig.hexProgress).toMatchObject({ bankedPathPoints: 0, investedPathPoints: 8 });
  });
});
