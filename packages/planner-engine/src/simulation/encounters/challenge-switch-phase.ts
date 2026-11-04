import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';

/**
 * A switch's encounter is a phase of its room outside the room's envelope:
 * this slot and envelope key name it in history, never a declared slot.
 */
export const CHALLENGE_SWITCH_PHASE_KEY = 'challengeSwitch';
export const CHALLENGE_SWITCH_ENVELOPE_KEY = 'challengeSwitch';

export function challengeSwitchPhaseAddress(room: OccurrenceAddress): EncounterPhaseAddress {
  return createEncounterPhaseAddress(
    createBiomeAddress(room.routeKey, room.biomeKey),
    { kind: 'occurrence', occurrenceId: room.occurrenceId },
    CHALLENGE_SWITCH_PHASE_KEY,
  );
}
