import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import {
  discoverAuthoredTraitCarrierChildren,
  type AuthoredTraitOfferTraits,
  type TraitOfferAddress,
} from '../../../src/authored-project';
import type { DraftSpec } from '../../../src/simulation';
import { latestRunState } from '../../../src/simulation/draft/report';
import type { DraftWalk } from '../../../src/simulation/draft/walk';
import { startDraftWalk } from '../../support/draft-walk';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const surface = createProjectDocument(catalog, {
  projectId: 's',
  routeKey: 'Surface',
  configuredBiomeCount: 4,
});
const underworld = createProjectDocument(catalog, {
  projectId: 'u',
  routeKey: 'Underworld',
  configuredBiomeCount: 4,
});
const surfaceWorld = (godKeys: readonly string[]): DraftSpec['world'] => ({
  godKeys,
  storyNpcByBiome: { N: 'Medea', O: 'Circe', P: 'Dionysus' },
  fieldNpcsByBiome: { O: ['Icarus'] },
});
const underworldWorld: DraftSpec['world'] = {
  godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
  storyNpcByBiome: { F: 'Arachne', G: 'Narcissus', H: 'Echo', I: 'Hades' },
  fieldNpcsByBiome: {},
};
const spec = (
  world: DraftSpec['world'],
  basketTraitKeys: readonly string[],
  loadoutChanges: Partial<DraftSpec['loadout']> = {},
): DraftSpec => ({
  loadout: { ...loadout, ...loadoutChanges },
  world,
  basketTraitKeys,
  rackKeepsakeKeys: [null, null, null],
});

/** Every authored traits offer in a value, with its address when the value names one. */
function traitOffers(value: unknown): AuthoredTraitOfferTraits[] {
  if (typeof value !== 'object' || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(traitOffers);
  const record = value as Record<string, unknown>;
  if (record.kind === 'traits' && Array.isArray(record.options))
    return [record as unknown as AuthoredTraitOfferTraits];
  return Object.values(record).flatMap(traitOffers);
}

/** Walks biome by biome until the trait is held; each walked biome is left with no issue. */
function walkUntilHeld(base: typeof surface, draft: DraftSpec, traitKey: string, seed = 1) {
  const walk = startDraftWalk(base, draft, seed);
  for (const index of base.route.itineraryBiomeKeys.keys()) {
    expect(walk.runBiome(index, walk.steps + 600), walk.failure).toBe(true);
    const held = Object.keys(latestRunState(walk.assembly)?.traits.equippedTraits ?? {});
    if (held.includes(traitKey)) return { walk, biomeIndex: index };
  }
  throw new Error(`${traitKey} was never drafted`);
}

/** The selected offer of the trait, with every engine-discovered child authored. */
function expectChildrenAuthored(walk: DraftWalk, biomeIndex: number, traitKey: string) {
  const offer = traitOffers(walk.project).find(
    (candidate) =>
      candidate.options[['option1', 'option2', 'option3'].indexOf(candidate.selectedOptionKey)]
        ?.traitKey === traitKey,
  );
  expect(offer).toBeDefined();
  // Discovery reads only the offer; the address is a placeholder owner.
  const address = {
    kind: 'traitOffer',
    routeKey: walk.project.route.routeKey,
    biomeKey: 'N',
    owner: { kind: 'startingReward' },
    acquisitionRole: 'selection',
  } as unknown as TraitOfferAddress;
  const children = discoverAuthoredTraitCarrierChildren(catalog, address, offer!).filter(
    (child) => child.kind !== 'hexTree' && child.kind !== 'concaveStone',
  );
  expect(children.length).toBeGreaterThan(0);
  expect(children.every((child) => child.authoredComplete)).toBe(true);
  const walked = walk.project.route.itineraryBiomeKeys.slice(0, biomeIndex + 1);
  expect(
    walk.assembly.evaluation.findings.filter(
      (finding) => 'biomeKey' in finding.origin && walked.includes(finding.origin.biomeKey),
    ),
  ).toEqual([]);
}

describe('draft selected-outcome children', () => {
  it('drafts Bridal Glow with its Heroic target', () => {
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Hera', 'Demeter', 'Ares']), ['BoonDecayBoon']),
      'BoonDecayBoon',
    );
    expectChildrenAuthored(walk, biomeIndex, 'BoonDecayBoon');
  });

  it("drafts Red Citrine Divination with Circe's Arcana resolution", () => {
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Hera', 'Demeter', 'Ares']), ['RandomArcanaTrait']),
      'RandomArcanaTrait',
    );
    expectChildrenAuthored(walk, biomeIndex, 'RandomArcanaTrait');
  });

  it('drafts All Together with one result per set', () => {
    const traits = [
      'HeraWeaponBoon',
      'OmegaHeraProjectileBoon',
      'DamageSharePotencyBoon',
      'AllElementalBoon',
    ];
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Hera', 'Demeter', 'Ares']), traits),
      'AllElementalBoon',
    );
    expectChildrenAuthored(walk, biomeIndex, 'AllElementalBoon');
  });

  it('drafts Natural Selection with its complete increments', () => {
    const traits = ['PoseidonWeaponBoon', 'DemeterSpecialBoon', 'BoonGrowthBoon', 'GoodStuffBoon'];
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Poseidon', 'Demeter', 'Ares']), traits),
      'GoodStuffBoon',
    );
    expectChildrenAuthored(walk, biomeIndex, 'GoodStuffBoon');
  });

  it('drafts Latest Model with its Hammer targets', () => {
    const traits = ['StaffDoubleAttackTrait', 'UpgradeHammerBoon'];
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Hera', 'Demeter', 'Ares']), traits),
      'UpgradeHammerBoon',
    );
    expectChildrenAuthored(walk, biomeIndex, 'UpgradeHammerBoon');
  });

  it('drafts Pom Pom Pom and Boon Boon Boon with their Echo outcomes', () => {
    for (const traitKey of ['EchoDoubleLevelBoon', 'EchoLastRunBoon']) {
      const { walk, biomeIndex } = walkUntilHeld(
        underworld,
        spec(underworldWorld, [traitKey]),
        traitKey,
      );
      expectChildrenAuthored(walk, biomeIndex, traitKey);
    }
  });

  it('resolves a Heroic Concave Stone with a residual row', () => {
    const traits = ['DemeterWeaponBoon', 'HeraCastBoon', 'KeepsakeLevelBoon'];
    const { walk, biomeIndex } = walkUntilHeld(
      surface,
      spec(surfaceWorld(['Zeus', 'Hera', 'Demeter', 'Ares']), traits, {
        startingKeepsakeKey: 'UnpickedBoonKeepsake',
      }),
      'KeepsakeLevelBoon',
    );
    expect(walk.runBiome(biomeIndex + 1, walk.steps + 600), walk.failure).toBe(true);
    expect(
      traitOffers(walk.project).some((offer) => offer.concaveStoneResult?.kind === 'proc'),
    ).toBe(true);
  });
});
