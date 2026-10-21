import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../../src/reward-kernel';
import type { DraftSpec } from '../../../src/simulation';
import type { RunStateSnapshot } from '../../../src/simulation/rewards';
import {
  draftBoonEntriesLeft,
  draftDoorStoreKeys,
  draftSideDoorWeight,
  draftSiblingHoldsGodBoon,
} from '../../../src/simulation/draft/steering';
import { draftSteeringFor } from '../../support/draft-walk';

function offer(rewardType: string, source?: string): ResolvedRewardOffer {
  const found = locallyValidRewardOffers(catalog.rewards, rewardType).find(
    (candidate) =>
      source === undefined ||
      (candidate.payload?.kind === 'BoonSource' && candidate.payload.source === source) ||
      (candidate.payload?.kind === 'DevotionPair' && candidate.payload.chosenSource === source),
  );
  if (found === undefined) throw new Error(`no ${rewardType} offer from ${source}`);
  return found;
}

const zeusBoon = offer('Boon', 'ZeusUpgrade');
const devotion = offer('Devotion', 'ZeusUpgrade');
const money = offer('RoomMoneyDrop');
const hermes = offer('HermesUpgrade');

describe('one boon door per exit', () => {
  it('counts a sibling door granting a god boon, a Devotion trial included', () => {
    const doors = (sibling: ResolvedRewardOffer | undefined) => [
      { occurrenceId: 'a', ...(sibling === undefined ? {} : { offer: sibling }) },
      { occurrenceId: 'b' },
    ];
    expect(draftSiblingHoldsGodBoon(catalog, doors(zeusBoon), 'b')).toBe(true);
    expect(draftSiblingHoldsGodBoon(catalog, doors(devotion), 'b')).toBe(true);
    expect(draftSiblingHoldsGodBoon(catalog, doors(zeusBoon), 'a')).toBe(false);
    expect(draftSiblingHoldsGodBoon(catalog, doors(money), 'b')).toBe(false);
    expect(draftSiblingHoldsGodBoon(catalog, doors(hermes), 'b')).toBe(false);
    expect(draftSiblingHoldsGodBoon(catalog, doors(undefined), 'b')).toBe(false);
  });

  it('damps only god boons beside a door that already holds one', () => {
    expect(draftSideDoorWeight(catalog, zeusBoon, 60, true)).toBeLessThan(1);
    expect(draftSideDoorWeight(catalog, devotion, 60, true)).toBeLessThan(1);
    expect(draftSideDoorWeight(catalog, zeusBoon, 60, false)).toBe(60);
    expect(draftSideDoorWeight(catalog, money, 1, true)).toBe(1);
  });
});

describe('boon bag reading', () => {
  it("reads the stores a biome's doors draw from", () => {
    const f = catalog.biomeLayouts.byKey.F!.progression.rewardStorePolicy;
    expect(draftDoorStoreKeys(catalog, 'Underworld', 'F')).toEqual(
      f.kind === 'authoredBaseStore' ? f.storeKeys : [],
    );
    expect(draftDoorStoreKeys(catalog, 'Underworld', 'F')).not.toContain('HubRewards');
    // Tartarus declares no base store; its rooms name their own.
    expect(draftDoorStoreKeys(catalog, 'Underworld', 'I')).toContain('TartarusRewards');
  });

  it('counts eligible boon entries in the named stores only', () => {
    const entry = (eligibility: string, count: number) => ({
      rewardType: 'Boon',
      eligibility,
      remaining: { kind: 'exact', count },
    });
    const bags = [
      { storeKey: 'RunProgress', entries: [entry('eligible', 1), entry('ineligible', 2)] },
      { storeKey: 'HubRewards', entries: [entry('eligible', 5)] },
    ] as unknown as RunStateSnapshot['bags'];
    expect(draftBoonEntriesLeft(bags, ['RunProgress'])).toBe(1);
    expect(draftBoonEntriesLeft(bags, ['RunProgress', 'HubRewards'])).toBe(6);
  });
});

describe('god purchases', () => {
  const traitOf = (godKey: string) => catalog.traitGivers.byKey[godKey]!.traitKeys;
  const spec = (routeKey: string, godKeys: readonly string[], basketTraitKeys: string[]) => {
    const base = createProjectDocument(catalog, {
      projectId: 's',
      routeKey,
      configuredBiomeCount: 1,
    });
    const { startingReward: _startingReward, ...loadout } =
      routeKey === 'FreshFile' ? base.route.loadout : createDefaultRouteLoadout(catalog);
    void _startingReward;
    const draft: DraftSpec = {
      loadout,
      world: { godKeys, storyNpcByBiome: {}, fieldNpcsByBiome: {} },
      basketTraitKeys,
      rackKeepsakeKeys: [],
    };
    return draftSteeringFor(base, draft);
  };

  it('puts the Shop boon of a god that can take its next basket trait first', () => {
    const steering = spec(
      'Underworld',
      ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
      ['ZeusWeaponBoon'],
    );
    expect(steering.shopWeight(offer('RandomLoot', 'ZeusUpgrade'))).toBeGreaterThan(
      steering.shopWeight(offer('RandomLoot', 'ApolloUpgrade')),
    );
  });

  it('prefers a queued unmet god over a Shop only where the save file starts closed', () => {
    const gods = ['Apollo', 'Poseidon', 'Demeter', 'Hestia'];
    const poseidonTrait = 'PoseidonWeaponBoon';
    expect(traitOf('Poseidon')).toContain(poseidonTrait);
    const fresh = spec('FreshFile', gods, [poseidonTrait]);
    expect(fresh.queuedNewGod(offer('Boon', 'PoseidonUpgrade'))).toBe(true);
    // Demeter has no queued basket trait.
    expect(fresh.queuedNewGod(offer('Boon', 'DemeterUpgrade'))).toBe(false);
    const mature = spec('Underworld', gods, [poseidonTrait]);
    expect(mature.queuedNewGod(offer('Boon', 'PoseidonUpgrade'))).toBe(false);
  });
});

describe('midshop preference', () => {
  it('weighs a mid-biome Shop door above a boon door only when the player prefers midshops', () => {
    const base = createProjectDocument(catalog, {
      projectId: 'm',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
    void _startingReward;
    const spec: DraftSpec = {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
      },
      basketTraitKeys: ['ZeusWeaponBoon'],
      rackKeepsakeKeys: [null, null, null],
    };
    const shop = (preferMidshops: boolean) =>
      draftSteeringFor(base, { ...spec, ...(preferMidshops ? { preferMidshops } : {}) }).roomWeight(
        'F_Shop01',
        'F',
      );
    const boonDoor = draftSteeringFor(base, spec);
    const boon = boonDoor.roomWeight('F_Combat01', 'F') * boonDoor.offerWeight(zeusBoon);
    expect(shop(true)).toBeGreaterThan(boon);
    expect(shop(false)).toBeLessThan(boon);
  });
});
