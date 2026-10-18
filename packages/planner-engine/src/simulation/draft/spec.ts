import type { Catalog } from '../../catalog-schema';
import type {
  AuthoredRoutePlan,
  ProjectDocument,
  RouteLoadout,
} from '../../authored-project/model';
import { createProjectDocument } from '../../authored-project/defaults';
import { decodeProjectDocument } from '../../authored-project/codec';

/** The project's route and itinerary, which a draft never changes. */
export type DraftRoute = Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'>;

/** The loadout a draft sets; the starting reward and keepsake equip results are generated. */
export interface DraftLoadout {
  readonly weaponKey: string;
  readonly aspectKey: string;
  readonly familiarKey: string;
  readonly manualArcanaKeys: readonly string[];
  readonly fearRanks: Readonly<Record<string, number>>;
  readonly startingKeepsakeKey: string;
  readonly aspectHexTree?: RouteLoadout['aspectHexTree'];
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
export function forcesGod(catalog: Catalog, keepsakeKey: string): boolean {
  return catalog.keepsakes.byKey[keepsakeKey]?.effect?.kind === 'olympianRewardPressure';
}

/** The route loadout a draft sets, before any generated choice. */
export function draftRouteLoadout(loadout: DraftLoadout): RouteLoadout {
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
 * The base project's route with the draft loadout, every itinerary biome
 * configured and no topology, strictly decoded. Run modifiers carry over.
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
    configuredBiomeCount: base.route.itineraryBiomeKeys.length,
  });
  const runModifiers = base.route.loadout.runModifiers;
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        loadout: {
          ...draftRouteLoadout(loadout),
          ...(runModifiers === undefined ? {} : { runModifiers }),
        },
      },
    },
    catalog,
  );
}

/** A rack follows every biome's Postboss except the last. */
export function draftKeepsakeOptions(catalog: Catalog, route: DraftRoute): DraftKeepsakeOptions {
  const keepsakeKeys = Object.freeze(
    catalog.keepsakes.values.map((k) => k.key).filter((key) => !forcesGod(catalog, key)),
  );
  return Object.freeze({
    rackSlots: Object.freeze(
      route.itineraryBiomeKeys
        .slice(0, -1)
        .map((afterBiomeKey) => Object.freeze({ afterBiomeKey, keepsakeKeys })),
    ),
  });
}
