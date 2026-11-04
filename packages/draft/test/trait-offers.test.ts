import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createDefaultRouteLoadout,
  createEncounterPhaseAddress,
  createProjectDocument,
  createTraitOfferAddress,
  type AuthoredTraitOfferTraits,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import type { ProjectCandidateSession } from '@run-planner/engine/simulation';
import { draftProject, type DraftSpec } from '../src';
import { DraftTraitOffers, type DraftTraitOfferContext } from '../src/trait-offers';
import { draftSteeringFor } from './support/draft-walk';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const base = createProjectDocument(catalog, {
  projectId: 't',
  routeKey: 'Underworld',
  configuredBiomeCount: 4,
});

/** Trait allowance for sources other than a trait offer, over the base project's start. */
function allowance(basketByGiver: DraftSpec['basketByGiver']) {
  const spec: DraftSpec = {
    loadout,
    world: {
      godKeys: ['Zeus', 'Hestia', 'Ares', 'Demeter'],
      storyNpcByBiome: { I: 'Hades' },
      fieldNpcsByBiome: {},
    },
    basketByGiver,
    rackKeepsakeKeys: [null, null, null],
  };
  const steering = draftSteeringFor(base, spec);
  const unused = () => {
    throw new Error('not used by trait allowance');
  };
  const offers = new DraftTraitOffers({
    catalog,
    spec,
    steering,
    hooked: new Set(),
    project: () => base,
    candidates: unused,
    startingOutcome: unused,
    apply: unused,
    shuffle: (values) => [...values],
    fail: unused,
  } satisfies DraftTraitOfferContext);
  return (traitKey: string) => offers.traitAllowed(traitKey, steering.progress());
}

describe('draft trait allowance', () => {
  it('never takes a trait that would keep a basket trait still to come from being offered', () => {
    const hestiaCast = allowance({ Hestia: ['CastProjectileBoon'] });
    for (const traitKey of [
      'HadesCastProjectileBoon',
      'CastAnywhereBoon',
      'CastLobBoon',
      'SelfCastBoon',
    ])
      expect(hestiaCast(traitKey), traitKey).toBe(false);
    expect(hestiaCast('ZeusWeaponBoon')).toBe(true);
    const hadesCast = allowance({ Hades: ['HadesCastProjectileBoon'] });
    expect(hadesCast('CastProjectileBoon')).toBe(false);
    expect(allowance({})('CastProjectileBoon')).toBe(true);
  });
});

describe('draft trait screens with a Death Defiance offer row', () => {
  const dream = createProjectDocument(catalog, {
    projectId: 'd',
    routeKey: 'Dream',
    itineraryBiomeKeys: ['H', 'F', 'N', 'I'],
    configuredBiomeCount: 1,
  });
  const spec: DraftSpec = {
    loadout,
    world: {
      godKeys: ['Zeus', 'Apollo', 'Poseidon', 'Hestia'],
      storyNpcByBiome: { H: 'Echo' },
      fieldNpcsByBiome: {},
    },
    basketByGiver: {},
    rackKeepsakeKeys: [null, null, null],
  };
  const echoRows = [
    'EchoDeathDefianceRefill',
    'DiminishingDodgeBoon',
    'DiminishingHealthAndManaBoon',
  ];
  const echoScreen: AuthoredTraitOfferTraits = {
    kind: 'traits',
    giverKey: 'Echo',
    options: echoRows.map((traitKey) => ({ traitKey })),
    selectedOptionKey: 'option2',
    rarificationActions: [],
  } as unknown as AuthoredTraitOfferTraits;

  /** Authors Echo's story screen, whose engine rows include Echo's Death Defiance refill. */
  function authorEchoScreen(supported: (traitKeys: readonly string[]) => boolean) {
    const drafted = draftProject(catalog, dream, spec, 1);
    if (drafted.kind !== 'drafted') throw new Error(`draft ${drafted.kind}`);
    const biome = drafted.project.route.biomes[0]!;
    const echo = biome.topology!.occurrences.find(
      (occurrence) => occurrence.encounters?.traitOffersByPhase?.Encounter?.Story_Echo_01,
    )!;
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        createBiomeAddress('Dream', 'H'),
        { kind: 'occurrence', occurrenceId: echo.occurrenceId },
        'Encounter',
      ),
      'selection',
    );
    const applied: ProjectCommand[] = [];
    const failures: string[] = [];
    const candidates = {
      evaluate: (query: { value: AuthoredTraitOfferTraits }) => ({
        kind: 'traitOffer',
        result: {
          supported: supported(query.value.options.map((option) => option.traitKey)),
          findings: [],
          assessments: query.value.options.map(() => ({})),
        },
      }),
    } as unknown as ProjectCandidateSession;
    const offers = new DraftTraitOffers({
      catalog,
      spec,
      steering: draftSteeringFor(dream, spec),
      hooked: new Set(),
      project: () => drafted.project,
      candidates: () => candidates,
      startingOutcome: (_trait, giverKey) => (giverKey === 'Echo' ? echoScreen : undefined),
      apply: (command) => {
        applied.push(command);
        return true;
      },
      shuffle: (values) => [...values],
      fail: (reason) => failures.push(reason),
    } satisfies DraftTraitOfferContext);
    return { authored: offers.author(trait), applied, failures };
  }

  it('fills the Death Defiance row with another of the giver’s rows', () => {
    const { authored, applied } = authorEchoScreen(() => true);
    expect(authored).toBe(true);
    expect(applied).toHaveLength(1);
    const command = applied[0]!;
    if (command.kind !== 'ReplaceTraitOffer' || command.value.kind !== 'traits')
      throw new Error(command.kind);
    const rows = command.value.options.map((option) => option.traitKey);
    expect(rows).not.toContain('EchoDeathDefianceRefill');
    expect([rows[1], command.value.selectedOptionKey]).toEqual(['DiminishingDodgeBoon', 'option2']);
  });

  // The walk then ends the biome at the missing offer, as at any repair it cannot make.
  it('refuses the screen when no other row can take the Death Defiance row’s place', () => {
    const offered = (traitKeys: readonly string[]) =>
      traitKeys.every((traitKey) => echoRows.includes(traitKey));
    expect(authorEchoScreen(offered)).toEqual({ authored: false, applied: [], failures: [] });
  });
});
