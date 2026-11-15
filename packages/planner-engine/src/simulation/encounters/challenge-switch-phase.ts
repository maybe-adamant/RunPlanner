import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';

import { CHALLENGE_SWITCH_PHASE_KEY } from '../../authored-project/acquisition/challenge-switch';

export function challengeSwitchPhaseAddress(room: OccurrenceAddress): EncounterPhaseAddress {
  return createEncounterPhaseAddress(
    createBiomeAddress(room.routeKey, room.biomeKey),
    { kind: 'occurrence', occurrenceId: room.occurrenceId },
    CHALLENGE_SWITCH_PHASE_KEY,
  );
}
