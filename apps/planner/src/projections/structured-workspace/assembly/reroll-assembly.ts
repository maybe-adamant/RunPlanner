import {
  biomeRerolledOwners,
  createOccurrenceAddress,
  createRoomActionAddress,
  roomActionKey,
  rerollTargetOwner,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type OccurrenceId,
  rerollSurfaceKey,
  type RerolledRewardOwner,
  type RerollRoomAction,
  type RerollSurface,
  type RerollTarget,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { RerollSurfaceSettlement } from '@run-planner/engine/simulation';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';

import type { WorkspaceRewardWheelDescriptor } from '../contracts/locals';
import type { WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
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
  'biome' | 'findingsFor' | 'plan' | 'rerollPressAllowance' | 'rerollSurface'
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
): WorkspaceRerolledRewardFacts | undefined {
  const ownerKey = semanticAddressKey(owner);
  const target = settled?.targets.find(
    (candidate) => semanticAddressKey(candidate.owner) === ownerKey,
  );
  const mismatch = source
    .findingsFor(owner)
    .some((finding) => finding.code === 'rerolledRewardMismatch');
  const rerolled =
    target === undefined || sameOffer(target.assigned, target.current) ? undefined : target.current;
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

/**
 * One surface's ordered presses with a press appended at the end. The list
 * appears where a held card enables rerolls or the room already holds presses;
 * a press is repaired here, on `tab`, unless it must move on its Timeline row.
 */
function assembleRerollList(input: {
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly presses: readonly { readonly reference: RerollRoomAction }[];
  readonly settled: RerollSurfaceSettlement | undefined;
  readonly source: WorkspaceRerollSource;
  readonly surface: RerollSurface;
  readonly tab: WorkspaceRoomTab;
  readonly targetLabel: (target: RerollTarget) => string;
  readonly targetNoun: WorkspaceRoomRerolls['targetNoun'];
  readonly rewardTypes: (owner: RerolledRewardOwner) => WorkspaceRerollRewardTypes;
}):
  | { readonly rerolls: WorkspaceRoomRerolls; readonly requirement: RerollListRequirement }
  | undefined {
  const { occurrence, settled, source, surface } = input;
  if (settled?.enabled !== true && input.presses.length === 0) return undefined;
  const biome = source.biome;
  const owner = createOccurrenceAddress(biome, occurrence.occurrenceId);
  const ownerOf = (target: RerollTarget) =>
    rerollTargetOwner(biome, occurrence.occurrenceId, target);
  const interactionKey = `rerolls:${rerollSurfaceKey(surface)}`;
  const nodeKey = `occurrence:${semanticAddressKey(owner)}`;
  const rows = input.presses.map(({ reference }) => {
    const key = roomActionKey(reference);
    const address = createRoomActionAddress(biome, occurrence.occurrenceId, key);
    const marker = input.markerDestinations.marker(address);
    input.markerDestinations.redirect([marker], nodeKey);
    if (!rerollMovedOnTimeline(source, address))
      input.markerDestinations.setRoomTab([marker], input.tab);
    return Object.freeze({
      address,
      key,
      marker,
      reward: reference.reward,
      rewardTypes: input.rewardTypes(ownerOf(reference.target)),
      targetLabel: input.targetLabel(reference.target),
    });
  });
  const targets: WorkspaceRerollTargetRequirement[] = (settled?.targets ?? []).flatMap(
    (candidate) => {
      const target = candidate.target;
      if (target.kind === 'hubSlot') return [];
      return [
        Object.freeze({
          key: semanticAddressKey(candidate.owner),
          label: input.targetLabel(target),
          rewardOwner: candidate.owner,
          rewardTypes: input.rewardTypes(candidate.owner),
          target,
          ...(candidate.unavailable === undefined ? {} : { unavailable: candidate.unavailable }),
        }),
      ];
    },
  );
  const allowance = source.rerollPressAllowance(surface);
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

const noRewardTypes: WorkspaceRerollRewardTypes = Object.freeze({ kind: 'none' });

function countedRewardTypes(control: WorkspaceRewardControl): WorkspaceRerollRewardTypes {
  return control.kind === 'countedReward'
    ? Object.freeze({ kind: 'counted', owner: control.owner, binding: control.binding })
    : noRewardTypes;
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
  const rewardTypesByOwner = new Map<string, WorkspaceRerollRewardTypes>();
  const targets = input.targets.map((target) => {
    let changed = false;
    const rewards = target.door.offerRewardSurface.rewards.map((reward): WorkspaceDoorReward => {
      const control = reward.control;
      if (control === undefined) return reward;
      rewardTypesByOwner.set(
        semanticAddressKey(control.owner.address),
        countedRewardTypes(control),
      );
      const owner = control.owner.address;
      if (owner.kind !== 'incomingReward' && owner.kind !== 'localReward') return reward;
      const facts = rerolledRewardFacts(catalog, source, settled, owner);
      if (facts === undefined) return reward;
      changed = true;
      return Object.freeze({ ...reward, ...facts });
    });
    return changed
      ? Object.freeze({
          ...target,
          door: Object.freeze({
            ...target.door,
            offerRewardSurface: Object.freeze({
              ...target.door.offerRewardSurface,
              rewards: Object.freeze(rewards),
            }),
          }),
        })
      : target;
  });
  const list =
    occurrence === undefined || surface === undefined
      ? undefined
      : assembleRerollList({
          markerDestinations: input.markerDestinations,
          occurrence,
          presses: occurrence.roomActions.order.flatMap((reference) =>
            reference.kind === 'reroll' && reference.target.kind !== 'wheelOffer'
              ? [{ reference }]
              : [],
          ),
          settled,
          source,
          surface,
          tab: 'doors',
          targetLabel: (target) =>
            target.kind === 'wheelOffer'
              ? target.offerKey
              : workspaceDoorRerollTargetLabel(
                  { biome, catalog, layout: source.layout, plan: source.plan },
                  occurrence.occurrenceId,
                  target,
                ),
          targetNoun: 'door',
          rewardTypes: (owner) =>
            rewardTypesByOwner.get(semanticAddressKey(owner)) ?? noRewardTypes,
        });
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
  const list = assembleRerollList({
    markerDestinations: input.markerDestinations,
    occurrence: input.occurrence,
    presses: input.occurrence.roomActions.order.flatMap((reference) =>
      reference.kind === 'reroll' &&
      reference.target.kind === 'wheelOffer' &&
      reference.target.wheelKey === wheel.key
        ? [{ reference }]
        : [],
    ),
    settled,
    source,
    surface,
    tab: input.tab,
    targetLabel: (target) =>
      target.kind === 'wheelOffer'
        ? (wheel.offers.find((offer) => offer.key === target.offerKey)?.label ?? target.offerKey)
        : target.exitKey,
    targetNoun: 'offer',
    rewardTypes: (owner) => {
      const offer = offerByOwner.get(semanticAddressKey(owner));
      return offer === undefined ? noRewardTypes : countedRewardTypes(offer.control);
    },
  });
  return Object.freeze({
    wheel: Object.freeze({ ...wheel, offers: Object.freeze(offers) }),
    ...(list === undefined ? {} : list),
  });
}
