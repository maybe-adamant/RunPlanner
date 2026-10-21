import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import type { AuthoredTraitOfferTraits } from '../../../src/authored-project';
import type { DraftSpec } from '../../../src/simulation';
import type { DraftWalk } from '../../../src/simulation/draft/walk';
import { DEFAULT_DRAFT_BUDGET } from '../../../src/simulation/draft/generator';
import { latestRunState } from '../../../src/simulation/draft/report';
import { draftDuoFires } from '../../../src/simulation/draft/trait-offers';
import { startDraftWalk } from '../../support/draft-walk';
import { decodeProjectDocument } from '../../../src/authored-project/codec';
import { simulateProjectAssembly } from '../../../src/simulation';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import { draftLoadoutProject } from '../../../src/simulation/draft/spec';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const base = createProjectDocument(catalog, {
  projectId: 'w',
  routeKey: 'Underworld',
  configuredBiomeCount: 4,
});
const zeusBasket = ['ZeusWeaponBoon', 'ZeusCastBoon', 'BoltRetaliateBoon', 'FocusLightningBoon'];

function traitOffers(value: unknown): AuthoredTraitOfferTraits[] {
  if (typeof value !== 'object' || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(traitOffers);
  const record = value as Record<string, unknown>;
  if (record.kind === 'traits' && Array.isArray(record.options))
    return [record as unknown as AuthoredTraitOfferTraits];
  return Object.values(record).flatMap(traitOffers);
}

/** The offer the walk's last step authored. */
function authored(before: DraftWalk['project'], after: DraftWalk['project']) {
  const known = new Set(traitOffers(before).map((offer) => JSON.stringify(offer)));
  return traitOffers(after).find((offer) => !known.has(JSON.stringify(offer)));
}

/** Each seed's authoring of the route's first trait offer from a Zeus room, from the same frontier. */
function firstZeusOffers(spec: DraftSpec, seeds: readonly number[]): AuthoredTraitOfferTraits[] {
  const walk = startDraftWalk(base, spec, 1);
  const step = (from: DraftWalk) => {
    const steps = from.steps;
    from.runBiome(0, steps + 1);
    if (from.steps === steps) throw new Error(`walk stopped: ${from.failure}`);
  };
  for (;;) {
    if (walk.assembly.evaluation.issue?.reasons[0]?.code === 'traitOfferMissing') {
      const offers = seeds.map((seed) => {
        const next = startDraftWalk(base, spec, seed, { from: walk.assembly, scheduleSeed: 1 });
        step(next);
        return authored(walk.project, next.project);
      });
      if (offers.every((offer) => offer?.giverKey === 'Zeus'))
        return offers as AuthoredTraitOfferTraits[];
    }
    step(walk);
  }
}

const unselected = (offer: AuthoredTraitOfferTraits) =>
  offer.options
    .filter((_, index) => ['option1', 'option2', 'option3'][index] !== offer.selectedOptionKey)
    .map((option) => option.traitKey);

describe('draft trait offer filler', () => {
  const zeusOnly: DraftSpec = {
    loadout,
    world: { godKeys: ['Zeus'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
    basketTraitKeys: [],
    rackKeepsakeKeys: [null, null, null],
  };

  it('draws the unselected rows at random', () => {
    const offered = new Set(
      firstZeusOffers(zeusOnly, [1, 2, 3, 4, 5, 6]).flatMap((offer) =>
        offer.options.map((option) => option.traitKey),
      ),
    );
    expect(offered.size).toBeGreaterThan(3);
  });

  it('keeps wanted basket traits out of the rows Denial bans', () => {
    const denial: DraftSpec = {
      ...zeusOnly,
      loadout: {
        ...loadout,
        fearRanks: { ...loadout.fearRanks, BanUnpickedBoonsShrineUpgrade: 1 },
      },
      basketTraitKeys: zeusBasket,
    };
    for (const offer of firstZeusOffers(denial, [1, 2, 3, 4])) {
      expect(zeusBasket).toContain(
        offer.options[['option1', 'option2', 'option3'].indexOf(offer.selectedOptionKey)]!.traitKey,
      );
      expect(unselected(offer).filter((key) => zeusBasket.includes(key))).toEqual([]);
    }
  });
});

describe('draft rack keepsakes', () => {
  it('equips the rack keepsake with its equip result before the biome succeeds', () => {
    const rack: DraftSpec = {
      loadout,
      world: { godKeys: ['Zeus', 'Apollo', 'Hestia'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
      basketTraitKeys: [],
      rackKeepsakeKeys: ['TempHammerKeepsake', null, null],
    };
    const walk = startDraftWalk(base, rack, 1);
    expect(walk.runBiome(0, 600), walk.failure).toBe(true);
    const occurrence = walk.project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.keepsakeRack !== undefined,
    );
    expect(occurrence?.keepsakeRack?.keepsakeKey).toBe('TempHammerKeepsake');
    expect(occurrence?.keepsakeRack?.equipResults?.experimentalHammer).toBeDefined();
    expect(
      walk.assembly.evaluation.findings.filter(
        (finding) => 'biomeKey' in finding.origin && finding.origin.biomeKey === 'F',
      ),
    ).toEqual([]);
  });
});

/** Basket traits the walk holds, in the order they were first equipped. */
function acquired(walk: DraftWalk, basket: readonly string[]): string[] {
  const order: string[] = [];
  const snapshots = walk.assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  for (const snapshot of snapshots)
    for (const key of Object.keys(snapshot.traits.equippedTraits))
      if (basket.includes(key) && !order.includes(key)) order.push(key);
  return order;
}

/** Pool gods in the order the run first picked up their boons. */
function godsInAcquisitionOrder(assembly: ProjectEvaluationAssembly): string[] {
  const snapshots = assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  const gods: string[] = [];
  for (const snapshot of snapshots)
    for (const source of snapshot.godPool.acquiredSourceKeys) {
      const giverKey = catalog.traitGiverByAcquisitionGameName[source];
      if (giverKey !== undefined && !gods.includes(giverKey)) gods.push(giverKey);
    }
  return gods;
}

describe('draft walk order', () => {
  const world = {
    godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
    storyNpcByBiome: {},
    fieldNpcsByBiome: {},
  };

  it("takes each god's basket traits only in basket order", () => {
    const zeus = ['ZeusManaBoon', 'ZeusSprintBoon', 'ZeusWeaponBoon', 'ZeusCastBoon'];
    const spec: DraftSpec = {
      loadout,
      world,
      basketTraitKeys: [...zeus, 'ApolloSpecialBoon'],
      rackKeepsakeKeys: [null, null, null],
    };
    for (const seed of [1]) {
      const walk = startDraftWalk(base, spec, seed);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      const held = acquired(walk, zeus);
      expect(held.length).toBeGreaterThan(0);
      expect(held).toEqual(zeus.slice(0, held.length));
    }
  });

  it('meets new gods in pool order, the starting reward bringing pool #1', () => {
    const pool = ['Hestia', 'Aphrodite', 'Zeus', 'Apollo'];
    const spec: DraftSpec = {
      loadout,
      world: { ...world, godKeys: pool },
      basketTraitKeys: ['HestiaSpecialBoon', 'ApolloCastBoon'],
      rackKeepsakeKeys: [null, null, null],
    };
    for (const seed of [1]) {
      const walk = startDraftWalk(base, spec, seed);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      const met = godsInAcquisitionOrder(walk.assembly);
      expect(met.length).toBeGreaterThan(1);
      expect(met).toEqual(pool.slice(0, met.length));
    }
  });

  it('takes a ready Duo with chance 1/3, then 2/3, then always', () => {
    expect([0, 1, 2].map((declined) => draftDuoFires(declined, 0.3))).toEqual([true, true, true]);
    expect([0, 1, 2].map((declined) => draftDuoFires(declined, 0.5))).toEqual([false, true, true]);
    expect([0, 1, 2].map((declined) => draftDuoFires(declined, 0.9))).toEqual([false, false, true]);
  });

  it("counts each declined god room of a ready Duo and continues the previous biome's count", () => {
    const duo = 'ApolloSecondStageCastBoon';
    const spec: DraftSpec = {
      loadout,
      world,
      basketTraitKeys: ['ApolloExCastBoon', 'ZeusWeaponBoon', duo],
      rackKeepsakeKeys: [null, null, null],
    };
    const run = (
      seed: number,
      duoDeclines: ReadonlyMap<string, number>,
      from?: ProjectEvaluationAssembly,
    ) => {
      const walk = startDraftWalk(base, spec, seed, {
        duoDeclines,
        ...(from === undefined ? {} : { from }),
      });
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      const held = Object.keys(latestRunState(walk.assembly)?.traits.equippedTraits ?? {});
      return { taken: held.includes(duo), declines: walk.duoDeclines().get(duo) ?? 0 };
    };
    // Declined in a god room, a later one takes it.
    expect(run(2, new Map())).toEqual({ taken: true, declines: 1 });
    // A count carried in from an earlier biome continues: twice declined, every later room fires it.
    for (const seed of [1, 3]) expect(run(seed, new Map([[duo, 2]])).declines).toBe(2);
    // Planned only to F, the walk is in its last biome: the first god room takes the Duo.
    const loadoutProject = draftLoadoutProject(catalog, base, spec.loadout);
    const onlyF = simulateProjectAssembly(
      catalog,
      decodeProjectDocument(
        {
          ...loadoutProject,
          route: { ...loadoutProject.route, biomes: loadoutProject.route.biomes.slice(0, 1) },
        },
        catalog,
      ),
    );
    expect(run(1, new Map(), onlyF)).toEqual({ taken: true, declines: 0 });
  });
});
