import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createProjectDocument } from '../../src/authored-project/defaults';
import { routeInitialProfile } from '../../src/authored-project/route-profile';
import type { DraftFillerRank, ProjectDocument } from '../../src/authored-project';
import {
  assessDraftBasket,
  draftKeepsakeOptions,
  draftRefusals,
  draftWorldOptions,
  type DraftLoadout,
  type DraftSpec,
  type DraftWorld,
} from '../../src/simulation';
import { createDraftRng, shuffleDraft } from '../../src/simulation/draft/rng';
import { draftBasket } from '../support/draft-basket';

export interface DraftCorpusEntry {
  readonly name: string;
  readonly base: ProjectDocument;
  readonly spec: DraftSpec;
  /** Planned biomes ("Plan up to"); the base project's configured prefix. */
  readonly prefix: number;
  readonly seeds: readonly number[];
}

/** Basket composition, filled in a seeded order with only traits the basket admits at that point. */
interface BasketRecipe {
  readonly godTraits: number;
  readonly hermes?: number;
  readonly hammer?: number;
  readonly selene?: number;
  /** Exact leading traits, each admitted in turn: Duos with their prerequisites before them. */
  readonly leadTraits?: readonly string[];
  /** A trait of this selected NPC giver, added last. */
  readonly npcGiverKey?: string;
}

interface EntryRecipe {
  readonly name: string;
  readonly routeKey: string;
  readonly itineraryBiomeKeys?: readonly string[];
  readonly prefix: number;
  readonly godKeys: readonly string[];
  readonly fieldNpcsByBiome?: Readonly<Record<string, readonly string[]>>;
  readonly basket: BasketRecipe;
  readonly forfeit?: boolean;
  /** Keepsake taken at the first rack. */
  readonly rackKeepsakeKey?: string;
  readonly preferMidshops?: boolean;
  readonly pursueTartarusGoal?: boolean;
  readonly purchasesPerBiome?: number;
  readonly fillerPriority?: readonly DraftFillerRank[];
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const LIGHT = 3;
const MEDIUM = 8;
/** More than any god cap, so a heavy basket fills to the planned cap. */
const HEAVY = 16;

const UNDERWORLD_GODS = ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'];
const UNDERWORLD_ALT_GODS = ['Poseidon', 'Demeter', 'Hera', 'Ares'];
const SURFACE_GODS = ['Zeus', 'Hera', 'Demeter', 'Ares'];
const DREAM_GODS = ['Zeus', 'Apollo', 'Poseidon', 'Hestia'];
const DREAM_ITINERARY = ['H', 'F', 'N', 'I'];
/** Fresh File offers Apollo first, Aphrodite and Hestia only after Poseidon or Demeter. */
const FRESH_GODS = ['Apollo', 'Poseidon', 'Demeter', 'Hestia'];
const FRESH_ALT_GODS = ['Apollo', 'Demeter', 'Aphrodite', 'Poseidon'];

const baseRecipes: readonly EntryRecipe[] = [
  {
    name: 'U1 light Artemis',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_GODS,
    fieldNpcsByBiome: { F: ['Artemis'] },
    basket: { godTraits: LIGHT },
    rackKeepsakeKey: 'DoorHealReserveKeepsake',
  },
  {
    name: 'U2 medium Hermes Hammer Selene',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_ALT_GODS,
    basket: { godTraits: MEDIUM, hermes: 1, hammer: 1, selene: 1 },
  },
  {
    name: 'U3 heavy Hermes Artemis trait',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_GODS,
    fieldNpcsByBiome: { F: ['Artemis'] },
    basket: { godTraits: HEAVY, hermes: 1, npcGiverKey: 'Artemis' },
  },
  {
    name: 'U4 medium Forfeit',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_ALT_GODS,
    basket: { godTraits: MEDIUM },
    forfeit: true,
  },
  {
    name: 'U5 medium prefix 1',
    routeKey: 'Underworld',
    prefix: 1,
    godKeys: UNDERWORLD_GODS,
    basket: { godTraits: MEDIUM },
  },
  {
    name: 'U6 medium Hammer prefix 2',
    routeKey: 'Underworld',
    prefix: 2,
    godKeys: UNDERWORLD_ALT_GODS,
    fieldNpcsByBiome: { G: ['Artemis'] },
    basket: { godTraits: MEDIUM, hammer: 1 },
  },
  {
    name: 'S1 light Icarus',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    fieldNpcsByBiome: { O: ['Icarus'] },
    basket: { godTraits: LIGHT },
    rackKeepsakeKey: 'DoorHealReserveKeepsake',
  },
  {
    name: 'S2 medium Hermes Hammer Selene Heracles',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    fieldNpcsByBiome: { N: ['Heracles'] },
    basket: { godTraits: MEDIUM, hermes: 1, hammer: 1, selene: 1 },
  },
  {
    name: 'S3 heavy Hermes Icarus trait',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    fieldNpcsByBiome: { O: ['Icarus'] },
    basket: { godTraits: HEAVY, hermes: 1, npcGiverKey: 'Icarus' },
  },
  {
    name: 'S4 medium Forfeit prefix 2',
    routeKey: 'Surface',
    prefix: 2,
    godKeys: SURFACE_GODS,
    basket: { godTraits: MEDIUM },
    forfeit: true,
  },
  {
    name: 'S5 light prefix 1',
    routeKey: 'Surface',
    prefix: 1,
    godKeys: SURFACE_GODS,
    basket: { godTraits: LIGHT },
  },
  {
    name: 'S6 medium Artemis N',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    fieldNpcsByBiome: { N: ['Artemis'] },
    basket: { godTraits: MEDIUM },
  },
  {
    name: 'S7 heavy Hermes Artemis trait N',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    fieldNpcsByBiome: { N: ['Artemis'] },
    basket: { godTraits: HEAVY, hermes: 1, npcGiverKey: 'Artemis' },
  },
  {
    name: 'D1 light',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 4,
    godKeys: DREAM_GODS,
    basket: { godTraits: LIGHT },
    rackKeepsakeKey: 'DoorHealReserveKeepsake',
  },
  {
    name: 'D2 medium Hammer Artemis prefix 2',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 2,
    godKeys: DREAM_GODS,
    fieldNpcsByBiome: { F: ['Artemis'] },
    basket: { godTraits: MEDIUM, hammer: 1 },
  },
  {
    name: 'D3 heavy Hermes Artemis trait',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 4,
    godKeys: DREAM_GODS,
    fieldNpcsByBiome: { F: ['Artemis'] },
    basket: { godTraits: HEAVY, hermes: 1, npcGiverKey: 'Artemis' },
  },
  {
    name: 'D4 medium Forfeit',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 4,
    godKeys: DREAM_GODS,
    basket: { godTraits: MEDIUM },
    forfeit: true,
  },
  {
    name: 'U7 medium 2 Hermes 2 Hammer',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_GODS,
    basket: { godTraits: MEDIUM, hermes: 2, hammer: 2 },
  },
  {
    name: 'S8 medium 2 Hermes 2 Hammer',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    basket: { godTraits: MEDIUM, hermes: 2, hammer: 2 },
  },
  {
    name: 'D5 medium 2 Hermes 2 Hammer',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 4,
    godKeys: DREAM_GODS,
    basket: { godTraits: MEDIUM, hermes: 2, hammer: 2 },
  },
  {
    name: 'U8 heavy 2 Duos',
    routeKey: 'Underworld',
    prefix: 4,
    godKeys: UNDERWORLD_GODS,
    basket: {
      godTraits: HEAVY,
      leadTraits: [
        'ZeusWeaponBoon',
        'HestiaSpecialBoon',
        'EchoBurnBoon',
        'ApolloCastBoon',
        'CoverRegenerationBoon',
      ],
    },
  },
  {
    name: 'S9 heavy 2 Duos',
    routeKey: 'Surface',
    prefix: 4,
    godKeys: SURFACE_GODS,
    basket: {
      godTraits: HEAVY,
      leadTraits: [
        'DemeterCastBoon',
        'HeraWeaponBoon',
        'KeepsakeLevelBoon',
        'ZeusSpecialBoon',
        'RootStrikeBoon',
      ],
    },
  },
  {
    name: 'D6 heavy 2 Duos',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 4,
    godKeys: DREAM_GODS,
    basket: {
      godTraits: HEAVY,
      leadTraits: [
        'PoseidonCastBoon',
        'ZeusWeaponBoon',
        'LightningVulnerabilityBoon',
        'HestiaSpecialBoon',
        'SteamBoon',
      ],
    },
  },
  {
    name: 'U9 heavy prefix 3',
    routeKey: 'Underworld',
    prefix: 3,
    godKeys: UNDERWORLD_GODS,
    basket: { godTraits: HEAVY, hermes: 1 },
  },
  {
    name: 'S10 heavy prefix 2',
    routeKey: 'Surface',
    prefix: 2,
    godKeys: SURFACE_GODS,
    basket: { godTraits: HEAVY },
  },
  {
    name: 'D7 heavy prefix 3',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 3,
    godKeys: DREAM_GODS,
    basket: { godTraits: HEAVY, hammer: 1 },
  },
  {
    name: 'F1 light',
    routeKey: 'FreshFile',
    prefix: 4,
    godKeys: FRESH_GODS,
    basket: { godTraits: LIGHT },
  },
  {
    name: 'F2 medium',
    routeKey: 'FreshFile',
    prefix: 4,
    godKeys: FRESH_ALT_GODS,
    basket: { godTraits: MEDIUM },
  },
  {
    name: 'F3 heavy',
    routeKey: 'FreshFile',
    prefix: 4,
    godKeys: FRESH_GODS,
    basket: { godTraits: HEAVY },
  },
  {
    name: 'F4 heavy prefix 2',
    routeKey: 'FreshFile',
    prefix: 2,
    godKeys: FRESH_ALT_GODS,
    basket: { godTraits: HEAVY },
  },
  {
    name: 'F5 medium prefix 1',
    routeKey: 'FreshFile',
    prefix: 1,
    godKeys: FRESH_GODS,
    basket: { godTraits: MEDIUM },
  },
  {
    name: 'F6 heavy alt',
    routeKey: 'FreshFile',
    prefix: 4,
    godKeys: FRESH_ALT_GODS,
    basket: { godTraits: HEAVY },
  },
  {
    name: 'U10 light 1 god prefix 1',
    routeKey: 'Underworld',
    prefix: 1,
    godKeys: ['Zeus'],
    basket: { godTraits: LIGHT },
  },
  {
    name: 'U11 medium 2 gods prefix 2',
    routeKey: 'Underworld',
    prefix: 2,
    godKeys: ['Zeus', 'Apollo'],
    basket: { godTraits: MEDIUM },
  },
  {
    name: 'S11 light 2 gods prefix 1',
    routeKey: 'Surface',
    prefix: 1,
    godKeys: ['Zeus', 'Hera'],
    basket: { godTraits: LIGHT },
  },
  {
    name: 'S12 light 1 god prefix 1',
    routeKey: 'Surface',
    prefix: 1,
    godKeys: ['Hera'],
    basket: { godTraits: LIGHT },
  },
  {
    name: 'D8 light 2 gods prefix 3',
    routeKey: 'Dream',
    itineraryBiomeKeys: DREAM_ITINERARY,
    prefix: 3,
    godKeys: ['Zeus', 'Apollo'],
    basket: { godTraits: LIGHT },
  },
  {
    name: 'F7 light 1 god prefix 1',
    routeKey: 'FreshFile',
    prefix: 1,
    godKeys: ['Apollo'],
    basket: { godTraits: LIGHT },
  },
];

/** The same specs with the player's midshop preference on. */
const MIDSHOP_VARIANTS = ['U3', 'S2', 'D3', 'U6', 'F3'];
/** Full-route specs through Tartarus, with the Clockwork Goal pursued. */
const TARTARUS_VARIANTS = ['U1', 'U3', 'U4', 'U8', 'D1', 'D3', 'D4', 'F3'];

/** Ranked filler: the spec's suffix, its ranking and its Shop purchases per biome. */
const FILLER_VARIANTS: readonly {
  readonly base: string;
  readonly suffix: string;
  readonly fillerPriority: readonly DraftFillerRank[];
  readonly purchasesPerBiome?: number;
}[] = [
  {
    base: 'U1',
    suffix: 'filler',
    fillerPriority: [
      { kind: 'maxHealth' },
      { kind: 'pom' },
      { kind: 'gold' },
      { kind: 'maxMagick' },
    ],
  },
  {
    base: 'S2',
    suffix: 'filler amounts',
    fillerPriority: [
      { kind: 'maxHealth', amount: 3 },
      { kind: 'pom', amount: 2 },
      { kind: 'gold' },
    ],
  },
  {
    base: 'D1',
    suffix: 'filler shops',
    fillerPriority: [{ kind: 'pom' }, { kind: 'maxHealth' }, { kind: 'maxMagick' }],
    purchasesPerBiome: 3,
  },
];

const recipes: readonly EntryRecipe[] = [
  ...baseRecipes,
  ...baseRecipes
    .filter((recipe) => MIDSHOP_VARIANTS.includes(recipe.name.split(' ')[0]!))
    .map((recipe) => ({ ...recipe, name: `${recipe.name} midshops`, preferMidshops: true })),
  ...baseRecipes
    .filter((recipe) => TARTARUS_VARIANTS.includes(recipe.name.split(' ')[0]!))
    .map((recipe) => ({ ...recipe, name: `${recipe.name} tartarus`, pursueTartarusGoal: true })),
  ...FILLER_VARIANTS.map(({ base, suffix, ...options }) => {
    const recipe = baseRecipes.find((candidate) => candidate.name.split(' ')[0] === base)!;
    return { ...recipe, ...options, name: `${recipe.name} ${suffix}` };
  }),
];

function baseName(recipe: EntryRecipe): string {
  return recipe.name.replace(/ (midshops|tartarus|filler|filler amounts|filler shops)$/, '');
}

function nameSeed(name: string): number {
  let hash = 2_166_136_261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619) >>> 0;
  return hash;
}

function providerKindsOf(traitKey: string): readonly string[] {
  return catalog.traitGivers.values
    .filter((giver) => giver.traitKeys.includes(traitKey))
    .map((giver) => giver.providerKind);
}

/** Grows the basket one admitted trait at a time, so each prerequisite precedes its dependants. */
function buildBasket(
  recipe: EntryRecipe,
  base: ProjectDocument,
  loadout: DraftLoadout,
  world: DraftWorld,
): string[] {
  // A midshop variant builds its base spec's basket.
  const rng = createDraftRng(nameSeed(baseName(recipe)));
  const basket: string[] = [];
  const spec = (): DraftSpec => ({
    loadout,
    world,
    basketByGiver: draftBasket(basket, {}, world.godKeys),
    rackKeepsakeKeys: [],
  });
  // A capped kind stops at the planned share's cap; a named trait must be admitted.
  const add = (
    count: number,
    wanted: (traitKey: string) => boolean,
    label: string,
    capped = false,
  ) => {
    for (let added = 0; added < count; added += 1) {
      const selectable = assessDraftBasket(catalog, base.route, spec()).traits.filter(
        (trait) => !trait.inBasket && trait.selectable && wanted(trait.traitKey),
      );
      // A trait admitted now can still leave an earlier one waiting on it, so the basket must stay unrefused.
      const next = shuffleDraft(
        rng,
        selectable.map((trait) => trait.traitKey),
      ).find(
        (key) =>
          !draftRefusals(catalog, base, {
            ...spec(),
            basketByGiver: draftBasket([...basket, key], {}, world.godKeys),
          }).some(
            (refusal) => refusal.kind === 'basketTrait' || refusal.kind === 'firstOfferBlocked',
          ),
      );
      if (next === undefined && capped) return;
      if (next === undefined) throw new Error(`${recipe.name}: no admissible ${label} trait`);
      basket.push(next);
    }
  };
  const godKinds = (key: string) => {
    const kinds = providerKindsOf(key);
    return kinds.length > 0 && kinds.every((kind) => kind === 'olympian');
  };
  for (const key of recipe.basket.leadTraits ?? []) add(1, (candidate) => candidate === key, key);
  add(recipe.basket.godTraits - (recipe.basket.leadTraits?.length ?? 0), godKinds, 'god', true);
  add(recipe.basket.hermes ?? 0, (key) => providerKindsOf(key).includes('hermes'), 'Hermes', true);
  add(recipe.basket.hammer ?? 0, (key) => providerKindsOf(key).includes('hammer'), 'Hammer', true);
  add(recipe.basket.selene ?? 0, (key) => providerKindsOf(key).includes('spell'), 'Selene');
  const npc = recipe.basket.npcGiverKey;
  if (npc !== undefined)
    add(1, (key) => catalog.traitGivers.byKey[npc]?.traitKeys.includes(key) === true, npc);
  return basket;
}

function buildEntry(recipe: EntryRecipe): DraftCorpusEntry {
  const base = createProjectDocument(catalog, {
    projectId: `corpus-${nameSeed(baseName(recipe))}`,
    routeKey: recipe.routeKey,
    ...(recipe.itineraryBiomeKeys === undefined
      ? {}
      : { itineraryBiomeKeys: recipe.itineraryBiomeKeys }),
    configuredBiomeCount: recipe.prefix,
  });
  // A fixed-loadout route drafts its own null loadout; the others the default one.
  const { startingReward: _startingReward, ...defaults } =
    routeInitialProfile(catalog, recipe.routeKey).kind === 'freshFile'
      ? base.route.loadout
      : createDefaultRouteLoadout(catalog);
  void _startingReward;
  const loadout: DraftLoadout = recipe.forfeit
    ? { ...defaults, fearRanks: { ...defaults.fearRanks, BoonSkipShrineUpgrade: 1 } }
    : defaults;
  const options = draftWorldOptions(catalog, base.route);
  const world: DraftWorld = {
    godKeys: recipe.godKeys,
    storyNpcByBiome: Object.fromEntries(
      options.biomes.flatMap((biome) =>
        biome.storyNpc === undefined ? [] : [[biome.biomeKey, biome.storyNpc.npcKey]],
      ),
    ),
    fieldNpcsByBiome: recipe.fieldNpcsByBiome ?? {},
  };
  const rackSlots = draftKeepsakeOptions(catalog, base.route).rackSlots;
  const rackKeepsakeKeys = rackSlots.map((slot, index) => {
    const key = index === 0 ? recipe.rackKeepsakeKey : undefined;
    if (key !== undefined && !slot.keepsakeKeys.includes(key))
      throw new Error(`${recipe.name}: ${key} is not a rack option`);
    return key ?? null;
  });
  const spec: DraftSpec = {
    loadout,
    world,
    basketByGiver: draftBasket(buildBasket(recipe, base, loadout, world), {}, world.godKeys),
    rackKeepsakeKeys,
    ...(recipe.preferMidshops === true ? { preferMidshops: true } : {}),
    ...(recipe.pursueTartarusGoal === true ? { pursueTartarusGoal: true } : {}),
    ...(recipe.purchasesPerBiome === undefined
      ? {}
      : { purchasesPerBiome: recipe.purchasesPerBiome }),
    ...(recipe.fillerPriority === undefined ? {} : { fillerPriority: recipe.fillerPriority }),
  };
  const refusals = draftRefusals(catalog, base, spec);
  if (refusals.length > 0)
    throw new Error(`${recipe.name} is refused: ${JSON.stringify(refusals)}`);
  return Object.freeze({ name: recipe.name, base, spec, prefix: recipe.prefix, seeds: SEEDS });
}

/** One spec of the opt-in draft corpus, which spans all three routes with deterministic seeds. */
export function draftCorpusEntry(index: number): DraftCorpusEntry {
  return buildEntry(recipes[index]!);
}

export const DRAFT_CORPUS_SPEC_COUNT = recipes.length;
export const DRAFT_CORPUS_RUN_COUNT = recipes.length * SEEDS.length;
