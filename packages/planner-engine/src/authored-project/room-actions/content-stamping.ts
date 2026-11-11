import type { Catalog } from '../../catalog-schema';
import type { AuthoredBiomePlan, ProjectDocument, RoomOccurrence } from '../model';
import { roomActionDomainForOccurrence } from './defaults';
import {
  biomePlanContentSource,
  roomActionCarriesContent,
  roomActionItemContent,
  withRoomActionContent,
  type RoomActionContentSource,
} from './item-content';
import { roomActionKey } from './key';

/**
 * The occurrence with every row that recorded no content stamped with its
 * item's, once that item is observed; the same occurrence when none changes.
 */
export function withStampedRoomActionContent(
  source: RoomActionContentSource,
  occurrence: RoomOccurrence,
  activeKeys: () => ReadonlySet<string>,
): RoomOccurrence {
  let changed = false;
  const order = occurrence.roomActions.order.map((reference) => {
    if (!roomActionCarriesContent(reference) || reference.content !== undefined) return reference;
    const content = roomActionItemContent(source, occurrence, reference);
    // A stale row acts on no item of the room, so it records none.
    if (content === null || !activeKeys().has(roomActionKey(reference))) return reference;
    changed = true;
    return withRoomActionContent(reference, content);
  });
  return changed
    ? Object.freeze({
        ...occurrence,
        roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
      })
    : occurrence;
}

function stampedPlan(
  catalog: Catalog,
  document: ProjectDocument,
  plan: AuthoredBiomePlan,
): AuthoredBiomePlan {
  const source = biomePlanContentSource(catalog, document, plan);
  const topology = plan.topology;
  if (source === undefined || topology === null || topology === undefined) return plan;
  let changed = false;
  const occurrences = topology.occurrences.map((occurrence) => {
    let active: ReadonlySet<string> | undefined;
    const activeKeys = () =>
      (active ??= new Set(
        (
          roomActionDomainForOccurrence(document, catalog, source.biome, occurrence.occurrenceId)
            ?.domain.contributions ?? []
        ).flatMap((entry) => (entry.kind === 'action' ? [roomActionKey(entry.reference)] : [])),
      ));
    const stamped = withStampedRoomActionContent(source, occurrence, activeKeys);
    if (stamped !== occurrence) changed = true;
    return stamped;
  });
  return changed
    ? Object.freeze({
        ...plan,
        topology: Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) }),
      })
    : plan;
}

/**
 * The biomes whose items an edit from `before` to `after` may have changed:
 * every biome whose plan changed, and the route's first when its starting
 * reward changed.
 */
export function contentTouchedBiomeKeys(
  before: ProjectDocument,
  after: ProjectDocument,
): ReadonlySet<string> {
  const startingRewardChanged =
    before.route.loadout.startingReward !== after.route.loadout.startingReward;
  return new Set(
    after.route.biomes.flatMap((plan, index) =>
      before.route.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey) !== plan ||
      (index === 0 && startingRewardChanged)
        ? [plan.biomeKey]
        : [],
    ),
  );
}

/**
 * Stamps every row of these biomes that recorded no content and whose item is
 * observed; the same document when none changes.
 */
export function stampRoomActionContent(
  catalog: Catalog,
  document: ProjectDocument,
  biomeKeys: ReadonlySet<string>,
): ProjectDocument {
  if (biomeKeys.size === 0) return document;
  let changed = false;
  const biomes = document.route.biomes.map((plan) => {
    if (!biomeKeys.has(plan.biomeKey)) return plan;
    const stamped = stampedPlan(catalog, document, plan);
    if (stamped !== plan) changed = true;
    return stamped;
  });
  return changed
    ? Object.freeze({
        ...document,
        route: Object.freeze({ ...document.route, biomes: Object.freeze(biomes) }),
      })
    : document;
}
