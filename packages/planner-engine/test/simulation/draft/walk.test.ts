import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import type { AuthoredTraitOfferTraits } from '../../../src/authored-project';
import type { DraftSpec } from '../../../src/simulation';
import type { DraftWalk } from '../../../src/simulation/draft/walk';
import { DEFAULT_DRAFT_BUDGET } from '../../../src/simulation/draft/generator';
import { draftReport } from '../../../src/simulation/draft/report';
import { startDraftWalk } from '../../support/draft-walk';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import { selectedExitTarget } from '../../../src/authored-project/topology/query';

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
});

describe('draft exit choice', () => {
  it('takes an offered story door over a miniboss door', () => {
    const spec: DraftSpec = {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: { F: 'Arachne' },
        fieldNpcsByBiome: {},
      },
      basketTraitKeys: zeusBasket,
      rackKeepsakeKeys: [null, null, null],
    };
    // A seed whose Arachne door shares its exit with a miniboss carrying a wanted boon.
    const walk = startDraftWalk(base, spec, 13);
    expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
    const topology = walk.project.route.biomes[0]!.topology!;
    const roomOf = (occurrenceId: string) =>
      topology.occurrences.find((o) => o.occurrenceId === occurrenceId)?.gameName;
    const exit = topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.targets.some((t) => roomOf(t.occurrenceId) === 'F_Story01'),
    );
    if (exit?.kind !== 'exit') throw new Error('no Arachne door');
    expect(
      exit.normal.targets.some(
        (t) => catalog.rooms.byKey[roomOf(t.occurrenceId) ?? '']?.kind === 'Miniboss',
      ),
    ).toBe(true);
    const selected = selectedExitTarget(exit);
    expect(selected && roomOf(selected.occurrenceId)).toBe('F_Story01');
  });
});

describe("the starting keepsake's chosen result", () => {
  const pomSpec = (traitKey: string, extra: Partial<DraftSpec> = {}): DraftSpec => ({
    loadout: {
      ...loadout,
      startingKeepsakeKey: 'HadesAndPersephoneKeepsake',
      keepsakeEquipResults: { jeweledPom: { traitKey } },
    },
    world: { godKeys: ['Zeus', 'Apollo', 'Hestia'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
    basketTraitKeys: [],
    rackKeepsakeKeys: [null, null, null],
    ...extra,
  });
  const drafted = (spec: DraftSpec) => {
    const walk = startDraftWalk(base, spec, 1);
    expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
    return {
      pom: walk.project.route.loadout.keepsakeEquipResults?.jeweledPom?.traitKey,
      target: draftReport(catalog, spec, walk.assembly).targets.find(
        (target) => target.kind === 'startingKeepsakeResult',
      ),
    };
  };

  it("takes the player's own Jeweled Pom trait and reports it met", () => {
    expect(drafted(pomSpec('HadesPreDamageBoon'))).toEqual({
      pom: 'HadesPreDamageBoon',
      target: { kind: 'startingKeepsakeResult', key: 'jeweledPom', met: true },
    });
  });

  it("falls back to an allowed trait when the basket's Hades trait holds the cap, reported unmet", () => {
    const result = drafted(
      pomSpec('HadesPreDamageBoon', {
        world: {
          godKeys: ['Zeus', 'Apollo', 'Hestia'],
          storyNpcByBiome: { I: 'Hades' },
          fieldNpcsByBiome: {},
        },
        basketTraitKeys: ['HadesLifestealBoon'],
      }),
    );
    expect(result.pom).not.toBe('HadesPreDamageBoon');
    expect(result.target).toEqual({
      kind: 'startingKeepsakeResult',
      key: 'jeweledPom',
      met: false,
    });
  });
});

describe('draft Ephyra doors with a small pool', () => {
  const surface = createProjectDocument(catalog, {
    projectId: 'ephyra',
    routeKey: 'Surface',
    configuredBiomeCount: 1,
  });

  it.each([[['Zeus']], [['Zeus', 'Hera']]])(
    'shows outside gods only on Hub doors it never visits, with %j',
    (godKeys) => {
      const spec: DraftSpec = {
        loadout,
        world: { godKeys, storyNpcByBiome: {}, fieldNpcsByBiome: { N: ['Heracles'] } },
        basketTraitKeys: [],
        rackKeepsakeKeys: [],
      };
      const walk = startDraftWalk(surface, spec, 1);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      const topology = walk.project.route.biomes[0]!.topology!;
      const hub = topology.decisions.find((decision) => decision.kind === 'hub')!;
      const visited = new Set(
        hub.actions.flatMap((action) => (action.kind === 'roomVisit' ? [action.hubSlotKey] : [])),
      );
      const outsideDoors = hub.openTargets.filter((target) => {
        const occurrence = topology.occurrences.find((o) => o.occurrenceId === target.occurrenceId);
        const reward =
          occurrence !== undefined && 'reward' in occurrence.state ? occurrence.state.reward : null;
        const source =
          reward?.offer.payload?.kind === 'BoonSource' ? reward.offer.payload.source : '';
        const giverKey = catalog.traitGiverByAcquisitionGameName[source];
        return giverKey !== undefined && !godKeys.includes(giverKey);
      });
      expect(outsideDoors.length).toBeGreaterThan(0);
      expect(outsideDoors.filter((door) => visited.has(door.hubSlotKey))).toEqual([]);
      const report = draftReport(catalog, spec, walk.assembly);
      expect(report.extras).toEqual([]);
      expect(godsInAcquisitionOrder(walk.assembly).every((god) => godKeys.includes(god))).toBe(
        true,
      );
      expect(report.targets.filter((target) => target.kind === 'fieldNpc')).toEqual([
        { kind: 'fieldNpc', key: 'Heracles', biomeKey: 'N', met: true },
      ]);
    },
  );
});
