import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';
import { semanticAddressKey, type EncounterPhaseAddress } from '../../authored-project/addresses';
import type { GeneratedEncounterSelection } from '../../catalog-schema';
import type { HistoryStateView, ProgressiveRoomHistoryViews } from '../history/model';
import type { RoomHistoryOrigin } from '../lifecycle';
import type { ResolvedEncounterPhase } from './model';
import {
  assessGeneratedEncounter,
  initializeGeneratedEncounter,
  type GeneratedEncounterAssessment,
} from './generation';

/** The supported pure query captures one concrete phase's exact generation inputs. */
export interface GeneratedEncounterCandidateCapability {
  readonly origin: EncounterPhaseAddress;
  readonly decisionKey: string;
  readonly assess: (value: AuthoredGeneratedEncounterCustomization) => GeneratedEncounterAssessment;
  /** One deterministic, complete starting value for the exact reached context. */
  readonly initialize: () => AuthoredGeneratedEncounterCustomization | undefined;
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

export function targetRewardGeneration(
  rooms: readonly ProgressiveRoomHistoryViews[],
  origin: RoomHistoryOrigin,
) {
  const key = semanticAddressKey(origin);
  return rooms
    .flatMap((room) => room.targetGenerations)
    .find((generation) => semanticAddressKey(generation.roomOrigin) === key);
}

export function prepareGeneratedEncounter(
  phase: ResolvedEncounterPhase,
  origin: EncounterPhaseAddress,
  preparation: HistoryStateView,
  rewardGeneration: HistoryStateView | undefined,
  hordesRankAt?: (
    selection: GeneratedEncounterSelection,
    origin: EncounterPhaseAddress,
  ) => number | undefined,
  fangsRankAt?: (origin: EncounterPhaseAddress) => number | undefined,
  menaceRankAt?: (origin: EncounterPhaseAddress) => number | undefined,
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
  const exactHordesRank = hordesRankAt?.(policy, origin);
  // Candidate publication may stop at an incomplete reward frontier. Keep the
  // existing structural phase, but do not publish a generated candidate from
  // a fabricated Hordes value.
  if (hordesRankAt !== undefined && exactHordesRank === undefined) return { phase };
  const hordesRank = exactHordesRank ?? 0;
  const exactFangsRank = fangsRankAt?.(origin);
  // A reached snapshot without Fangs is rank zero; a missing snapshot is not
  // an authorization to invent the post-reward selection context.
  if (fangsRankAt !== undefined && exactFangsRank === undefined) return { phase };
  const exactMenaceRank = menaceRankAt?.(origin);
  if (menaceRankAt !== undefined && exactMenaceRank === undefined) return { phase };
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
    // RewardLogic forwards declared reward Overrides; the complete modeled
    // reward domain contains no MakeHardEncounter producer.
    hard: false,
    hordesRank,
    fangsRank: exactFangsRank ?? 0,
    menaceRank: exactMenaceRank ?? 0,
    roomSetKey: origin.biomeKey,
  });
  const assess = (value: AuthoredGeneratedEncounterCustomization) =>
    assessGeneratedEncounter(policy, value, context);
  const capability = Object.freeze({
    origin,
    decisionKey: decision.key,
    assess,
    initialize: () => initializeGeneratedEncounter(policy, context),
  });
  if (decision.value?.kind !== 'generated') return { phase, capability };
  const assessment = assess(decision.value);
  const operands = assessment.operands;
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
        ...(operands === undefined ? {} : { operands }),
        knownRunBlacklistAdditions: assessment.knownRunBlacklistAdditions,
      }),
    }),
  };
}
