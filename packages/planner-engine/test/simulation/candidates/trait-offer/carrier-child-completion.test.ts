import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../../src/authored-project/defaults';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  discoverAuthoredTraitCarrierChildren,
  type AuthoredTraitOfferTraits,
  type OccurrenceId,
  type TraitOfferAddress,
} from '../../../../src/authored-project';
import {
  completeTraitCarrierChildren,
  FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE,
  type CarrierChildChoice,
} from '../../../../src/simulation/candidates/trait-offer/carrier-child-completion';
import type { ProjectCandidateSession } from '../../../../src/simulation/candidates/session';
import type { DraftSpec } from '../../../../src/simulation';
import { latestRunState } from '../../../../src/simulation/draft/report';
import type { DraftWalk } from '../../../../src/simulation/draft/walk';
import { startDraftWalk } from '../../../support/draft-walk';
import { draftBasket } from '../../../support/draft-basket';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const surface = createProjectDocument(catalog, {
  projectId: 's',
  routeKey: 'Surface',
  configuredBiomeCount: 4,
});
// Echo's story room is in the first biome.
const dream = createProjectDocument(catalog, {
  projectId: 'd',
  routeKey: 'Dream',
  itineraryBiomeKeys: ['H', 'F', 'N', 'I'],
  configuredBiomeCount: 4,
});
const surfaceWorld = (godKeys: readonly string[]): DraftSpec['world'] => ({
  godKeys,
  storyNpcByBiome: { N: 'Medea', O: 'Circe', P: 'Dionysus' },
  fieldNpcsByBiome: { O: ['Icarus'] },
});
const dreamWorld: DraftSpec['world'] = {
  godKeys: ['Zeus', 'Apollo', 'Poseidon', 'Hestia'],
  storyNpcByBiome: { H: 'Echo', F: 'Arachne', N: 'Medea', I: 'Hades' },
  fieldNpcsByBiome: {},
};
const spec = (
  world: DraftSpec['world'],
  basketTraitKeys: readonly string[],
  loadoutChanges: Partial<DraftSpec['loadout']> = {},
): DraftSpec => ({
  loadout: { ...loadout, ...loadoutChanges },
  world,
  basketByGiver: draftBasket(basketTraitKeys, {}, world.godKeys),
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

describe('carrier-child completion under Draft steering', () => {
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
      2,
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
      const { walk, biomeIndex } = walkUntilHeld(dream, spec(dreamWorld, [traitKey]), traitKey, 2);
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

describe('carrier-child completion choice', () => {
  const trait = createTraitOfferAddress(
    createIncomingRewardAddress(createBiomeAddress('Surface', 'N'), 'N-r1' as OccurrenceId),
    'source',
  );
  const offer: AuthoredTraitOfferTraits = {
    kind: 'traits',
    giverKey: catalog.traitGivers.values.find((giver) =>
      giver.traitKeys.includes('ZeusWeaponBoon'),
    )!.key,
    options: [
      { traitKey: 'ZeusWeaponBoon' },
      { traitKey: 'ZeusSpecialBoon' },
      { traitKey: 'ZeusCastBoon' },
    ],
    selectedOptionKey: 'option1',
  };
  /** An engine whose Concave Stone must proc on either unselected row and admits every offer. */
  const candidates = {
    evaluate: (query: { readonly kind: string }) =>
      query.kind === 'traitOffer'
        ? { kind: 'traitOffer', result: { supported: true, findings: [] } }
        : {
            kind: 'concaveStone',
            result: { branches: [{ required: true, residualOptionKeys: ['option2', 'option3'] }] },
          },
  } as unknown as ProjectCandidateSession;
  const procRow = (choice: CarrierChildChoice) => {
    const completed = completeTraitCarrierChildren(catalog, candidates, trait, offer, choice);
    return completed.concaveStoneResult?.kind === 'proc'
      ? completed.concaveStoneResult.optionKey
      : undefined;
  };
  // A frozen order proves preference sorts a copy of what the order returned.
  const reversed: CarrierChildChoice = {
    order: (values) => Object.freeze([...values].reverse()),
    allowsTrait: () => true,
    prefersTrait: () => false,
  };

  it('takes the first eligible residual row', () => {
    expect(procRow(FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE)).toBe('option2');
  });

  it("follows the choice's order", () => {
    expect(procRow(reversed)).toBe('option3');
  });

  it('puts a preferred trait ahead of the order', () => {
    expect(procRow({ ...reversed, prefersTrait: (key) => key === 'ZeusSpecialBoon' })).toBe(
      'option2',
    );
  });

  it('never takes a trait the choice does not allow', () => {
    expect(
      procRow({
        ...FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE,
        allowsTrait: (key) => key !== 'ZeusSpecialBoon',
      }),
    ).toBe('option3');
  });

  it('authors a named child again', () => {
    const authored = {
      ...offer,
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    } as const;
    const [stone] = discoverAuthoredTraitCarrierChildren(catalog, trait, authored).filter(
      (child) => child.kind === 'concaveStone',
    );
    const completed = completeTraitCarrierChildren(
      catalog,
      candidates,
      trait,
      authored,
      reversed,
      stone!.address,
    );
    expect(completed.concaveStoneResult).toEqual({ kind: 'proc', optionKey: 'option3' });
  });
});
