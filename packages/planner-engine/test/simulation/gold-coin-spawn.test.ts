import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  roomActionKey,
  traitGeneratedPickupSiteKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import { simulateProject } from '../../src/simulation';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import { type GoldGain } from '../../src/simulation/commerce/gold/gain-context';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import type { RewardBranch } from '../../src/simulation/rewards';
import { ordinaryRoutePosition } from '../support/route-position';

const combat09 = createOccurrenceId('golden-h-combat09');
const cage = (slotKey: string) =>
  createLocalRewardAddress(goldenHBiome, combat09, 'cages', slotKey);
const quickBuck = cage('cage1');
const buriedTreasure = cage('cage2');
const quickBuckScreen = createTraitOfferAddress(quickBuck, 'self');
const buriedTreasureScreen = createTraitOfferAddress(buriedTreasure, 'source');

type Action = Parameters<typeof replaceTestRoomActionOrder>[4][number];
const openCage = (slot: 1 | 2): Action[] => [
  { kind: 'completeFieldsCage', phaseKey: `Cage0${slot}` },
  { kind: 'interactLocalReward', groupKey: 'cages', slotKey: `cage${slot}` },
];
const coin = (screen: typeof quickBuckScreen, entryKey: string): Action => ({
  kind: 'interactAcquisitionEntry',
  siteKey: traitGeneratedPickupSiteKey(screen, 'option1'),
  entryKey,
});

/** Golden H with Quick Buck in combat09's first cage and `second` in its other. */
function withQuickBuck(second: 'buriedTreasure' | 'money'): ProjectDocument {
  let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
    kind: 'ReplaceLocalReward',
    reward: quickBuck,
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: quickBuckScreen,
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: ['MoneyMultiplierBoon', 'DodgeChanceBoon', 'SlowProjectileBoon'].map((traitKey) => ({
        traitKey,
        rarity: 'Common' as const,
      })),
      selectedOptionKey: 'option1',
    },
  } as never);
  if (second === 'money')
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: buriedTreasure,
      value: { rewardType: 'RoomMoneyDrop' },
    });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: buriedTreasure,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: buriedTreasureScreen,
    value: {
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
        { traitKey: 'PoseidonCastBoon', rarity: 'Rare' },
        { traitKey: 'PoseidonSprintBoon', rarity: 'Rare' },
      ],
      selectedOptionKey: 'option1',
    },
  } as never);
}

/** combat09's gold publications in walk order, from H walked after the pristine golden G. */
function combat09GoldEvents(
  project: ProjectDocument,
  order: readonly Action[],
  seed: (frontier: RewardBranch) => RewardBranch = (frontier) => frontier,
) {
  const ordered = replaceTestRoomActionOrder(project, catalog, goldenHBiome, combat09, order);
  const g = simulateProject(catalog, createGoldenFGHProject()).route!.biomes.find(
    (biome) => biome.biomeKey === 'G',
  );
  if (g?.authoring !== 'complete' || g.validity !== 'valid') throw new Error('G is incomplete');
  const rewards = evaluateProgressiveBiomeAssembly(
    catalog,
    goldenHBiome,
    ordered.route!.biomes.find((biome) => biome.biomeKey === 'H')!,
    {
      routePosition: ordinaryRoutePosition(catalog, 'Underworld', 'H'),
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: ordered.route!.loadout,
      seed: {
        history: g.history,
        // Hera leaves this run's loot history so Poseidon can appear in H.
        rewardFrontier: ((branch: RewardBranch) => {
          const { HeraUpgrade: _hera, ...lootTypeHistory } =
            branch.state.rewardHistory.lootTypeHistory;
          void _hera;
          return Object.freeze({
            ...branch,
            state: Object.freeze({
              ...branch.state,
              rewardHistory: Object.freeze({ ...branch.state.rewardHistory, lootTypeHistory }),
            }),
          });
        })(seed(g.rewards.frontier!)),
      },
    },
  )?.evaluation.rewards;
  if (rewards === undefined) throw new Error('H published no reward assessment');
  return rewards.goldEvents.filter(
    (event) => event.kind === 'gain' && event.room?.occurrenceId === combat09,
  );
}

/** combat09's money gains in walk order. */
function combat09MoneyGains(project: ProjectDocument, order: readonly Action[]) {
  return combat09GoldEvents(project, order).flatMap((event) =>
    event.kind === 'gain' &&
    event.room?.occurrenceId === combat09 &&
    event.contexts[0]?.gain.kind === 'moneyPickup'
      ? [
          event.contexts.map(
            (context) => context.gain as Extract<GoldGain, { kind: 'moneyPickup' }>,
          ),
        ]
      : [],
  );
}

describe('coin spawn valuation', () => {
  const spawn = (moneyMultiplier: number, moneyRewardBonus: number) => ({
    moneyMultiplier,
    moneyRewardBonus,
  });

  it('values each boon’s coins with the multipliers held as its screen closes', () => {
    const project = withQuickBuck('buriedTreasure');
    const qb = coin(quickBuckScreen, 'quickBuckGold');
    const small = coin(buriedTreasureScreen, 'smallGold');
    // Buried Treasure first: its coins spawn before Quick Buck; Quick Buck's after both.
    const treasureFirst = { qb: spawn(1.2, 1.5), small: spawn(1, 1.5) };
    // Quick Buck first: its coin spawns before Buried Treasure; Treasure's after both.
    const quickBuckFirst = { qb: spawn(1.2, 1), small: spawn(1.2, 1.5) };
    for (const [opening, expected] of [
      [[...openCage(2), ...openCage(1)], treasureFirst],
      [[...openCage(1), ...openCage(2)], quickBuckFirst],
    ] as const)
      // Collecting the coins in either order changes nothing: neither is re-multiplied.
      for (const coins of [
        [qb, small],
        [small, qb],
      ]) {
        const gains = combat09MoneyGains(project, [...opening, ...coins]).flat();
        const of = (gold: number) => gains.find((gain) => gain.gold === gold);
        expect(of(100)).toMatchObject({ spawn: expected.qb });
        expect(of(50)).toMatchObject({ spawn: expected.small });
        expect(gains.every((gain) => gain.remultipliers === undefined)).toBe(true);
      }
  });

  it('publishes each coin’s gold with the pickup action that collects it', () => {
    const qb = coin(quickBuckScreen, 'quickBuckGold');
    const events = combat09GoldEvents(withQuickBuck('money'), [...openCage(1), qb, ...openCage(2)]);
    const byAction = events.flatMap((event) =>
      event.kind === 'gain' && event.contexts[0]?.gain.kind === 'moneyPickup'
        ? [event.roomAction?.actionKey]
        : [],
    );
    // Quick Buck's own coins, then the second cage's money reward.
    expect(byAction).toEqual([
      roomActionKey(qb),
      roomActionKey({ kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' }),
    ]);
  });

  it('re-multiplies a cage’s gold by a Quick Buck taken before it is collected', () => {
    const project = withQuickBuck('money');
    const [cageGold] = combat09MoneyGains(project, [...openCage(1), ...openCage(2)]).filter(
      ([gain]) => gain?.gold === 100 && gain.remultipliers !== undefined,
    );
    // Spawned at the room's entry, before Quick Buck: valued at 1, then times 1.2.
    expect(cageGold).toEqual([
      expect.objectContaining({ spawn: spawn(1, 1), remultipliers: [1.2] }),
    ]);
    // Collected before Quick Buck, it is valued once and never re-multiplied.
    const [early] = combat09MoneyGains(project, [...openCage(2), ...openCage(1)]);
    expect(early).toEqual([expect.objectContaining({ gold: 100, spawn: spawn(1, 1) })]);
    expect(early![0]!.remultipliers).toBeUndefined();
  });
});
