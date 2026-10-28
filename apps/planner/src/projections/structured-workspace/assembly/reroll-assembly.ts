import {
  biomeRerolledOwners,
  createHubRerollAddress,
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
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';

import type { WorkspaceRewardWheelDescriptor } from '../contracts/locals';
import type { WorkspaceMarker, WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceDoorContract,
  WorkspaceDoorReward,
  WorkspacePhysicalTarget,
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
import { normalExitOrdinal } from './ordering';
import { workspaceDeclaredPhysicalExits } from './topology-presentation';

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

function sameOffer(left: ResolvedRewardOffer, right: ResolvedRewardOffer): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** What one surface's list reads from the biome: the engine's surface, pool and findings. */
export type WorkspaceRerollSource = Pick<
  WorkspaceBiomeSource,
  'biome' | 'findingsFor' | 'plan' | 'rerollSpendAllowance' | 'rerollSurface'
>;

/** A rerolled owner's final draw beside its first, and the repair of a kept mismatch. */
export interface WorkspaceRerolledRewardFacts {
  readonly rerolledOffer?: ResolvedRewardOffer;
  readonly rerolledSummary?: string;
  readonly rerolledRewardRepair?: NonNullable<WorkspaceDoorReward['rerolledRewardRepair']>;
}

function rerolledRewardFacts(
  catalog: Catalog,
  source: WorkspaceRerollSource,
  settled: RerollSurfaceSettlement | undefined,
  owner: RerolledRewardOwner,
  firstDraw: RerollSurfaceSettlement | undefined = settled,
): WorkspaceRerolledRewardFacts | undefined {
  const ownerKey = semanticAddressKey(owner);
  const ownerTarget = (surface: RerollSurfaceSettlement | undefined) =>
    surface?.targets.find((candidate) => semanticAddressKey(candidate.owner) === ownerKey);
  const target = ownerTarget(settled);
  const first = ownerTarget(firstDraw)?.assigned ?? target?.assigned;
  const mismatch = source
    .findingsFor(owner)
    .some((finding) => finding.code === 'rerolledRewardMismatch');
  const rerolled =
    target === undefined || first === undefined || sameOffer(first, target.current)
      ? undefined
      : target.current;
  if (rerolled === undefined && !mismatch) return undefined;
  const rerolledOwners =
    source.plan.topology === null
      ? new Map()
      : biomeRerolledOwners(source.biome, source.plan.topology);
  return Object.freeze({
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
      surface.kind === 'hubStay' && candidate.unavailable === 'slotEntered'
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
          ? settled.poolRemaining <= 0
            ? ('poolEmpty' as const)
            : ('poolReserved' as const)
          : undefined;
  return Object.freeze({
    rerolls: Object.freeze({
      owner,
      interactionKey,
      targetNoun: input.targetNoun,
      ...(settled === undefined ? {} : { poolRemaining: settled.poolRemaining }),
      rows: Object.freeze(
        rows.map(({ address, key, marker, reward, targetLabel }) =>
          Object.freeze({ address, key, marker, reward, targetLabel }),
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
  readonly tab: WorkspaceRoomTab;
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
    if (!rerollMovedOnTimeline(input.source, address))
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

/**
 * A door with each rerolled reward's final draw on one settled surface, and
 * its repair; `firstDraw` is the surface that first assigned it, where a Hub
 * stay later restores what an earlier stay's rerolls left.
 */
export function workspaceRerolledDoor(
  catalog: Catalog,
  source: WorkspaceRerollSource,
  settled: RerollSurfaceSettlement | undefined,
  door: WorkspaceDoorContract,
  firstDraw: RerollSurfaceSettlement | undefined = settled,
): WorkspaceDoorContract {
  let changed = false;
  const rewards = door.offerRewardSurface.rewards.map((reward): WorkspaceDoorReward => {
    const owner = reward.control?.owner.address;
    if (owner === undefined || (owner.kind !== 'incomingReward' && owner.kind !== 'localReward'))
      return reward;
    const facts = rerolledRewardFacts(catalog, source, settled, owner, firstDraw);
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
        ? target.offerKey
        : target.exitKey;
  const rows: WorkspacePreparedRerollRow[] = [];
  let visits = 0;
  for (const action of hub.actions) {
    if (action.kind === 'roomVisit') visits += 1;
    if (action.kind !== 'reroll' || visits !== input.precedingVisitCount) continue;
    const address = createHubRerollAddress(biome, hub.hubKey, action.rerollId);
    const marker = input.markerDestinations.marker(address);
    input.markerDestinations.redirect([marker], input.nodeKey);
    input.markerDestinations.setHubTab([marker], 'timeline');
    const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === action.hubSlotKey);
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
    const door = workspaceRerolledDoor(catalog, source, settled, target.door);
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
                ? target.offerKey
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
              tab: 'doors',
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
  return Object.freeze({
    ...(list === undefined ? {} : list),
    targets: Object.freeze(targets),
  });
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
        ? rerolledRewardFacts(catalog, source, settled, owner)
        : undefined;
    return facts === undefined ? offer : Object.freeze({ ...offer, ...facts });
  });
  const offerByOwner = new Map(
    wheel.offers.map((offer) => [semanticAddressKey(offer.control.owner.address), offer] as const),
  );
  const targetLabel = (target: RerollPressTarget) =>
    target.kind === 'wheelOffer'
      ? (wheel.offers.find((offer) => offer.key === target.offerKey)?.label ?? target.offerKey)
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
  return Object.freeze({
    wheel: Object.freeze({ ...wheel, offers: Object.freeze(offers) }),
    ...(list === undefined ? {} : list),
  });
}
