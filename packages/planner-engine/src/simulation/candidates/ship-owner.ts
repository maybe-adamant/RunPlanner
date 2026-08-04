import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import { requireShipCombatWheels } from '../../authored-project/room-state/declaration';
import { planFor } from './evaluated-biome';
import { CandidateEvaluationContractError } from './contract';

export function shipState(
  catalog: Catalog,
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
) {
  const plan = planFor(project, occurrence.routeKey, occurrence.biomeKey);
  const authored = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
  );
  if (authored?.state.kind !== 'shipCombat') {
    throw new CandidateEvaluationContractError('candidate owner has no Ship combat state');
  }
  const room = catalog.rooms.byKey[authored.gameName];
  if (room === undefined || room.encounterEnvelopeKey !== 'ShipEncounter') {
    throw new CandidateEvaluationContractError(
      'Ship candidate owner has no catalog encounter envelope',
    );
  }
  return Object.freeze({ authored, room, state: authored.state });
}

export function wheelState(
  catalog: Catalog,
  project: ProjectDocument,
  address: RewardWheelAddress | RewardWheelOfferAddress,
) {
  const owner = createOccurrenceAddress(
    createBiomeAddress(address.routeKey, address.biomeKey),
    address.occurrenceId,
  );
  const ship = shipState(catalog, project, owner);
  const descriptor = requireShipCombatWheels(catalog, ship.room, ship.room.gameName).find(
    (wheel) => wheel.key === address.wheelKey,
  );
  const wheel = ship.state.wheels[address.wheelKey];
  if (descriptor === undefined || wheel === undefined) {
    throw new CandidateEvaluationContractError(`Ship candidate has no ${address.wheelKey} wheel`);
  }
  if (address.kind === 'rewardWheelOffer' && !descriptor.offerKeys.includes(address.offerKey)) {
    throw new CandidateEvaluationContractError(
      `${address.wheelKey} has no ${address.offerKey} reward-wheel offer`,
    );
  }
  return Object.freeze({ owner, ship, descriptor, wheel });
}
