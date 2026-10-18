import type { Catalog } from '../../catalog-schema';
import type { AuthoredRoutePlan } from '../../authored-project/model';

/** The project's route and loadout a draft fills; the draft never edits them. */
export type DraftRoute = Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys' | 'loadout'>;

/** The world the draft searches inside. */
export interface DraftWorld {
  /** At most the native god cap. */
  readonly godKeys: readonly string[];
  /** Targeted story NPC by biome; a biome left out has no story target. */
  readonly storyNpcByBiome: Readonly<Record<string, string>>;
  readonly fieldNpcsByBiome: Readonly<Record<string, readonly string[]>>;
}

/** In-memory draft spec over the project's loadout. */
export interface DraftSpec {
  readonly world: DraftWorld;
  readonly basketTraitKeys: readonly string[];
  /** One entry per Postboss rack between biomes, in order; null keeps the held keepsake. */
  readonly rackKeepsakeKeys: readonly (string | null)[];
}

export type DraftRefusal =
  | { readonly kind: 'freshFileRoute' }
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

/** Reasons the route cannot be drafted at all. */
export function draftRefusals(catalog: Catalog, route: DraftRoute): readonly DraftRefusal[] {
  const refusals: DraftRefusal[] = [];
  if (catalog.routes.byKey[route.routeKey]?.initialProfile.kind === 'freshFile')
    refusals.push({ kind: 'freshFileRoute' });
  const keepsakeKey = route.loadout.startingKeepsakeKey;
  if (keepsakeKey !== null && forcesGod(catalog, keepsakeKey))
    refusals.push({ kind: 'godStartingKeepsake', keepsakeKey });
  return Object.freeze(refusals);
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
