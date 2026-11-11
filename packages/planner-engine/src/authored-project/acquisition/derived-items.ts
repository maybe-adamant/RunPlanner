import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, semanticAddressKey, type BiomeAddress } from '../addresses';
import type {
  AuthoredAcquisitionSiteState,
  AuthoredRewardState,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { sameRewardOffer } from '../../reward-kernel';
import { resolveRoutePosition } from '../route-context';
import { routeStartIncomingReward } from '../room-state/starting-reward';
import { authoredAcquisitionSources, type AuthoredAcquisitionSource } from './acquisition-sources';
import { parseArtificerReplacementEntryKey } from './artificer';
import { parseSeaStarDuplicateSiteKey, SEA_STAR_DUPLICATE_ENTRY_KEY } from './sea-star';

/**
 * Same-room items derived from another item: a Sea Star duplicate and an
 * Artificer replacement. Each names its source by owner and acquisition role.
 */
interface DerivedItem {
  readonly siteKey: string;
  readonly entryKey: string;
  readonly kind: 'seaStar' | 'artificer';
  readonly source: string;
}

function sourceKey(owner: string, acquisitionRole: string): string {
  return `${owner} ${acquisitionRole}`;
}

function derivedItems(occurrence: RoomOccurrence): readonly DerivedItem[] {
  return Object.entries(occurrence.acquisitionSites ?? {}).flatMap(
    ([siteKey, site]): DerivedItem[] => {
      const seaStar = parseSeaStarDuplicateSiteKey(siteKey);
      if (seaStar !== undefined)
        return [
          {
            siteKey,
            entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
            kind: 'seaStar' as const,
            source: sourceKey(seaStar.sourceKey, seaStar.acquisitionRole),
          },
        ];
      return Object.keys(site.pickupEntries ?? {}).flatMap((entryKey) => {
        const artificer = parseArtificerReplacementEntryKey(entryKey);
        return artificer === undefined
          ? []
          : [
              {
                siteKey,
                entryKey,
                kind: 'artificer' as const,
                source: sourceKey(artificer.sourceKey, artificer.acquisitionRole),
              },
            ];
      });
    },
  );
}

function sourcesByKey(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  routeStartIncoming: AuthoredRewardState | undefined,
): ReadonlyMap<string, AuthoredAcquisitionSource> {
  return new Map(
    authoredAcquisitionSources(biome, occurrence, routeStartIncoming).map((source) => [
      sourceKey(semanticAddressKey(source.acquisition.owner), source.acquisition.acquisitionRole),
      source,
    ]),
  );
}

/** The occurrence without the given items and the pickup rows that take them. */
function withoutItems(
  occurrence: RoomOccurrence,
  items: readonly Pick<DerivedItem, 'siteKey' | 'entryKey'>[],
): RoomOccurrence {
  const removed = new Set(items.map((item) => `${item.siteKey} ${item.entryKey}`));
  const sites: Record<string, AuthoredAcquisitionSiteState> = {};
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    const entries = Object.entries(site.pickupEntries ?? {}).filter(
      ([entryKey]) => !removed.has(`${siteKey} ${entryKey}`),
    );
    if (entries.length === Object.keys(site.pickupEntries ?? {}).length) sites[siteKey] = site;
    else if (entries.length > 0)
      sites[siteKey] = Object.freeze({
        ...site,
        pickupEntries: Object.freeze(Object.fromEntries(entries)),
      });
  }
  const { acquisitionSites: _sites, ...rest } = occurrence;
  void _sites;
  return Object.freeze({
    ...rest,
    ...(Object.keys(sites).length === 0 ? {} : { acquisitionSites: Object.freeze(sites) }),
    roomActions: Object.freeze({
      ...occurrence.roomActions,
      order: Object.freeze(
        occurrence.roomActions.order.filter(
          (reference) =>
            reference.kind !== 'interactAcquisitionEntry' ||
            !removed.has(`${reference.siteKey} ${reference.entryKey}`),
        ),
      ),
    }),
  });
}

/**
 * Discards, with their pickups, the derived items whose source this edit
 * changed: a source no longer produced, a source whose offer changed, an
 * Artificer replacement whose source no longer converts with the Artificer,
 * and any source the caller names. A discarded item's own derived items go
 * with it.
 */
export function withoutStaleDerivedItems(
  biome: BiomeAddress,
  previous: RoomOccurrence | undefined,
  occurrence: RoomOccurrence,
  options: {
    readonly previousStartIncoming?: AuthoredRewardState | undefined;
    readonly startIncoming?: AuthoredRewardState | undefined;
    /** Sources (owner key and acquisition role) the edit replaced whatever their offer. */
    readonly replacedSources?: ReadonlySet<string>;
  } = {},
): RoomOccurrence {
  if (derivedItems(occurrence).length === 0) return occurrence;
  const before =
    previous === undefined
      ? new Map<string, AuthoredAcquisitionSource>()
      : sourcesByKey(biome, previous, options.previousStartIncoming);
  let current = occurrence;
  for (;;) {
    const after = sourcesByKey(biome, current, options.startIncoming);
    const stale = derivedItems(current).filter((item) => {
      if (options.replacedSources?.has(item.source) === true) return true;
      const was = before.get(item.source);
      const is = after.get(item.source);
      // A source this edit never saw is not this edit's to judge.
      if (was === undefined) return false;
      if (is === undefined) return true;
      if (!sameRewardOffer(was.reward.offer, is.reward.offer)) return true;
      // Only the edit that takes the source off the Artificer discards its replacement.
      return item.kind === 'artificer' && convertsWithArtificer(was) && !convertsWithArtificer(is);
    });
    if (stale.length === 0) return current;
    current = withoutItems(current, stale);
  }
}

function convertsWithArtificer(source: AuthoredAcquisitionSource): boolean {
  return (
    source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole]?.kind ===
    'artificer'
  );
}

function sameOptionalOffer(
  left: AuthoredRewardState | undefined,
  right: AuthoredRewardState | undefined,
): boolean {
  return left === undefined || right === undefined
    ? left === right
    : sameRewardOffer(left.offer, right.offer);
}

/**
 * Drops each Artificer replacement, with its pickup, whose source does not
 * convert with the Artificer: leftover state an earlier schema kept dormant.
 */
export function withoutDormantArtificerReplacements(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  startIncoming?: AuthoredRewardState,
): RoomOccurrence {
  const items = derivedItems(occurrence).filter((item) => item.kind === 'artificer');
  if (items.length === 0) return occurrence;
  const sources = sourcesByKey(biome, occurrence, startIncoming);
  const dormant = items.filter((item) => {
    const source = sources.get(item.source);
    return source === undefined || !convertsWithArtificer(source);
  });
  return dormant.length === 0 ? occurrence : withoutItems(occurrence, dormant);
}

/** {@link withoutDormantArtificerReplacements} in every occurrence of the plan. */
export function withoutDormantArtificerReplacementsInProject(
  document: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  const route = document.route;
  let changed = false;
  const biomes = route.biomes.map((plan) => {
    if (plan.topology === null) return plan;
    const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
    const routePosition = resolveRoutePosition(catalog, route, plan.biomeKey);
    let occurrencesChanged = false;
    const occurrences = plan.topology.occurrences.map((occurrence) => {
      const cleaned = withoutDormantArtificerReplacements(
        biome,
        occurrence,
        routeStartIncomingReward(document, routePosition, occurrence) ?? undefined,
      );
      if (cleaned !== occurrence) occurrencesChanged = true;
      return cleaned;
    });
    if (!occurrencesChanged) return plan;
    changed = true;
    return Object.freeze({
      ...plan,
      topology: Object.freeze({ ...plan.topology, occurrences: Object.freeze(occurrences) }),
    });
  });
  return changed
    ? Object.freeze({
        ...document,
        route: Object.freeze({ ...route, biomes: Object.freeze(biomes) }),
      })
    : document;
}

/** Discards the items derived from one acquisition entry, whose source the edit replaced. */
export function withoutItemsDerivedFromEntry(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  siteKey: string,
  entryKey: string,
): RoomOccurrence {
  const replacedSources = new Set(
    authoredAcquisitionSources(biome, occurrence).flatMap(({ acquisition }) =>
      acquisition.owner.kind === 'acquisitionEntry' &&
      acquisition.owner.site.pointKey === siteKey &&
      acquisition.owner.entryKey === entryKey
        ? [sourceKey(semanticAddressKey(acquisition.owner), acquisition.acquisitionRole)]
        : [],
    ),
  );
  return replacedSources.size === 0
    ? occurrence
    : withoutStaleDerivedItems(biome, occurrence, occurrence, { replacedSources });
}

/**
 * Discards what one acquisition entry observed, as a replaced item: its payload
 * with its outcomes becomes unobserved and the items derived from it go, with
 * the pickup rows that take it unless `keepPickup` (a row placed for the item
 * it takes now).
 */
export function withoutAcquisitionEntryObservation(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  siteKey: string,
  entryKey: string,
  keepPickup: boolean,
): RoomOccurrence {
  const derived = withoutItemsDerivedFromEntry(biome, occurrence, siteKey, entryKey);
  const without = keepPickup ? derived : withoutItems(derived, [{ siteKey, entryKey }]);
  const site = without.acquisitionSites?.[siteKey];
  return Object.freeze({
    ...without,
    acquisitionSites: Object.freeze({
      ...without.acquisitionSites,
      [siteKey]: Object.freeze({
        ...site,
        pickupEntries: Object.freeze({ ...site?.pickupEntries, [entryKey]: null }),
      }),
    }),
  });
}

/**
 * Applies {@link withoutStaleDerivedItems} to every occurrence an edit
 * changed, judging each against its state before the edit.
 */
export function reconcileDerivedItems(
  previous: ProjectDocument,
  document: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  const route = document.route;
  const previousRoute = previous.route.routeKey === route.routeKey ? previous.route : undefined;
  let changed = false;
  const biomes = route.biomes.map((plan) => {
    if (plan.topology === null) return plan;
    const previousPlan = previousRoute?.biomes.find(
      (candidate) => candidate.biomeKey === plan.biomeKey,
    );
    const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
    const routePosition = () => resolveRoutePosition(catalog, route, plan.biomeKey);
    const previousPosition = () =>
      previousRoute === undefined || previousPlan === undefined
        ? undefined
        : resolveRoutePosition(catalog, previousRoute, plan.biomeKey);
    let occurrencesChanged = false;
    const occurrences = plan.topology.occurrences.map((occurrence) => {
      const before = previousPlan?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      );
      if (derivedItems(occurrence).length === 0) return occurrence;
      const startIncoming =
        routeStartIncomingReward(document, routePosition(), occurrence) ?? undefined;
      const beforePosition = before === undefined ? undefined : previousPosition();
      const previousStartIncoming =
        before === undefined || beforePosition === undefined
          ? undefined
          : (routeStartIncomingReward(previous, beforePosition, before) ?? undefined);
      if (before === occurrence && sameOptionalOffer(startIncoming, previousStartIncoming))
        return occurrence;
      const reconciled = withoutStaleDerivedItems(biome, before, occurrence, {
        previousStartIncoming,
        startIncoming,
      });
      if (reconciled !== occurrence) occurrencesChanged = true;
      return reconciled;
    });
    if (!occurrencesChanged) return plan;
    changed = true;
    return Object.freeze({
      ...plan,
      topology: Object.freeze({ ...plan.topology, occurrences: Object.freeze(occurrences) }),
    });
  });
  if (!changed) return document;
  return Object.freeze({
    ...document,
    route: Object.freeze({ ...route, biomes: Object.freeze(biomes) }),
  });
}
