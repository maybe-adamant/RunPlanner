import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import type { AuthoredTraitOfferTraits } from '../../../src/authored-project';
import type { DraftSpec } from '../../../src/simulation';
import type { DraftWalk } from '../../../src/simulation/draft/walk';
import { startDraftWalk } from '../../support/draft-walk';

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
