import type {
  ProjectCandidateEvaluation,
  RequirementEvaluationEvidence,
  RewardCandidateExclusionEvidence,
  RoomGenerationExclusionEvidence,
} from '@run-planner/engine/simulation';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { CounterAxis } from '@run-planner/engine/requirements';

import type { CandidateOptionProjection } from './candidateProjection';

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
  readonly selected: boolean;
}

export interface ContextualOptionResolver {
  readonly resolve: <T>(
    options: readonly CandidateOptionProjection<T>[],
    presentationFor: (option: CandidateOptionProjection<T>) => ContextualOptionPresentation,
  ) => readonly ContextualOption<T>[];
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
    case 'recentEncounterPhaseCount':
      return 'Recent encounter history does not satisfy this room.';
    case 'minExits':
      return `The parent has ${evidence.actual} exits; this room requires at least ${evidence.minimum}.`;
    case 'currentBatchTargetCount':
      return `This batch has ${evidence.actual} targets, outside the room's supported range.`;
    case 'currentBatchRoomCount':
      return `This batch contains ${evidence.actual} matching rooms, outside the supported range.`;
    case 'clockworkGoalsRemaining':
      return `${evidence.actual} Clockwork goals remain; this room is not valid at that point.`;
    case 'clockworkNonGoalCapacity':
      return `The Clockwork non-goal capacity is exhausted (${evidence.acquired}/${evidence.maximum}).`;
  }
}

function roomName(catalog: Catalog, gameName: string): string {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new Error(`contextual option references unknown room ${gameName}`);
  }
  return room.label;
}

function biomeName(catalog: Catalog, biomeKey: string): string {
  const biome = catalog.biomes.byKey[biomeKey];
  if (biome === undefined) {
    throw new Error(`contextual option references unknown biome ${biomeKey}`);
  }
  return biome.label;
}

function roomExclusionExplanation(
  catalog: Catalog,
  exclusion: RoomGenerationExclusionEvidence,
): CandidateExplanation {
  switch (exclusion.kind) {
    case 'notCandidate':
      return { kind: 'declaration', message: 'This room is not in the authored candidate set.' };
    case 'physicalExitUnavailable':
      return { kind: 'exit', message: `Exit ${exclusion.exitIndex} is unavailable here.` };
    case 'exitIncompatible':
      return {
        kind: 'compatibility',
        message: `${roomName(catalog, exclusion.candidateGameName)} is incompatible with this exit.`,
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
        message: `This room has reached its run creation cap (${exclusion.actual}/${exclusion.maximum}).`,
      };
    case 'maxCreationsPerRoom':
      return {
        kind: 'cap',
        message: `This parent has reached the room's creation cap (${exclusion.actual}/${exclusion.maximum}).`,
      };
    case 'maxAppearancesThisBiome':
      return {
        kind: 'cap',
        message: `This room has reached its biome appearance cap (${exclusion.actual}/${exclusion.maximum}).`,
      };
    case 'forcedPool':
      return {
        kind: 'force',
        message: `A forced room must be selected: ${exclusion.requiredRoomGameNames.map((name) => roomName(catalog, name)).join(', ')}.`,
      };
  }
}

function rewardExclusionExplanation(
  catalog: Catalog,
  exclusion: RewardCandidateExclusionEvidence,
): CandidateExplanation {
  switch (exclusion.kind) {
    case 'store':
      return {
        kind: 'store',
        message: 'This reward is outside the selected reward pool.',
      };
    case 'bag':
      return {
        kind: 'bag',
        message: 'No reachable reward-pool state supports this reward.',
      };
    case 'sibling':
      return {
        kind: 'sibling',
        message: `This reward conflicts with the offer on ${rewardPeerLabel(catalog, exclusion.priorOffers[0]?.origin)}.`,
      };
    case 'boonSource':
      return { kind: 'boonSource', message: 'This God cannot be offered at this point.' };
    case 'devotionPair':
      return { kind: 'devotionPair', message: 'This Devotion pair is not supported here.' };
    case 'payload':
      return { kind: 'payload', message: 'This reward payload is not valid.' };
    case 'shop':
      return { kind: 'shop', message: 'This shop configuration is not supported.' };
    case 'acquisition':
      return {
        kind: 'acquisition',
        message: 'This reward cannot be acquired at this lifecycle point.',
      };
  }
}

function numberedLabel(value: string, prefix: string): string {
  const suffix = value.match(/(\d+)$/)?.[1];
  return suffix === undefined ? prefix : `${prefix} ${Number(suffix)}`;
}

function rewardPeerLabel(catalog: Catalog, origin: SemanticAddress | undefined): string {
  if (origin === undefined) {
    return 'another offer';
  }
  switch (origin.kind) {
    case 'target':
      return `Exit ${origin.exitIndex}`;
    case 'rewardWheelOffer':
      return numberedLabel(origin.offerKey, 'Offer');
    case 'localReward':
      return numberedLabel(origin.slotKey, origin.groupKey === 'cages' ? 'Cage' : 'Side room');
    case 'hubSlot': {
      const layout = catalog.biomeLayouts.byKey[origin.biomeKey];
      const slot =
        layout?.kind === 'HubBiome'
          ? layout.hub.slots.find((candidate) => candidate.slotKey === origin.hubSlotKey)
          : undefined;
      return slot === undefined ? 'another Hub room' : roomName(catalog, slot.roomGameName);
    }
    default:
      return 'another offer';
  }
}

function isRoomExclusion(
  exclusion: RoomGenerationExclusionEvidence | RewardCandidateExclusionEvidence,
): exclusion is RoomGenerationExclusionEvidence {
  switch (exclusion.kind) {
    case 'notCandidate':
    case 'physicalExitUnavailable':
    case 'exitIncompatible':
    case 'currentRoomRepeat':
    case 'forceMinimum':
    case 'eligibilityRequirement':
    case 'maxCreationsThisRun':
    case 'maxCreationsPerRoom':
    case 'maxAppearancesThisBiome':
    case 'forcedPool':
      return true;
    default:
      return false;
  }
}

export function explainCandidateEvaluation(
  catalog: Catalog,
  evaluation: ProjectCandidateEvaluation,
): CandidateExplanation | undefined {
  if (evaluation.context === 'unavailable') {
    switch (evaluation.evidence.kind) {
      case 'authoredPrerequisiteMissing': {
        const prerequisite = evaluation.evidence.prerequisite;
        const label =
          prerequisite.kind === 'batchRewardStore'
            ? 'reward pool'
            : prerequisite.kind === 'batchState'
              ? 'Fields door roll'
              : prerequisite.owner.fieldKey === 'maxNonGoalRewards'
                ? 'rolled non-goal limit'
                : 'biome outcome';
        return {
          kind: 'authoredPrerequisiteMissing',
          message: `Choose the required ${label} before evaluating this option.`,
        };
      }
      case 'coverageNotReached':
        return {
          kind: 'coverage',
          message: 'This decision has not been reached by the current evaluated prefix.',
        };
      case 'producerFrontierUnavailable':
        return {
          kind: 'producerFrontierUnavailable',
          message: 'The current simulation does not reach this reward producer.',
        };
      case 'upstreamIncomplete':
        return {
          kind: 'upstreamIncomplete',
          message: `Complete ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before editing this biome contextually.`,
        };
      case 'upstreamInvalid':
        return {
          kind: 'upstreamInvalid',
          message: `Repair ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before editing this biome contextually.`,
        };
    }
  }
  if (evaluation.support === 'forced') {
    return {
      kind: 'forced',
      message: 'This option is part of the required choice set at this decision.',
    };
  }
  if (evaluation.support !== 'impossible') {
    return undefined;
  }
  if ('exclusions' in evaluation.evidence) {
    const first = evaluation.evidence.exclusions[0];
    if (first !== undefined) {
      return isRoomExclusion(first)
        ? roomExclusionExplanation(catalog, first)
        : rewardExclusionExplanation(catalog, first);
    }
  }
  return {
    kind: evaluation.findings[0]?.code ?? 'unsupported',
    message: 'This option is not supported by the current route state.',
  };
}

function state(evaluation: ProjectCandidateEvaluation): ContextualOptionState {
  return evaluation.context === 'unavailable' ? 'unassessed' : evaluation.support;
}

function presentationKey(values: readonly ContextualOptionPresentation[]): string {
  return JSON.stringify(values);
}

export function createContextualOptionResolver(catalog: Catalog): ContextualOptionResolver {
  const cache = new WeakMap<
    readonly CandidateOptionProjection<unknown>[],
    Map<string, readonly ContextualOption<unknown>[]>
  >();
  return Object.freeze({
    resolve<T>(
      options: readonly CandidateOptionProjection<T>[],
      presentationFor: (option: CandidateOptionProjection<T>) => ContextualOptionPresentation,
    ): readonly ContextualOption<T>[] {
      const presentation = options.map(presentationFor);
      let byPresentation = cache.get(options);
      if (byPresentation === undefined) {
        byPresentation = new Map();
        cache.set(options, byPresentation);
      }
      const key = presentationKey(presentation);
      const existing = byPresentation.get(key);
      if (existing !== undefined) {
        return existing as readonly ContextualOption<T>[];
      }
      const projected = Object.freeze(
        options.map((option, index) => {
          const display = presentation[index]!;
          const candidateExplanation = explainCandidateEvaluation(catalog, option.evaluation);
          return Object.freeze({
            value: option.value,
            label: display.label,
            ...(display.category === undefined ? {} : { category: display.category }),
            state: state(option.evaluation),
            selected: display.selected,
            ...(candidateExplanation === undefined
              ? {}
              : { explanation: Object.freeze(candidateExplanation) }),
          });
        }),
      );
      byPresentation.set(key, projected);
      return projected;
    },
  });
}
