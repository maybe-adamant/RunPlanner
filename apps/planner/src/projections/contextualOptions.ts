import type {
  FindingEvidenceValue,
  ProjectCandidateEvaluation,
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CounterAxis } from '@run-planner/engine/requirements';

import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
} from './candidateProjection';

export type ContextualOptionState = 'forced' | 'possible' | 'impossible' | 'unassessed';

export interface CandidateExplanation {
  readonly kind: string;
  readonly message: string;
}

export interface ContextualOption<T> {
  readonly value: T;
  readonly label: string;
  readonly category?: string;
  readonly state: ContextualOptionState;
  readonly selected: boolean;
  readonly explanation?: CandidateExplanation;
}

export interface ContextualOptionPresentation {
  readonly label: string;
  readonly category?: string;
  /** A domain-specific, typed explanation supplied by its application projector. */
  readonly explanation?: CandidateExplanation;
  readonly selected: boolean;
}

export interface ContextualOptionResolver {
  readonly resolve: <T>(
    options: readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
    presentationFor: (
      option: CandidateOptionProjection<T, CandidateProjectionEvaluation>,
    ) => ContextualOptionPresentation,
  ) => readonly ContextualOption<T>[];
}

function biomeName(catalog: Catalog, biomeKey: string): string {
  const biome = catalog.biomes.byKey[biomeKey];
  if (biome === undefined)
    throw new Error(`contextual option references unknown biome ${biomeKey}`);
  return biome.label;
}

function counterLabel(axis: CounterAxis): string {
  switch (axis) {
    case 'biomeDepthCache':
      return 'Biome depth';
    case 'biomeEncounterDepth':
      return 'Encounter depth';
    case 'encounterDepth':
      return 'Route encounter depth';
    case 'enteredBiomes':
      return 'Entered biome count';
    case 'upgradableTraitCount':
      return 'Upgradable trait count';
  }
}

function requirementMessage(evidence: RequirementEvaluationEvidence): string {
  switch (evidence.kind) {
    case 'all':
    case 'any': {
      const failed = evidence.children.find((child) => !child.satisfied);
      return failed === undefined
        ? 'The current history does not satisfy this room requirement.'
        : requirementMessage(failed);
    }
    case 'not':
      return 'A disallowed history condition is currently present.';
    case 'counterRange':
      return `${counterLabel(evidence.axis)} is ${evidence.actual}; this room requires ${evidence.expected.min ?? 'any'} to ${evidence.expected.max ?? 'any'}.`;
    case 'recordCount':
    case 'distinctRecordKeyCount':
      return `The current matching history count is ${evidence.actual}; this room requires a different count.`;
    case 'recentEnvelopeSlotCount':
      return 'Recent encounter history does not satisfy this room.';
    case 'minExits':
      return `This room has ${evidence.actual} doors; this room requires at least ${evidence.minimum}.`;
    case 'currentBatchTargetCount':
      return `These doors contain ${evidence.actual} rooms, outside the room's supported range.`;
    case 'currentBatchRoomCount':
      return `These doors contain ${evidence.actual} matching rooms, outside the room's supported range.`;
    case 'clockworkGoalsRemaining':
      return `${evidence.actual} Clockwork goals remain; this room is not valid at that point.`;
    case 'clockworkNonGoalCapacity':
      return `The Clockwork non-goal capacity is exhausted (${evidence.acquired}/${evidence.maximum}).`;
  }
}

function roomName(catalog: Catalog, gameName: string): string {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`contextual option references unknown room ${gameName}`);
  return room.label;
}

function roomExclusionExplanation(
  catalog: Catalog,
  exclusion: RoomGenerationExclusionEvidence,
): CandidateExplanation {
  switch (exclusion.kind) {
    case 'notCandidate':
      return { kind: 'declaration', message: 'This room is not available for this door.' };
    case 'physicalExitUnavailable':
      return { kind: 'exit', message: `Door ${exclusion.exitIndex} is unavailable here.` };
    case 'exitIncompatible':
      return {
        kind: 'compatibility',
        message: `${roomName(catalog, exclusion.candidateGameName)} is incompatible with this door.`,
      };
    case 'currentRoomRepeat':
      return { kind: 'repeat', message: 'The current room cannot immediately repeat.' };
    case 'forceMinimum':
      return {
        kind: 'counter',
        message: `${counterLabel(exclusion.axis)} is ${exclusion.actual}; this room starts at ${exclusion.minimum}.`,
      };
    case 'eligibilityRequirement':
      return { kind: 'requirement', message: requirementMessage(exclusion.evaluation) };
    case 'maxCreationsThisRun':
      return {
        kind: 'cap',
        message: `This room can appear at most ${exclusion.maximum} times on this route.`,
      };
    case 'maxCreationsPerRoom':
      return {
        kind: 'cap',
        message: `This room can appear at most ${exclusion.maximum} times among these doors.`,
      };
    case 'maxAppearancesThisBiome':
      return {
        kind: 'cap',
        message: `This room can appear at most ${exclusion.maximum} times in this biome.`,
      };
    case 'forcedPool': {
      const rooms = exclusion.requiredRoomGameNames.map((name) => roomName(catalog, name));
      const subject = rooms.length === 1 ? 'This room must' : 'These rooms must';
      return {
        kind: 'force',
        message: `${subject} be included here: ${rooms.join(', ')}.`,
      };
    }
  }
}

type EvidenceRecord = Readonly<Record<string, FindingEvidenceValue>>;

function evidenceRecord(value: FindingEvidenceValue | undefined): EvidenceRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as EvidenceRecord;
}

function numberedLabel(value: string, prefix: string): string {
  const suffix = value.match(/(\d+)$/)?.[1];
  return suffix === undefined ? prefix : `${prefix} ${Number(suffix)}`;
}

function rewardPeerLabel(catalog: Catalog, value: FindingEvidenceValue | undefined): string {
  const origin = evidenceRecord(value);
  if (origin === undefined || typeof origin.kind !== 'string') return 'another offer';
  switch (origin.kind) {
    case 'target':
      return typeof origin.exitKey === 'string'
        ? numberedLabel(origin.exitKey, 'Door')
        : 'another offer';
    case 'rewardWheelOffer':
      return typeof origin.offerKey === 'string'
        ? numberedLabel(origin.offerKey, 'Offer')
        : 'another offer';
    case 'localReward':
      return typeof origin.slotKey === 'string'
        ? numberedLabel(origin.slotKey, origin.groupKey === 'cages' ? 'Cage' : 'Side room')
        : 'another offer';
    case 'hubSlot': {
      if (typeof origin.biomeKey !== 'string' || typeof origin.hubSlotKey !== 'string') {
        return 'another Hub room';
      }
      const layout = catalog.biomeLayouts.byKey[origin.biomeKey];
      const slot =
        layout?.progression.kind === 'hub'
          ? layout.progression.slots.find((candidate) => candidate.slotKey === origin.hubSlotKey)
          : undefined;
      return slot === undefined ? 'another Hub room' : roomName(catalog, slot.roomGameName);
    }
    default:
      return 'another offer';
  }
}

function siblingExplanation(
  catalog: Catalog,
  finding: SemanticFinding,
): CandidateExplanation | undefined {
  const peers = Array.isArray(finding.evidence.priorOffers) ? finding.evidence.priorOffers : [];
  const firstPeer = evidenceRecord(peers[0]);
  return firstPeer === undefined
    ? undefined
    : {
        kind: 'sibling',
        message: `This reward conflicts with the offer on ${rewardPeerLabel(catalog, firstPeer.origin)}.`,
      };
}

function findingExplanation(catalog: Catalog, finding: SemanticFinding): CandidateExplanation {
  const sibling = siblingExplanation(catalog, finding);
  if (sibling !== undefined) return sibling;
  switch (finding.code) {
    case 'targetRoomSupportEmpty':
      return { kind: 'room', message: 'No room can be offered when this door appears.' };
    case 'targetRoomUnavailable':
      return {
        kind: 'room',
        message: 'This room is not among the rooms that can be offered for this door.',
      };
    case 'encounterUnavailable':
      return {
        kind: 'encounter',
        message: 'This encounter cannot occur when this room begins.',
      };
    case 'encounterSlotActivationUnavailable':
      return {
        kind: 'encounter',
        message: 'This encounter phase is not active for the selected room setup.',
      };
    case 'fieldsCageOutcomeUnavailable':
      return { kind: 'fields', message: 'This Fields door outcome cannot occur at this point.' };
    case 'hubOpenSlotUnavailable':
      return { kind: 'hub', message: 'This Hub room conflicts with the selected open set.' };
    case 'sideRoomGenerationUnavailable':
      return {
        kind: 'sideRoom',
        message: 'This side-room setup is not available with the selected Hub rooms.',
      };
    case 'baseRewardStoreUnavailable':
      return { kind: 'store', message: 'This reward is outside the selected reward pool.' };
    case 'rewardAcquisitionUnavailable':
      return {
        kind: 'acquisition',
        message: 'This reward cannot be acquired here.',
      };
    case 'rewardBagSupportEmpty':
      return {
        kind: 'bag',
        message: 'No available reward pool can offer this reward.',
      };
    case 'rewardBagEntryUnavailable':
      return { kind: 'bag', message: 'This reward is unavailable from the selected reward pool.' };
    case 'rewardPayloadInvalid':
      return { kind: 'payload', message: 'These reward details are not valid.' };
    case 'rewardSourceUnavailable':
      return typeof finding.evidence.chosenSource === 'string' &&
        typeof finding.evidence.spurnedSource === 'string'
        ? { kind: 'devotionPair', message: 'This Devotion pair is not supported here.' }
        : { kind: 'boonSource', message: 'This God cannot be offered at this point.' };
    case 'shopOfferUnavailable':
      return { kind: 'shop', message: 'These Shop offers cannot appear together.' };
    case 'shopPurchaseUnavailable':
      return {
        kind: 'shop',
        message: 'This purchase order cannot be completed with the current shop configuration.',
      };
    case 'alreadyEquipped':
      return { kind: 'trait', message: 'This trait is already equipped.' };
    case 'missingPrerequisite':
      return {
        kind: 'trait',
        message: 'The equipped-trait history does not satisfy this prerequisite.',
      };
    case 'negativePrerequisite':
      return { kind: 'trait', message: 'A trait that must be absent is currently equipped.' };
    case 'offerContext':
      return { kind: 'trait', message: 'This trait is blocked by the current offer context.' };
    case 'elementThreshold':
      return { kind: 'trait', message: 'The equipped element totals are too low for this trait.' };
    case 'rarityCount':
      return { kind: 'trait', message: 'The equipped rarity totals do not satisfy this trait.' };
    case 'rarifiableTarget':
      return { kind: 'trait', message: 'No equipped trait can be rarified for this offer.' };
    case 'targetedAcquisitionNoEligibleTarget':
      return { kind: 'trait', message: 'No equipped trait can receive this acquisition.' };
    case 'targetedAcquisitionTargetMissing':
      return { kind: 'trait', message: 'Choose an eligible equipped trait for this acquisition.' };
    case 'targetedAcquisitionTargetUnavailable':
      return { kind: 'trait', message: 'This equipped trait cannot receive the acquisition.' };
    case 'occupiedBoonSlot':
      return { kind: 'trait', message: 'This ordinary boon slot is already occupied.' };
    case 'freshRarityUnavailable':
      return { kind: 'trait', message: 'This rarity is unavailable for a fresh trait offer.' };
    case 'rarityBelowActiveFloor':
      return {
        kind: 'trait',
        message: 'This fresh Common offer is below the active Rare floor.',
      };
    case 'replacementUnavailable':
      return { kind: 'trait', message: 'This occupied boon slot cannot be replaced here.' };
    case 'replacementMaximumRarity':
      return { kind: 'trait', message: 'The occupied trait is already at maximum rarity.' };
    case 'replacementRarityMismatch':
      return { kind: 'trait', message: 'The replacement must use the exact promoted rarity.' };
    case 'replacementCompositionExceeded':
      return { kind: 'trait', message: 'This offer contains too many replacement options.' };
    case 'wrongHammerLoadout':
      return {
        kind: 'trait',
        message: 'This Hammer trait is incompatible with the selected loadout.',
      };
    case 'nonPriorityTrait':
      return {
        kind: 'trait',
        message: 'Every option in the first Olympian offer must be a priority trait.',
      };
    case 'missingAttackOrSpecial':
      return {
        kind: 'trait',
        message: 'The first Olympian offer must include an Attack or Special trait.',
      };
    case 'batchRewardStoreMissing':
    case 'batchStateMissing':
    case 'biomeFieldMissing':
    case 'biomeTopologyMissing':
    case 'continuationMissing':
    case 'hubOpenSetIncomplete':
    case 'hubVisitOrderIncomplete':
    case 'pickedShopStateMissing':
    case 'pickedTargetMissing':
    case 'targetMissing':
      return {
        kind: 'structure',
        message: 'Finish the required earlier route steps before this option can be evaluated.',
      };
  }
}

function activeFinding(
  evaluation: Exclude<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): SemanticFinding | undefined {
  if (evaluation.kind === 'traitOffer') return undefined;
  return 'findings' in evaluation.result ? evaluation.result.findings[0] : undefined;
}

function unavailableExplanation(
  catalog: Catalog,
  evaluation: Extract<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): CandidateExplanation {
  switch (evaluation.evidence.kind) {
    case 'authoredPrerequisiteMissing': {
      const label =
        evaluation.evidence.prerequisite.kind === 'batchRewardStore'
          ? 'reward pool'
          : evaluation.evidence.prerequisite.kind === 'fieldsCageOutcome'
            ? 'Fields door roll'
            : 'biome setting';
      return {
        kind: evaluation.evidence.kind,
        message: `Choose the required ${label} before evaluating this option.`,
      };
    }
    case 'coverageNotReached':
      return {
        kind: evaluation.evidence.kind,
        message: 'This part of the route has not been evaluated yet.',
      };
    case 'producerFrontierUnavailable':
      return {
        kind: evaluation.evidence.kind,
        message: 'The current route does not reach this reward yet.',
      };
    case 'targetNotReachable':
      return {
        kind: evaluation.evidence.kind,
        message: 'This door is not reachable in the current route.',
      };
    case 'upstreamIncomplete':
      return {
        kind: evaluation.evidence.kind,
        message: `Finish ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before choices here can be evaluated.`,
      };
    case 'upstreamInvalid':
      return {
        kind: evaluation.evidence.kind,
        message: `Fix ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before choices here can be evaluated.`,
      };
  }
}

export function explainCandidateEvaluation(
  catalog: Catalog,
  evaluation: ProjectCandidateEvaluation,
): CandidateExplanation | undefined {
  if (evaluation.kind === 'unavailable') return unavailableExplanation(catalog, evaluation);
  const support = candidateSupport({ value: null, evaluation });
  if (support === 'forced') {
    return {
      kind: 'forced',
      message: 'This option must be included here.',
    };
  }
  if (support !== 'impossible') return undefined;
  if (evaluation.kind === 'roomTarget') {
    const exclusion = evaluation.result.pressure.selectedExclusions[0];
    if (exclusion !== undefined) return roomExclusionExplanation(catalog, exclusion);
  }
  const finding = activeFinding(evaluation);
  if (finding !== undefined) return findingExplanation(catalog, finding);
  return {
    kind: 'unsupported',
    message: 'This option is not available with the current route.',
  };
}

function state(evaluation: CandidateProjectionEvaluation): ContextualOptionState {
  const support = candidateSupport({ value: null, evaluation });
  return support === 'unavailable' ? 'unassessed' : support;
}

function presentationKey(values: readonly ContextualOptionPresentation[]): string {
  return JSON.stringify(values);
}

export function createContextualOptionResolver(catalog: Catalog): ContextualOptionResolver {
  const cache = new WeakMap<
    readonly CandidateOptionProjection<unknown, CandidateProjectionEvaluation>[],
    Map<string, readonly ContextualOption<unknown>[]>
  >();
  return Object.freeze({
    resolve<T>(
      options: readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
      presentationFor: (
        option: CandidateOptionProjection<T, CandidateProjectionEvaluation>,
      ) => ContextualOptionPresentation,
    ): readonly ContextualOption<T>[] {
      const presentation = options.map(presentationFor);
      let byPresentation = cache.get(options);
      if (byPresentation === undefined) {
        byPresentation = new Map();
        cache.set(options, byPresentation);
      }
      const key = presentationKey(presentation);
      const existing = byPresentation.get(key);
      if (existing !== undefined) return existing as readonly ContextualOption<T>[];
      const projected = Object.freeze(
        options.map((option, index) => {
          const display = presentation[index]!;
          const explanation =
            display.explanation ??
            (option.evaluation.kind === 'encounter' ||
            option.evaluation.kind === 'traitOfferFocusedOption' ||
            option.evaluation.kind === 'traitAcquisitionTarget'
              ? undefined
              : explainCandidateEvaluation(catalog, option.evaluation));
          return Object.freeze({
            value: option.value,
            label: display.label,
            ...(display.category === undefined ? {} : { category: display.category }),
            state: state(option.evaluation),
            selected: display.selected,
            ...(explanation === undefined ? {} : { explanation: Object.freeze(explanation) }),
          });
        }),
      );
      byPresentation.set(key, projected);
      return projected;
    },
  });
}
