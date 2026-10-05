import { assessReachedHermesDeliveryPlacement } from '../../acquisition/generated-pickup-placement';
import type { Catalog } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import {
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
} from '../../../../authored-project/hermes-shrine-delivery';
import type { CanonicalAuthoredRoom } from '../../../materialization';
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
  branches: readonly RewardBranchState[],
  sequence: number,
  encounterPhaseKey: string | undefined,
): {
  readonly findings: readonly LifecycleFinding[];
  readonly frontiers: readonly DerivedAcquisitionEntryFrontier[];
  readonly placementRequired: boolean;
  readonly generatedPickupPlacements: readonly GeneratedPickupPlacement[];
} {
  const findings: LifecycleFinding[] = [];
  const frontiers: DerivedAcquisitionEntryFrontier[] = [];
  let placementRequired = false;
  const placements = new Map<string, GeneratedPickupPlacement>();
  const site = createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery');
  for (const branch of branches) {
    for (const delivery of Object.values(branch.state.pendingHermesShrineDeliveries)) {
      if (
        delivery.due === undefined ||
        semanticAddressKey(delivery.due.host) !== semanticAddressKey(deliveryHost)
      )
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
          assessReachedHermesDeliveryPlacement(deliveryHost, retainedReference, branches, sequence),
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
            row.reference.entryKey === entryKey &&
            row.reference.encounterPhaseKey === encounterPhaseKey,
        );
      if (retained === undefined || !hasExactDeliveryAction) {
        placementRequired = true;
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
          branchCohortSize: branches.length,
          rewardTypes: Object.freeze([delivery.rewardType]),
          ...(encounterPhaseKey === undefined ? {} : { encounterPhaseKey }),
          ...(fixedReward === null ? {} : { fixedReward }),
          retainedSourceMismatch:
            retained !== undefined &&
            retained !== null &&
            retained.offer.rewardType !== delivery.rewardType,
          branchesBeforeEntry: Object.freeze([branch]),
        }),
      );
    }
  }
  return Object.freeze({
    findings: Object.freeze(findings),
    frontiers: Object.freeze(frontiers),
    placementRequired,
    generatedPickupPlacements: Object.freeze([...placements.values()]),
  });
}
