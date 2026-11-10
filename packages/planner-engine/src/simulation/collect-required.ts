import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../authored-project/addresses';
import { ProjectCommandContractError } from '../authored-project/commands/contract';
import type { ProjectCommand } from '../authored-project/commands/types';
import type { ProjectDocument } from '../authored-project/model';
import { roomActionKey } from '../authored-project/room-actions/key';
import {
  settleProjectEdit,
  type ProjectEditSettlement,
  type RemovedStaleRoomActions,
  type SettlementFault,
} from './edit-settlement';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import {
  liveActionsForProjectEvaluationAssembly,
  type LiveAction,
  type RoomLiveActions,
} from './evaluation/live-actions';
import { roomWalk } from './evaluation/spawned-loot';

type LivePlacement = Extract<LiveAction, { readonly kind: 'place' }>;

/** Placements one collection may settle before it reports non-convergence. */
const PLACEMENT_LIMIT = 256;

/**
 * Where a collection ended: the walk passes the room, stops in it on
 * something no required placement repairs (a missing choice, an invalid
 * value), or does not reach it.
 */
export type CollectRequiredStop = 'complete' | 'blocked' | 'unreached';

export interface CollectedRequiredItems extends ProjectEditSettlement {
  /** The placements settled, in order; empty when nothing required was live. */
  readonly commands: readonly ProjectCommand[];
  readonly stop: CollectRequiredStop;
}

export interface CollectRequiredOptions {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly occurrence: OccurrenceAddress;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}

/** The index a placement takes; the Pedestal's collect has none and appends. */
function placementIndex(command: ProjectCommand, frontier: number): number {
  return 'index' in command && typeof command.index === 'number' ? command.index : frontier;
}

/** A required placement offered at the frontier, with what orders it among the others. */
interface RequiredPlacement {
  readonly placement: LivePlacement;
  /** The action index it takes. */
  readonly index: number;
  /** Whether it collects loot lying on the ground rather than acting on an object. */
  readonly pickup: boolean;
}

/**
 * Which of two required placements goes first: the earlier index; then a
 * pickup before an action on an object, since playing forward takes what lies
 * on the ground before starting the next interaction (a cage's reward before
 * the next cage, a delivery the wheels opening spawned before the next wheel's
 * choice); then, for determinism, its row's kind and key.
 */
function comesFirst(left: RequiredPlacement, right: RequiredPlacement): boolean {
  if (left.index !== right.index) return left.index < right.index;
  if (left.pickup !== right.pickup) return left.pickup;
  const leftKind = left.placement.reference.kind;
  const rightKind = right.placement.reference.kind;
  if (leftKind !== rightKind) return leftKind < rightKind;
  return roomActionKey(left.placement.reference) < roomActionKey(right.placement.reference);
}

/**
 * The next required item to collect at the walk's frontier, by the command the
 * live product offers for it: its canonical restore where offered through the
 * frontier and not before an item this collection already took, otherwise its
 * placement at the frontier. Collection plays forward, so a Fields cage's
 * reward is collected before the next cage is cleared, and nothing is placed
 * while the walk stands before a row it took (that row blocks on its own
 * contact, such as an unauthored trait offer). Placements are ordered
 * as `comesFirst` says. A caged pickup waits for its unlock, and a placement
 * that still needs a Travel Deal item's value is left to its owner.
 */
export function nextRequiredPlacement(
  live: RoomLiveActions,
  collected: ReadonlySet<string>,
): LivePlacement | undefined {
  const canonical = new Map<string, LivePlacement>();
  // Past the last row this collection placed.
  let floor = 0;
  for (const gap of live.gaps)
    for (const item of gap.items)
      for (const action of item.actions) {
        const key = roomActionKey(action.reference);
        if (action.kind === 'place' && action.canonical === true) canonical.set(key, action);
        else if (action.kind === 'placed' && collected.has(key))
          floor = Math.max(floor, gap.index + 1);
      }
  // The walk stopped at or before a row this collection placed: nothing is collected behind it.
  if (live.frontier < floor) return undefined;
  let next: RequiredPlacement | undefined;
  for (const item of live.gaps[live.frontier]?.items ?? []) {
    const actions: readonly LiveAction[] =
      item.kind === 'pickup'
        ? item.participation === 'required' && item.lockedUntil === undefined
          ? item.actions
          : []
        : item.actions.filter((action) => action.participation === 'required');
    for (const action of actions) {
      if (action.kind !== 'place' || action.needsChoice === 'travelDealItem') continue;
      const restore = canonical.get(roomActionKey(action.reference));
      const placement =
        restore !== undefined && placementIndex(restore.command, live.frontier) >= floor
          ? restore
          : action;
      const candidate: RequiredPlacement = {
        placement,
        index: placementIndex(placement.command, live.frontier),
        pickup: item.kind === 'pickup',
      };
      if (next === undefined || comesFirst(candidate, next)) next = candidate;
    }
  }
  return next?.placement;
}

/**
 * Collects every required item live in one room, as playing forward and taking
 * each would: a required pickup, contact, cage completion, Hermes delivery or
 * Gold Gold Gold duplicate, each placed by the command the live product offers
 * for it and settled as an edit. Placing one can let the walk pass a boundary
 * and reveal more, so the room is read again after each, until nothing
 * required is live at the frontier. Optional items are never placed. The
 * result is one edit: the final assembly, the placements in order and where
 * the room stands. Like edit settlement it is total: a settlement fault stops
 * it, and an offered placement that is refused, changes nothing or comes back
 * again is reported as a fault beside the last settled assembly.
 *
 * Known limits: `complete` can be reported while a caged required pickup
 * still waits on an unplaced optional unlock, which is never placed here; and
 * an unplaced contact (the Gorgon, Nemesis, an encounter's NPC) still blocks
 * the walk at once, unlike a cage or wheel choice, so rows of its window
 * ranked after it are not reached until it is placed.
 */
export function collectRequiredItems(options: CollectRequiredOptions): CollectedRequiredItems {
  const { catalog, occurrence, evaluate } = options;
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  let assembly = options.before;
  const commands: ProjectCommand[] = [];
  const removed: RemovedStaleRoomActions[] = [];
  const placed = new Set<string>();
  const result = (stop: CollectRequiredStop, fault?: SettlementFault): CollectedRequiredItems =>
    Object.freeze({
      assembly,
      commands: Object.freeze(commands),
      stop,
      ...(fault === undefined ? {} : { fault }),
      ...(removed.length === 0 ? {} : { removedStaleActions: Object.freeze(removed) }),
    });
  const collectFault = (key: string): SettlementFault => {
    const owner = createRoomActionAddress(biome, occurrence.occurrenceId, key);
    return Object.freeze({ key: `collectRequired:${semanticAddressKey(owner)}`, owner });
  };

  for (;;) {
    const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, occurrence);
    if (live === undefined) return result('unreached');
    const placement = nextRequiredPlacement(live, placed);
    if (placement === undefined)
      return result(roomWalk(assembly, occurrence).stop === undefined ? 'complete' : 'blocked');
    const key = roomActionKey(placement.reference);
    // An item placed once is collected; offered again, the placement did not hold.
    if (placed.has(key) || placed.size >= PLACEMENT_LIMIT)
      return result('blocked', collectFault(key));
    placed.add(key);
    let settled: ProjectEditSettlement;
    try {
      settled = settleProjectEdit({
        catalog,
        before: assembly,
        command: placement.command,
        evaluate,
      });
    } catch (error) {
      if (error instanceof ProjectCommandContractError) return result('blocked', collectFault(key));
      throw error;
    }
    if (settled.assembly.project === assembly.project) return result('blocked', collectFault(key));
    assembly = settled.assembly;
    commands.push(placement.command);
    if (settled.removedStaleActions !== undefined) removed.push(...settled.removedStaleActions);
    if (settled.fault !== undefined) return result('blocked', settled.fault);
  }
}
