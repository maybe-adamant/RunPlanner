import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from './candidates/candidateProjection';
import type { CandidateExplanation } from './contextual/contextualOptions';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from './contextual/contextualPicker';

export interface ChoicePickerChoice<T> {
  readonly label: string;
  readonly value: T;
}

type ChoiceKey = string | number;

type ChoiceExplainer<T> = (
  evaluation: CandidateProjectionEvaluation,
  value: T,
  labelFor: (key: string) => string,
) => CandidateExplanation | undefined;

/**
 * The shared projector for support-backed scalar settings whose decision rests
 * on route-wide math the player cannot see in a bare label. Declaration order
 * and support classification are already settled by candidate evaluation; this
 * only attaches the authored label and the domain sentence that explains a
 * forced or impossible option.
 */
function projectChoicePicker<T extends ChoiceKey>(
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly ChoicePickerChoice<T>[],
  selected: T | undefined,
  candidates: readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
  explain: ChoiceExplainer<T>,
): ContextualPickerModel<T> {
  const labels = new Map(choices.map((choice) => [String(choice.value), choice.label]));
  const labelFor = (key: string): string => labels.get(key) ?? key;
  return contextualPicker.project(
    candidates,
    (candidate) => {
      const label = labels.get(String(candidate.value));
      if (label === undefined) {
        throw new Error(`choice picker candidate ${candidate.value} is outside its domain`);
      }
      const explanation = explain(candidate.evaluation, candidate.value, labelFor);
      return Object.freeze({
        label,
        selected: candidate.value === selected,
        ...(explanation === undefined ? {} : { explanation }),
      });
    },
    (value) => String(value),
  );
}

/**
 * The reward controller keeps a run-wide Minor ratio, so a pool can be forced
 * or excluded by rooms entered far from the choice. The ledger it read is
 * reported beside the verdict, in the same words wherever the controller runs.
 */
function rewardControllerExplanation(
  ledger: {
    readonly enteredMetaStoreCount: number;
    readonly enteredStoreCount: number;
  },
  supportedStoreKeys: readonly string[],
  labelFor: (key: string) => string,
): CandidateExplanation | undefined {
  const forced = supportedStoreKeys.length === 1 ? supportedStoreKeys[0] : undefined;
  if (forced === undefined) {
    return supportedStoreKeys.length === 0
      ? { kind: 'store', message: 'No reward pool is supported at this point.' }
      : undefined;
  }
  const counted =
    ledger.enteredStoreCount === 0
      ? 'No entered room has counted yet'
      : `${ledger.enteredMetaStoreCount} of ${ledger.enteredStoreCount} entered rooms counted ${labelFor('MetaProgress')}`;
  return {
    kind: 'store',
    message: `${counted}; the controller forces ${labelFor(forced)} here.`,
  };
}

function rewardStoreExplanation(
  evaluation: CandidateProjectionEvaluation,
  _value: string,
  labelFor: (key: string) => string,
): CandidateExplanation | undefined {
  if (evaluation.kind !== 'batchRewardStore') return undefined;
  return rewardControllerExplanation(
    evaluation.result,
    evaluation.result.supportStoreKeys,
    labelFor,
  );
}

/** The ship wheel rolls its pool from the same controller, at its own spawn. */
function rewardWheelStoreExplanation(
  evaluation: CandidateProjectionEvaluation,
  _value: string,
  labelFor: (key: string) => string,
): CandidateExplanation | undefined {
  if (evaluation.kind !== 'rewardWheelStore') return undefined;
  return rewardControllerExplanation(
    evaluation.result,
    evaluation.result.supportedStoreKeys,
    labelFor,
  );
}

/**
 * A Fields door rolls Maximum only while the biome has cage room left and its
 * depth supports the roll. Where one outcome is settled, the counters that
 * settled it are the explanation — for the outcome that must happen as much as
 * for the one that cannot.
 */
function fieldsCageOutcomeExplanation(
  evaluation: CandidateProjectionEvaluation,
  _value: 'min' | 'max',
  labelFor: (key: string) => string,
): CandidateExplanation | undefined {
  if (evaluation.kind !== 'fieldsCageOutcome') return undefined;
  const { fieldsMaxDoorsRolled, maxDoorCageCeiling, biomeDepthCache, supportOutcomes } =
    evaluation.result;
  const forced = supportOutcomes.length === 1 ? supportOutcomes[0] : undefined;
  if (forced === undefined) return undefined;
  return forced === 'min' && fieldsMaxDoorsRolled >= maxDoorCageCeiling
    ? {
        kind: 'fields',
        message: `${fieldsMaxDoorsRolled} of ${maxDoorCageCeiling} ${labelFor('max')} outcomes are already rolled; this door must roll ${labelFor('min')}.`,
      }
    : {
        kind: 'fields',
        message: `Biome depth is ${biomeDepthCache}; this door must roll ${labelFor(forced)} there.`,
      };
}

export function projectRewardStorePicker(
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly ChoicePickerChoice<string>[],
  selected: string | undefined,
  candidates: readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[],
): ContextualPickerModel<string> {
  return projectChoicePicker(
    contextualPicker,
    choices,
    selected,
    candidates,
    rewardStoreExplanation,
  );
}

export function projectRewardWheelStorePicker(
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly ChoicePickerChoice<string>[],
  selected: string | undefined,
  candidates: readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[],
): ContextualPickerModel<string> {
  return projectChoicePicker(
    contextualPicker,
    choices,
    selected,
    candidates,
    rewardWheelStoreExplanation,
  );
}

export function projectFieldsCageOutcomePicker(
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly ChoicePickerChoice<'min' | 'max'>[],
  selected: 'min' | 'max' | undefined,
  candidates: readonly CandidateOptionProjection<'min' | 'max', CandidateProjectionEvaluation>[],
): ContextualPickerModel<'min' | 'max'> {
  return projectChoicePicker(
    contextualPicker,
    choices,
    selected,
    candidates,
    fieldsCageOutcomeExplanation,
  );
}
