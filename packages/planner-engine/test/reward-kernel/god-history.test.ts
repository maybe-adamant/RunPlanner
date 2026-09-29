import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  factsWithHistory,
  ordinarySourceGameNames,
  recordGodLootPickup,
  supportedPayloads,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../src/reward-kernel';
import { evaluateRequirement, type RequirementEvaluationContext } from '../../src/requirements';

const rewards = catalog.rewards;
const ordinaryGods = ordinarySourceGameNames(rewards);

function baseFacts(): RewardKernelFacts {
  return {
    requirements: {
      routeKey: 'Underworld',
      counters: {
        biomeDepthCache: 2,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: { biomeUseRecord: {}, lootTypeHistory: {}, roomsEntered: {}, useRecord: {} },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: { hubRewardLookup: new Set() },
      offeredRewardTypes: new Set(),
      runDepthCache: 3,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 2,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

const factsFor = (history: RewardHistoryState) => factsWithHistory(baseFacts(), history, new Set());

const loot = (gameName: string) => ({ kind: 'loot' as const, gameName });

function sources(rewardType: string, history: RewardHistoryState): readonly string[] {
  return supportedPayloads(rewards, rewards.rewardTypes.byKey[rewardType]!, factsFor(history))
    .flatMap((payload) => (payload.kind === 'BoonSource' ? [payload.source] : []))
    .sort();
}

const without = (...excluded: string[]) =>
  ordinaryGods.filter((god) => !excluded.includes(god)).sort();

describe('save-file god history', () => {
  it('seeds a mature file with every ordinary god used and picked up, and a closed file empty', () => {
    const mature = createRewardHistoryState(rewards, 'mature');
    const closed = createRewardHistoryState(rewards, 'closed');
    const everyGod = Object.fromEntries(ordinaryGods.map((god) => [god, 1]));
    expect(mature.lifetimeGodUseRecord).toEqual(everyGod);
    expect(mature.lifetimeGodPickupRecord).toEqual(everyGod);
    expect(closed.lifetimeGodUseRecord).toEqual({});
    expect(closed.lifetimeGodPickupRecord).toEqual({});
  });

  it('keeps initial history out of the current run ledgers', () => {
    for (const saveFile of ['mature', 'closed'] as const) {
      const history = createRewardHistoryState(rewards, saveFile);
      expect(history.lootTypeHistory).toEqual({});
      expect(history.useRecord).toEqual({});
    }
  });

  it('distinguishes an offer, a use and a completed pickup', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    const offered = applyOfferProjection(
      rewards,
      closed,
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
      factsFor(closed),
    );
    expect(offered.lifetimeGodUseRecord).toEqual({});
    expect(offered.lifetimeGodPickupRecord).toEqual({});

    const used = applyConcreteAcquisition(rewards, offered, loot('PoseidonUpgrade'));
    expect(used.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(used.lifetimeGodPickupRecord).toEqual({});

    const pickedUp = recordGodLootPickup(rewards, used, 'PoseidonUpgrade');
    expect(pickedUp.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(pickedUp.lifetimeGodPickupRecord).toEqual({ PoseidonUpgrade: 1 });
  });

  it('records only ordinary gods', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    const hermes = applyConcreteAcquisition(rewards, closed, loot('HermesUpgrade'));
    expect(hermes.useRecord).toEqual({ HermesUpgrade: 1 });
    expect(hermes.lifetimeGodUseRecord).toEqual({});
    expect(recordGodLootPickup(rewards, hermes, 'HermesUpgrade')).toBe(hermes);
  });

  it('carries both records into requirement facts', () => {
    const history = recordGodLootPickup(
      rewards,
      createRewardHistoryState(rewards, 'closed'),
      'ApolloUpgrade',
    );
    expect(factsFor(history).requirements.records).toMatchObject({
      lifetimeGodUseRecord: {},
      lifetimeGodPickupRecord: { ApolloUpgrade: 1 },
    });
  });
});

describe('Hestia and Aphrodite loot requirement', () => {
  it('admits both only after Poseidon or Demeter is used on the file', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    expect(sources('Boon', closed)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
    for (const god of ['PoseidonUpgrade', 'DemeterUpgrade']) {
      const used = applyConcreteAcquisition(rewards, closed, loot(god));
      expect(sources('Boon', used)).toEqual(without());
    }
    expect(sources('Boon', createRewardHistoryState(rewards, 'mature'))).toEqual(without());
  });

  it('is not satisfied by another god, an offer or a pickup record alone', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    const zeusUsed = applyConcreteAcquisition(rewards, closed, loot('ZeusUpgrade'));
    expect(sources('Boon', zeusUsed)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
    const poseidonOffered = applyOfferProjection(
      rewards,
      closed,
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
      factsFor(closed),
    );
    expect(sources('Boon', poseidonOffered)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
    const pickupOnly = recordGodLootPickup(rewards, closed, 'PoseidonUpgrade');
    expect(sources('Boon', pickupOnly)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
  });

  it('gates the counted door at generation and keeps the run cap independent', () => {
    const runProgress = rewards.stores.byKey.RunProgress!;
    const hestiaDoor = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' },
    };
    const closed = createRewardHistoryState(rewards, 'closed');
    const bag = createRewardBagState(runProgress);
    expect(consumeCountedOffer(rewards, runProgress, bag, hestiaDoor, factsFor(closed))).toEqual(
      [],
    );
    const used = applyConcreteAcquisition(rewards, closed, loot('DemeterUpgrade'));
    expect(
      consumeCountedOffer(rewards, runProgress, bag, hestiaDoor, factsFor(used)).length,
    ).toBeGreaterThan(0);

    // The four-god cap still counts this run's gods, not the file's history.
    const capped = ['ApolloUpgrade', 'AresUpgrade', 'HeraUpgrade', 'ZeusUpgrade'].reduce(
      (history, god) => applyConcreteAcquisition(rewards, history, loot(god)),
      createRewardHistoryState(rewards, 'mature'),
    );
    expect(sources('Boon', capped)).toEqual(
      ['ApolloUpgrade', 'AresUpgrade', 'HeraUpgrade', 'ZeusUpgrade'].sort(),
    );
  });

  it('reports a context without save-file history as a contract error', () => {
    const context = baseFacts().requirements as RequirementEvaluationContext;
    const requirement = rewards.acquisitions.byKey.HestiaUpgrade!.lootRequirement!;
    expect(() => evaluateRequirement(requirement, context)).toThrow(/lifetimeGodUseRecord/);
  });
});

describe('World Shop boon god selection', () => {
  it('intersects eligible gods with gods picked up on the file', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    const apollo = recordGodLootPickup(rewards, closed, 'ApolloUpgrade');
    expect(sources('RandomLoot', apollo)).toEqual(['ApolloUpgrade']);
    const both = recordGodLootPickup(rewards, apollo, 'ZeusUpgrade');
    expect(sources('RandomLoot', both)).toEqual(['ApolloUpgrade', 'ZeusUpgrade']);
  });

  it('falls back to every eligible god when the intersection is empty', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    expect(sources('RandomLoot', closed)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
    // A picked-up god that is no longer eligible leaves the intersection empty.
    const gated = recordGodLootPickup(rewards, closed, 'HestiaUpgrade');
    expect(sources('RandomLoot', gated)).toEqual(without('AphroditeUpgrade', 'HestiaUpgrade'));
  });

  it('reads pickups, not uses, and leaves Mystery Boon on ordinary eligibility', () => {
    const closed = createRewardHistoryState(rewards, 'closed');
    const apolloPicked = recordGodLootPickup(rewards, closed, 'ApolloUpgrade');
    const zeusUsed = applyConcreteAcquisition(rewards, apolloPicked, loot('ZeusUpgrade'));
    expect(sources('RandomLoot', zeusUsed)).toEqual(['ApolloUpgrade']);
    expect(sources('BlindBoxLoot', apolloPicked)).toEqual(
      without('AphroditeUpgrade', 'HestiaUpgrade'),
    );
  });

  it('keeps the mature shop domain unchanged', () => {
    const mature = createRewardHistoryState(rewards, 'mature');
    expect(sources('RandomLoot', mature)).toEqual(sources('BlindBoxLoot', mature));
    expect(sources('RandomLoot', mature)).toEqual(without());
  });
});
