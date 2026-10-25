import { describe, expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../../src/reward-kernel';
import type { DraftSpec } from '../../../src/simulation';
import type { RunStateSnapshot } from '../../../src/simulation/rewards';
import {
  draftBoonEntriesLeft,
  draftDoorStoreKeys,
  draftFillerKind,
  draftSideDoorWeight,
  draftSiblingHoldsGodBoon,
  draftPaceWeight,
  draftWindowForceChance,
} from '../../../src/simulation/draft/steering';
import { draftSteeringFor } from '../../support/draft-walk';
import { createDraftRng } from '../../../src/simulation/draft/rng';
import type { ForcePressureLedgerEntry } from '../../../src/simulation/generation';
import { draftBasket } from '../../support/draft-basket';

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
      basketByGiver: draftBasket(basketTraitKeys, {}, godKeys),
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

describe('ranked filler', () => {
  const base = createProjectDocument(catalog, {
    projectId: 'f',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  const gods = ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'];
  // Apollo has no basket trait, so the basket leaves nothing for him to give.
  const steeringFor = (fillerPriority?: DraftSpec['fillerPriority']) =>
    draftSteeringFor(base, {
      loadout,
      world: { godKeys: gods, storyNpcByBiome: {}, fieldNpcsByBiome: {} },
      basketByGiver: draftBasket(['ZeusWeaponBoon'], {}, gods),
      rackKeepsakeKeys: [],
      ...(fillerPriority === undefined ? {} : { fillerPriority }),
    });
  const apolloBoon = offer('Boon', 'ApolloUpgrade');

  it('groups every variant of the four filler kinds', () => {
    const kinds = Object.fromEntries(
      catalog.rewards.rewardTypes.values.flatMap((type) => {
        const kind = draftFillerKind(type.gameName);
        return kind === undefined ? [] : [[type.gameName, kind]];
      }),
    );
    expect(kinds).toEqual({
      StackUpgrade: 'pom',
      StackUpgradeBig: 'pom',
      StackUpgradeTriple: 'pom',
      MaxHealthDrop: 'maxHealth',
      MaxHealthDropBig: 'maxHealth',
      MaxHealthDropSmall: 'maxHealth',
      EmptyMaxHealthSmallDrop: 'maxHealth',
      EmptyMaxHealthDrop: 'maxHealth',
      MaxManaDrop: 'maxMagick',
      MaxManaDropBig: 'maxMagick',
      MaxManaDropSmall: 'maxMagick',
      Currency: 'gold',
      RoomMoneyDrop: 'gold',
      RoomMoneySmallDrop: 'gold',
      RoomMoneyTripleDrop: 'gold',
      RoomMoneyTinyDrop: 'gold',
      StoreRewardRandomStack: 'pom',
    });
  });

  it('weighs filler evenly and a finished god above it when nothing is ranked', () => {
    const steering = steeringFor();
    expect(steering.offerWeight(money)).toBe(1);
    expect(steering.offerWeight(offer('StackUpgrade'))).toBe(1);
    expect(steering.offerWeight(apolloBoon)).toBeGreaterThan(steering.offerWeight(money));
    expect(steering.shopFillerWeight(offer('MaxHealthDrop'))).toBe(0);
  });

  it('weighs ranked filler by rank, a finished god below the top rank', () => {
    const steering = steeringFor(['maxHealth', 'pom', 'gold']);
    const health = steering.offerWeight(offer('MaxHealthDropBig'));
    const pom = steering.offerWeight(offer('StackUpgrade'));
    expect(health).toBeGreaterThan(pom);
    expect(pom).toBeGreaterThan(steering.offerWeight(money));
    expect(steering.offerWeight(money)).toBeGreaterThan(steering.offerWeight(offer('MaxManaDrop')));
    expect(steering.offerWeight(offer('MaxManaDrop'))).toBe(1);
    expect(steering.offerWeight(apolloBoon)).toBeLessThan(health);
    // A god with a queued basket trait keeps its pull.
    expect(steering.offerWeight(zeusBoon)).toBe(steeringFor().offerWeight(zeusBoon));
  });

  it('buys only ranked Max Health, Max Magick and Pom as Shop filler', () => {
    const steering = steeringFor(['gold', 'pom', 'maxHealth']);
    expect(steering.shopFillerWeight(offer('StoreRewardRandomStack'))).toBeGreaterThan(
      steering.shopFillerWeight(offer('MaxHealthDrop')),
    );
    expect(steering.shopFillerWeight(offer('MaxHealthDrop'))).toBeGreaterThan(0);
    expect(steering.shopFillerWeight(money)).toBe(0);
    expect(steering.shopFillerWeight(offer('MaxManaDrop'))).toBe(0);
    expect(steering.shopFillerWeight(offer('RandomLoot', 'ZeusUpgrade'))).toBe(0);
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
      basketByGiver: draftBasket(['ZeusWeaponBoon']),
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

describe('depth pacing', () => {
  const base = createProjectDocument(catalog, {
    projectId: 'p',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  const steeringFor = (basketTraitKeys: string[]) =>
    draftSteeringFor(base, {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
      },
      basketByGiver: draftBasket(basketTraitKeys, {}, ['Zeus', 'Apollo', 'Aphrodite', 'Hestia']),
      rackKeepsakeKeys: [],
    });
  const draws = (...values: number[]) => {
    let index = 0;
    return () => values[index++ % values.length]!;
  };
  const zeus = ['ZeusWeaponBoon', 'ZeusCastBoon', 'ZeusSpecialBoon'];

  it('pulls a god softly: below a non-god reward well before the target, rising past it', () => {
    expect(draftPaceWeight(1, 5)).toBeLessThan(1);
    expect(draftPaceWeight(4, 5)).toBeGreaterThan(draftPaceWeight(3, 5));
    expect(draftPaceWeight(5, 5)).toBe(60);
    expect(draftPaceWeight(7, 5)).toBeGreaterThan(draftPaceWeight(6, 5));
    expect(draftPaceWeight(6, 5)).toBeGreaterThan(60);
  });

  it("spreads a biome's due traits in schedule order with the seeded jitter", () => {
    const targets = (random: () => number) => {
      const steering = steeringFor(zeus);
      steering.paceBiome(random);
      return zeus.map((key) => steering.targetDepth(key));
    };
    const spread = targets(draws(0.9, 0.1, 0.5));
    expect(spread).toEqual([...spread].sort((a, b) => a - b));
    expect(spread[0]).toBeGreaterThanOrEqual(1);
    expect(targets(draws(0.9, 0.1, 0.5))).toEqual(spread);
    expect(targets(draws(0.2, 0.3, 0.4))).not.toEqual(spread);
  });

  it('compresses the targets as the due traits crowd the biome', () => {
    const latest = (basket: string[]) => {
      const steering = steeringFor(basket);
      steering.paceBiome(() => 0.999);
      return Math.max(...basket.map((key) => steering.targetDepth(key)));
    };
    const crowded = [...zeus, 'ApolloWeaponBoon', 'AphroditeCastBoon', 'HestiaSpecialBoon'];
    expect(latest(crowded)).toBeLessThan(latest(['ZeusWeaponBoon']));
  });

  it("places a Duo's target after its prerequisites', with no ramp of its own", () => {
    const duo = 'ApolloSecondStageCastBoon';
    const basket = ['ApolloExCastBoon', 'ZeusWeaponBoon', duo];
    const steering = steeringFor(basket);
    steering.paceBiome(draws(0.1, 0.9, 0.2));
    const prerequisites = basket.slice(0, 2).map((key) => steering.targetDepth(key));
    expect(steering.targetDepth(duo)).toBeGreaterThanOrEqual(Math.max(...prerequisites));
  });
});

describe('hosted Duos', () => {
  const base = createProjectDocument(catalog, {
    projectId: 'd',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  const duo = 'ApolloSecondStageCastBoon';
  const steeringFor = (basketTraitKeys: string[], host = 'Zeus') =>
    draftSteeringFor(base, {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
      },
      basketByGiver: draftBasket(basketTraitKeys, { [duo]: host }),
      rackKeepsakeKeys: [],
    });
  const holding = (traitKeys: string[]) => ({
    equippedTraitKeys: traitKeys,
    hermes: 0,
    held: {
      traitKeys: new Set(traitKeys),
      elementCounts: { Air: 0, Earth: 0, Fire: 0, Water: 0, Aether: 0 },
      godBoonRarityCounts: {},
    },
  });

  it('passes over a Duo until its prerequisites are held, then returns to it', () => {
    // Zeus hosts the Duo ahead of the Zeus core it needs.
    const steering = steeringFor([duo, 'ZeusWeaponBoon', 'ZeusCastBoon', 'ApolloExCastBoon']);
    expect(steering.nextQueued('Zeus', holding([]))).toBe('ZeusWeaponBoon');
    expect(steering.nextQueued('Zeus', holding(['ZeusWeaponBoon']))).toBe('ZeusCastBoon');
    expect(steering.nextQueued('Zeus', holding(['ZeusWeaponBoon', 'ApolloExCastBoon']))).toBe(duo);
  });

  it('lets only the host take a Duo', () => {
    const ready = holding(['ZeusWeaponBoon', 'ApolloExCastBoon']);
    const zeusHosts = steeringFor(['ZeusWeaponBoon', 'ApolloExCastBoon', duo]);
    expect(zeusHosts.queueGiver(duo)).toBe('Zeus');
    expect(zeusHosts.godTakes('Zeus', ready)).toBe(true);
    expect(zeusHosts.godTakes('Apollo', ready)).toBe(false);
    const apolloHosts = steeringFor(['ZeusWeaponBoon', 'ApolloExCastBoon', duo], 'Apollo');
    expect(apolloHosts.queueGiver(duo)).toBe('Apollo');
    expect(apolloHosts.godTakes('Zeus', ready)).toBe(false);
    expect(apolloHosts.godTakes('Apollo', ready)).toBe(true);
  });
});

describe('need-gated Shops', () => {
  const base = createProjectDocument(catalog, {
    projectId: 'n',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  const steering = () => {
    const paced = draftSteeringFor(base, {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
      },
      basketByGiver: draftBasket(['ZeusWeaponBoon']),
      rackKeepsakeKeys: [],
    });
    // The trait's target lies deep in the biome, so nothing is overdue at its start.
    paced.paceBiome(() => 0.99);
    return paced;
  };
  const band = 100;

  it('prefers a Preboss Shop only on a low boon bag or an overdue trait a god can take', () => {
    const plain = steering();
    expect(plain.roomWeight('F_PreBoss01', 'F')).toBe(1);
    const low = steering();
    vi.spyOn(low, 'boonBagLow').mockReturnValue(true);
    expect(low.roomWeight('F_PreBoss01', 'F')).toBeGreaterThanOrEqual(band);
    const overdue = steering();
    vi.spyOn(overdue, 'targetDepth').mockReturnValue(0);
    expect(overdue.roomWeight('F_PreBoss01', 'F')).toBeGreaterThanOrEqual(band);
  });

  it('prefers a mid-biome Shop only once the door bags hold no boon', () => {
    const left = (count: number) => {
      const shop = steering();
      vi.spyOn(
        shop as unknown as { boonEntriesLeft: () => number },
        'boonEntriesLeft',
      ).mockReturnValue(count);
      return shop.roomWeight('F_Shop01', 'F');
    };
    expect(left(0)).toBeGreaterThanOrEqual(band);
    expect(left(1)).toBeLessThan(2);
  });
});

describe('windowed room forcing', () => {
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  const base = createProjectDocument(catalog, {
    projectId: 'f',
    routeKey: 'Underworld',
    configuredBiomeCount: 4,
  });
  const spec = (storyNpcByBiome: Readonly<Record<string, string>>): DraftSpec => ({
    loadout,
    world: { godKeys: ['Zeus'], storyNpcByBiome, fieldNpcsByBiome: {} },
    basketByGiver: {},
    rackKeepsakeKeys: [null, null, null],
  });
  /** A Fields door inside the minibosses' window (start 2, deadline 4), by default at depth 2. */
  const pressure = (optional: readonly string[], depth = 2) =>
    ({
      biomeDepthCache: depth,
      biomeEncounterDepth: depth,
      optionalForcedRoomGameNames: optional,
    }) as unknown as ForcePressureLedgerEntry;
  const combats = ['H_Combat01', 'H_Combat02'];
  const minibosses = ['H_MiniBoss01', 'H_MiniBoss02'];

  it('rolls each windowed room on the shifted ramp and picks among the hits', () => {
    const steering = draftSteeringFor(base, spec({}));
    const legal = [...combats, ...minibosses];
    const rng = createDraftRng(7);
    let hits = 0;
    const picked = new Set<string>();
    for (let door = 0; door < 400; door += 1) {
      const room = steering.windowForcedRoom(legal, pressure(minibosses), 'H', rng);
      if (room === undefined) continue;
      hits += 1;
      picked.add(room);
    }
    // Two rooms at 1/3 each: a door is forced five times in nine.
    expect(hits / 400).toBeGreaterThan(0.47);
    expect(hits / 400).toBeLessThan(0.64);
    expect([...picked].sort()).toEqual(minibosses);
    // 1/3 at depth 2, 1/2 at depth 3: a roll below the chance hits.
    const roll = (depth: number, value: number) =>
      steering.windowForcedRoom(legal, pressure(['H_MiniBoss01'], depth), 'H', () => value);
    expect(roll(2, 0.33)).toBe('H_MiniBoss01');
    expect(roll(2, 0.34)).toBe(undefined);
    expect(roll(3, 0.49)).toBe('H_MiniBoss01');
    expect(roll(3, 0.5)).toBe(undefined);
    // Only rooms the door can legally show roll.
    expect(steering.windowForcedRoom(combats, pressure(minibosses), 'H', () => 0)).toBe(undefined);
  });

  it('softens the native ramp one step, keeping it for windows one depth wide', () => {
    expect([1, 2, 3, 4, 5].map((depth) => draftWindowForceChance(depth, 2, 4))).toEqual([
      0,
      1 / 3,
      1 / 2,
      1,
      1,
    ]);
    expect([3, 4, 5, 6, 7].map((depth) => draftWindowForceChance(depth, 3, 7))).toEqual([
      1 / 5,
      1 / 4,
      1 / 3,
      1 / 2,
      1,
    ]);
    expect([0, 1].map((depth) => draftWindowForceChance(depth, 0, 1))).toEqual([1, 1]);
    expect(draftWindowForceChance(9, 9, 9)).toBe(1);
  });

  it('forces at the game odds or only at the deadline when the spec says so', () => {
    const ramp = (forcing: 'deadline' | 'game') =>
      [1, 2, 3, 4].map((depth) => draftWindowForceChance(depth, 2, 4, forcing));
    expect(ramp('game')).toEqual([0, 1 / 2, 1, 1]);
    expect(ramp('deadline')).toEqual([0, 0, 0, 1]);
    // A window one depth wide keeps the game's rule under every setting.
    for (const forcing of ['deadline', 'softened', 'game'] as const)
      expect(draftWindowForceChance(0, 0, 1, forcing)).toBe(1);
    const steering = draftSteeringFor(base, { ...spec({}), roomForcing: 'deadline' });
    expect(
      steering.windowForcedRoom([...combats, ...minibosses], pressure(minibosses), 'H', () => 0),
    ).toBe(undefined);
  });

  it('keeps a door that can show a wanted story room', () => {
    const legal = ['H_Bridge01', ...minibosses];
    expect(
      draftSteeringFor(base, spec({ H: 'Echo' })).windowForcedRoom(
        legal,
        pressure(minibosses),
        'H',
        () => 0,
      ),
    ).toBe(undefined);
    // Without a selected story NPC the story room holds nothing.
    expect(
      draftSteeringFor(base, spec({})).windowForcedRoom(legal, pressure(minibosses), 'H', () => 0),
    ).toBe('H_MiniBoss01');
  });
});
