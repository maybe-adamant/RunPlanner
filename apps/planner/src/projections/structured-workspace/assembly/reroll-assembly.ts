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
  type RerollSurface,
  type RerollTarget,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';

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

export interface WorkspaceRoomRerollsAssembly {
  readonly rerolls?: WorkspaceRoomRerolls;
  readonly requirement?: Extract<
    WorkspaceOccurrenceInteractionRequirement,
    { readonly kind: 'roomRerolls' }
  >;
  /** The batch's doors with each rerolled reward's final draw and repair. */
  readonly targets: readonly WorkspacePhysicalTarget[];
}

/**
 * A room's door and cage rerolls beside its doors. The surface, its pool and
 * each target's refusal are the engine's; the list appears where a held card
 * enables rerolls or the room already holds presses.
 */
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
  const rerolledOwners =
    source.plan.topology === null ? new Map() : biomeRerolledOwners(biome, source.plan.topology);
  const occurrence = input.sourceOccurrence;
  const surfaceAddress: RerollSurface | undefined =
    occurrence === undefined
      ? undefined
      : { kind: 'doors', occurrence: createOccurrenceAddress(biome, occurrence.occurrenceId) };
  const surface = surfaceAddress === undefined ? undefined : source.rerollSurface(surfaceAddress);
  const settledByOwner = new Map(
    (surface?.targets ?? []).map((target) => [semanticAddressKey(target.owner), target] as const),
  );
  const rewardTypesByOwner = new Map<string, WorkspaceRerollRewardTypes>();
  const targets = input.targets.map((target) => {
    let changed = false;
    const rewards = target.door.offerRewardSurface.rewards.map((reward): WorkspaceDoorReward => {
      const control = reward.control;
      if (control === undefined) return reward;
      const ownerKey = semanticAddressKey(control.owner.address);
      if (control.kind === 'countedReward')
        rewardTypesByOwner.set(
          ownerKey,
          Object.freeze({ kind: 'counted', owner: control.owner, binding: control.binding }),
        );
      const settled = settledByOwner.get(ownerKey);
      const mismatch = source
        .findingsFor(control.owner.address)
        .some((finding) => finding.code === 'rerolledRewardMismatch');
      const rerolled =
        settled === undefined || sameOffer(settled.assigned, settled.current)
          ? undefined
          : settled.current;
      if (rerolled === undefined && !mismatch) return reward;
      if (
        control.owner.address.kind !== 'incomingReward' &&
        control.owner.address.kind !== 'localReward'
      )
        return reward;
      changed = true;
      return Object.freeze({
        ...reward,
        ...(rerolled === undefined
          ? {}
          : {
              rerolledOffer: rerolled,
              rerolledSummary: summarizeRewardOffer(catalog, rerolled),
            }),
        ...(mismatch
          ? {
              rerolledRewardRepair: Object.freeze({
                owner: control.owner.address,
                repair: rerolledOwners.has(ownerKey) ? ('adopt' as const) : ('drop' as const),
              }),
            }
          : {}),
      });
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
  if (occurrence === undefined || surfaceAddress === undefined)
    return Object.freeze({ targets: Object.freeze(targets) });
  const presses = occurrence.roomActions.order.flatMap((reference) =>
    reference.kind === 'reroll' && reference.target.kind !== 'wheelOffer'
      ? [{ reference, target: reference.target }]
      : [],
  );
  if (surface?.enabled !== true && presses.length === 0)
    return Object.freeze({ targets: Object.freeze(targets) });
  const owner = surfaceAddress.occurrence;
  const labelInput = { biome, catalog, layout: source.layout, plan: source.plan };
  const label = (target: DoorRerollTarget) =>
    workspaceDoorRerollTargetLabel(labelInput, occurrence.occurrenceId, target);
  const typesFor = (target: RerollTarget): WorkspaceRerollRewardTypes =>
    rewardTypesByOwner.get(
      semanticAddressKey(rerollTargetOwner(biome, occurrence.occurrenceId, target)),
    ) ?? Object.freeze({ kind: 'none' });
  const interactionKey = `rerolls:${semanticAddressKey(owner)}`;
  const nodeKey = `occurrence:${semanticAddressKey(owner)}`;
  const rows = presses.map(({ reference, target }) => {
    const key = roomActionKey(reference);
    const address = createRoomActionAddress(biome, occurrence.occurrenceId, key);
    const marker = input.markerDestinations.marker(address);
    // A press is repaired in this list, on its room's Doors tab, unless it must move.
    input.markerDestinations.redirect([marker], nodeKey);
    if (!rerollMovedOnTimeline(source, address))
      input.markerDestinations.setRoomTab([marker], 'doors');
    return Object.freeze({
      address,
      key,
      marker,
      reward: reference.reward,
      rewardTypes: typesFor(target),
      targetLabel: label(target),
    });
  });
  const requirementTargets: WorkspaceRerollTargetRequirement[] = (surface?.targets ?? []).flatMap(
    (settled) => {
      const target = settled.target;
      if (target.kind !== 'door' && target.kind !== 'cage') return [];
      return [
        Object.freeze({
          key: semanticAddressKey(settled.owner),
          label: label(target),
          rewardOwner: settled.owner,
          rewardTypes: typesFor(target),
          target,
          ...(settled.unavailable === undefined ? {} : { unavailable: settled.unavailable }),
        }),
      ];
    },
  );
  const allowance = source.rerollPressAllowance(surfaceAddress);
  const appendLocked =
    surface === undefined || allowance.kind === 'unreached'
      ? ('unreached' as const)
      : !surface.enabled
        ? ('notEnabled' as const)
        : !allowance.allowed
          ? ('poolEmpty' as const)
          : undefined;
  const rerolls: WorkspaceRoomRerolls = Object.freeze({
    owner,
    interactionKey,
    ...(surface === undefined ? {} : { poolRemaining: surface.poolRemaining }),
    rows: Object.freeze(
      rows.map(({ address, key, marker, reward, targetLabel }) =>
        Object.freeze({ address, key, marker, reward, targetLabel }),
      ),
    ),
    ...(appendLocked === undefined ? {} : { appendLocked }),
  });
  return Object.freeze({
    rerolls,
    requirement: Object.freeze({
      kind: 'roomRerolls' as const,
      owner,
      interactionKey,
      surface: surfaceAddress,
      targets: Object.freeze(requirementTargets),
      rows: Object.freeze(
        rows.map(({ address, key, reward, rewardTypes }) =>
          Object.freeze({ address, key, reward, rewardTypes }),
        ),
      ),
    }),
    targets: Object.freeze(targets),
  });
}
