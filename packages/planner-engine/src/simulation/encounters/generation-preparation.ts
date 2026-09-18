import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';
import { semanticAddressKey, type EncounterPhaseAddress } from '../../authored-project/addresses';
import type { HistoryStateView, ProgressiveRoomHistoryViews } from '../history/model';
import type { RoomHistoryOrigin } from '../lifecycle';
import type { ResolvedEncounterPhase } from './model';
import { assessGeneratedEncounter, type GeneratedEncounterAssessment } from './generation';

/** The supported pure query captures one concrete phase's exact generation inputs. */
export interface GeneratedEncounterCandidateCapability {
  readonly origin: EncounterPhaseAddress;
  readonly decisionKey: string;
  readonly assess: (value: AuthoredGeneratedEncounterCustomization) => GeneratedEncounterAssessment;
}

export function targetRewardGenerationCheckpoint(
  rooms: readonly ProgressiveRoomHistoryViews[],
  origin: RoomHistoryOrigin,
): HistoryStateView | undefined {
  const key = semanticAddressKey(origin);
  return rooms
    .flatMap((room) => room.targetGenerations)
    .find((generation) => semanticAddressKey(generation.roomOrigin) === key)?.before;
}

export function prepareGeneratedEncounter(
  phase: ResolvedEncounterPhase,
  origin: EncounterPhaseAddress,
  preparation: HistoryStateView,
  rewardGeneration: HistoryStateView | undefined,
): {
  readonly phase: ResolvedEncounterPhase;
  readonly capability?: GeneratedEncounterCandidateCapability;
} {
  const decision = phase.customization?.find((entry) => entry.selection.kind === 'generated');
  if (decision?.selection.kind !== 'generated') return { phase };
  const policy = decision.selection;
  const before = policy.preparation === 'rewardGeneration' ? rewardGeneration : preparation;
  // Unreached generation has no exact candidate product. Do not substitute the
  // later room-entry checkpoint for an earlier reward-owned generation call.
  if (before === undefined) {
    if (decision.value !== undefined)
      throw new Error(`${phase.encounterKey} lost its reward-generation checkpoint`);
    return { phase };
  }
  const context = Object.freeze({
    biomeDepthCache: before.ledgers.counters.biomeDepthCache,
    biomeEncounterDepth: before.ledgers.counters.biomeEncounterDepth,
    knownRunBlacklist: Object.freeze([
      ...new Set(
        before.ledgers.encounterRecords.flatMap(
          (record) => record.knownEnemyBlacklistAdditions ?? [],
        ),
      ),
    ]),
  });
  const assess = (value: AuthoredGeneratedEncounterCustomization) =>
    assessGeneratedEncounter(policy, value, context);
  const capability = Object.freeze({ origin, decisionKey: decision.key, assess });
  if (decision.value?.kind !== 'generated') return { phase, capability };
  const assessment = assess(decision.value);
  return {
    capability,
    phase: Object.freeze({
      ...phase,
      customization: Object.freeze(
        phase.customization!.map((entry) =>
          entry === decision
            ? Object.freeze({ ...entry, valueSupported: assessment.supported })
            : entry,
        ),
      ),
      generatedCustomization: Object.freeze({
        decisionKey: decision.key,
        ...(assessment.operands === undefined ? {} : { operands: assessment.operands }),
        knownRunBlacklistAdditions: assessment.knownRunBlacklistAdditions,
      }),
    }),
  };
}
