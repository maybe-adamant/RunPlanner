import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RouteLoadout } from '../../authored-project/model';
import { createProjectDocument } from '../../authored-project/defaults';
import { decodeProjectDocument } from '../../authored-project/codec';
import { ProjectDocumentContractError } from '../../authored-project/validation';

/** The loadout a draft sets; the starting reward and keepsake equip results are generated. */
export interface DraftLoadout {
  readonly routeKey: string;
  readonly itineraryBiomeKeys: readonly string[];
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

export type DraftRefusal =
  | { readonly kind: 'freshFileRoute' }
  /** The project codec rejects the loadout. */
  | { readonly kind: 'invalidLoadout'; readonly path: string; readonly detail: string }
  | { readonly kind: 'godStartingKeepsake'; readonly keepsakeKey: string };

export interface DraftKeepsakeOptions {
  /** Legal keepsakes for each rack slot, in route order. */
  readonly rackSlots: readonly {
    readonly afterBiomeKey: string;
    readonly keepsakeKeys: readonly string[];
  }[];
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

/** A strictly decoded project with every itinerary biome configured and no topology. */
export function draftLoadoutProject(
  catalog: Catalog,
  loadout: DraftLoadout,
  projectId: string,
): ProjectDocument {
  const project = createProjectDocument(catalog, {
    projectId,
    routeKey: loadout.routeKey,
    itineraryBiomeKeys: loadout.itineraryBiomeKeys,
    configuredBiomeCount: loadout.itineraryBiomeKeys.length,
  });
  return decodeProjectDocument(
    { ...project, route: { ...project.route, loadout: draftRouteLoadout(loadout) } },
    catalog,
  );
}

/** Reasons the loadout cannot be drafted at all. */
export function draftRefusals(catalog: Catalog, loadout: DraftLoadout): readonly DraftRefusal[] {
  const refusals: DraftRefusal[] = [];
  if (catalog.routes.byKey[loadout.routeKey]?.initialProfile.kind === 'freshFile')
    refusals.push({ kind: 'freshFileRoute' });
  else
    try {
      draftLoadoutProject(catalog, loadout, 'draft');
    } catch (error) {
      if (!(error instanceof ProjectDocumentContractError)) throw error;
      refusals.push({ kind: 'invalidLoadout', path: error.path, detail: error.detail });
    }
  if (forcesGod(catalog, loadout.startingKeepsakeKey))
    refusals.push({ kind: 'godStartingKeepsake', keepsakeKey: loadout.startingKeepsakeKey });
  return Object.freeze(refusals);
}

/** A rack follows every biome's Postboss except the last. */
export function draftKeepsakeOptions(
  catalog: Catalog,
  loadout: DraftLoadout,
): DraftKeepsakeOptions {
  const keepsakeKeys = Object.freeze(
    catalog.keepsakes.values.map((k) => k.key).filter((key) => !forcesGod(catalog, key)),
  );
  return Object.freeze({
    rackSlots: Object.freeze(
      loadout.itineraryBiomeKeys
        .slice(0, -1)
        .map((afterBiomeKey) => Object.freeze({ afterBiomeKey, keepsakeKeys })),
    ),
  });
}
