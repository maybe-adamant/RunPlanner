import { catalog } from '@run-planner/hades2-catalog';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { EvaluatedTraitOfferCandidate } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  catalogTraitLabel,
  findingCopy,
  findingTitleLimit,
  presentTraitCandidateFinding,
  presentTraitOfferGenerationFinding,
  type TraitOfferGenerationFacts,
} from '@planner/projections/evaluationProjection';

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
