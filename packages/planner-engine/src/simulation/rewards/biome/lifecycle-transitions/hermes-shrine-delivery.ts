import { assessReachedHermesDeliveryPlacement } from '../../acquisition/generated-pickup-placement';
import type { Catalog } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import {
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
  isSameRoomDelivery,
} from '../../../../authored-project/hermes-shrine-delivery';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { timedPickupDueContact } from '../../../room-actions';
import { ownerRegion } from '../../../finding-regions';
import type {
  GeneratedPickupPlacement,
  DerivedAcquisitionEntryFrontier,
} from '../../acquisition/contracts';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import type { LifecycleFinding } from './types';

/** Shared publication for a matured Shrine delivery at its exact host contact. */
export function dueHermesShrineDeliveryFrontier(
  catalog: Catalog,
  room: CanonicalAuthoredRoom | undefined,
  deliveryHost: Extract<SemanticAddress, { readonly kind: 'occurrence' }>,
  branch: RewardBranchState | undefined,
  sequence: number,
  encounterPhaseKey: string | undefined,
): {
  readonly findings: readonly LifecycleFinding[];
  readonly frontiers: readonly DerivedAcquisitionEntryFrontier[];
  readonly generatedPickupPlacements: readonly GeneratedPickupPlacement[];
} {
  const findings: LifecycleFinding[] = [];
  const frontiers: DerivedAcquisitionEntryFrontier[] = [];
  const placements = new Map<string, GeneratedPickupPlacement>();
  const site = createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery');
  if (branch === undefined)
    return Object.freeze({
      findings: Object.freeze([]),
      frontiers: Object.freeze([]),
      generatedPickupPlacements: Object.freeze([]),
    });
  for (const delivery of Object.values(branch.state.pendingHermesShrineDeliveries)) {
    // Only what fell due at this host arrives here; a placed row is timed by the walk.
    if (delivery.due === undefined || !isSameRoomDelivery(delivery.due.host, deliveryHost))
      continue;
    const entryKey = hermesShrineDeliveryEntryKey(delivery.source, delivery.generationKey);
    const retained =
      room?.kind === 'authored'
        ? room.acquisitionSites?.hermesShrineDelivery?.entries[entryKey]
        : undefined;
    const retainedReference = room?.roomActionRoster?.rows.find(
      (row) =>
        row.rank !== null &&
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'hermesShrineDelivery' &&
        row.reference.entryKey === entryKey,
    )?.reference;
    if (retainedReference?.kind === 'interactAcquisitionEntry')
      placements.set(
        entryKey,
        assessReachedHermesDeliveryPlacement(
          deliveryHost,
          retainedReference,
          branch,
          sequence,
          // It falls due at this contact, so the walk's later events take no part.
          room === undefined
            ? undefined
            : {
                catalog,
                declaration: catalog.rooms.byKey[room.gameName],
                graph: room.roomActionRoster.eventGraph,
                events: [],
              },
        ).placement,
      );
    const fixedReward = defaultHermesShrineDeliveryReward(
      catalog,
      delivery.rewardType,
      site.routeKey,
    );
    const hasExactDeliveryAction =
      room?.kind === 'authored' &&
      room.roomActionRoster?.rows.some(
        (row) =>
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.siteKey === 'hermesShrineDelivery' &&
          row.reference.entryKey === entryKey,
      );
    if (retained === undefined || !hasExactDeliveryAction) {
      findings.push(
        Object.freeze({
          finding: rewardFinding(
            'hermesShrineDeliveryPlacementRequired',
            createAcquisitionEntryAddress(site, entryKey),
            {
              sourceKey: delivery.entryKey,
              ...(encounterPhaseKey === undefined ? {} : { encounterPhaseKey }),
            },
          ),
          region: ownerRegion(createAcquisitionEntryAddress(site, entryKey)),
          chronology: Object.freeze({
            kind: 'history' as const,
            sequence,
            boundary: 'at' as const,
          }),
        }),
      );
    }
    frontiers.push(
      Object.freeze({
        address: createAcquisitionEntryAddress(site, entryKey),
        kind: 'hermesShrineDelivery',
        rewardTypes: Object.freeze([delivery.rewardType]),
        ...(encounterPhaseKey === undefined ? {} : { encounterPhaseKey }),
        ...(room?.roomActionRoster === undefined
          ? {}
          : {
              dueContact: timedPickupDueContact(
                room.roomActionRoster.eventGraph,
                encounterPhaseKey,
              ),
            }),
        ...(fixedReward === null ? {} : { fixedReward }),
        retainedSourceMismatch:
          retained !== undefined &&
          retained !== null &&
          retained.offer.rewardType !== delivery.rewardType,
        beforeEntry: branch,
      }),
    );
  }
  return Object.freeze({
    findings: Object.freeze(findings),
    frontiers: Object.freeze(frontiers),
    generatedPickupPlacements: Object.freeze([...placements.values()]),
  });
}
