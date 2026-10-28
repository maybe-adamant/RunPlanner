type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

const ENTRY_KEY = 'infernalContractReward';

/**
 * One occurrence in its schema-99 shape: no phantom exit, and a Shop-form
 * pedestal returns to the Shop inventory.
 */
function legacyOccurrence(occurrence: Json): Json {
  const copy: Json = { ...occurrence };
  delete copy.phantomExit;
  const pedestal = copy.infernalContractPedestal;
  delete copy.infernalContractPedestal;
  const state = record(copy.state);
  const shop = state?.kind === 'shop' ? record(state.shop) : undefined;
  const offers = record(shop?.offers);
  if (pedestal === undefined || shop === undefined || offers === undefined) return copy;
  copy.state = { ...state, shop: { ...shop, offers: { ...offers, [ENTRY_KEY]: pedestal } } };
  const actions = record(copy.roomActions);
  if (Array.isArray(actions?.order))
    copy.roomActions = {
      ...actions,
      order: actions.order.map((action) =>
        record(action)?.kind === 'interactInfernalContractPedestal'
          ? { kind: 'interactShopOffer', offerKey: ENTRY_KEY }
          : action,
      ),
    };
  const sites = record(copy.acquisitionSites);
  const pedestalSite = record(sites?.infernalContractPedestal);
  if (sites !== undefined && pedestalSite !== undefined) {
    const rest = { ...sites };
    delete rest.infernalContractPedestal;
    const roomExit = record(rest.roomExit) ?? {};
    rest.roomExit = {
      ...roomExit,
      pickupEntries: {
        ...(record(roomExit.pickupEntries) ?? {}),
        ...(record(pedestalSite.pickupEntries) ?? {}),
      },
    };
    copy.acquisitionSites = rest;
  }
  return copy;
}

/**
 * A current document body in its schema-99 shape, for tests that relabel a
 * current document as an older schema and load it through every transition.
 */
export function legacySchema99Body<T>(value: T): T {
  const document = record(value);
  const route = record(document?.route);
  if (document === undefined || route === undefined || !Array.isArray(route.biomes)) return value;
  return {
    ...document,
    route: {
      ...route,
      biomes: route.biomes.map((biome) => {
        const topology = record(record(biome)?.topology);
        if (topology === undefined || !Array.isArray(topology.occurrences)) return biome;
        return {
          ...(biome as Json),
          topology: {
            ...topology,
            occurrences: topology.occurrences.map((occurrence) =>
              legacyOccurrence(occurrence as Json),
            ),
          },
        };
      }),
    },
  } as T;
}
