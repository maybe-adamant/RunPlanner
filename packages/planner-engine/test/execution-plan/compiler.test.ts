import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGIxionChaosProject,
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';
import { simulateProjectAssembly } from '../../src/simulation';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { allTogetherOffer, allTogetherResult } from '../simulation/shop-trait-purchase-support';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  createTraitOfferAddress,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredTraitOfferTraits,
} from '../../src/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionPlanCodecError,
} from '../../src/execution-plan';
import { validateExecutionProduct } from '../../src/execution-plan/assembly/validation';
import {
  acquisitionRole as decodeExecutionAcquisitionRole,
  traitOffer as decodeExecutionTraitOffer,
} from '../../src/execution-plan/codec/rewards';
import { transaction as decodeExecutionTransaction } from '../../src/execution-plan/codec/timeline';
import { overview as decodeExecutionOverview } from '../../src/execution-plan/codec/overview';
import { expandDiagnosticFrames } from '../../src/execution-plan/codec/diagnostics';
import { fingerprint } from '../../src/execution-plan/codec/primitives';
import type { ExecutionSemanticProduct } from '../../src/execution-plan/model';
import fOpeningFixture from './fixtures/f-opening.execution.json';
import fgFixture from './fixtures/fg.execution.json';
import fgAnomalyFixture from './fixtures/fg-anomaly.execution.json';
import fgIxionChaosFixture from './fixtures/fg-ixion-chaos.execution.json';
import automaticBossFixture from './fixtures/automatic-boss.execution.json';
import { bossAutomaticOutcomeProject } from './support/automatic-fixture';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import { orderedExecutionRooms } from '../../src/execution-plan/assembly/route';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  mergePlannerTimelineFacts,
} from '../../src/simulation/timeline-facts';

function fOnlyProject(project = createCompleteFGProject()) {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

function planFor(project: ReturnType<typeof createCompleteFGProject>) {
  const assembly = simulateProjectAssembly(catalog, project);
  const product = assembleExecutionProduct({ assembly });
  return { product, plan: compileExecutionPlan({ product }) };
}

function shrineOverviewWithPairing(
  initialPurchase = true,
  initialSource = true,
  refillPurchase = true,
  refillSource = true,
) {
  return {
    encounterPhases: [],
    requiredObjects: [],
    hermesShrine: {
      offers: [
        {
          generationKey: 'initial:first',
          optionKey: 'Heal',
          rewardType: 'HealBigDrop',
          slotIndex: 1,
          ...(initialPurchase ? { purchase: { roomDelay: 2, rushed: true } } : {}),
          ...(initialSource ? { deliverySourceKey: 'hermesShrineDelivery:source:first' } : {}),
        },
        {
          generationKey: 'initial:secondLeft',
          optionKey: 'Health',
          rewardType: 'MaxHealthDrop',
          slotIndex: 2,
        },
        {
          generationKey: 'initial:secondRight',
          optionKey: 'Mana',
          rewardType: 'MaxManaDrop',
          slotIndex: 3,
        },
      ],
      travelDealRefill: {
        sourceGenerationKey: 'initial:first',
        slotIndex: 1,
        optionKey: 'Armor',
        rewardType: 'ArmorDrop',
        ...(refillPurchase ? { purchase: { roomDelay: 8, rushed: false } } : {}),
        ...(refillSource ? { deliverySourceKey: 'hermesShrineDelivery:source:refill' } : {}),
      },
    },
  };
}

function allTogetherProjection(selected: boolean) {
  const assembly = simulateProjectAssembly(
    catalog,
    authorLegalTraitOffers(createCompleteFGProject()),
  );
  const biome = assembly.evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('fixture lacks a complete-valid execution biome');
  const source = biome.rewards.selectedTraitOffers.find(
    (candidate) => candidate.offer.kind === 'traits',
  );
  if (source === undefined) throw new Error('fixture lacks an ordinary selected trait offer');
  const selectedOffer = allTogetherOffer() as AuthoredTraitOfferTraits;
  const offer: AuthoredTraitOfferTraits = selected
    ? selectedOffer
    : Object.freeze({
        ...selectedOffer,
        options: Object.freeze([
          selectedOffer.options[1]!,
          selectedOffer.options[0]!,
          selectedOffer.options[2]!,
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
      });
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate === source ? Object.freeze({ ...candidate, offer }) : candidate,
        ),
      ),
    }),
  });
}

function naturalSelectionProjection(selected: boolean) {
  const assembly = simulateProjectAssembly(
    catalog,
    authorLegalTraitOffers(createCompleteFGProject()),
  );
  const biome = assembly.evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('fixture lacks a complete-valid execution biome');
  const source = biome.rewards.selectedTraitOffers.find(
    (candidate) => candidate.offer.kind === 'traits',
  );
  if (source === undefined) throw new Error('fixture lacks an ordinary selected trait offer');
  const naturalOption = Object.freeze({
    traitKey: 'GoodStuffBoon',
    rarity: 'Duo' as const,
    naturalSelectionTargets: Object.freeze([
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloWeaponBoon',
    ]),
  });
  const offer = Object.freeze({
    kind: 'traits' as const,
    giverKey: source.offer.giverKey,
    options: Object.freeze([
      ...(selected
        ? [
            naturalOption,
            Object.freeze({ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }),
          ]
        : [
            Object.freeze({ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }),
            naturalOption,
          ]),
      Object.freeze({ traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1' as const,
  });
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate === source ? Object.freeze({ ...candidate, offer }) : candidate,
        ),
      ),
    }),
  });
}

function bridalGlowProjection() {
  const assembly = simulateProjectAssembly(
    catalog,
    authorLegalTraitOffers(createCompleteFGProject()),
  );
  const biome = assembly.evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('fixture lacks a complete-valid execution biome');
  const source = biome.rewards.selectedTraitOffers.find(
    (candidate) => candidate.offer.kind === 'traits',
  );
  if (source === undefined) throw new Error('fixture lacks an ordinary selected trait offer');
  const targetTraitKey = 'ApolloWeaponBoon';
  const offer: AuthoredTraitOfferTraits = Object.freeze({
    kind: 'traits',
    giverKey: 'Hera',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'BoonDecayBoon',
        rarity: 'Epic' as const,
        targetTraitKey,
      }),
      Object.freeze({ traitKey: 'HeraCastBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate === source
            ? Object.freeze({
                ...candidate,
                offer,
                branches: Object.freeze(
                  candidate.branches.map((branch) =>
                    Object.freeze({
                      ...branch,
                      targetedAcquisition: Object.freeze({
                        applies: true,
                        legal: true,
                        sourceTraitKey: 'BoonDecayBoon',
                        targetTraitKey,
                        findings: Object.freeze([]),
                        transition: Object.freeze({
                          kind: 'promoteGodTraitToHeroic' as const,
                          sourceTraitKey: 'BoonDecayBoon',
                          targetTraitKey,
                          oldRarity: 'Epic' as const,
                          newRarity: 'Heroic' as const,
                          oldLevel: 1,
                          newLevel: 4,
                        }),
                      }),
                    }),
                  ),
                ),
              })
            : candidate,
        ),
      ),
    }),
  });
}

function concaveStoneProjection() {
  const assembly = simulateProjectAssembly(
    catalog,
    authorLegalTraitOffers(createCompleteFGProject()),
  );
  const biome = assembly.evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('fixture lacks a complete-valid execution biome');
  const source = biome.rewards.selectedTraitOffers.find(
    (candidate) => candidate.offer.kind === 'traits',
  );
  if (source === undefined) throw new Error('fixture lacks an ordinary selected trait offer');
  const offer: AuthoredTraitOfferTraits = Object.freeze({
    kind: 'traits' as const,
    giverKey: source.offer.giverKey,
    options: Object.freeze([
      Object.freeze({ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }),
      Object.freeze({
        traitKey: 'AllElementalBoon',
        rarity: 'Legendary' as const,
        allTogetherResult,
      }),
      Object.freeze({
        traitKey: 'GoodStuffBoon',
        rarity: 'Duo' as const,
        naturalSelectionTargets: Object.freeze(['ApolloWeaponBoon']),
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1' as const,
    concaveStoneResult: Object.freeze({ kind: 'proc' as const, optionKey: 'option2' as const }),
  });
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate === source ? Object.freeze({ ...candidate, offer }) : candidate,
        ),
      ),
    }),
  });
}

function concaveStoneBridalGlowProjection() {
  const biome = concaveStoneProjection();
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) => {
          if (
            candidate.offer.kind !== 'traits' ||
            candidate.offer.concaveStoneResult?.kind !== 'proc'
          )
            return candidate;
          return Object.freeze({
            ...candidate,
            offer: Object.freeze({
              ...candidate.offer,
              options: Object.freeze([
                candidate.offer.options[0]!,
                Object.freeze({
                  traitKey: 'BoonDecayBoon',
                  rarity: 'Epic' as const,
                  targetTraitKey: 'ApolloWeaponBoon',
                }),
                Object.freeze({ traitKey: 'HeraCastBoon', rarity: 'Common' as const }),
              ]) as AuthoredTraitOfferTraits['options'],
            }),
          });
        }),
      ),
    }),
  });
}

function concaveStoneNaturalSelectionProjection() {
  const biome = concaveStoneProjection();
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate.offer.kind === 'traits' && candidate.offer.concaveStoneResult?.kind === 'proc'
            ? Object.freeze({
                ...candidate,
                offer: Object.freeze({
                  ...candidate.offer,
                  concaveStoneResult: Object.freeze({
                    kind: 'proc' as const,
                    optionKey: 'option3' as const,
                  }),
                }),
              })
            : candidate,
        ),
      ),
    }),
  });
}

function echoCarrierProjection(echoLastRunBoon: AuthoredEchoLastRunBoonOffer) {
  const assembly = simulateProjectAssembly(
    catalog,
    authorLegalTraitOffers(createCompleteFGProject()),
  );
  const biome = assembly.evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('fixture lacks a complete-valid execution biome');
  const source = biome.rewards.selectedTraitOffers.find(
    (candidate) => candidate.offer.kind === 'traits',
  );
  if (source === undefined) throw new Error('fixture lacks an ordinary selected trait offer');
  const offer: AuthoredTraitOfferTraits = Object.freeze({
    kind: 'traits',
    giverKey: 'Echo',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'EchoLastRunBoon',
        echoLastRunBoon,
      }),
      Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
      Object.freeze({ traitKey: 'DiminishingHealthBoon' }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });
  return Object.freeze({
    ...biome,
    rewards: Object.freeze({
      ...biome.rewards,
      selectedTraitOffers: Object.freeze(
        biome.rewards.selectedTraitOffers.map((candidate) =>
          candidate === source
            ? Object.freeze({
                ...candidate,
                offer,
                branches: Object.freeze(
                  candidate.branches.map((branch) =>
                    Object.freeze({ ...branch, effectiveEchoLastRunBoon: echoLastRunBoon }),
                  ),
                ),
              })
            : candidate,
        ),
      ),
    }),
  });
}

function planWithGenericDependency() {
  const { product } = planFor(authorLegalTraitOffers(createUnderworldFWellCheckpoint()));
  const occurrence = product.occurrences.find((entry) => entry.timeline.transactions.length >= 2);
  if (occurrence === undefined) throw new Error('fixture lacks a multi-transaction occurrence');
  const pair = occurrence.timeline.transactions
    .flatMap((after, afterIndex) =>
      occurrence.timeline.transactions
        .slice(0, afterIndex)
        .map((before) => ({ owner: after.owner, afterOwner: before.owner })),
    )
    .find(
      (candidate) =>
        !occurrence.timeline.dependencies.some(
          (dependency) =>
            dependency.owner === candidate.owner && dependency.afterOwner === candidate.afterOwner,
        ),
    );
  if (pair === undefined) throw new Error('fixture lacks an independent transaction pair');
  const updatedProduct = Object.freeze({
    ...product,
    occurrences: Object.freeze(
      product.occurrences.map((entry) =>
        entry.id !== occurrence.id
          ? entry
          : Object.freeze({
              ...entry,
              timeline: Object.freeze({
                ...entry.timeline,
                dependencies: Object.freeze([...entry.timeline.dependencies, pair]),
              }),
            }),
      ),
    ),
  });
  return compileExecutionPlan({ product: updatedProduct });
}

function refreshWireFingerprint(wire: Record<string, unknown>): void {
  const expanded = expandDiagnosticFrames(wire);
  wire.planFingerprint = fingerprint({
    format: expanded.format,
    protocolVersion: expanded.protocolVersion,
    catalogVersion: expanded.catalogVersion,
    projectId: expanded.projectId,
    routeKey: expanded.routeKey,
    startingLoadout: expanded.startingLoadout,
    startingKeepsake: expanded.startingKeepsake,
    extent: expanded.extent,
    selectedOccurrenceIds: expanded.selectedOccurrenceIds,
    resources: expanded.resources,
    occurrences: expanded.occurrences,
  });
}

function productWithDependency(
  product: ExecutionSemanticProduct,
  dependentOccurrenceId: string,
  owner: string,
  afterOwner: string,
): ExecutionSemanticProduct {
  return Object.freeze({
    ...product,
    occurrences: Object.freeze(
      product.occurrences.map((occurrence) =>
        occurrence.id !== dependentOccurrenceId
          ? occurrence
          : Object.freeze({
              ...occurrence,
              timeline: Object.freeze({
                ...occurrence.timeline,
                dependencies: Object.freeze([
                  ...occurrence.timeline.dependencies,
                  Object.freeze({ owner, afterOwner }),
                ]),
              }),
            }),
      ),
    ),
  });
}

function selectedTransactionPair(product: ExecutionSemanticProduct): {
  readonly dependentOccurrenceId: string;
  readonly dependentIndex: number;
  readonly dependentOwner: string;
  readonly prerequisiteOwner: string;
} {
  const occurrences = new Map(product.occurrences.map((occurrence) => [occurrence.id, occurrence]));
  for (
    let dependentIndex = 1;
    dependentIndex + 1 < product.selectedOccurrenceIds.length;
    dependentIndex += 1
  ) {
    const dependent = occurrences.get(product.selectedOccurrenceIds[dependentIndex]!);
    if (dependent?.timeline.transactions[0] === undefined) continue;
    for (
      let prerequisiteIndex = dependentIndex - 1;
      prerequisiteIndex >= 0;
      prerequisiteIndex -= 1
    ) {
      const prerequisite = occurrences.get(product.selectedOccurrenceIds[prerequisiteIndex]!);
      if (prerequisite?.timeline.transactions[0] === undefined) continue;
      const dependentOwner = dependent.timeline.transactions[0].owner;
      const prerequisiteOwner = prerequisite.timeline.transactions[0].owner;
      if (
        !product.occurrences.some((occurrence) =>
          occurrence.timeline.dependencies.some(
            (dependency) =>
              dependency.owner === dependentOwner && dependency.afterOwner === prerequisiteOwner,
          ),
        )
      )
        return {
          dependentOccurrenceId: dependent.id,
          dependentIndex,
          dependentOwner,
          prerequisiteOwner,
        };
    }
  }
  throw new Error('fixture lacks selected cross-occurrence transaction pair');
}

describe('execution-plan compiler and codec', () => {
  it('accepts source-owned replacement materialization only for Artificer roles', () => {
    const role = {
      role: 'self',
      disposition: 'artificer',
      lifecyclePoint: 'roomRewardPickup',
      kind: 'loot',
      gameName: 'MetaCurrencyDrop',
      replacement: {
        reward: {
          rewardType: 'Boon',
          producerLifecycleKey: 'RoomReward',
          resolvedStoreKey: 'RunProgress',
          source: 'ApolloUpgrade',
        },
        gameName: 'RoomRewardConsolationPrize',
      },
    };
    expect(decodeExecutionAcquisitionRole(role, 'role')).toEqual(role);
    expect(() =>
      decodeExecutionAcquisitionRole({ ...role, disposition: 'normal' }, 'role'),
    ).toThrow(/only valid for artificer roles/);
  });

  it('rejects Sea Star results outside a normal free acquisition source role', () => {
    const result = { kind: 'proc' as const };
    const role = {
      role: 'self',
      disposition: 'normal' as const,
      lifecyclePoint: 'roomRewardPickup',
      kind: 'loot',
      gameName: 'MetaCurrencyDrop',
      seaStarResult: result,
    };
    expect(decodeExecutionAcquisitionRole(role, 'role')).toEqual(role);
    expect(() =>
      decodeExecutionAcquisitionRole(
        {
          ...role,
          producer: { kind: 'seaStarDuplicate', sourceOwner: 'source', sourceRole: 'self' },
        },
        'role',
      ),
    ).toThrow(/invalid on a Sea Star duplicate/);
    expect(() =>
      decodeExecutionAcquisitionRole({ ...role, disposition: 'artificer' }, 'role'),
    ).toThrow(/only valid for normal roles/);
    expect(() =>
      decodeExecutionTransaction(
        {
          kind: 'shopPurchase',
          owner: 'purchase',
          window: { kind: 'standard', phase: 'beforeCombat' },
          offerKey: 'offer',
          rewardType: 'MetaCurrencyDrop',
          sourceOwner: 'source',
          reward: { rewardType: 'MetaCurrencyDrop', producerLifecycleKey: 'Shop' },
          producerLifecycleKey: 'Shop',
          roles: [role],
        },
        'transaction',
      ),
    ).toThrow(/may not publish Sea Star results for purchases/);
  });

  it('decodes the published Anvil result only on a Shop purchase', () => {
    const transaction = {
      kind: 'shopPurchase' as const,
      owner: 'purchase',
      window: { kind: 'standard' as const, phase: 'beforeCombat' as const },
      offerKey: 'Anvil',
      rewardType: 'ChaosWeaponUpgrade',
      sourceOwner: 'shop-source',
      reward: { rewardType: 'ChaosWeaponUpgrade', producerLifecycleKey: 'Q_WorldShop' },
      producerLifecycleKey: 'Q_WorldShop',
      roles: [],
      anvilResult: {
        kind: 'anvilOfFates' as const,
        removedTraitKey: null,
        addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'] as const,
      },
    };
    const decoded = decodeExecutionTransaction(transaction, 'transaction');
    if (decoded.kind !== 'shopPurchase') throw new Error('expected a Shop purchase');
    expect(decoded.anvilResult).toEqual(transaction.anvilResult);
    expect(() =>
      decodeExecutionTransaction(
        {
          ...transaction,
          anvilResult: { ...transaction.anvilResult, addedTraitKeys: ['OnlyOne'] },
        },
        'transaction',
      ),
    ).toThrow(/addedTraitKeys/);
    expect(() =>
      decodeExecutionTransaction({ ...transaction, anvilResult: undefined }, 'transaction'),
    ).toThrow(/required for an Anvil purchase/);
    expect(() =>
      decodeExecutionTransaction({ ...transaction, rewardType: 'MaxHealthDrop' }, 'transaction'),
    ).toThrow(/only valid for an Anvil purchase/);
  });

  it('decodes an unpurchased Anvil inventory without a purchase result', () => {
    const overview = decodeExecutionOverview(
      {
        encounterPhases: [],
        requiredObjects: [],
        shop: {
          profileKey: 'Q_WorldShop',
          offers: [
            {
              offerKey: 'Anvil',
              optionKey: 'ChaosWeaponUpgrade',
              rewardType: 'ChaosWeaponUpgrade',
            },
          ],
          travelDealRefill: {
            sourceOfferKey: 'Anvil',
            sourceOwner: 'refill-acquisition',
            slotIndex: 0,
            groupIndex: 0,
            optionKey: 'MaxHealthDropBig',
            reward: {
              rewardType: 'MaxHealthDropBig',
              producerLifecycleKey: 'Q_WorldShop',
            },
          },
        },
      },
      'overview',
    );
    expect(overview.shop?.offers[0]).toEqual({
      offerKey: 'Anvil',
      optionKey: 'ChaosWeaponUpgrade',
      rewardType: 'ChaosWeaponUpgrade',
    });
    expect(overview.shop?.travelDealRefill).toMatchObject({
      sourceOwner: 'refill-acquisition',
      groupIndex: 0,
    });
  });

  it('requires Shrine purchase and delivery source identities to be paired', () => {
    for (const [initialPurchase, initialSource, refillPurchase, refillSource] of [
      [true, false, true, true],
      [false, true, true, true],
      [true, true, true, false],
      [true, true, false, true],
    ] as const) {
      expect(() =>
        decodeExecutionOverview(
          shrineOverviewWithPairing(initialPurchase, initialSource, refillPurchase, refillSource),
          'overview',
        ),
      ).toThrow(/purchase and deliverySourceKey must be paired/);
    }
  });

  it('publishes a non-default selected weapon and aspect as a verification-only start contract', () => {
    const project = authorLegalTraitOffers(
      applyProjectCommand(fOnlyProject(), catalog, {
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponDagger',
        aspectKey: 'DaggerHomingThrowAspect',
      }),
    );
    const { plan } = planFor(project);
    expect(plan.startingLoadout).toMatchObject({
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerHomingThrowAspect',
    });
    expect(plan.startingLoadout).not.toHaveProperty('startingHex');
  });

  it('does not manufacture a run-start Hex for Aspect of Persephone', () => {
    const project = authorLegalTraitOffers(
      applyProjectCommand(fOnlyProject(), catalog, {
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponLob',
        aspectKey: 'LobImpulseAspect',
      }),
    );
    expect(planFor(project).plan.startingLoadout).toMatchObject({
      weaponKey: 'WeaponLob',
      aspectKey: 'LobImpulseAspect',
    });
    expect(planFor(project).plan.startingLoadout).not.toHaveProperty('startingHex');
  });

  it('publishes the Calling Card initial rarity beside its final effective rarity', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-start'));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: ['option1'],
      },
    });
    const plan = planFor(authorLegalTraitOffers(project)).plan;
    const offer = plan.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer ? [role.traitOffer] : []))
      .find((candidate) => candidate.kind === 'traits' && candidate.giver === 'Apollo');
    if (offer?.kind !== 'traits') throw new Error('Calling Card offer is missing');
    expect(offer.options[0]).toMatchObject({
      key: 'ApolloWeaponBoon',
      baseRarity: 'Common',
      rarity: 'Rare',
    });
  });

  it('publishes provider-keepsake rarification with its room-exit charge proof', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-start'));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'ForceApolloBoonKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: ['option1'],
      },
    });
    const plan = planFor(authorLegalTraitOffers(project)).plan;
    const occurrence = plan.occurrences.find((candidate) =>
      candidate.timeline.transactions.some(
        (transaction) =>
          transaction.kind === 'acquisition' &&
          transaction.roles.some(
            (role) => role.traitOffer?.kind === 'traits' && role.traitOffer.giver === 'Apollo',
          ),
      ),
    );
    const offer = occurrence?.timeline.transactions
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer ? [role.traitOffer] : []))
      .find((candidate) => candidate.kind === 'traits' && candidate.giver === 'Apollo');
    if (offer?.kind !== 'traits') throw new Error('provider-keepsake offer is missing');
    expect(offer.options[0]).toMatchObject({
      key: 'ApolloWeaponBoon',
      baseRarity: 'Common',
      rarity: 'Rare',
    });
    expect(occurrence?.roomExitConformance?.facts).toContainEqual({ kind: 'keepsakeEffects' });
  });

  it('publishes All Together only when its carrying option can execute', () => {
    const selectedBiome = allTogetherProjection(true);
    const selected = orderedExecutionRooms([selectedBiome]).flatMap((room) =>
      executionTimelineTransactions(
        room,
        selectedBiome,
        mergePlannerTimelineFacts(
          room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
          selectedBiome.rewards.timelineFacts,
        ),
      ),
    );
    const selectedOffer = selected
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((offer) => offer.options.some((option) => option.key === 'AllElementalBoon'));
    if (selectedOffer === undefined) throw new Error('selected All Together offer is missing');
    expect(selectedOffer.options[0]?.allTogetherResult).toEqual(allTogetherResult);

    const dormantBiome = allTogetherProjection(false);
    const dormantOffer = orderedExecutionRooms([dormantBiome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          dormantBiome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            dormantBiome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((offer) => offer.options.some((option) => option.key === 'AllElementalBoon'));
    if (dormantOffer === undefined) throw new Error('dormant All Together offer is missing');
    expect(dormantOffer.options[1]).not.toHaveProperty('allTogetherResult');
  });

  it('publishes proc/noProc only on the source role while an authored Sea Star child remains unpicked', () => {
    const biome = allTogetherProjection(true);
    const room = orderedExecutionRooms([biome]).find((candidate) => {
      const transactions = executionTimelineTransactions(
        candidate,
        biome,
        mergePlannerTimelineFacts(
          candidate.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
          biome.rewards.timelineFacts,
        ),
      );
      return transactions.some((transaction) => transaction.kind === 'acquisition');
    });
    if (room === undefined) throw new Error('fixture lacks a source acquisition room');
    const facts = mergePlannerTimelineFacts(
      room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
      biome.rewards.timelineFacts,
    );
    const source = executionTimelineTransactions(room, biome, facts).find(
      (transaction) => transaction.kind === 'acquisition',
    );
    if (source === undefined) throw new Error('fixture lacks a source acquisition transaction');
    for (const kind of ['proc', 'noProc'] as const) {
      const withResult = {
        ...biome,
        rewards: {
          ...biome.rewards,
          branches: biome.rewards.branches.map((branch) => ({
            ...branch,
            events: branch.events.map((event) =>
              event.kind === 'concreteAcquisition' &&
              semanticAddressKey(event.origin) === source.sourceOwner
                ? { ...event, seaStarResult: { kind } }
                : event,
            ),
          })),
        },
      };
      const published = executionTimelineTransactions(room, withResult, facts);
      const sourceRole = published.find(
        (transaction) => transaction.kind === 'acquisition' && transaction.owner === source.owner,
      );
      if (sourceRole?.kind !== 'acquisition')
        throw new Error('Sea Star source was not republished');
      expect(sourceRole.roles).toContainEqual(expect.objectContaining({ seaStarResult: { kind } }));
      if (kind === 'proc')
        expect(
          published.some(
            (transaction) =>
              transaction.kind === 'acquisition' &&
              transaction.roles.some((role) => role.producer?.kind === 'seaStarDuplicate'),
          ),
        ).toBe(false);
    }
  });

  it('publishes Natural Selection only when its carrying option can execute', () => {
    const selectedBiome = naturalSelectionProjection(true);
    const selectedOffer = orderedExecutionRooms([selectedBiome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          selectedBiome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            selectedBiome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((offer) => offer.options.some((option) => option.key === 'GoodStuffBoon'));
    expect(selectedOffer?.options[0]?.naturalSelectionTargets).toEqual([
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloWeaponBoon',
    ]);

    const dormantBiome = naturalSelectionProjection(false);
    const dormantOffer = orderedExecutionRooms([dormantBiome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          dormantBiome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            dormantBiome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((offer) => offer.options.some((option) => option.key === 'GoodStuffBoon'));
    expect(dormantOffer?.options[1]).not.toHaveProperty('naturalSelectionTargets');
  });

  it('publishes Bridal Glow target only on its selected source option', () => {
    const biome = bridalGlowProjection();
    const offer = orderedExecutionRooms([biome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          biome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            biome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((candidate) => candidate.options.some((option) => option.key === 'BoonDecayBoon'));
    if (offer === undefined) throw new Error('Bridal Glow offer is missing');
    expect(offer.options[0]?.targetTraitKey).toBe('ApolloWeaponBoon');
    expect(offer.options[1]).not.toHaveProperty('targetTraitKey');
    expect(offer.options[2]).not.toHaveProperty('targetTraitKey');
  });

  it('publishes the frozen Stone result beside its source option without dropping residual consequences', () => {
    const biome = concaveStoneProjection();
    const offer = orderedExecutionRooms([biome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          biome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            biome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((candidate) => candidate.options.some((option) => option.concaveStoneResult));
    if (offer === undefined) throw new Error('Concave Stone offer is missing');
    expect(offer.options[0]?.concaveStoneResult).toEqual({ kind: 'proc', optionKey: 'option2' });
    expect(offer.options[1]?.allTogetherResult).toEqual(allTogetherResult);
    expect(offer.options[2]).not.toHaveProperty('naturalSelectionTargets');
  });

  it('publishes Bridal Glow target when Concave Stone selects it as the residual', () => {
    const biome = concaveStoneBridalGlowProjection();
    const offer = orderedExecutionRooms([biome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          biome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            biome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((candidate) => candidate.options.some((option) => option.concaveStoneResult));
    if (offer === undefined) throw new Error('Concave Stone Bridal Glow offer is missing');
    expect(offer.options[1]).toMatchObject({
      key: 'BoonDecayBoon',
      targetTraitKey: 'ApolloWeaponBoon',
    });
  });

  it('publishes Natural Selection targets when Concave Stone selects it as the residual', () => {
    const biome = concaveStoneNaturalSelectionProjection();
    const offer = orderedExecutionRooms([biome])
      .flatMap((room) =>
        executionTimelineTransactions(
          room,
          biome,
          mergePlannerTimelineFacts(
            room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
            biome.rewards.timelineFacts,
          ),
        ),
      )
      .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
      .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
      .find((candidate) => candidate.options.some((option) => option.concaveStoneResult));
    if (offer === undefined) throw new Error('Concave Stone Natural Selection offer is missing');
    expect(offer.options[2]).toMatchObject({
      key: 'GoodStuffBoon',
      naturalSelectionTargets: ['ApolloWeaponBoon'],
    });
  });

  it('publishes each selected Echo nested carrier consequence at the execution boundary', () => {
    const cases: readonly {
      readonly child: AuthoredEchoLastRunBoonOffer;
      readonly expected: Readonly<Record<string, unknown>>;
    }[] = [
      {
        child: Object.freeze({
          options: Object.freeze([
            Object.freeze({
              giverKey: 'Hera',
              traitKey: 'BoonDecayBoon',
              rarity: 'Epic',
              targetTraitKey: 'ApolloWeaponBoon',
            }),
          ]) as AuthoredEchoLastRunBoonOffer['options'],
          selectedOptionKey: 'option1',
        }),
        expected: { targetTraitKey: 'ApolloWeaponBoon' },
      },
      {
        child: Object.freeze({
          options: Object.freeze([
            Object.freeze({
              giverKey: 'Hera',
              traitKey: 'AllElementalBoon',
              rarity: 'Legendary',
              allTogetherResult,
            }),
          ]) as AuthoredEchoLastRunBoonOffer['options'],
          selectedOptionKey: 'option1',
        }),
        expected: { allTogetherResult },
      },
      {
        child: Object.freeze({
          options: Object.freeze([
            Object.freeze({
              giverKey: 'Demeter',
              traitKey: 'GoodStuffBoon',
              rarity: 'Duo',
              naturalSelectionTargets: Object.freeze(['ApolloWeaponBoon']),
            }),
          ]) as AuthoredEchoLastRunBoonOffer['options'],
          selectedOptionKey: 'option1',
        }),
        expected: { naturalSelectionTargets: ['ApolloWeaponBoon'] },
      },
    ];
    for (const { child, expected } of cases) {
      const biome = echoCarrierProjection(child);
      const offer = orderedExecutionRooms([biome])
        .flatMap((room) =>
          executionTimelineTransactions(
            room,
            biome,
            mergePlannerTimelineFacts(
              room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
              biome.rewards.timelineFacts,
            ),
          ),
        )
        .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
        .flatMap((role) => (role.traitOffer?.kind === 'traits' ? [role.traitOffer] : []))
        .find((candidate) => candidate.giver === 'Echo');
      if (offer === undefined) throw new Error('Echo carrier offer is missing');
      expect(offer.options[0]?.echoLastRunBoon?.options[0]).toMatchObject(expected);
    }
  });

  it('rejects ambiguous run-start Arcana and Hex identities before fingerprint validation', () => {
    const duplicateArcana = {
      ...fOpeningFixture,
      startingLoadout: {
        ...fOpeningFixture.startingLoadout,
        arcana: [
          { key: 'CardDraw', origin: 'manual', rarity: 'Common' },
          { key: 'CardDraw', origin: 'manual', rarity: 'Common' },
        ],
      },
    };
    expect(() => decodeExecutionPlan(duplicateArcana)).toThrow(/duplicate key/);
    const nonSeleneHex = {
      ...fOpeningFixture,
      startingLoadout: {
        ...fOpeningFixture.startingLoadout,
        startingHex: {
          spellTraitKey: 'SpellMoonBeamTrait',
          layoutKey: 'Lung',
          rareTalentKeys: ['MoonBeamPrimaryTalent', 'MoonBeamPrimaryTalent'],
          epicTalentKeys: [],
        },
      },
    };
    expect(() => decodeExecutionPlan(nonSeleneHex)).toThrow(/requires SuitHexAspect/);
  });

  it('publishes boss rewards as required but simulation-neutral native outcomes', () => {
    const { plan } = planFor(createCompleteFGProject());
    const bosses = plan.occurrences.filter((occurrence) =>
      occurrence.overview.encounterPhases.some((phase) => phase.kind === 'boss'),
    );

    expect(bosses.map((boss) => boss.gameName)).toEqual(['F_Boss01', 'G_Boss01']);
    expect(bosses.every((boss) => boss.overview.effectNeutralRequiredReward === true)).toBe(true);
    expect(
      bosses.every((boss) =>
        boss.timeline.transactions.every(
          (transaction) => !transaction.owner.includes('collectRequiredReward'),
        ),
      ),
    ).toBe(true);
  });

  it('accepts forced-shortage trait screens without permitting a missing selection', () => {
    const offer = {
      kind: 'traits',
      giver: 'Hera',
      options: [
        {
          key: 'AllElementalBoon',
          rarity: 'Legendary',
          allTogetherResult: {
            earth: 'ElementalDamageBoon',
            fire: 'ElementalBaseDamageBoon',
            air: 'ElementalDamageFloorBoon',
            water: null,
          },
        },
      ],
      selected: 'option1',
    };
    expect(decodeExecutionTraitOffer(offer, 'offer')).toMatchObject({
      options: [
        {
          key: 'AllElementalBoon',
          allTogetherResult: {
            earth: 'ElementalDamageBoon',
            fire: 'ElementalBaseDamageBoon',
            air: 'ElementalDamageFloorBoon',
            water: null,
          },
        },
      ],
      selected: 'option1',
    });
    expect(() => decodeExecutionTraitOffer({ ...offer, selected: 'option2' }, 'offer')).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [
            {
              ...offer.options[0],
              allTogetherResult: { earth: 'ElementalDamageBoon', fire: null, air: null },
            },
          ],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
  });

  it('strictly decodes bounded Natural Selection target sequences', () => {
    const offer = {
      kind: 'traits',
      giver: 'Demeter',
      options: [
        {
          key: 'GoodStuffBoon',
          rarity: 'Duo',
          naturalSelectionTargets: ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloWeaponBoon'],
        },
      ],
      selected: 'option1',
    };
    const decoded = decodeExecutionTraitOffer(offer, 'offer');
    if (decoded.kind !== 'traits')
      throw new Error('Natural Selection must decode as an ordinary trait offer');
    expect(decoded.options[0]?.naturalSelectionTargets).toEqual([
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloWeaponBoon',
    ]);
    expect(() =>
      decodeExecutionTraitOffer(
        { ...offer, options: [{ ...offer.options[0], naturalSelectionTargets: [] }] },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [
            { ...offer.options[0], naturalSelectionTargets: Array(9).fill('ApolloWeaponBoon') },
          ],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
  });

  it('strictly decodes a selected targeted-acquisition trait', () => {
    const offer = {
      kind: 'traits',
      giver: 'Hera',
      options: [
        { key: 'BoonDecayBoon', rarity: 'Epic', targetTraitKey: 'ApolloSprintBoon' },
        { key: 'HeraCastBoon', rarity: 'Common' },
      ],
      selected: 'option1',
    };
    expect(decodeExecutionTraitOffer(offer, 'offer')).toMatchObject({
      options: [{ targetTraitKey: 'ApolloSprintBoon' }, {}],
    });
    expect(() => decodeExecutionTraitOffer({ ...offer, selected: 'option2' }, 'offer')).toThrow(
      ExecutionPlanCodecError,
    );
  });

  it('requires the complete three-row Hex contract only for SpellDrop offers', () => {
    const spell = {
      kind: 'traits',
      giver: 'SpellDrop',
      options: [{ key: 'one' }, { key: 'two' }, { key: 'three' }],
      selected: 'option1',
      hexTree: { layoutKey: 'Lung', rareTalentKeys: ['rare'], epicTalentKeys: ['epic'] },
    };
    expect(decodeExecutionTraitOffer(spell, 'spell')).toMatchObject({ giver: 'SpellDrop' });
    const missingTree = {
      kind: spell.kind,
      giver: spell.giver,
      options: spell.options,
      selected: spell.selected,
    };
    expect(() => decodeExecutionTraitOffer(missingTree, 'spell')).toThrow(ExecutionPlanCodecError);
    expect(() =>
      decodeExecutionTraitOffer({ ...spell, options: [{ key: 'one' }] }, 'spell'),
    ).toThrow(ExecutionPlanCodecError);
    expect(() => decodeExecutionTraitOffer({ ...spell, giver: 'Zeus' }, 'spell')).toThrow(
      ExecutionPlanCodecError,
    );
  });

  it('strictly decodes a selected-option Concave Stone disposition', () => {
    const offer = {
      kind: 'traits',
      giver: 'Apollo',
      options: [
        { key: 'ApolloWeaponBoon', concaveStoneResult: { kind: 'proc', optionKey: 'option2' } },
        { key: 'ApolloSpecialBoon' },
      ],
      selected: 'option1',
    };
    expect(decodeExecutionTraitOffer(offer, 'offer')).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ concaveStoneResult: { kind: 'proc', optionKey: 'option2' } }),
      ]),
    });
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [
            { ...offer.options[0], concaveStoneResult: { kind: 'proc', optionKey: 'option1' } },
            offer.options[1],
          ],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [
            offer.options[0],
            { ...offer.options[1], concaveStoneResult: { kind: 'noProc' } },
          ],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
  });

  it('strictly decodes only bounded selected-option Circe resolutions', () => {
    const offer = {
      kind: 'traits',
      giver: 'Circe',
      options: [
        {
          key: 'ArcanaRarityTrait',
          circeResolution: {
            kind: 'promoteArcana',
            arcanaKeys: ['CastCount', 'CardDraw'],
          },
        },
        { key: 'CirceShrinkTrait' },
      ],
      selected: 'option1',
    };
    const decoded = decodeExecutionTraitOffer(offer, 'offer');
    if (decoded.kind !== 'traits') throw new Error('Circe must decode as a trait offer');
    expect(decoded.options[0]?.circeResolution).toEqual({
      kind: 'promoteArcana',
      arcanaKeys: ['CastCount', 'CardDraw'],
    });
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [
            {
              ...offer.options[0],
              circeResolution: {
                kind: 'promoteArcana',
                arcanaKeys: ['CastCount', 'CardDraw', 'ChanneledCast'],
              },
            },
          ],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          giver: 'Zeus',
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
    expect(() =>
      decodeExecutionTraitOffer(
        {
          ...offer,
          options: [offer.options[1], offer.options[0]],
        },
        'offer',
      ),
    ).toThrow(ExecutionPlanCodecError);
  });

  it('strictly decodes only a selected Icarus Latest Model Hammer target', () => {
    const offer = {
      kind: 'traits',
      giver: 'Icarus',
      options: [
        { key: 'UpgradeHammerBoon', icarusHammerTarget: 'StaffDoubleAttackTrait' },
        { key: 'OmegaExplodeBoon' },
      ],
      selected: 'option1',
    };
    const decoded = decodeExecutionTraitOffer(offer, 'offer');
    if (decoded.kind !== 'traits') throw new Error('Icarus must decode as a trait offer');
    expect(decoded.options[0]?.icarusHammerTarget).toBe('StaffDoubleAttackTrait');
    expect(() => decodeExecutionTraitOffer({ ...offer, giver: 'Circe' }, 'offer')).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() => decodeExecutionTraitOffer({ ...offer, selected: 'option2' }, 'offer')).toThrow(
      ExecutionPlanCodecError,
    );
  });

  it('strictly decodes Echo volatile results only on their selected outer rows', () => {
    const boon = {
      kind: 'traits',
      giver: 'Echo',
      options: [
        {
          key: 'EchoLastRunBoon',
          echoLastRunBoon: {
            options: [
              { giver: 'Hera', key: 'HeraWeaponBoon', rarity: 'Rare' },
              {
                giver: 'Zeus',
                key: 'ZeusSpecialBoon',
                rarity: 'Epic',
                allTogetherResult: {
                  earth: 'Earth',
                  fire: 'Fire',
                  air: 'Air',
                  water: 'Water',
                },
              },
            ],
            selected: 'option2',
          },
        },
        { key: 'DiminishingDodgeBoon' },
      ],
      selected: 'option1',
    };
    const decodedBoon = decodeExecutionTraitOffer(boon, 'Echo offer');
    if (decodedBoon.kind !== 'traits') throw new Error('Echo must decode as a trait offer');
    expect(decodedBoon.options[0]?.echoLastRunBoon?.options).toHaveLength(2);
    expect(decodedBoon.options[0]?.echoLastRunBoon?.options[1]?.allTogetherResult).toEqual({
      earth: 'Earth',
      fire: 'Fire',
      air: 'Air',
      water: 'Water',
    });
    const nonselectedCarrier = {
      ...boon,
      options: [
        {
          ...boon.options[0],
          echoLastRunBoon: {
            ...boon.options[0]!.echoLastRunBoon,
            options: [
              {
                ...boon.options[0]!.echoLastRunBoon!.options[0],
                allTogetherResult: {
                  earth: 'Earth',
                  fire: 'Fire',
                  air: 'Air',
                  water: 'Water',
                },
              },
              boon.options[0]!.echoLastRunBoon!.options[1],
            ],
          },
        },
        boon.options[1],
      ],
    };
    expect(() => decodeExecutionTraitOffer(nonselectedCarrier, 'Echo offer')).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() => decodeExecutionTraitOffer({ ...boon, selected: 'option2' }, 'Echo offer')).toThrow(
      ExecutionPlanCodecError,
    );

    const pom = {
      kind: 'traits',
      giver: 'Echo',
      options: [
        { key: 'DiminishingDodgeBoon' },
        { key: 'EchoDoubleLevelBoon', echoPomTarget: 'ZeusWeaponBoon' },
      ],
      selected: 'option2',
    };
    const decodedPom = decodeExecutionTraitOffer(pom, 'Echo offer');
    if (decodedPom.kind !== 'traits') throw new Error('Echo must decode as a trait offer');
    expect(decodedPom.options[1]?.echoPomTarget).toBe('ZeusWeaponBoon');
    expect(() => decodeExecutionTraitOffer({ ...pom, giver: 'Icarus' }, 'Echo offer')).toThrow(
      ExecutionPlanCodecError,
    );
  });

  it('strictly decodes one closed volatile keepsake replay result', () => {
    const replay = {
      kind: 'keepsakeReplay',
      owner: 'echo-replay',
      window: { kind: 'standard', phase: 'beforeCombat' },
      keepsakeKey: 'TempHammerKeepsake',
      equipResults: { experimentalHammer: { kind: 'exhausted' } },
    };
    expect(decodeExecutionTransaction(replay, 'replay')).toMatchObject({
      kind: 'keepsakeReplay',
      equipResults: { experimentalHammer: { kind: 'exhausted' } },
    });
    for (const equipResults of [
      {},
      { jeweledPom: { traitKey: 'PomTrait' } },
      {
        experimentalHammer: { kind: 'exhausted' },
        transcendentEmbryo: { blessingKey: 'Blessing', blessingValues: {} },
      },
    ]) {
      expect(() => decodeExecutionTransaction({ ...replay, equipResults }, 'replay')).toThrow(
        ExecutionPlanCodecError,
      );
    }
  });

  it.each([
    ['f-opening', fOnlyProject(), fOpeningFixture],
    ['fg', createCompleteFGProject(), fgFixture],
    ['fg-ixion-chaos', createCompleteFGIxionChaosProject(), fgIxionChaosFixture],
    ['fg-anomaly', createCompleteFGAnomalyProject(), fgAnomalyFixture],
    ['automatic-boss', bossAutomaticOutcomeProject(), automaticBossFixture],
  ])('keeps the %s product byte-stable', (_name, project, fixture) => {
    const { plan } = planFor(project);
    if (fixture !== undefined) expect(decodeExecutionPlan(fixture)).toEqual(plan);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('publishes native-only Empty carriers without manufacturing timeline phases', () => {
    const { plan } = planFor(createCompleteFGProject());
    const intro = plan.occurrences.find((occurrence) => occurrence.gameName === 'G_Intro');
    expect(intro?.overview).toMatchObject({
      unmodeledEncounterKeys: ['Empty'],
      encounterPhases: [],
    });
  });

  it('requires the semantic Fountain contact on every fountain-use transaction', () => {
    const { plan } = planFor(fOnlyProject());
    const fountain = plan.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find((transaction) => transaction.kind === 'fountainUse');
    expect(fountain).toMatchObject({ interactionKey: 'fountain' });

    const malformed = JSON.parse(encodeExecutionPlan(plan)) as {
      occurrences: { timeline: { transactions: Record<string, unknown>[] } }[];
    };
    const malformedFountain = malformed.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find((transaction) => transaction.kind === 'fountainUse');
    expect(malformedFountain).toBeDefined();
    if (malformedFountain === undefined) throw new Error('fixture lacks a Fountain interaction');
    delete malformedFountain.interactionKey;
    expect(() => decodeExecutionPlan(malformed)).toThrow(ExecutionPlanCodecError);
  });

  it('keeps diagnostic frames compact and nonblocking on the wire', () => {
    const { plan } = planFor(createCompleteFGProject());
    const encoded = encodeExecutionPlan(plan);
    const wire = JSON.parse(encoded) as {
      readonly occurrences: readonly {
        readonly diagnostics?: {
          readonly roomEntered?: Record<string, unknown>;
          readonly beforeRoomExit?: Record<string, unknown>;
        };
      }[];
    };
    const diagnosticFrames = wire.occurrences.flatMap((occurrence) =>
      [occurrence.diagnostics?.roomEntered, occurrence.diagnostics?.beforeRoomExit].filter(
        (frame): frame is Record<string, unknown> => frame !== undefined && 'frame' in frame,
      ),
    );
    expect(diagnosticFrames[0]).toMatchObject({ frame: 0 });
    expect(Object.keys((diagnosticFrames[0]!.replace ?? {}) as object)).toHaveLength(13);
    expect(
      diagnosticFrames.some((frame) => Object.keys((frame.replace ?? {}) as object).length < 13),
    ).toBe(true);
    expect(encoded.length).toBeLessThan(JSON.stringify(plan).length * 0.75);
    expect(decodeExecutionPlan(wire)).toEqual(plan);
  });

  it('strictly validates the resource policy references and room-exit element fact', () => {
    const { plan } = planFor(fOnlyProject());
    const wire = (): Record<string, unknown> =>
      JSON.parse(encodeExecutionPlan(plan)) as Record<string, unknown>;
    const valid = wire();
    expect(decodeExecutionPlan(valid)).toEqual(plan);
    for (const occurrence of plan.occurrences) {
      if (occurrence.diagnostics?.beforeRoomExit === undefined) continue;
      expect(occurrence.roomExitConformance?.facts).toContainEqual({ kind: 'elementCounts' });
      expect(occurrence.diagnostics.beforeRoomExit.traits.elements).toEqual({
        Aether: expect.any(Number),
        Earth: expect.any(Number),
        Air: expect.any(Number),
        Fire: expect.any(Number),
        Water: expect.any(Number),
      });
    }

    const missing = wire();
    delete missing.resources;
    expect(() => decodeExecutionPlan(missing)).toThrow(/resources is required/);

    const malformedDisposition = wire();
    const malformedRows = (
      malformedDisposition.resources as { occurrences: Record<string, unknown>[] }
    ).occurrences;
    malformedRows[0] = {
      ...malformedRows[0],
      pointDispositions: {
        ...(malformedRows[0]!.pointDispositions as Record<string, unknown>),
        Pickaxe: 'roll',
      },
    };
    refreshWireFingerprint(malformedDisposition);
    expect(() => decodeExecutionPlan(malformedDisposition)).toThrow(/is unsupported/);

    const duplicate = wire();
    const duplicateRows = (duplicate.resources as { occurrences: Record<string, unknown>[] })
      .occurrences;
    duplicateRows.push({ ...duplicateRows[0] });
    refreshWireFingerprint(duplicate);
    expect(() => decodeExecutionPlan(duplicate)).toThrow(
      /resource occurrences must have unique IDs/,
    );

    const malformedConformance = wire();
    const firstOccurrence = (malformedConformance.occurrences as Record<string, unknown>[])[0]!;
    const conformance = firstOccurrence.roomExitConformance as { facts: Record<string, unknown>[] };
    conformance.facts = conformance.facts.filter((fact) => fact.kind !== 'elementCounts');
    refreshWireFingerprint(malformedConformance);
    expect(() => decodeExecutionPlan(malformedConformance)).toThrow(
      /room-exit conformance is missing elementCounts/,
    );

    const incompleteElementVector = wire();
    const firstDiagnostic = (
      incompleteElementVector.occurrences as {
        diagnostics: { roomEntered: { replace: { traits: { elements: Record<string, number> } } } };
      }[]
    )[0]!.diagnostics.roomEntered.replace.traits.elements;
    delete firstDiagnostic.Water;
    expect(() => decodeExecutionPlan(incompleteElementVector)).toThrow(
      /traits\.elements\.Water is required/,
    );
  });

  it('rejects disconnected cursors and contradictory target identities on the codec boundary', () => {
    const { product } = planFor(createCompleteFGProject());
    const opening = product.occurrences[0]!;
    if (opening.doors.kind !== 'batch') throw new Error('expected opening batch');
    const openingDoors = opening.doors;
    const connected = new Set(openingDoors.targets.map((target) => target.room.id));
    const disconnected = product.occurrences.find(
      (occurrence) =>
        occurrence.id !== opening.id &&
        !connected.has(occurrence.id) &&
        !(opening.overview.additional ?? []).some(
          (additional) => additional.room.id === occurrence.id,
        ),
    );
    expect(disconnected).toBeDefined();
    if (disconnected === undefined) throw new Error('fixture lacks disconnected occurrence');
    const disconnectedPlan = compileExecutionPlan({
      product: Object.freeze({
        ...product,
        selectedOccurrenceIds: Object.freeze([opening.id, disconnected.id]),
      }),
    });
    expect(() => decodeExecutionPlan(disconnectedPlan)).toThrow(/disconnected/);

    const target = openingDoors.targets[0]!;
    const contradictoryProduct = Object.freeze({
      ...product,
      occurrences: Object.freeze(
        product.occurrences.map((occurrence) =>
          occurrence.id !== opening.id
            ? occurrence
            : Object.freeze({
                ...occurrence,
                doors: Object.freeze({
                  ...occurrence.doors,
                  targets: Object.freeze([
                    Object.freeze({
                      ...target,
                      room: Object.freeze({ ...target.room, gameName: 'ContradictoryRoom' }),
                    }),
                    ...openingDoors.targets.slice(1),
                  ]),
                }),
              }),
        ),
      ),
    });
    const contradictoryPlan = compileExecutionPlan({ product: contradictoryProduct });
    expect(() => decodeExecutionPlan(contradictoryPlan)).toThrow(
      /contradicts its occurrence identity/,
    );
  });

  it('rejects protocol-v9 trace products and malformed v10 unions', () => {
    expect(() => decodeExecutionPlan({ ...fOpeningFixture, protocolVersion: 9 })).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() =>
      decodeExecutionPlan({
        ...fOpeningFixture,
        rooms: fOpeningFixture.occurrences,
        occurrences: undefined,
      }),
    ).toThrow(ExecutionPlanCodecError);
    const malformed = JSON.parse(JSON.stringify(fOpeningFixture)) as Record<string, unknown>;
    const occurrences = malformed.occurrences as Record<string, unknown>[];
    const timeline = occurrences[0]!.timeline as Record<string, unknown>;
    const transactions = timeline.transactions as Record<string, unknown>[];
    transactions[0] = {
      kind: 'acquisition',
      owner: 'opaque',
      sourceOwner: 'opaque',
      reward: {},
      producerLifecycleKey: 'x',
      roles: [],
      window: { kind: 'postOutgoing' },
      required: true,
    };
    expect(() => decodeExecutionPlan(malformed)).toThrow(ExecutionPlanCodecError);
  });

  it('rejects the G-only Anomaly payload on an F occurrence', () => {
    const { product } = planFor(fOnlyProject());
    const malformed = compileExecutionPlan({
      product: Object.freeze({
        ...product,
        occurrences: Object.freeze(
          product.occurrences.map((occurrence, index) =>
            index === 0
              ? Object.freeze({
                  ...occurrence,
                  anomaly: Object.freeze({
                    replacedRoomGameName: 'F_Combat01',
                    success: true,
                  }),
                })
              : occurrence,
          ),
        ),
      }),
    });
    expect(() => decodeExecutionPlan(malformed)).toThrow(/only supported for G occurrences/);
  });

  it('rejects unknown fields in the strict Anomaly payload union', () => {
    const malformed = JSON.parse(JSON.stringify(fgAnomalyFixture)) as {
      occurrences: Array<{ anomaly?: Record<string, unknown> }>;
    };
    const occurrence = malformed.occurrences.find((entry) => entry.anomaly !== undefined);
    if (occurrence?.anomaly === undefined) throw new Error('fixture lacks Anomaly payload');
    occurrence.anomaly.extra = true;
    expect(() => decodeExecutionPlan(malformed)).toThrow(/unknown field extra/);
  });

  it('rejects incomplete or duplicate interacted Well and Pool inventories', () => {
    const wellMalformed = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{ overview: { stygianWell?: Record<string, unknown> } }>;
    };
    const wellOccurrence = wellMalformed.occurrences.find(
      (entry) => entry.overview.stygianWell !== undefined,
    );
    if (wellOccurrence?.overview.stygianWell === undefined)
      throw new Error('fixture lacks a Well overview');
    const well = wellOccurrence.overview.stygianWell;
    well.interacted = true;
    delete well.offers;
    expect(() => decodeExecutionPlan(wellMalformed)).toThrow(
      /offers must be present iff interacted/,
    );

    const duplicateWell = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{
        overview: { stygianWell?: { interacted: boolean; offers?: unknown[] } };
      }>;
    };
    const duplicateWellOccurrence = duplicateWell.occurrences.find(
      (entry) => entry.overview.stygianWell?.offers !== undefined,
    );
    if (duplicateWellOccurrence?.overview.stygianWell?.offers === undefined)
      throw new Error('fixture lacks interacted Well inventory');
    duplicateWellOccurrence.overview.stygianWell.offers.push(
      duplicateWellOccurrence.overview.stygianWell.offers[0],
    );
    expect(() => decodeExecutionPlan(duplicateWell)).toThrow(/duplicate generation keys/);

    const poolMalformed = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{ overview: { purgingPool?: Record<string, unknown> } }>;
    };
    const poolOccurrence = poolMalformed.occurrences.find(
      (entry) => entry.overview.purgingPool !== undefined,
    );
    if (poolOccurrence?.overview.purgingPool === undefined)
      throw new Error('fixture lacks a Pool overview');
    const pool = poolOccurrence.overview.purgingPool;
    pool.interacted = false;
    delete pool.traits;
    refreshWireFingerprint(poolMalformed as unknown as Record<string, unknown>);
    expect(() => decodeExecutionPlan(poolMalformed)).not.toThrow();
    pool.interacted = true;
    delete pool.traits;
    expect(() => decodeExecutionPlan(poolMalformed)).toThrow(
      /traits must be present iff interacted/,
    );

    const duplicatePool = JSON.parse(
      JSON.stringify(planFor(authorLegalTraitOffers(createUnderworldFPoolCheckpoint())).plan),
    ) as {
      occurrences: Array<{
        overview: { purgingPool?: { interacted: boolean; traits?: unknown[] } };
      }>;
    };
    const duplicatePoolOccurrence = duplicatePool.occurrences.find(
      (entry) => entry.overview.purgingPool?.traits !== undefined,
    );
    if (duplicatePoolOccurrence?.overview.purgingPool?.traits === undefined)
      throw new Error('fixture lacks interacted Pool inventory');
    duplicatePoolOccurrence.overview.purgingPool.traits[1] =
      duplicatePoolOccurrence.overview.purgingPool.traits[0];
    expect(() => decodeExecutionPlan(duplicatePool)).toThrow(/duplicate slot keys/);
  });

  it('validates sparse dependency owner integrity without retaining the removed streams field', () => {
    const plan = planWithGenericDependency();
    const wire = () =>
      JSON.parse(encodeExecutionPlan(plan)) as {
        occurrences: Array<{
          timeline: {
            dependencies: Array<{ owner: string; afterOwner: string }>;
          } & Record<string, unknown>;
        }>;
      };
    const valid = wire();
    expect(decodeExecutionPlan(valid)).toEqual(plan);
    const occurrence = valid.occurrences.find((entry) => entry.timeline.dependencies.length > 0);
    if (occurrence === undefined) throw new Error('fixture lacks a dependency');
    const dependency = occurrence.timeline.dependencies[0]!;

    const missingOwner = wire();
    const missingOccurrence = missingOwner.occurrences.find(
      (entry) => entry.timeline.dependencies.length > 0,
    )!;
    missingOccurrence.timeline.dependencies[0] = {
      ...missingOccurrence.timeline.dependencies[0]!,
      afterOwner: 'missing-owner',
    };
    expect(() => decodeExecutionPlan(missingOwner)).toThrow(/unresolved dependency owner/);

    const duplicate = wire();
    const duplicateOccurrence = duplicate.occurrences.find(
      (entry) => entry.timeline.dependencies.length > 0,
    )!;
    duplicateOccurrence.timeline.dependencies.push({ ...dependency });
    expect(() => decodeExecutionPlan(duplicate)).toThrow(/duplicate dependency/);

    const self = wire();
    const selfOccurrence = self.occurrences.find(
      (entry) => entry.timeline.dependencies.length > 0,
    )!;
    selfOccurrence.timeline.dependencies[0] = {
      owner: selfOccurrence.timeline.dependencies[0]!.owner,
      afterOwner: selfOccurrence.timeline.dependencies[0]!.owner,
    };
    expect(() => decodeExecutionPlan(self)).toThrow(/self dependency/);

    const cycle = wire();
    const cycleOccurrence = cycle.occurrences.find(
      (entry) => entry.timeline.dependencies.length > 0,
    )!;
    cycleOccurrence.timeline.dependencies.push({
      owner: dependency.afterOwner,
      afterOwner: dependency.owner,
    });
    expect(() => decodeExecutionPlan(cycle)).toThrow(/dependenc.*cycle/);

    const removedStreams = wire();
    removedStreams.occurrences[0]!.timeline.streams = [];
    expect(() => decodeExecutionPlan(removedStreams)).toThrow(/unknown field streams/);
  });

  it('rejects every cross-occurrence prerequisite', () => {
    const product = planFor(createCompleteFGProject()).product;
    const pair = selectedTransactionPair(product);
    const crossOccurrence = productWithDependency(
      product,
      pair.dependentOccurrenceId,
      pair.dependentOwner,
      pair.prerequisiteOwner,
    );
    expect(() => validateExecutionProduct(crossOccurrence)).toThrow(/cross-occurrence dependency/);
    expect(() => decodeExecutionPlan(compileExecutionPlan({ product: crossOccurrence }))).toThrow(
      /cross-occurrence dependency/,
    );

    const selected = new Set(product.selectedOccurrenceIds);
    const sourceForUnselected = product.occurrences.find(
      (occurrence) =>
        selected.has(occurrence.id) && occurrence.timeline.transactions[0] !== undefined,
    );
    if (sourceForUnselected?.timeline.transactions[0] === undefined)
      throw new Error('fixture lacks a transaction occurrence to clone');
    const unselectedOwner = 'unselected-occurrence-owner';
    const unselected = Object.freeze({
      ...sourceForUnselected,
      id: 'unselected-occurrence',
      owner: unselectedOwner,
      timeline: Object.freeze({
        ...sourceForUnselected.timeline,
        transactions: Object.freeze([
          Object.freeze({
            ...sourceForUnselected.timeline.transactions[0],
            owner: unselectedOwner,
          }),
        ]),
        dependencies: Object.freeze([]),
        obligations: Object.freeze([
          Object.freeze({
            ...sourceForUnselected.timeline.obligations[0]!,
            owner: unselectedOwner,
          }),
        ]),
      }),
    });
    const productWithUnselected = Object.freeze({
      ...product,
      occurrences: Object.freeze([...product.occurrences, unselected]),
    });
    const unselectedDependency = productWithDependency(
      productWithUnselected,
      pair.dependentOccurrenceId,
      pair.dependentOwner,
      unselectedOwner,
    );
    expect(() => validateExecutionProduct(unselectedDependency)).toThrow(
      /cross-occurrence dependency/,
    );
    expect(() =>
      decodeExecutionPlan(compileExecutionPlan({ product: unselectedDependency })),
    ).toThrow(/cross-occurrence dependency/);

    const futureOccurrence = product.occurrences.find(
      (occurrence) =>
        product.selectedOccurrenceIds.indexOf(occurrence.id) > pair.dependentIndex &&
        occurrence.timeline.transactions[0] !== undefined,
    );
    if (futureOccurrence?.timeline.transactions[0] === undefined)
      throw new Error('fixture lacks a later selected transaction occurrence');
    const future = productWithDependency(
      product,
      pair.dependentOccurrenceId,
      pair.dependentOwner,
      futureOccurrence.timeline.transactions[0].owner,
    );
    expect(() => validateExecutionProduct(future)).toThrow(/cross-occurrence dependency/);
    expect(() => decodeExecutionPlan(compileExecutionPlan({ product: future }))).toThrow(
      /cross-occurrence dependency/,
    );
  });
});
