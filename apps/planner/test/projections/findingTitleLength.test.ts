import { catalog } from '@run-planner/hades2-catalog';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { EvaluatedTraitOfferCandidate } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  catalogFindingLabels,
  catalogTraitLabel,
  findingCopy,
  findingTitleLimit,
  presentEncounterCustomizationFinding,
  presentFinding,
  presentTraitCandidateFinding,
  presentTraitOfferGenerationFinding,
  type EncounterCustomizationUnavailableFacts,
  type FindingLabels,
  type TraitOfferGenerationFacts,
} from '@planner/projections/evaluationProjection';
import {
  generatedEnemyLabel,
  type CompositionIssue,
  type RosterIssue,
} from '@planner/projections/encounterIssueCopy';

type CandidateFinding = EvaluatedTraitOfferCandidate['result']['findings'][number];
type GenerationReason = Exclude<NonNullable<CandidateFinding['reason']>, 'nothingLeft'>;
type RarityCause = NonNullable<CandidateFinding['rarityCause']>;

const reasons = [
  'duplicateTrait',
  'traitUnavailable',
  'rarityUnavailable',
  'coreTraitsFirst',
  'screenSize',
  'pairConflict',
  'generic',
] as const satisfies readonly GenerationReason[];
const rarityCauses = [
  'notInTrait',
  'noChance',
  'forcedCommon',
  'devotion',
  'guaranteed',
  'replacement',
] as const satisfies readonly RarityCause[];
const rarities = [
  'Common',
  'Rare',
  'Epic',
  'Heroic',
  'Legendary',
  'Duo',
] as const satisfies readonly TraitRarity[];

// The lists name every member of the engine's unions.
const everyReason: [Exclude<GenerationReason, (typeof reasons)[number]>] extends [never]
  ? true
  : false = true;
const everyCause: [Exclude<RarityCause, (typeof rarityCauses)[number]>] extends [never]
  ? true
  : false = true;
const everyRarity: [Exclude<TraitRarity, (typeof rarities)[number]>] extends [never]
  ? true
  : false = true;

const traitLabel = catalogTraitLabel(catalog);
const [longest, nextLongest] = [...catalog.traits.values]
  .sort((left, right) => right.label.length - left.label.length)
  .map((trait) => trait.key);

function generationFacts(): readonly TraitOfferGenerationFacts[] {
  return reasons.flatMap((reason): TraitOfferGenerationFacts[] => {
    if (reason !== 'rarityUnavailable')
      return [
        { reason },
        { reason, traitKey: longest! },
        { reason, traitKeys: [longest!] },
        { reason, traitKeys: [longest!, nextLongest!] },
      ];
    return rarityCauses.flatMap((rarityCause) =>
      rarities.flatMap((rarity) =>
        rarities.map((requiredRarity) => ({
          reason,
          traitKey: longest!,
          rarity,
          rarityCause,
          requiredRarity,
        })),
      ),
    );
  });
}

describe('finding title length', () => {
  it('keeps every default finding title within the limit', () => {
    const over = Object.entries(findingCopy)
      .filter(([, copy]) => copy.title.length > findingTitleLimit)
      .map(([code]) => code);
    expect(over).toEqual([]);
    for (const code of ['duplicateOfferedTrait', 'screenRerollUnavailable'] as const)
      expect(presentTraitCandidateFinding(code, 'nothingLeft').title.length).toBeLessThanOrEqual(
        findingTitleLimit,
      );
  });

  it('fits an unshowable screen’s title with the longest catalog names', () => {
    expect([everyReason, everyCause, everyRarity]).toEqual([true, true, true]);
    for (const facts of generationFacts()) {
      for (const labels of [traitLabel, undefined]) {
        const { title } = presentTraitOfferGenerationFinding(facts, labels);
        expect(title.length, title).toBeLessThanOrEqual(findingTitleLimit);
      }
    }
  });
});

type CustomizationReason = EncounterCustomizationUnavailableFacts['reason'];
type CompositionReason = CompositionIssue['reason'];
type RequiredField = Extract<CompositionIssue, { reason: 'required' }>['field'];
type FangsIssue = Extract<CompositionIssue, { reason: 'fangs' }>['issue'];
type MenaceIssue = Extract<CompositionIssue, { reason: 'menace' }>['issue'];
type RosterReason = RosterIssue['reason'];

const allowed = { min: 1, max: 4 };
const typeCounts = [
  { actual: 0, allowed },
  { actual: 14, allowed },
  { actual: 13, allowed: { min: 14, max: 14 } },
] as const;
const compositionIssues = {
  required: (['waveCount', 'baseRoll', 'highlight', 'wave', 'allocations'] as const).map(
    (field) => ({ reason: 'required', field, waveIndex: 4 }) as const,
  ),
  baseRoll: [{ reason: 'baseRoll', actual: 1000 }],
  waveCount: [{ reason: 'waveCount', actual: 10, allowed: { min: 10, max: 14 } }],
  highlight: [{ reason: 'highlight', key: 'enemy' }],
  enemyUnavailable: [{ reason: 'enemyUnavailable', waveIndex: 4, position: 14, key: 'enemy' }],
  introductionRequired: [true, false].flatMap((admitted) => [
    { reason: 'introductionRequired', key: 'enemy', introductionEncounterKey: 'i', admitted },
    {
      reason: 'introductionRequired',
      key: 'enemy',
      introductionEncounterKey: 'i',
      admitted,
      waveIndex: 4,
      position: 14,
    },
  ]),
  typeCount: typeCounts.map((count) => ({ reason: 'typeCount', waveIndex: 4, ...count }) as const),
  placeholderCount: [{ reason: 'placeholderCount', waveIndex: 4, actual: 0, allowed: 14 }],
  allocationMembers: [{ reason: 'allocationMembers', waveIndex: 4 }],
  fangs: (['typeUnavailable', 'perkUnavailable', 'incomplete'] as const).map(
    (issue) => ({ reason: 'fangs', issue }) as const,
  ),
  menace: (['countUnavailable', 'targetRequired', 'targetUnavailable'] as const).map(
    (issue) => ({ reason: 'menace', issue, waveIndex: 4, key: 'enemy' }) as const,
  ),
} as const satisfies {
  readonly [Reason in CompositionReason]: readonly Extract<CompositionIssue, { reason: Reason }>[];
};
const rosterIssues = {
  enemyUnavailable: [{ reason: 'enemyUnavailable', position: 14, key: 'enemy' }],
  typeCount: typeCounts.map((count) => ({ reason: 'typeCount', ...count }) as const),
} as const satisfies {
  readonly [Reason in RosterReason]: readonly Extract<RosterIssue, { reason: Reason }>[];
};
const customizationFacts = {
  contextuallyReplaced: [{ reason: 'contextuallyReplaced' }],
  valueNotDeclared: [{ reason: 'valueNotDeclared' }],
  cocoonCountOutOfRange: [
    { reason: 'cocoonCountOutOfRange', count: 100, minimum: 10, maximum: 14 },
    { reason: 'cocoonCountOutOfRange', count: 100, minimum: 14, maximum: 14 },
  ],
  cocoonRewardPointAbsent: [{ reason: 'cocoonRewardPointAbsent', spawnPointId: 1234567 }],
  routeExcluded: [{ reason: 'routeExcluded', choiceKey: 'choice' }],
  compositionInvalid: Object.values(compositionIssues)
    .flat()
    .map((compositionIssue) => ({ reason: 'compositionInvalid', compositionIssue }) as const),
  infiniteRosterInvalid: Object.values(rosterIssues)
    .flat()
    .map((rosterIssue) => ({ reason: 'infiniteRosterInvalid', rosterIssue }) as const),
} as const satisfies {
  readonly [Reason in CustomizationReason]: readonly Extract<
    EncounterCustomizationUnavailableFacts,
    { reason: Reason }
  >[];
};

// The keyed records above name every member of the engine's unions; these name the nested ones.
const everyRequiredField: [
  Exclude<RequiredField, (typeof compositionIssues.required)[number]['field']>,
] extends [never]
  ? true
  : false = true;
const everyFangsIssue: [
  Exclude<FangsIssue, (typeof compositionIssues.fangs)[number]['issue']>,
] extends [never]
  ? true
  : false = true;
const everyMenaceIssue: [
  Exclude<MenaceIssue, (typeof compositionIssues.menace)[number]['issue']>,
] extends [never]
  ? true
  : false = true;

const longestOf = (labels: Iterable<string>) =>
  [...labels].sort((left, right) => right.length - left.length)[0]!;
const definitions = [...catalog.encounterDefinitions.values];
const decisions = definitions.flatMap((definition) => definition.customization ?? []);
const longestNames = {
  encounter: longestOf([
    ...definitions.map((definition) => definition.label),
    ...[...catalog.encounterSets.values].flatMap((set) =>
      set.authoringProfiles.map((profile) => profile.label),
    ),
  ]),
  decision: longestOf(decisions.map((decision) => decision.label)),
  choice: longestOf(
    decisions.flatMap(({ selection }) =>
      selection.kind === 'single' || selection.kind === 'orderedPrefix'
        ? selection.choices.map((choice) => choice.label)
        : [],
    ),
  ),
  enemy: longestOf(
    decisions.flatMap(({ selection }) =>
      selection.kind === 'generated'
        ? [...selection.choices, ...selection.fixedEnemies].map((enemy) =>
            generatedEnemyLabel(enemy.label),
          )
        : selection.kind === 'infiniteRoster'
          ? selection.choices.map((enemy) => generatedEnemyLabel(enemy.label))
          : [],
    ),
  ),
};
const longestLabels: FindingLabels = {
  ...catalogFindingLabels(catalog),
  encounter: () => longestNames.encounter,
  introduction: () => longestNames.encounter,
  enemy: () => longestNames.enemy,
  customizationDecision: () => longestNames.decision,
  customizationChoice: () => longestNames.choice,
};

describe('encounter finding title length', () => {
  it('fits every unavailable customization’s title with the longest catalog names', () => {
    expect([everyRequiredField, everyFangsIssue, everyMenaceIssue]).toEqual([true, true, true]);
    for (const facts of Object.values(customizationFacts).flat())
      for (const labels of [longestLabels, undefined]) {
        const { title } = presentEncounterCustomizationFinding(
          { ...facts, decisionKey: 'decision' },
          labels,
        );
        expect(title.length, title).toBeLessThanOrEqual(findingTitleLimit);
      }
  });

  it('fits an unavailable encounter’s title with the longest catalog name', () => {
    const { title } = presentFinding(
      {
        code: 'encounterUnavailable',
        phase: 'encounterResolution',
        origin: { kind: 'project' },
        evidence: { selectedEncounterKey: 'encounter', candidateEncounterKeys: [] },
      },
      longestLabels,
    );
    expect(title).toBe(`${longestNames.encounter} can't occur here`);
    expect(title.length, title).toBeLessThanOrEqual(findingTitleLimit);
  });
});
