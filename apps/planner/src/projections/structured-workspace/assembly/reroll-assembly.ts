import {
  biomeRerolledOwners,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  roomActionKey,
  rerollTargetOwner,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type HubDecision,
  type HubDecisionAddress,
  type HubRerollAddress,
  type HubStayRow,
  type OccurrenceAddress,
  type OccurrenceId,
  rerollSurfaceKey,
  type RerolledRewardOwner,
  type RerollPressTarget,
  type RerollRoomAction,
  type RerollSurface,
  type RerollTarget,
  type RoomActionAddress,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { RerollSurfaceSettlement } from '@run-planner/engine/simulation';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import { sameRewardOffer, type ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';

import type { WorkspaceRewardWheelDescriptor } from '../contracts/locals';
import type { WorkspaceMarker, WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceDoorContract,
  WorkspaceDoorReward,
  WorkspacePhysicalTarget,
  WorkspaceRerollRow,
  WorkspaceRoomRerolls,
} from '../contracts/structure';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRerollRewardTypes,
  WorkspaceRerollTargetRequirement,
} from '../interactions/interaction-requirements';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import type { WorkspaceBiomeSource } from '../source-index';
import { requireWorkspaceRoom } from './catalog-room';
import { sharedRoomIconNumber } from '../presentation/room-icon';
import { normalExitOrdinal } from './ordering';
import { workspaceDeclaredPhysicalExits } from './topology-presentation';
import { rewardWheelOfferLabel } from '@planner/projections/rewards/wheelOfferLabel';

type DoorRerollTarget = Exclude<RerollTarget, { readonly kind: 'wheelOffer' }>;

/** A door reroll target as the room's doors name it: its door, and its cage in Fields. */
export function workspaceDoorRerollTargetLabel(
  input: {
    readonly biome: BiomeAddress;
    readonly catalog: Catalog;
    readonly layout: BiomeLayout;
    readonly plan: AuthoredBiomePlan;
  },
  sourceOccurrenceId: OccurrenceId,
  target: DoorRerollTarget,
): string {
  const index =
    workspaceDeclaredPhysicalExits(input.catalog, input.layout, input.plan, {
      kind: 'occurrence',
      occurrenceId: sourceOccurrenceId,
    }).find((exit) => exit.exitKey === target.exitKey)?.index ?? normalExitOrdinal(target.exitKey);
  const door = index === undefined ? 'Door' : `Door ${index}`;
  if (target.kind === 'door') return door;
  const owner = rerollTargetOwner(input.biome, sourceOccurrenceId, target);
  const destination = input.plan.topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === target.occurrenceId,
  );
  const group =
    destination === undefined || owner.kind !== 'localReward'
      ? undefined
      : requireWorkspaceRoom(input.catalog, destination.gameName).localChildren.find(
          (child) => child.key === owner.groupKey,
        );
  const slot = group?.kind === 'boundedRewardSlots' ? group.slotKeys.indexOf(target.slotKey) : -1;
  return slot < 0 ? `${door} Cage` : `${door} Cage ${slot + 1}`;
}

/** A misplaced press is repaired by its Timeline row's Move, which the Rerolls list lacks. */
export function rerollMovedOnTimeline(
  input: {
    readonly findingsFor?: (
      owner: import('@run-planner/engine/authored-project').SemanticAddress,
    ) => readonly { readonly code: string }[];
  },
  address: import('@run-planner/engine/authored-project').RoomActionAddress,
): boolean {
  return (input.findingsFor?.(address) ?? []).some(
    (finding) => finding.code === 'roomActionOrderUnavailable',
  );
}

/** What one surface's list reads from the biome: the engine's surface, pool and findings. */
export type WorkspaceRerollSource = Pick<
  WorkspaceBiomeSource,
  'biome' | 'findingsFor' | 'plan' | 'rerollSpendAllowance' | 'rerollSurface'
>;

/** A rerolled owner's final draw beside its first, and the repair of a kept mismatch. */
export interface WorkspaceRerolledRewardFacts {
  /** A held card enables rerolls here: the final-draw line keeps its place while empty. */
  readonly rerollLineReserved?: true;
  readonly rerolledOffer?: ResolvedRewardOffer;
  readonly rerolledSummary?: string;
  readonly rerolledRewardRepair?: NonNullable<WorkspaceDoorReward['rerolledRewardRepair']>;
}

/** What a settled surface says of one rerolled owner. */
export interface WorkspaceRerolledRewardView {
  /** Whether a held card enabled rerolls where the owner was assigned. */
  readonly enabled: boolean;
  /** Its final draw, where the presses left it a different reward. */
  readonly rerolled?: ResolvedRewardOffer;
}

function surfaceRerolledView(
  settled: RerollSurfaceSettlement | undefined,
  owner: RerolledRewardOwner,
): WorkspaceRerolledRewardView | undefined {
  if (settled === undefined) return undefined;
  const ownerKey = semanticAddressKey(owner);
  const target = settled.targets.find(
    (candidate) => semanticAddressKey(candidate.owner) === ownerKey,
  );
  return Object.freeze({
    enabled: settled.enabled,
    ...(target === undefined || sameRewardOffer(target.assigned, target.current)
      ? {}
      : { rerolled: target.current }),
  });
}

function rerolledRewardFacts(
  catalog: Catalog,
  source: WorkspaceRerollSource,
  owner: RerolledRewardOwner,
  view: WorkspaceRerolledRewardView | undefined,
): WorkspaceRerolledRewardFacts | undefined {
  const ownerKey = semanticAddressKey(owner);
  const mismatch = source
    .findingsFor(owner)
    .some((finding) => finding.code === 'rerolledRewardMismatch');
  const rerolled = view?.rerolled;
  const reserved = view?.enabled === true ? { rerollLineReserved: true as const } : {};
  if (rerolled === undefined && !mismatch)
    return view?.enabled === true ? Object.freeze(reserved) : undefined;
  const rerolledOwners =
    source.plan.topology === null
      ? new Map()
      : biomeRerolledOwners(source.biome, source.plan.topology);
  return Object.freeze({
    ...reserved,
    ...(rerolled === undefined
      ? {}
      : { rerolledOffer: rerolled, rerolledSummary: summarizeRewardOffer(catalog, rerolled) }),
    ...(mismatch
      ? {
          rerolledRewardRepair: Object.freeze({
            owner,
            repair: rerolledOwners.has(ownerKey) ? ('adopt' as const) : ('drop' as const),
          }),
        }
      : {}),
  });
}

type RerollListRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomRerolls' }
>;

/** One authored press as its list shows it, its marker already routed to the list. */
interface WorkspacePreparedRerollRow {
  readonly address: RoomActionAddress | HubRerollAddress;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly reward: ResolvedRewardOffer;
  readonly rewardTypes: WorkspaceRerollRewardTypes;
  readonly targetLabel: string;
  readonly targetRoom?: WorkspaceRerollRow['targetRoom'];
}

/**
 * One surface's ordered presses with a press appended at the end. The list
 * appears where a held card enables rerolls or the surface already holds
 * presses.
 */
function assembleRerollList(input: {
  readonly owner: OccurrenceAddress | HubDecisionAddress;
  readonly rows: readonly WorkspacePreparedRerollRow[];
  readonly settled: RerollSurfaceSettlement | undefined;
  readonly source: WorkspaceRerollSource;
  readonly surface: RerollSurface;
  readonly targetLabel: (target: RerollPressTarget) => string;
  readonly targetNoun: WorkspaceRoomRerolls['targetNoun'];
  readonly rewardTypes: (owner: RerolledRewardOwner) => WorkspaceRerollRewardTypes;
}):
  | { readonly rerolls: WorkspaceRoomRerolls; readonly requirement: RerollListRequirement }
  | undefined {
  const { owner, rows, settled, source, surface } = input;
  if (settled?.enabled !== true && rows.length === 0) return undefined;
  const interactionKey = `rerolls:${rerollSurfaceKey(surface)}`;
  const targets: WorkspaceRerollTargetRequirement[] = (settled?.targets ?? []).flatMap(
    (candidate) =>
      // An entered Hub door is closed for the run.
      candidate.unavailable === 'slotEntered'
        ? []
        : [
            Object.freeze({
              key: semanticAddressKey(candidate.owner),
              label: input.targetLabel(candidate.target),
              rewardOwner: candidate.owner,
              rewardTypes: input.rewardTypes(candidate.owner),
              target: candidate.target,
              ...(candidate.unavailable === undefined
                ? {}
                : { unavailable: candidate.unavailable }),
            }),
          ],
  );
  const allowance = source.rerollSpendAllowance({ kind: 'press', surface });
  const appendLocked =
    settled === undefined || allowance.kind === 'unreached'
      ? ('unreached' as const)
      : !settled.enabled
        ? ('notEnabled' as const)
        : !allowance.allowed
          ? ('poolEmpty' as const)
          : undefined;
  return Object.freeze({
    rerolls: Object.freeze({
      owner,
      interactionKey,
      targetNoun: input.targetNoun,
      ...(settled === undefined ? {} : { poolRemaining: settled.poolRemaining }),
      ...(allowance.kind === 'reached' ? { pressCost: allowance.cost } : {}),
      rows: Object.freeze(
        rows.map(({ address, key, marker, reward, targetLabel, targetRoom }) =>
          Object.freeze({
            address,
            key,
            marker,
            reward,
            targetLabel,
            ...(targetRoom === undefined ? {} : { targetRoom }),
          }),
        ),
      ),
      ...(appendLocked === undefined ? {} : { appendLocked }),
    }),
    requirement: Object.freeze({
      kind: 'roomRerolls' as const,
      owner,
      interactionKey,
      surface,
      targets: Object.freeze(targets),
      rows: Object.freeze(
        rows.map(({ address, key, reward, rewardTypes }) =>
          Object.freeze({ address, key, reward, rewardTypes }),
        ),
      ),
    }),
  });
}

/** A room's presses on one surface, repaired in its list on `tab` unless they must move on its Timeline. */
function roomRerollRows(input: {
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly presses: readonly RerollRoomAction[];
  readonly source: WorkspaceRerollSource;
  /** The list's tab; absent where the presses are the room Timeline's own rows. */
  readonly tab?: WorkspaceRoomTab;
  readonly targetLabel: (target: RerollTarget) => string;
  readonly rewardTypes: (owner: RerolledRewardOwner) => WorkspaceRerollRewardTypes;
}): readonly WorkspacePreparedRerollRow[] {
  const biome = input.source.biome;
  const { occurrence } = input;
  const nodeKey = `occurrence:${semanticAddressKey(createOccurrenceAddress(biome, occurrence.occurrenceId))}`;
  return input.presses.map((reference) => {
    const key = roomActionKey(reference);
    const address = createRoomActionAddress(biome, occurrence.occurrenceId, key);
    const marker = input.markerDestinations.marker(address);
    input.markerDestinations.redirect([marker], nodeKey);
    if (input.tab !== undefined && !rerollMovedOnTimeline(input.source, address))
      input.markerDestinations.setRoomTab([marker], input.tab);
    return Object.freeze({
      address,
      key,
      marker,
      reward: reference.reward,
      rewardTypes: input.rewardTypes(
        rerollTargetOwner(biome, occurrence.occurrenceId, reference.target),
      ),
      targetLabel: input.targetLabel(reference.target),
    });
  });
}

const noRewardTypes: WorkspaceRerollRewardTypes = Object.freeze({ kind: 'none' });

function countedRewardTypes(control: WorkspaceRewardControl): WorkspaceRerollRewardTypes {
  return control.kind === 'countedReward'
    ? Object.freeze({ kind: 'counted', owner: control.owner, binding: control.binding })
    : noRewardTypes;
}

/** Each door reward's counted binding, by its reward owner. */
function doorRewardTypes(
  doors: readonly WorkspaceDoorContract[],
): ReadonlyMap<string, WorkspaceRerollRewardTypes> {
  const types = new Map<string, WorkspaceRerollRewardTypes>();
  for (const door of doors)
    for (const reward of door.offerRewardSurface.rewards)
      if (reward.control !== undefined)
        types.set(
          semanticAddressKey(reward.control.owner.address),
          countedRewardTypes(reward.control),
        );
  return types;
}

/** A door with each rerolled reward's final draw as `viewOf` reads it, and its repair. */
export function workspaceRerolledDoor(
  catalog: Catalog,
  source: WorkspaceRerollSource,
  viewOf: (owner: RerolledRewardOwner) => WorkspaceRerolledRewardView | undefined,
  door: WorkspaceDoorContract,
): WorkspaceDoorContract {
  let changed = false;
  const rewards = door.offerRewardSurface.rewards.map((reward): WorkspaceDoorReward => {
    const owner = reward.control?.owner.address;
    if (owner === undefined || (owner.kind !== 'incomingReward' && owner.kind !== 'localReward'))
      return reward;
    const facts = rerolledRewardFacts(catalog, source, owner, viewOf(owner));
    if (facts === undefined) return reward;
    changed = true;
    return Object.freeze({ ...reward, ...facts });
  });
  return changed
    ? Object.freeze({
        ...door,
        offerRewardSurface: Object.freeze({
          ...door.offerRewardSurface,
          rewards: Object.freeze(rewards),
        }),
      })
    : door;
}

/**
 * One Hub stay's board-door presses, edited in its gap of the Hub timeline;
 * the stay's presses are the Hub's rerolls between its visits.
 */
export function assembleHubStayRerolls(input: {
  readonly hub: HubDecision;
  /** The stay's rows in authored order; its presses are listed. */
  readonly stayRows: readonly HubStayRow[];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  /** The Hub node whose timeline holds the list. */
  readonly nodeKey: string;
  readonly owner: HubDecisionAddress;
  readonly precedingVisitCount: number;
  readonly settled: RerollSurfaceSettlement | undefined;
  /** The board's open doors by slot, with their labels. */
  readonly slots: ReadonlyMap<
    string,
    { readonly label: string; readonly door?: WorkspaceDoorContract }
  >;
  readonly source: WorkspaceRerollSource;
}): {
  readonly rerolls?: WorkspaceRoomRerolls;
  readonly requirement?: RerollListRequirement;
} {
  const { hub, owner, source } = input;
  const biome = source.biome;
  const rewardTypesByOwner = doorRewardTypes(
    [...input.slots.values()].flatMap((slot) => (slot.door === undefined ? [] : [slot.door])),
  );
  const rewardTypes = (rewardOwner: RerolledRewardOwner) =>
    rewardTypesByOwner.get(semanticAddressKey(rewardOwner)) ?? noRewardTypes;
  const targetLabel = (target: RerollPressTarget) =>
    target.kind === 'hubSlot'
      ? (input.slots.get(target.hubSlotKey)?.label ?? target.hubSlotKey)
      : target.kind === 'wheelOffer'
        ? rewardWheelOfferLabel(target.offerKey, 2)
        : target.exitKey;
  const rows: WorkspacePreparedRerollRow[] = [];
  for (const row of input.stayRows) {
    if (row.kind !== 'reroll') continue;
    const { action, address } = row;
    const marker = input.markerDestinations.marker(address);
    input.markerDestinations.redirect([marker], input.nodeKey);
    input.markerDestinations.setHubTab([marker], 'timeline');
    const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === action.hubSlotKey);
    const room = input.slots.get(action.hubSlotKey)?.door?.room;
    rows.push(
      Object.freeze({
        address,
        key: action.rerollId,
        marker,
        reward: action.reward,
        rewardTypes:
          target === undefined
            ? noRewardTypes
            : rewardTypes(createIncomingRewardAddress(biome, target.occurrenceId)),
        targetLabel: targetLabel({ kind: 'hubSlot', hubSlotKey: action.hubSlotKey }),
        ...(room === undefined
          ? {}
          : {
              targetRoom: Object.freeze({
                roomIcon: room.roomIcon,
                ...(sharedRoomIconNumber(room.roomIcon, room.label) === undefined
                  ? {}
                  : { roomNumber: sharedRoomIconNumber(room.roomIcon, room.label)! }),
              }),
            }),
      }),
    );
  }
  return (
    assembleRerollList({
      owner,
      rows,
      settled: input.settled,
      source,
      surface: { kind: 'hubStay', hub: owner, precedingVisitCount: input.precedingVisitCount },
      targetLabel,
      targetNoun: 'door',
      rewardTypes,
    }) ?? {}
  );
}

export interface WorkspaceRoomRerollsAssembly {
  readonly rerolls?: WorkspaceRoomRerolls;
  readonly requirement?: RerollListRequirement;
  /** The batch's doors with each rerolled reward's final draw and repair. */
  readonly targets: readonly WorkspacePhysicalTarget[];
}

/** A room's door and cage rerolls beside its doors. */
export function assembleRoomRerolls(input: {
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly source: WorkspaceBiomeSource;
  /** The room whose doors these are; absent for a Hub's doors. */
  readonly sourceOccurrence?: RoomOccurrence;
  readonly targets: readonly WorkspacePhysicalTarget[];
}): WorkspaceRoomRerollsAssembly {
  const { catalog, source } = input;
  const biome = source.biome;
  const occurrence = input.sourceOccurrence;
  const surface: RerollSurface | undefined =
    occurrence === undefined
      ? undefined
      : { kind: 'doors', occurrence: createOccurrenceAddress(biome, occurrence.occurrenceId) };
  const settled = surface === undefined ? undefined : source.rerollSurface(surface);
  const rewardTypesByOwner = doorRewardTypes(input.targets.map((target) => target.door));
  const targets = input.targets.map((target) => {
    const door = workspaceRerolledDoor(
      catalog,
      source,
      (owner) => surfaceRerolledView(settled, owner),
      target.door,
    );
    return door === target.door ? target : Object.freeze({ ...target, door });
  });
  const list =
    occurrence === undefined || surface === undefined
      ? undefined
      : (() => {
          const targetLabel = (target: RerollPressTarget) =>
            target.kind === 'door' || target.kind === 'cage'
              ? workspaceDoorRerollTargetLabel(
                  { biome, catalog, layout: source.layout, plan: source.plan },
                  occurrence.occurrenceId,
                  target,
                )
              : target.kind === 'wheelOffer'
                ? rewardWheelOfferLabel(target.offerKey, 2)
                : target.hubSlotKey;
          const rewardTypes = (owner: RerolledRewardOwner) =>
            rewardTypesByOwner.get(semanticAddressKey(owner)) ?? noRewardTypes;
          return assembleRerollList({
            owner: createOccurrenceAddress(biome, occurrence.occurrenceId),
            rows: roomRerollRows({
              markerDestinations: input.markerDestinations,
              occurrence,
              presses: occurrence.roomActions.order.flatMap((reference) =>
                reference.kind === 'reroll' && reference.target.kind !== 'wheelOffer'
                  ? [reference]
                  : [],
              ),
              source,
              targetLabel,
              rewardTypes,
            }),
            settled,
            source,
            surface,
            targetLabel,
            targetNoun: 'door',
            rewardTypes,
          });
        })();
  // A locked door stays locked until its press; a door reroll can follow only that press.
  const stillLocked = new Set(occurrence?.lockedExits ?? []);
  const lockedAt = new Map<string, readonly string[]>();
  for (const reference of occurrence?.roomActions.order ?? []) {
    if (reference.kind === 'unlockExit') stillLocked.delete(reference.exitKey);
    else if (reference.kind === 'reroll' && reference.target.kind !== 'wheelOffer')
      lockedAt.set(roomActionKey(reference), Object.freeze([...stillLocked]));
  }
  // Each press reads as its door (a cage is known by its reward), the reward it
  // replaces, and every door once it lands.
  const states = workspacePressSurfaceStates({
    entries: input.targets.map((target) => ({
      key: target.exitKey,
      visible: target.door.offerRewardSurface.visibility !== 'hidden',
      owners: target.door.offerRewardSurface.rewards.map((reward) => ({
        ownerKey: semanticAddressKey(reward.marker.address),
        first: reward.offer,
      })),
    })),
    presses:
      occurrence === undefined
        ? []
        : occurrence.roomActions.order.flatMap((reference) => {
            if (
              reference.kind !== 'reroll' ||
              (reference.target.kind !== 'door' && reference.target.kind !== 'cage')
            )
              return [];
            const target = reference.target;
            const index = input.targets.find(
              (candidate) => candidate.exitKey === target.exitKey,
            )?.index;
            return [
              {
                rowKey: roomActionKey(reference),
                ownerKey: semanticAddressKey(
                  rerollTargetOwner(biome, occurrence.occurrenceId, target),
                ),
                label: index === undefined ? 'Door' : `Door ${index}`,
                reward: reference.reward,
                locked: lockedAt.get(roomActionKey(reference)) ?? [],
              },
            ];
          }),
    settled: settledRewards(settled),
  });
  const withDoors = withPressStates(list, states);
  return Object.freeze({
    ...(withDoors === undefined ? {} : withDoors),
    targets: Object.freeze(targets),
  });
}

/** One door or wheel offer a press may change: each reward it shows, by owner. */
export interface WorkspacePressSurfaceEntry {
  /** The door's exit key or the offer's key. */
  readonly key: string;
  /** False where the game hides the entry's rewards. */
  readonly visible: boolean;
  readonly owners: readonly {
    readonly ownerKey: string;
    readonly first: ResolvedRewardOffer | null;
  }[];
}

/** One authored press on the surface, in action order. */
export interface WorkspaceSurfacePress {
  readonly rowKey: string;
  readonly ownerKey: string;
  readonly label: string;
  readonly reward: ResolvedRewardOffer;
  /** The entries still locked once the press lands, by key. */
  readonly locked?: readonly string[];
}

/**
 * Each press's view of its surface: the reward it replaces, and every entry
 * once it lands. The engine's settled reward of an owner stands for its last
 * press, so a press that did not settle changes nothing; earlier presses read
 * their authored rewards in order. Hidden rewards are never shown.
 */
export function workspacePressSurfaceStates(input: {
  readonly entries: readonly WorkspacePressSurfaceEntry[];
  readonly presses: readonly WorkspaceSurfacePress[];
  readonly settled: ReadonlyMap<string, ResolvedRewardOffer>;
}): ReadonlyMap<string, NonNullable<WorkspaceRerollRow['doors']>> {
  const current = new Map(
    input.entries.flatMap((entry) =>
      entry.owners.map((owner) => [owner.ownerKey, owner.first] as const),
    ),
  );
  const hidden = new Set(
    input.entries.flatMap((entry) =>
      entry.visible ? [] : entry.owners.map((owner) => owner.ownerKey),
    ),
  );
  const lastPress = new Map(input.presses.map((press, index) => [press.ownerKey, index] as const));
  return new Map(
    input.presses.map((press, index) => {
      const before = hidden.has(press.ownerKey) ? null : (current.get(press.ownerKey) ?? null);
      const settled =
        lastPress.get(press.ownerKey) === index ? input.settled.get(press.ownerKey) : undefined;
      current.set(press.ownerKey, settled ?? press.reward);
      return [
        press.rowKey,
        Object.freeze({
          doorLabel: press.label,
          before,
          after: Object.freeze(
            input.entries.map((entry) =>
              Object.freeze({
                exitKey: entry.key,
                ...(press.locked?.includes(entry.key) === true ? { locked: true as const } : {}),
                rewards: Object.freeze(
                  entry.visible
                    ? entry.owners.map((owner) => current.get(owner.ownerKey) ?? null)
                    : [],
                ),
              }),
            ),
          ),
        }),
      ] as const;
    }),
  );
}

/** A list whose rows carry their press's view of the surface. */
function withPressStates<T extends { readonly rerolls?: WorkspaceRoomRerolls }>(
  list: T | undefined,
  states: ReadonlyMap<string, NonNullable<WorkspaceRerollRow['doors']>>,
): T | undefined {
  if (list?.rerolls === undefined) return list;
  return {
    ...list,
    rerolls: Object.freeze({
      ...list.rerolls,
      rows: Object.freeze(
        list.rerolls.rows.map((row) => {
          const doors = states.get(row.key);
          return doors === undefined ? row : Object.freeze({ ...row, doors });
        }),
      ),
    }),
  };
}

/** The engine's settled reward of each owner on a reached surface. */
function settledRewards(
  settled: RerollSurfaceSettlement | undefined,
): ReadonlyMap<string, ResolvedRewardOffer> {
  return new Map(
    (settled?.targets ?? []).map(
      (target) => [semanticAddressKey(target.owner), target.current] as const,
    ),
  );
}

/** One ship wheel's offers with their final draws, and its offer rerolls before the pick. */
export function assembleWheelRerolls(input: {
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly source: WorkspaceRerollSource;
  readonly tab: WorkspaceRoomTab;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}): {
  readonly wheel: WorkspaceRewardWheelDescriptor;
  readonly rerolls?: WorkspaceRoomRerolls;
  readonly requirement?: RerollListRequirement;
} {
  const { catalog, source, wheel } = input;
  const surface: RerollSurface = { kind: 'rewardWheel', wheel: wheel.address };
  const settled = source.rerollSurface(surface);
  const offers = wheel.offers.map((offer) => {
    const owner = offer.control.owner.address;
    const facts =
      owner.kind === 'rewardWheelOffer'
        ? rerolledRewardFacts(catalog, source, owner, surfaceRerolledView(settled, owner))
        : undefined;
    return facts === undefined ? offer : Object.freeze({ ...offer, ...facts });
  });
  const offerByOwner = new Map(
    wheel.offers.map((offer) => [semanticAddressKey(offer.control.owner.address), offer] as const),
  );
  const targetLabel = (target: RerollPressTarget) =>
    target.kind === 'wheelOffer'
      ? (wheel.offers.find((offer) => offer.key === target.offerKey)?.label ??
        rewardWheelOfferLabel(target.offerKey, wheel.offerCount))
      : target.kind === 'hubSlot'
        ? target.hubSlotKey
        : target.exitKey;
  const rewardTypes = (owner: RerolledRewardOwner) => {
    const offer = offerByOwner.get(semanticAddressKey(owner));
    return offer === undefined ? noRewardTypes : countedRewardTypes(offer.control);
  };
  const list = assembleRerollList({
    owner: createOccurrenceAddress(source.biome, input.occurrence.occurrenceId),
    rows: roomRerollRows({
      markerDestinations: input.markerDestinations,
      occurrence: input.occurrence,
      presses: input.occurrence.roomActions.order.flatMap((reference) =>
        reference.kind === 'reroll' &&
        reference.target.kind === 'wheelOffer' &&
        reference.target.wheelKey === wheel.key
          ? [reference]
          : [],
      ),
      source,
      tab: input.tab,
      targetLabel,
      rewardTypes,
    }),
    settled,
    source,
    surface,
    targetLabel,
    targetNoun: 'offer',
    rewardTypes,
  });
  // Each press reads as its offer, the reward it replaces, and every offer once it lands.
  const states = workspacePressSurfaceStates({
    entries: wheel.offers
      .filter((offer) => offer.active)
      .map((offer) => ({
        key: offer.key,
        visible: true,
        owners: [
          {
            ownerKey: semanticAddressKey(offer.control.owner.address),
            first: offer.control.offer,
          },
        ],
      })),
    presses: input.occurrence.roomActions.order.flatMap((reference) =>
      reference.kind === 'reroll' &&
      reference.target.kind === 'wheelOffer' &&
      reference.target.wheelKey === wheel.key
        ? [
            {
              rowKey: roomActionKey(reference),
              ownerKey: semanticAddressKey(
                rerollTargetOwner(source.biome, input.occurrence.occurrenceId, reference.target),
              ),
              label: targetLabel(reference.target),
              reward: reference.reward,
            },
          ]
        : [],
    ),
    settled: settledRewards(settled),
  });
  const withOffers = withPressStates(list, states);
  return Object.freeze({
    wheel: Object.freeze({ ...wheel, offers: Object.freeze(offers) }),
    ...(withOffers === undefined ? {} : withOffers),
  });
}
