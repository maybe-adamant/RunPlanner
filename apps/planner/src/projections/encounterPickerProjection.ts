import type {
  CandidateOptionProjection,
  EncounterCandidateProjectionEvaluation,
} from './candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from './contextualPicker';

export interface EncounterPickerChoice {
  readonly label: string;
  readonly value: string;
}

function explanationFor(
  evaluation: EncounterCandidateProjectionEvaluation,
): { readonly kind: 'encounter'; readonly message: string } | undefined {
  switch (evaluation.result.evidence.kind) {
    case 'coverageUnavailable':
      return {
        kind: 'encounter',
        message: 'This encounter phase has not been evaluated yet.',
      };
    case 'inactiveSlot':
      return {
        kind: 'encounter',
        message: 'This encounter phase is not active for the selected room setup.',
      };
    case 'requirementsExcluded':
      return {
        kind: 'encounter',
        message: 'This encounter does not meet the current encounter requirements.',
      };
    case 'supported':
      return undefined;
  }
}

/**
 * Applies encounter-specific player language to the declaration-ordered
 * engine candidate domain. It deliberately does not inspect requirements or
 * membership: generic support-set evidence was already classified by
 * candidateProjection.
 */
export function projectEncounterPicker(
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly EncounterPickerChoice[],
  selectedEncounterKey: string,
  candidates: readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[],
): ContextualPickerModel<string> {
  const labels = new Map(choices.map((choice) => [choice.value, choice.label]));
  return contextualPicker.project(
    candidates,
    (candidate) => {
      const label = labels.get(candidate.value);
      if (label === undefined) {
        throw new Error(
          `Encounter picker candidate ${candidate.value} is outside its declaration domain`,
        );
      }
      if (candidate.evaluation.kind !== 'encounter') {
        throw new Error(
          `Encounter picker received a non-encounter candidate for ${candidate.value}`,
        );
      }
      const explanation = explanationFor(candidate.evaluation);
      return Object.freeze({
        label,
        selected: candidate.value === selectedEncounterKey,
        ...(explanation === undefined ? {} : { explanation }),
      });
    },
    (encounterKey) => encounterKey,
  );
}
