import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../../authored-project/addresses';
import type { RoomActionReference } from '../../../authored-project/model';
import {
  hermesShrineDeliverySourceAddress,
  isSameRoomDelivery,
  parseHermesShrineDeliveryEntryKey,
} from '../../../authored-project/hermes-shrine-delivery';
import type {
  RoomEventGraph,
  RoomEventPoint,
} from '../../../authored-project/room-actions/event-graph';
import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { HistoryEvent } from '../../history';
import { timedPickupDueContact } from '../../room-actions';
import {
  endEffectsAdvanceDeliveries,
  roomTraitClocks,
} from '../biome/lifecycle-transitions/end-effect-clocks';
import { parseClockedTraitGeneratedPickupEntryKey } from '../../../authored-project/acquisition/pickup-producers';
import {
  hermesShrineDeliveryPickupSource,
  type GeneratedPickupPlacementAssessment,
  type GeneratedPickupSource,
} from '../../../authored-project/generated-pickup-placement';
import type { RewardBranchState } from '../branch-primitives';
import type { DerivedAcquisitionEntryFrontier, GeneratedPickupPlacement } from './contracts';

type PickupReference = Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>;

/** The host room's walk a delivery or clocked-drop row is judged against. */
export interface TimedPickupRoomWalk {
  readonly catalog: Catalog;
  readonly declaration: RoomDeclaration | undefined;
  readonly graph: RoomEventGraph;
  /** The room's history events, its later ones included. */
  readonly events: readonly HistoryEvent[];
}

/**
 * A placement, with the due spawn the row stands before when the walk makes it
 * due later in this room. Its deadline, the room's next gated interaction, the
 * walk checks there.
 */
export interface TimedPickupJudgment {
  readonly placement: GeneratedPickupPlacement;
  readonly beforeSpawn?: RoomEventPoint;
}

function placement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  source: GeneratedPickupSource,
  /** The reached state's status; none is reached when the state is absent. */
  status: 'valid' | 'invalid' | 'unassessed' | undefined,
  sequence: number,
  invalidReason: 'sourceInactive' | 'dueContactMismatch' = 'dueContactMismatch',
): GeneratedPickupPlacement {
  const kind = status ?? 'unassessed';
  const assessment: GeneratedPickupPlacementAssessment =
    kind === 'invalid' ? { kind, source, reason: invalidReason } : { kind, source };
  return Object.freeze({
    address: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(owner, reference.siteKey),
      reference.entryKey,
    ),
    assessment: Object.freeze(assessment),
    contact: Object.freeze({ owner, sequence }),
  });
}

/** The phase of the `count`th end effects the room applies after `sequence` and `counts`. */
function laterEndEffects(
  walk: TimedPickupRoomWalk,
  sequence: number,
  count: number,
  counts: (encounterKey: string | undefined) => boolean = () => true,
): string | undefined {
  const encounterKeys = new Map(
    walk.events.flatMap((event) =>
      event.kind === 'encounterStarted' ? [[event.phaseKey, event.encounterKey] as const] : [],
    ),
  );
  return walk.events.flatMap((event) =>
    event.kind === 'encounterEndEffectsApplied' &&
    event.sequence > sequence &&
    counts(encounterKeys.get(event.phaseKey))
      ? [event.phaseKey]
      : [],
  )[count - 1];
}

/** The judgment, with its due contact from the phase it falls due at. */
function judgment(
  timed: GeneratedPickupPlacement,
  walk: TimedPickupRoomWalk | undefined,
  duePhaseKey: string | undefined,
  laterPhaseKey: string | undefined,
): TimedPickupJudgment {
  const phaseKey = laterPhaseKey ?? duePhaseKey;
  return Object.freeze({
    placement:
      walk === undefined || phaseKey === undefined
        ? timed
        : Object.freeze({ ...timed, dueContact: timedPickupDueContact(walk.graph, phaseKey) }),
    ...(laterPhaseKey === undefined
      ? {}
      : { beforeSpawn: Object.freeze({ kind: 'endEffects' as const, phaseKey: laterPhaseKey }) }),
  });
}

/** The pending delivery is the lifecycle authority for this exact host; its walk times the row. */
export function assessReachedHermesDeliveryPlacement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  branch: RewardBranchState | undefined,
  sequence: number,
  walk: TimedPickupRoomWalk | undefined,
): TimedPickupJudgment {
  const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey)!;
  const source = hermesShrineDeliveryPickupSource(
    hermesShrineDeliverySourceAddress(parsed),
    parsed.generationKey,
  );
  const delivery = branch?.state.pendingHermesShrineDeliveries[reference.entryKey];
  const due = delivery?.due;
  const here = due !== undefined && isSameRoomDelivery(due.host, owner);
  // Still counting down, it falls due over the room's later end effects that advance it.
  const laterPhaseKey =
    delivery === undefined || due !== undefined || walk === undefined
      ? undefined
      : laterEndEffects(walk, sequence, delivery.remainingUses, (encounterKey) =>
          endEffectsAdvanceDeliveries(walk.catalog, walk.declaration, encounterKey),
        );
  return judgment(
    placement(
      owner,
      reference,
      source,
      branch === undefined ? undefined : here || laterPhaseKey !== undefined ? 'valid' : 'invalid',
      sequence,
    ),
    due?.cause === 'rush' ? undefined : walk,
    here ? due.encounterPhaseKey : undefined,
    laterPhaseKey,
  );
}

/** The state's matured progress proves contact; absent capability alone proves nothing. */
export function assessReachedClockedPickupPlacement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  branch: RewardBranchState | undefined,
  frontier: DerivedAcquisitionEntryFrontier | undefined,
  sequence: number,
  walk: TimedPickupRoomWalk | undefined,
): TimedPickupJudgment {
  const parsed = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey)!;
  const maturity =
    branch === undefined
      ? undefined
      : branch.state.traitHistory.events
          .filter(
            (event) =>
              event.kind === 'pickupProducerProgress' &&
              event.acquisitionIdentity === parsed.acquisitionIdentity &&
              event.matured &&
              semanticAddressKey(event.owner) === semanticAddressKey(owner),
          )
          .at(-1);
  const reached =
    maturity !== undefined &&
    frontier?.kind === 'clockedTraitPickup' &&
    frontier.historySequence === maturity.sequence &&
    frontier.beforeEntry?.state.traitHistory.events.includes(maturity) === true;
  const held =
    branch === undefined
      ? undefined
      : Object.values(branch.state.traitHistory.equippedTraits).find(
          (trait) =>
            trait.acquisitionIdentity === parsed.acquisitionIdentity &&
            trait.pickupProducerInterval !== undefined,
        );
  // A held clock not yet matured here matures over the room's later end effects.
  const clocks = walk === undefined ? undefined : roomTraitClocks(walk.declaration, owner.routeKey);
  const laterPhaseKey =
    maturity !== undefined ||
    held?.pickupProducerInterval === undefined ||
    walk === undefined ||
    clocks?.advance !== true ||
    clocks.deferMaturity
      ? undefined
      : laterEndEffects(
          walk,
          sequence,
          Math.max(1, held.pickupProducerInterval - (held.pickupProducerProgress ?? 0)),
        );
  return judgment(
    placement(
      owner,
      reference,
      { kind: 'clockedTraitPickup', acquisitionIdentity: parsed.acquisitionIdentity },
      branch === undefined
        ? undefined
        : laterPhaseKey !== undefined || (maturity !== undefined && reached)
          ? 'valid'
          : maturity === undefined
            ? 'invalid'
            : 'unassessed',
      sequence,
      // A producer no longer held drops nothing anywhere; a held one matures elsewhere.
      // A swap or replacement equips its trait under its own acquisition identity.
      branch !== undefined && maturity === undefined && held === undefined
        ? 'sourceInactive'
        : 'dueContactMismatch',
    ),
    walk,
    reached ? frontier.encounterPhaseKey : undefined,
    laterPhaseKey,
  );
}
