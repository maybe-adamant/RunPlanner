import type { Catalog } from '../../catalog-schema';
import type {
  AuthoredKeepsakeEquipResults,
  AuthoredRoutePlan,
  DraftRoomForcing,
  ProjectDocument,
  RouteLoadout,
} from '../../authored-project/model';
import { createProjectDocument } from '../../authored-project/defaults';
import { decodeProjectDocument } from '../../authored-project/codec';
import { resolveRoutePosition } from '../../authored-project/route-context';
import { routeHasKeepsakeRack } from '../../authored-project/route-profile';

/** The project's route and itinerary, which a draft never changes, and its configured prefix. */
export type DraftRoute = Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'> &
  Partial<Pick<AuthoredRoutePlan, 'biomes'>>;

/** The biomes a draft plans: the configured prefix ("Plan up to"), or the whole itinerary when none is. */
export function draftPlannedBiomeKeys(route: DraftRoute): readonly string[] {
  const count = route.biomes?.length ?? 0;
  return count === 0 ? route.itineraryBiomeKeys : route.itineraryBiomeKeys.slice(0, count);
}

/**
 * The loadout a draft sets; the starting reward and keepsake equip results are generated.
 * A null choice is one the route's save profile has not unlocked; the project codec judges it.
 */
export interface DraftLoadout {
  readonly weaponKey: string | null;
  readonly aspectKey: string | null;
  readonly familiarKey: string | null;
  readonly manualArcanaKeys: readonly string[];
  readonly fearRanks: Readonly<Record<string, number>>;
  readonly startingKeepsakeKey: string | null;
  readonly aspectHexTree?: RouteLoadout['aspectHexTree'];
  /** The player's own result for the starting keepsake, honoured where possible. */
  readonly keepsakeEquipResults?: AuthoredKeepsakeEquipResults;
}

/** The world the draft searches inside. */
export interface DraftWorld {
  /** At most the native god cap. */
  readonly godKeys: readonly string[];
  /** Targeted story NPC by biome; a biome left out has no story target. */
  readonly storyNpcByBiome: Readonly<Record<string, string>>;
  readonly fieldNpcsByBiome: Readonly<Record<string, readonly string[]>>;
}

/** In-memory draft spec: the loadout it sets and the plan it searches for. */
export interface DraftSpec {
  readonly loadout: DraftLoadout;
  readonly world: DraftWorld;
  readonly basketTraitKeys: readonly string[];
  /** One entry per Postboss rack between biomes, in order; null keeps the held keepsake. */
  readonly rackKeepsakeKeys: readonly (string | null)[];
  /** The player's preference for mid-biome Shops, which have no combat. */
  readonly preferMidshops?: boolean;
  /** Planned god boons by biome; a biome left out keeps its biome's default. */
  readonly godBoonsByBiome?: Readonly<Record<string, number>>;
  /** The most god boons from one god before Denial's reduction; absent is the default. */
  readonly perGodCap?: number;
  /** In Tartarus, always take the Clockwork Goal door, below a selected story room. */
  readonly pursueTartarusGoal?: boolean;
  /** How early a windowed room is forced; absent is the softened ramp. */
  readonly roomForcing?: DraftRoomForcing;
  /** Shop god boon purchases paced per planned biome; absent is the default. */
  readonly purchasesPerBiome?: number;
  /** Further attempts per biome after its first success; absent is the default. */
  readonly retriesPerBiome?: number;
  /** Percent chance a room rolls a resource point; absent is the default. */
  readonly resourceRoomChance?: number;
}

export interface DraftKeepsakeOptions {
  /** Legal keepsakes for each rack slot, in route order. */
  readonly rackSlots: readonly {
    readonly afterBiomeKey: string;
    readonly keepsakeKeys: readonly string[];
  }[];
}

/** Vow of Forfeit: an active vow that substitutes one boon room per biome. */
export function draftForfeitActive(catalog: Catalog, loadout: DraftLoadout): boolean {
  return catalog.fearVows.values.some(
    (vow) => vow.effect?.kind === 'substituteRoomReward' && (loadout.fearRanks[vow.key] ?? 0) > 0,
  );
}

/** Vow of Denial: an active vow that bans an offer's unselected rows. */
export function draftDenialActive(catalog: Catalog, loadout: DraftLoadout): boolean {
  return catalog.fearVows.values.some(
    (vow) => vow.effect?.kind === 'banUnselectedTraits' && (loadout.fearRanks[vow.key] ?? 0) > 0,
  );
}

/** Keepsakes that force a god's boon (`ForceBoonName`) bring an outside god in. */
export function forcesGod(catalog: Catalog, keepsakeKey: string | null): boolean {
  return (
    keepsakeKey !== null &&
    catalog.keepsakes.byKey[keepsakeKey]?.effect?.kind === 'olympianRewardPressure'
  );
}

/** The route loadout a draft sets, before any generated choice. */
function draftRouteLoadout(loadout: DraftLoadout): RouteLoadout {
  return Object.freeze({
    weaponKey: loadout.weaponKey,
    aspectKey: loadout.aspectKey,
    startingReward: null,
    manualArcanaKeys: loadout.manualArcanaKeys,
    fearRanks: loadout.fearRanks,
    startingKeepsakeKey: loadout.startingKeepsakeKey,
    familiarKey: loadout.familiarKey,
    ...(loadout.aspectHexTree === undefined ? {} : { aspectHexTree: loadout.aspectHexTree }),
  });
}

/**
 * The base project's route with the draft loadout, its planned biomes
 * configured and no topology, strictly decoded. Run modifiers and the Practice start carry over.
 */
export function draftLoadoutProject(
  catalog: Catalog,
  base: ProjectDocument,
  loadout: DraftLoadout,
): ProjectDocument {
  const project = createProjectDocument(catalog, {
    projectId: base.projectId,
    routeKey: base.route.routeKey,
    itineraryBiomeKeys: base.route.itineraryBiomeKeys,
    configuredBiomeCount: draftPlannedBiomeKeys(base.route).length,
  });
  const runModifiers = base.route.loadout.runModifiers;
  const practiceStart = base.route.practiceStart;
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        ...(practiceStart === undefined ? {} : { practiceStart }),
        loadout: {
          ...draftRouteLoadout(loadout),
          ...(runModifiers === undefined ? {} : { runModifiers }),
        },
      },
    },
    catalog,
  );
}

/** A rack follows each biome's Postboss whose room holds one on this route; the last biome has none. */
export function draftKeepsakeOptions(catalog: Catalog, route: DraftRoute): DraftKeepsakeOptions {
  const keepsakeKeys = Object.freeze(
    catalog.keepsakes.values.map((k) => k.key).filter((key) => !forcesGod(catalog, key)),
  );
  return Object.freeze({
    rackSlots: Object.freeze(
      route.itineraryBiomeKeys
        .filter((biomeKey) => {
          const postboss = resolveRoutePosition(catalog, route, biomeKey).completion
            .postbossRoomGameName;
          return (
            postboss !== null && routeHasKeepsakeRack(catalog.rooms.byKey[postboss], route.routeKey)
          );
        })
        .map((afterBiomeKey) => Object.freeze({ afterBiomeKey, keepsakeKeys })),
    ),
  });
}
