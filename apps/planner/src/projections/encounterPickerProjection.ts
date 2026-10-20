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

/** The story or field NPC a native encounter presents, when it presents one. */
export function encounterNpcKey(catalog: Catalog, definitionKey: string): string | undefined {
  const definition = catalog.encounterDefinitions.byKey[definitionKey];
  return (
    definition?.npcPresentationKey ??
    (definition?.kind === 'story' ? definition.traitOfferProducer?.giverKey : undefined)
  );
}

export function rangeLabel(range: NumericRange): string {
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

function generatedEnemyNames(catalog: Catalog, keys: readonly string[]): string {
  const labels = new Map<string, string>();
  for (const definition of catalog.encounterDefinitions.values)
    for (const decision of definition.customization ?? [])
      if (decision.selection.kind === 'generated')
        for (const choice of decision.selection.choices) labels.set(choice.key, choice.label);
  return keys.length === 0 ? 'its enemy' : keys.map((key) => labels.get(key) ?? key).join(' / ');
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
    case 'encounterCompletionCount': {
      const names = encounterNames(catalog, evidence.encounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${names} was already completed this run.`
          : expected && evidence.expected.min === 1 && evidence.expected.max === undefined
            ? `Requires ${names} to be completed earlier this run.`
            : `Requires ${expected ? '' : 'a count outside '}${rangeLabel(evidence.expected)} completions of ${names} this run; currently ${evidence.actual}.`,
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

export const inactiveEncounterPhaseMessage =
  'This encounter phase is not active for the selected room setup.';

/** The reasons an encounter cannot occur in its phase, most direct first. */
export function encounterCandidateExplanations(
  catalog: Catalog,
  evaluation: EncounterCandidateProjectionEvaluation,
): readonly { readonly kind: 'encounter'; readonly message: string }[] {
  const reasons = (messages: readonly string[]) =>
    Object.freeze(
      [...new Set(messages)].map((message) => ({ kind: 'encounter' as const, message })),
    );
  switch (evaluation.result.evidence.kind) {
    case 'coverageUnavailable':
      return reasons(['This encounter phase has not been evaluated yet.']);
    case 'inactiveSlot':
      return reasons(
        evaluation.result.evidence.requirement === undefined
          ? [inactiveEncounterPhaseMessage]
          : requirementMessages(catalog, evaluation.result.evidence.requirement),
      );
    case 'requirementsExcluded': {
      const messages = evaluation.result.evidence.exclusions.flatMap((exclusion) => {
        if (exclusion.kind === 'gorgonConsumed')
          return ['Athena has already appeared through Gorgon Amulet.'];
        if (exclusion.kind === 'resolutionUnavailable')
          return ['The room reward must be authored before this encounter can resolve.'];
        if (exclusion.kind === 'introductionUnreachable')
          return [
            `No encounter here can include ${generatedEnemyNames(catalog, exclusion.triggerEnemyKeys)}, so this introduction cannot occur.`,
          ];
        const variants = exclusion.definitions.map((definition) =>
          requirementMessages(catalog, definition.evaluation),
        );
        const alternatives = [...new Set(variants.map((lines) => lines.join(' ')))];
        // One variant's failed conditions are separate reasons; several variants are one choice.
        return alternatives.length === 1
          ? variants[0]!
          : [`Requires one encounter variant: ${alternatives.join(' OR ')}`];
      });
      return reasons(messages);
    }
    case 'supported':
      return [];
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
      // The unassessed section heading already says the phase is not evaluated.
      const explanations =
        candidate.evaluation.result.evidence.kind === 'coverageUnavailable'
          ? []
          : encounterCandidateExplanations(catalog, candidate.evaluation);
      return Object.freeze({
        label,
        selected: candidate.value === selectedEncounterKey,
        ...(explanations.length === 0 ? {} : { explanations }),
      });
    },
    (encounterKey) => encounterKey,
  );
  // Without a reached phase context the members are the declared domain only:
  // list them once, claiming no availability.
  if (
    model.sections.length > 0 &&
    model.sections.every((section) => section.kind === 'unassessed')
  ) {
    const declared = (item: ContextualPickerModel<string>['sections'][number]['items'][number]) =>
      Object.freeze({
        key: item.key,
        value: item.value,
        label: item.label,
        state: item.state,
        selected: item.selected,
        disabled: item.disabled,
      });
    const items = model.sections.flatMap((section) => section.items).map(declared);
    const selected = items.find((item) => item.selected);
    return Object.freeze({
      ...(selected === undefined ? {} : { selected }),
      sections: Object.freeze([
        Object.freeze({
          key: 'unassessed:declared',
          kind: 'unassessed' as const,
          label: 'Declared encounters · evaluated after earlier choices',
          collapsible: false,
          items: Object.freeze(items),
        }),
      ]),
    });
  }
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
