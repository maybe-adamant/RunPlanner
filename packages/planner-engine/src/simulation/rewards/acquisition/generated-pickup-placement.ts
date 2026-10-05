import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../../authored-project/addresses';
import type { RoomActionReference } from '../../../authored-project/model';
import { parseHermesShrineDeliveryEntryKey } from '../../../authored-project/hermes-shrine-delivery';
import { parseClockedTraitGeneratedPickupEntryKey } from '../../../authored-project/acquisition/pickup-producers';
import type {
  GeneratedPickupPlacementAssessment,
  GeneratedPickupSource,
} from '../../../authored-project/generated-pickup-placement';
import type { RewardBranchState } from '../branch-primitives';
import type { DerivedAcquisitionEntryFrontier, GeneratedPickupPlacement } from './contracts';

type PickupReference = Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>;
function placement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  source: GeneratedPickupSource,
  statuses: readonly ('valid' | 'invalid' | 'unassessed')[],
  sequence: number,
): GeneratedPickupPlacement {
  const kind =
    statuses.length === 0
      ? 'unassessed'
      : statuses.every((status) => status === 'valid')
        ? 'valid'
        : statuses.every((status) => status === 'invalid')
          ? 'invalid'
          : 'unassessed';
  const assessment: GeneratedPickupPlacementAssessment =
    kind === 'invalid' ? { kind, source, reason: 'dueContactMismatch' } : { kind, source };
  return Object.freeze({
    address: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(owner, reference.siteKey),
      reference.entryKey,
    ),
    assessment: Object.freeze(assessment),
    contact: Object.freeze({ owner, sequence }),
  });
}

/** The pending delivery is the lifecycle authority for this exact host and phase. */
export function assessReachedHermesDeliveryPlacement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  branches: readonly RewardBranchState[],
  sequence: number,
): GeneratedPickupPlacement {
  const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey)!;
  const source = createOccurrenceAddress(
    createBiomeAddress(parsed.routeKey, parsed.biomeKey),
    parsed.sourceOccurrenceId,
  );
  return placement(
    owner,
    reference,
    source,
    branches.map((branch) => {
      const due = branch.state.pendingHermesShrineDeliveries[reference.entryKey];
      return due?.due !== undefined &&
        semanticAddressKey(due.due.host) === semanticAddressKey(owner) &&
        due.due.encounterPhaseKey === reference.encounterPhaseKey
        ? 'valid'
        : 'invalid';
    }),
    sequence,
  );
}

/** Branch-local matured progress proves contact; absent capability alone proves nothing. */
export function assessReachedClockedPickupPlacement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  branches: readonly RewardBranchState[],
  frontiers: readonly DerivedAcquisitionEntryFrontier[],
  sequence: number,
): GeneratedPickupPlacement {
  const parsed = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey)!;
  return placement(
    owner,
    reference,
    { kind: 'clockedTraitPickup', acquisitionIdentity: parsed.acquisitionIdentity },
    branches.map((branch) => {
      const maturities = branch.state.traitHistory.events.filter(
        (event) =>
          event.kind === 'pickupProducerProgress' &&
          event.acquisitionIdentity === parsed.acquisitionIdentity &&
          event.matured &&
          semanticAddressKey(event.owner) === semanticAddressKey(owner),
      );
      const maturity = maturities.at(-1);
      if (maturity === undefined) return 'invalid';
      const contactFrontiers = frontiers.filter(
        (frontier) =>
          frontier.kind === 'clockedTraitPickup' && frontier.historySequence === maturity.sequence,
      );
      const branchFrontiers = contactFrontiers.filter((frontier) =>
        frontier.branchesBeforeEntry.some((before) =>
          before.state.traitHistory.events.includes(maturity),
        ),
      );
      if (branchFrontiers.length === 0) return 'unassessed';
      return branchFrontiers.some(
        (frontier) => frontier.encounterPhaseKey === reference.encounterPhaseKey,
      )
        ? 'valid'
        : 'invalid';
    }),
    sequence,
  );
}
