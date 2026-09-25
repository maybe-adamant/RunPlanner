import { catalog as productionCatalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '../../src/catalog-schema';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { resolveRoutePosition } from '../../src/authored-project/route-context';
import { createArcanaFearState, type ArcanaFearState } from '../../src/simulation/arcana-fear';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import type { KeepsakeState } from '../../src/simulation/keepsakes/state';
import type { RewardHistoryState } from '../../src/reward-kernel';
import type { StygianWellRunState } from '../../src/simulation/commerce/stygian-well';
import { createInitialSimulationState } from '../../src/simulation/state/construction';
import type { SimulationState } from '../../src/simulation/state/model';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { createTraitHistoryState } from '../../src/simulation/traits/history/fold';
import { initializeTestRewardBranchesForRoute } from './arcana-fear';
import type { TraitHistoryState } from '../../src/simulation/traits/history/model';

export interface TraitFrontierOverrides {
  readonly catalog?: Catalog;
  readonly routeKey?: string;
  readonly biomeKey?: string;
  /** Required for Dream, whose itinerary is authored rather than preset. */
  readonly itineraryBiomeKeys?: readonly string[];
  /** Reaches the nth itinerary biome, which owns that acquisition ordinal. */
  readonly acquisitionOrdinal?: number;
  readonly loadout?: { readonly weaponKey: string; readonly aspectKey: string };
  readonly startingKeepsakeKey?: string;
  readonly arcanaFear?: ArcanaFearState;
  readonly keepsakes?: KeepsakeState;
  readonly rewardHistory?: RewardHistoryState;
  readonly stygianWell?: Partial<StygianWellRunState>;
}

/**
 * One explicit run-start snapshot for focused trait-eligibility tests. It
 * composes production constructors and then installs the exact substates a
 * focused case owns; it never reproduces eligibility policy.
 */
export function traitFrontierState(
  traitHistory: TraitHistoryState = createTraitHistoryState(),
  overrides: TraitFrontierOverrides = {},
): SimulationState {
  const catalog = overrides.catalog ?? productionCatalog;
  const routeKey = overrides.routeKey ?? 'Underworld';
  const route = catalog.routes.byKey[routeKey];
  if (route === undefined) throw new Error(`unknown test route ${routeKey}`);
  const itineraryBiomeKeys =
    overrides.itineraryBiomeKeys ??
    (route.biomeKeys.length > 0 ? route.biomeKeys : route.dreamItinerary?.initialBiomeKeys);
  if (itineraryBiomeKeys === undefined)
    throw new Error(`test route ${routeKey} needs an explicit itinerary`);
  const biomeKey =
    overrides.biomeKey ?? itineraryBiomeKeys[(overrides.acquisitionOrdinal ?? 1) - 1]!;
  const defaults = createDefaultRouteLoadout(catalog);
  const loadout = overrides.loadout ?? defaults;
  const startingKeepsakeKey = overrides.startingKeepsakeKey ?? catalog.defaultStartingKeepsakeKey;
  const arcanaFear = overrides.arcanaFear ?? createArcanaFearState(catalog, defaults);
  const initial = createInitialSimulationState(
    catalog,
    loadout,
    startingKeepsakeKey,
    arcanaFear,
    Object.freeze({
      routePosition: resolveRoutePosition(catalog, { routeKey, itineraryBiomeKeys }, biomeKey),
      historyView: createRouteStartHistoryView(),
    }),
  );
  const reached = replaceSimulationTraitHistory(initial, traitHistory);
  return Object.freeze({
    ...reached,
    ...(overrides.keepsakes === undefined ? {} : { keepsakes: overrides.keepsakes }),
    ...(overrides.rewardHistory === undefined ? {} : { rewardHistory: overrides.rewardHistory }),
    ...(overrides.stygianWell === undefined
      ? {}
      : { stygianWell: Object.freeze({ ...reached.stygianWell, ...overrides.stygianWell }) }),
  });
}

/** The same frontier with at least one settled Spell Drop in reward history. */
export function withSettledSpellDrop(state: SimulationState): SimulationState {
  return Object.freeze({
    ...state,
    rewardHistory: Object.freeze({
      ...state.rewardHistory,
      useRecord: Object.freeze({ ...state.rewardHistory.useRecord, SpellDrop: 1 }),
    }),
  });
}

/** A run-start branch reached at the nth itinerary biome of an ordinary route. */
export function testRewardBranchesAtOrdinal(
  ordinal: number,
  routeKey = 'Underworld',
  testCatalog: Catalog = productionCatalog,
  arcanaFear?: ArcanaFearState,
) {
  const route = testCatalog.routes.byKey[routeKey];
  if (route === undefined) throw new Error(`unknown test route ${routeKey}`);
  return initializeTestRewardBranchesForRoute(
    undefined,
    arcanaFear,
    testCatalog,
    undefined,
    undefined,
    routeKey,
    undefined,
    Object.freeze({
      routePosition: resolveRoutePosition(
        testCatalog,
        { routeKey, itineraryBiomeKeys: route.biomeKeys },
        route.biomeKeys[ordinal - 1]!,
      ),
      historyView: createRouteStartHistoryView(),
    }),
  );
}

/** The exact Arcana frontier with the named cards active. */
export function arcanaFearWithActive(
  cardKeys: readonly string[],
  base: ArcanaFearState = createArcanaFearState(
    productionCatalog,
    createDefaultRouteLoadout(productionCatalog),
  ),
): ArcanaFearState {
  return Object.freeze({
    ...base,
    arcana: Object.freeze({
      ...base.arcana,
      active: Object.freeze(
        cardKeys.map((key) =>
          Object.freeze({ key, origin: 'manual' as const, rarity: 'Common' as const }),
        ),
      ),
    }),
  });
}

/** A candidate context for a screen whose options are built when it opens. */
export function openTimeTraitOfferContext<
  Context extends { readonly state: SimulationState; readonly source: object },
>(context: Context): Context & { readonly generationState: SimulationState } {
  return Object.freeze({ ...context, generationState: context.state });
}

export function openTimeTraitOfferContexts<
  Context extends { readonly state: SimulationState; readonly source: object },
>(
  contexts: ReadonlyMap<string, readonly Context[]>,
): ReadonlyMap<string, readonly (Context & { readonly generationState: SimulationState })[]> {
  return new Map(
    [...contexts].map(([key, values]) => [
      key,
      Object.freeze(values.map((value) => openTimeTraitOfferContext(value))),
    ]),
  );
}
