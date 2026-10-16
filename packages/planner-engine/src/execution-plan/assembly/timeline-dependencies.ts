import {
  createBiomeAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions/state';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { RoomActionRow } from '../../simulation/room-actions';
import { traitOfferRoomOccurrence } from '../../simulation/state/pending-trait-offers';
import type {
  PlannerTimelineDependency,
  PlannerTimelineFacts,
} from '../../simulation/timeline-facts';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { ExecutionTimelineTransaction } from '../model';

/** Actions that change trait outcomes without a screen and publish a transaction. */
const transactedTraitFenceKinds: ReadonlySet<RoomActionReference['kind']> = new Set([
  'useFountain',
  'interactKeepsakeRack',
]);

/** Actions that change trait outcomes natively without a transaction; their order is unenforced. */
const untransactedTraitFenceKinds: ReadonlySet<RoomActionReference['kind']> = new Set([
  'sellPurgingPoolTrait',
  'interactEris',
  'purchaseHermesShrineOffer',
]);

/** The Travel Deal refill purchase, addressed by its action key before any row ranks it. */
const TRAVEL_DEAL_REFILL_WELL_PURCHASE = roomActionKey({
  kind: 'purchaseStygianWellOffer',
  generationKey: 'travelDealRefill',
});

/** How one dependency endpoint reaches the published timeline. */
type TimelineDependencyEndpoint =
  /** A transaction of this room. */
  | 'transaction'
  /** A trait fence the game performs without a transaction. */
  | 'untransactedFence'
  /** A room action of this room with no transaction: the game performs or skips it natively. */
  | 'nativeAction'
  /** An owner outside this room, ordered by route order. */
  | 'otherRoom';

/** Owners outside every authored room: the Hub board, the route start and a biome's start. */
type EndpointPlace = { readonly occurrenceId: string } | 'hub' | 'routeStart' | 'biomeStart';

/** The room an endpoint belongs to, or undefined when its address names none. */
function endpointPlace(owner: SemanticAddress): EndpointPlace | undefined {
  switch (owner.kind) {
    case 'hubDecision':
    case 'hubSlot':
    case 'hubOpenSet':
    case 'hubRoom':
    case 'hubVisit':
    case 'hubFountain':
      return 'hub';
    case 'localVisitDecision':
    case 'localVisitSlot':
    case 'localVisitOrder':
      return { occurrenceId: owner.sourceOccurrenceId };
    case 'keepsakeSelection':
      return owner.owner === 'routeStart' ? 'routeStart' : owner.owner;
    case 'keepsakeEquipResult':
      return endpointPlace(owner.selection);
    case 'echoKeepsakeReplay':
      return 'biomeStart';
    case 'fountainRarityOutcome':
      return endpointPlace(owner.action);
    case 'acquisitionEntry':
    case 'acquisitionSite': {
      const site = owner.kind === 'acquisitionEntry' ? owner.site : owner;
      return site.owner.kind === 'occurrence' ? site.owner : endpointPlace(site.owner);
    }
    default: {
      const occurrence = traitOfferRoomOccurrence(owner);
      return occurrence === undefined ? undefined : occurrence;
    }
  }
}

function roomRowsByOwner(room: CanonicalAuthoredRoom): ReadonlyMap<string, RoomActionRow> {
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  const rows = new Map<string, RoomActionRow>();
  for (const row of room.roomActionRoster.rows)
    for (const owner of [row.owner, createRoomActionAddress(biome, room.occurrenceId, row.key)]) {
      const key = semanticAddressKey(owner);
      const current = rows.get(key);
      if (current === undefined || (current.stale && !row.stale)) rows.set(key, row);
    }
  return rows;
}

/** Classifies one endpoint; any other owner of this room is a defect. */
export function classifyTimelineDependencyEndpoint(
  room: CanonicalAuthoredRoom,
  owner: SemanticAddress,
  transactionOwners: ReadonlySet<string>,
  entryOccurrenceId: string,
  rows: ReadonlyMap<string, RoomActionRow> = roomRowsByOwner(room),
): TimelineDependencyEndpoint {
  const key = semanticAddressKey(owner);
  if (transactionOwners.has(key)) return 'transaction';
  const row = rows.get(key);
  if (row !== undefined)
    return untransactedTraitFenceKinds.has(row.reference.kind)
      ? 'untransactedFence'
      : 'nativeAction';
  const place = endpointPlace(owner);
  const occurrenceId =
    place === 'biomeStart'
      ? entryOccurrenceId
      : typeof place === 'object'
        ? place.occurrenceId
        : undefined;
  if (place === 'hub' || place === 'routeStart') return 'otherRoom';
  if (occurrenceId !== undefined && occurrenceId !== room.occurrenceId) return 'otherRoom';
  if (
    occurrenceId === room.occurrenceId &&
    owner.kind === 'roomAction' &&
    owner.actionKey === TRAVEL_DEAL_REFILL_WELL_PURCHASE
  )
    return 'nativeAction';
  throw new CompilerError(
    'executionCoverageMissing',
    `${room.gameName} dependency on ${key} has no transaction`,
  );
}

function isTraitScreen(transaction: ExecutionTimelineTransaction): boolean {
  switch (transaction.kind) {
    case 'acquisition':
      return transaction.roles.some(
        (role) => role.traitOffer !== undefined || role.levelResolution !== undefined,
      );
    case 'encounterInteraction':
      return transaction.resolution?.kind === 'traitOffer';
    default:
      return false;
  }
}

/**
 * Whether the game already orders a screen after its prior mutation. A reward spawns before
 * its encounter's end effects, which re-roll spawned loot, so it opens only after them.
 */
function nativelyOrdered(
  dependency: PlannerTimelineDependency,
  rows: ReadonlyMap<string, RoomActionRow>,
): boolean {
  const { owner, afterOwner } = dependency;
  if (
    afterOwner.kind === 'steadyGrowthOutcome' ||
    afterOwner.kind === 'transcendentEmbryoOutcome'
  ) {
    const window = rows.get(semanticAddressKey(owner))?.window;
    return window?.kind === 'standard' && window.phase === 'afterCombat';
  }
  // Devotion's spurned boon resolves after the trial that the chosen pick starts.
  return (
    owner.kind === 'acquisitionRole' &&
    afterOwner.kind === 'acquisitionRole' &&
    owner.acquisitionRole === 'spurnedSource' &&
    afterOwner.acquisitionRole === 'chosenSource' &&
    semanticAddressKey(owner.owner) === semanticAddressKey(afterOwner.owner)
  );
}

/**
 * Each transacted trait fence after the latest trait screen ranked before it,
 * and the earliest trait screen ranked after it after the fence.
 */
export function traitFenceDependencies(
  room: CanonicalAuthoredRoom,
  transactions: readonly ExecutionTimelineTransaction[],
): readonly PlannerTimelineDependency[] {
  const byOwner = new Map(transactions.map((transaction) => [transaction.owner, transaction]));
  const ranked = room.roomActionRoster.rows
    .filter((row) => !row.stale && row.rank !== null && byOwner.has(semanticAddressKey(row.owner)))
    .sort((left, right) => left.rank! - right.rank!);
  const screens = ranked.filter((row) =>
    isTraitScreen(byOwner.get(semanticAddressKey(row.owner))!),
  );
  return Object.freeze(
    ranked
      .filter((row) => transactedTraitFenceKinds.has(row.reference.kind))
      .flatMap((fence) => {
        const before = screens.filter((screen) => screen.rank! < fence.rank!).at(-1);
        const after = screens.find((screen) => screen.rank! > fence.rank!);
        return [
          ...(before === undefined
            ? []
            : [Object.freeze({ owner: fence.owner, afterOwner: before.owner })]),
          ...(after === undefined
            ? []
            : [Object.freeze({ owner: after.owner, afterOwner: fence.owner })]),
        ];
      }),
  );
}

/**
 * The room's published dependencies: each planner edge between its transactions
 * the game does not already order, then each trait fence edge not already implied.
 */
export function roomTimelineDependencies(
  room: CanonicalAuthoredRoom,
  facts: PlannerTimelineFacts,
  transactions: readonly ExecutionTimelineTransaction[],
  entryOccurrenceId: string,
): readonly PlannerTimelineDependency[] {
  const transactionOwners = new Set(transactions.map((transaction) => transaction.owner));
  const rows = roomRowsByOwner(room);
  const published = new Map<string, PlannerTimelineDependency>();
  const after = new Map<string, Set<string>>();
  const add = (dependency: PlannerTimelineDependency) => {
    const owner = semanticAddressKey(dependency.owner);
    const afterOwner = semanticAddressKey(dependency.afterOwner);
    published.set(`${owner}\u0000${afterOwner}`, dependency);
    after.set(owner, (after.get(owner) ?? new Set()).add(afterOwner));
  };
  for (const dependency of facts.dependencies) {
    const endpoints = [dependency.owner, dependency.afterOwner].map((owner) =>
      classifyTimelineDependencyEndpoint(room, owner, transactionOwners, entryOccurrenceId, rows),
    );
    if (
      endpoints.every((endpoint) => endpoint === 'transaction') &&
      !nativelyOrdered(dependency, rows)
    )
      add(dependency);
  }
  const reaches = (owner: string, target: string): boolean => {
    const seen = new Set<string>();
    const pending = [owner];
    while (pending.length > 0) {
      const next = pending.pop()!;
      if (next === target) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...(after.get(next) ?? []));
    }
    return false;
  };
  for (const dependency of traitFenceDependencies(room, transactions))
    if (!reaches(semanticAddressKey(dependency.owner), semanticAddressKey(dependency.afterOwner)))
      add(dependency);
  return Object.freeze([...published.values()]);
}
