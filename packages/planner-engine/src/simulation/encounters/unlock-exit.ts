import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { UnlockExitRoomAction } from '../../authored-project/model';
import { unlockExitEncounterKey } from '../../authored-project/locked-exits';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { resolveEntryDeclaration } from '../../authored-project/room-state/entry-resolution';
import type { EncounterEntryVowRanks } from '../arcana-fear';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import {
  prepareGeneratedEncounter,
  type GeneratedEncounterCandidateCapability,
} from './generation-preparation';
import type { EncounterCustomizationUnsupportedReason, ResolvedEncounterPhase } from './model';
import { encounterAdmissionAt } from './preparation';
import { resolvedEncounterPhaseForDefinition } from './resolve';

/**
 * A locked door's fight is a phase of its room outside the room's envelope,
 * one per door: these keys name it in history, never a declared slot.
 */
export const UNLOCK_EXIT_ENVELOPE_KEY = 'unlockExit';

export function unlockExitPhaseKey(exitKey: string): string {
  return `unlockExit:${exitKey}`;
}

export function unlockExitPhaseAddress(
  room: OccurrenceAddress,
  exitKey: string,
): EncounterPhaseAddress {
  return createEncounterPhaseAddress(
    createBiomeAddress(room.routeKey, room.biomeKey),
    { kind: 'occurrence', occurrenceId: room.occurrenceId },
    unlockExitPhaseKey(exitKey),
  );
}

/** One authored decision of a locked door's fight the resolved encounter cannot steer with. */
export interface UnlockExitCustomizationIssue {
  readonly decisionKey: string;
  readonly unsupported: EncounterCustomizationUnsupportedReason;
}

/**
 * A locked door's fight as `AttemptUseDoor` generates it at the press: the
 * host's lock encounter, its composition assessed against the state the
 * press reaches.
 */
export interface PreparedUnlockExitEncounter {
  readonly origin: EncounterPhaseAddress;
  readonly exitKey: string;
  readonly phase: ResolvedEncounterPhase;
  readonly capability?: GeneratedEncounterCandidateCapability;
  readonly customizationIssues: readonly UnlockExitCustomizationIssue[];
}

/**
 * Prepares one press's fight at the view before it. `ranks` are the room's
 * entry vow ranks; without them the composition reads rank zero, as history
 * composition prepares a room's own phases.
 */
export function prepareUnlockExitEncounter(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  routePosition: ResolvedRoutePosition,
  action: UnlockExitRoomAction,
  before: HistoryStateView,
  ranks?: EncounterEntryVowRanks,
): PreparedUnlockExitEncounter | undefined {
  if (room.origin.kind !== 'occurrence') return undefined;
  const encounterKey = unlockExitEncounterKey(catalog, room.gameName);
  const rawDeclaration = catalog.rooms.byKey[room.gameName];
  if (encounterKey === undefined || rawDeclaration === undefined)
    throw new Error(`${room.gameName} lost its locked door's fight`);
  const origin = unlockExitPhaseAddress(room.origin, action.exitKey);
  const resolved = resolvedEncounterPhaseForDefinition(
    catalog,
    {
      slotKey: unlockExitPhaseKey(action.exitKey),
      envelopeKey: UNLOCK_EXIT_ENVELOPE_KEY,
      figLeafSkip: false,
      ...(action.customization === undefined
        ? {}
        : { customizationByDecision: action.customization }),
    },
    encounterKey,
  );
  const admissionAt = encounterAdmissionAt(
    catalog,
    room,
    routePosition,
    resolveEntryDeclaration(rawDeclaration, routePosition),
    false,
    false,
  );
  const generated = prepareGeneratedEncounter(
    resolved,
    origin,
    before,
    undefined,
    ranks === undefined ? undefined : () => ranks.hordes,
    ranks === undefined ? undefined : () => ranks.fangs,
    ranks === undefined ? undefined : () => ranks.menace,
    admissionAt,
  );
  return Object.freeze({
    origin,
    exitKey: action.exitKey,
    phase: generated.phase,
    ...(generated.capability === undefined ? {} : { capability: generated.capability }),
    customizationIssues: Object.freeze(
      (generated.phase.customization ?? []).flatMap((decision) =>
        decision.valueSupported
          ? []
          : [Object.freeze({ decisionKey: decision.key, unsupported: decision.unsupported })],
      ),
    ),
  });
}
