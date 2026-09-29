import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CounterAxis, NumericRange } from '@run-planner/engine/requirements';
import type { EncounterRequirementEvidence } from '@run-planner/engine/simulation';
import type {
  CandidateOptionProjection,
  EncounterCandidateProjectionEvaluation,
} from './candidates/candidateProjection';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from './contextual/contextualPicker';

export interface EncounterPickerChoice {
  readonly label: string;
  readonly value: string;
}

function rangeLabel(range: NumericRange): string {
  if (range.min === undefined && range.max === undefined) return 'any value';
  if (range.min === range.max) return `exactly ${range.min}`;
  if (range.min === undefined) return `at most ${range.max}`;
  if (range.max === undefined) return `at least ${range.min}`;
  return `${range.min}–${range.max}`;
}

const counterLabels: Readonly<Record<CounterAxis, string>> = {
  biomeDepthCache: 'biome depth',
  biomeEncounterDepth: 'biome encounter depth',
  encounterDepth: 'route encounter depth',
  enteredBiomes: 'entered biome count',
  upgradableTraitCount: 'upgradable trait count',
};

function encounterNames(catalog: Catalog, keys: readonly string[]): string {
  return [...new Set(keys.map((key) => catalog.encounterDefinitions.byKey[key]!.label))].join(
    ' / ',
  );
}

function requirementMessages(
  catalog: Catalog,
  evidence: EncounterRequirementEvidence,
  expected = true,
): readonly string[] {
  if (evidence.satisfied === expected) return [];
  switch (evidence.kind) {
    case 'all':
    case 'any': {
      const children = evidence.children
        .map((child) => requirementMessages(catalog, child, expected))
        .filter((messages) => messages.length > 0);
      const jointlyRequired = (evidence.kind === 'all') === expected;
      return jointlyRequired
        ? [...new Set(children.flat())]
        : [
            `Requires one alternative: ${[...new Set(children.map((messages) => `(${messages.join(' ')})`))].join(' OR ')}`,
          ];
    }
    case 'not':
      return requirementMessages(catalog, evidence.child, !expected);
    case 'routeKeyEquals': {
      const label = catalog.routes.byKey[evidence.expected]?.label ?? evidence.expected;
      return [expected ? `Requires the ${label} route.` : `Unavailable in ${label}.`];
    }
    case 'counterRange':
      return [
        `Requires ${counterLabels[evidence.axis]} ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)}; currently ${evidence.actual}.`,
      ];
    case 'encounterKeyCount': {
      const scope = evidence.scope === 'route' ? 'run' : 'biome';
      const names = encounterNames(catalog, evidence.encounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${names} already occurred this ${scope}.`
          : `Requires ${expected ? '' : 'a count outside '}${rangeLabel(evidence.expected)} occurrences of ${names} this ${scope}; currently ${evidence.actual}.`,
      ];
    }
    case 'previousRoomEncounterKeyCount': {
      const subject = encounterNames(catalog, evidence.matchingEncounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${subject} occurred within the previous ${evidence.roomWindow} rooms.`
          : `Requires ${expected ? '' : 'a count outside '}${rangeLabel(evidence.expected)} matching encounters in the previous ${evidence.roomWindow} rooms; currently ${evidence.actual}.`,
      ];
    }
    case 'currentRoomRewardExcludes': {
      const rewardLabel = (key: string) =>
        key === 'ClockworkGoal' ? 'Clockwork goal' : catalog.rewards.rewardTypes.byKey[key]!.label;
      return [
        expected
          ? `Unavailable with the current room reward: ${rewardLabel(evidence.actual!)}.`
          : `Requires a room reward of ${evidence.rewardTypes.map(rewardLabel).join(' / ')}.`,
      ];
    }
    case 'currentRoomStructuralTagsInclude':
      return [
        `${expected ? 'Requires' : 'Unavailable in'} ${evidence.expected.join(' / ').toLowerCase()} rooms.`,
      ];
  }
}

export function encounterCandidateExplanation(
  catalog: Catalog,
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
        message:
          evaluation.result.evidence.requirement === undefined
            ? 'This encounter phase is not active for the selected room setup.'
            : requirementMessages(catalog, evaluation.result.evidence.requirement).join(' '),
      };
    case 'requirementsExcluded': {
      const messages = evaluation.result.evidence.exclusions.map((exclusion) => {
        if (exclusion.kind === 'gorgonConsumed')
          return 'Athena has already appeared through Gorgon Amulet.';
        if (exclusion.kind === 'resolutionUnavailable')
          return 'The room reward must be authored before this encounter can resolve.';
        const alternatives = [
          ...new Set(
            exclusion.definitions.map((definition) =>
              requirementMessages(catalog, definition.evaluation).join(' '),
            ),
          ),
        ];
        return alternatives.length === 1
          ? alternatives[0]!
          : `Requires one encounter variant: ${alternatives.join(' OR ')}`;
      });
      return {
        kind: 'encounter',
        message: [...new Set(messages)].join(' '),
      };
    }
    case 'supported':
      return undefined;
  }
}

/**
 * Applies encounter-specific player language to the declaration-ordered
 * engine candidate domain. It deliberately does not evaluate requirements or
 * membership: exact support-set evidence was already classified by
 * candidateProjection.
 */
export function projectEncounterPicker(
  catalog: Catalog,
  contextualPicker: ContextualPickerProjectionService,
  choices: readonly EncounterPickerChoice[],
  selectedEncounterKey: string,
  candidates: readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[],
): ContextualPickerModel<string> {
  const labels = new Map(choices.map((choice) => [choice.value, choice.label]));
  const model = contextualPicker.project(
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
      const explanation = encounterCandidateExplanation(catalog, candidate.evaluation);
      return Object.freeze({
        label,
        selected: candidate.value === selectedEncounterKey,
        ...(explanation === undefined ? {} : { explanation }),
      });
    },
    (encounterKey) => encounterKey,
  );
  if (selectedEncounterKey !== 'NemesisRandomEvent' || model.selected?.disabled !== true)
    return model;
  // Reopening this selected branch edits its family; it does not select an
  // unavailable encounter. Keep its invalidity visible without blocking repair.
  const selected = Object.freeze({ ...model.selected, disabled: false });
  return Object.freeze({
    selected,
    sections: Object.freeze(
      model.sections.map((section) =>
        Object.freeze({
          ...section,
          items: Object.freeze(section.items.map((item) => (item.selected ? selected : item))),
        }),
      ),
    ),
  });
}
