import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../../authored-project/addresses';
import type { RoomActionReference } from '../../../authored-project/model';
import {
  dueContactMatches,
  hermesShrineDeliverySourceAddress,
  parseHermesShrineDeliveryEntryKey,
} from '../../../authored-project/hermes-shrine-delivery';
import { parseClockedTraitGeneratedPickupEntryKey } from '../../../authored-project/acquisition/pickup-producers';
import {
  hermesShrineDeliveryPickupSource,
  type GeneratedPickupPlacementAssessment,
  type GeneratedPickupSource,
} from '../../../authored-project/generated-pickup-placement';
import type { RewardBranchState } from '../branch-primitives';
import type { DerivedAcquisitionEntryFrontier, GeneratedPickupPlacement } from './contracts';

type PickupReference = Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>;
function placement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  source: GeneratedPickupSource,
  /** The reached state's status; none is reached when the state is absent. */
  status: 'valid' | 'invalid' | 'unassessed' | undefined,
  sequence: number,
): GeneratedPickupPlacement {
  const kind = status ?? 'unassessed';
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
  branch: RewardBranchState | undefined,
  sequence: number,
): GeneratedPickupPlacement {
  const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey)!;
  const source = hermesShrineDeliveryPickupSource(
    hermesShrineDeliverySourceAddress(parsed),
    parsed.generationKey,
  );
  return placement(
    owner,
    reference,
    source,
    branch === undefined
      ? undefined
      : (() => {
          const delivery = branch.state.pendingHermesShrineDeliveries[reference.entryKey];
          return delivery !== undefined && dueContactMatches(delivery, owner, reference)
            ? 'valid'
            : 'invalid';
        })(),
    sequence,
  );
}

/** The state's matured progress proves contact; absent capability alone proves nothing. */
export function assessReachedClockedPickupPlacement(
  owner: OccurrenceAddress,
  reference: PickupReference,
  branch: RewardBranchState | undefined,
  frontier: DerivedAcquisitionEntryFrontier | undefined,
  sequence: number,
): GeneratedPickupPlacement {
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
    frontier.branchesBeforeEntry.some((before) =>
      before.state.traitHistory.events.includes(maturity),
    );
  return placement(
    owner,
    reference,
    { kind: 'clockedTraitPickup', acquisitionIdentity: parsed.acquisitionIdentity },
    branch === undefined
      ? undefined
      : maturity === undefined
        ? 'invalid'
        : !reached
          ? 'unassessed'
          : frontier.encounterPhaseKey === reference.encounterPhaseKey
            ? 'valid'
            : 'invalid',
    sequence,
  );
}
