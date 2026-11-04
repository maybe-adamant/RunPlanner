import type {
  Catalog,
  ChallengeSwitchEliteEncounterDeclaration,
  ChallengeSwitchKind,
} from '../../catalog-schema';
import type { EncounterPhaseAddress } from '../../authored-project/addresses';
import {
  CHALLENGE_SWITCH_ENVELOPE_KEY,
  CHALLENGE_SWITCH_PHASE_KEY,
  challengeSwitchPhaseAddress,
} from './challenge-switch-phase';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { resolveEntryDeclaration } from '../../authored-project/room-state/entry-resolution';
import { challengeSwitchEncounterKey } from '../../authored-project/acquisition/challenge-switch';
import { assessEliteChallengeChoice, type EliteChallengeIssue } from '../commerce/challenge-switch';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { EncounterEntryVowRanks } from '../arcana-fear';
import {
  prepareGeneratedEncounter,
  type GeneratedEncounterCandidateCapability,
} from './generation-preparation';
import type { EncounterCustomizationUnsupportedReason, ResolvedEncounterPhase } from './model';
import { encounterAdmissionAt } from './preparation';
import { resolvedEncounterPhaseForDefinition } from './resolve';

/** One authored decision of the switch encounter the resolved encounter cannot steer with. */
export interface ChallengeSwitchCustomizationIssue {
  readonly decisionKey: string;
  readonly unsupported: EncounterCustomizationUnsupportedReason;
}

/**
 * The observed switch's encounter as native `HandleSecretSpawns` builds it at
 * room entry (RoomLogic.lua:4983-4992): the kind's encounter at this host, its
 * generated composition assessed against the entry state, and for Elite its
 * declared elite and the pinned elite's issues.
 */
export interface PreparedChallengeSwitchEncounter {
  readonly origin: EncounterPhaseAddress;
  readonly switchKind: ChallengeSwitchKind;
  readonly phase: ResolvedEncounterPhase;
  readonly capability?: GeneratedEncounterCandidateCapability;
  readonly customizationIssues: readonly ChallengeSwitchCustomizationIssue[];
  readonly elite?: {
    readonly encounter: ChallengeSwitchEliteEncounterDeclaration;
    readonly issues: readonly EliteChallengeIssue[];
  };
}

/**
 * Prepares an observed switch's encounter at its room's entry view. `ranks`
 * are the entry vow ranks; without them the composition reads rank zero, as
 * history composition prepares a room's own phases.
 */
export function prepareChallengeSwitchEncounter(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  routePosition: ResolvedRoutePosition,
  entry: HistoryStateView,
  ranks?: EncounterEntryVowRanks,
): PreparedChallengeSwitchEncounter | undefined {
  const observed = room.challengeSwitch;
  if (observed === undefined || room.origin.kind !== 'occurrence') return undefined;
  const variant = catalog.challengeSwitches.variants.byKey[observed.variantKey];
  const encounterKey = challengeSwitchEncounterKey(catalog, room.gameName, observed.variantKey);
  const rawDeclaration = catalog.rooms.byKey[room.gameName];
  if (variant === undefined || encounterKey === undefined || rawDeclaration === undefined)
    throw new Error(`${room.gameName} lost its challenge switch encounter`);
  const origin = challengeSwitchPhaseAddress(room.origin);
  const resolved = resolvedEncounterPhaseForDefinition(
    catalog,
    {
      slotKey: CHALLENGE_SWITCH_PHASE_KEY,
      envelopeKey: CHALLENGE_SWITCH_ENVELOPE_KEY,
      figLeafSkip: false,
      ...(observed.customization === undefined
        ? {}
        : { customizationByDecision: observed.customization }),
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
    entry,
    undefined,
    ranks === undefined ? undefined : () => ranks.hordes,
    ranks === undefined ? undefined : () => ranks.fangs,
    ranks === undefined ? undefined : () => ranks.menace,
    admissionAt,
  );
  const customizationIssues = (generated.phase.customization ?? []).flatMap((decision) =>
    decision.valueSupported
      ? []
      : [Object.freeze({ decisionKey: decision.key, unsupported: decision.unsupported })],
  );
  const eliteEncounter =
    variant.switchKind === 'elite'
      ? catalog.challengeSwitches.eliteEncounters.byKey[encounterKey]
      : undefined;
  if (variant.switchKind === 'elite' && eliteEncounter === undefined)
    throw new Error(`${room.gameName} lost its Elite encounter ${encounterKey}`);
  const roomSetKey = rawDeclaration.roomSetKey;
  return Object.freeze({
    origin,
    switchKind: variant.switchKind,
    phase: generated.phase,
    ...(generated.capability === undefined ? {} : { capability: generated.capability }),
    customizationIssues: Object.freeze(customizationIssues),
    ...(eliteEncounter === undefined
      ? {}
      : {
          elite: Object.freeze({
            encounter: eliteEncounter,
            issues:
              observed.elite === undefined
                ? Object.freeze([])
                : assessEliteChallengeChoice(eliteEncounter, roomSetKey, observed.elite),
          }),
        }),
  });
}
