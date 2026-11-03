import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createContextualOptionResolver } from '@planner/projections/contextual/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextual/contextualPicker';
import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
} from '@planner/projections/rewards/rewardDomainProjection';
import { createRewardPickerProjection } from '@planner/projections/rewards/rewardPicker';

/** Only Zeus is acquired, so every Trial pair still misses at least one god. */
function trialDomain() {
  const prepared = prepareRewardDomain(catalog, ['Devotion']);
  return projectRewardDomain(
    prepared,
    rewardDomainOffers(prepared).map((value) => {
      const payload = value.payload;
      const sources =
        payload?.kind === 'DevotionPair'
          ? [payload.chosenSource, payload.spurnedSource].filter((key) => key !== 'ZeusUpgrade')
          : [];
      const evaluation: ProjectCandidateEvaluation = {
        kind: 'incomingReward',
        result: {
          supported: false,
          findings: [],
          exclusions: [
            {
              kind: 'devotionSourceNotAcquired',
              sources,
              acquiredSources: ['ZeusUpgrade'],
              required: 2,
            },
          ],
        },
      };
      return { value, evaluation };
    }),
  );
}

describe('reward picker projection', () => {
  const pickers = createRewardPickerProjection(
    catalog,
    createContextualPickerProjection(createContextualOptionResolver(catalog)),
  );
  const reasonsFor = (model: ReturnType<typeof pickers.project>, label: string) =>
    model.sections.flatMap((section) => section.items).find((item) => item.label === label)
      ?.explanations;

  it('states the Trial pair rule for a row that stands for many pairs', () => {
    expect(reasonsFor(pickers.project(trialDomain(), 'type'), 'Trial')).toEqual([
      'Requires boons from 2 different gods this run, not counting Ares.',
    ]);
  });

  it('names the chosen god only when that god is the one missing', () => {
    const selected = {
      rewardType: 'Devotion',
      payload: { kind: 'DevotionPair', chosenSource: 'ZeusUpgrade', spurnedSource: 'HeraUpgrade' },
    } as const;
    const chosen = pickers.project(trialDomain(), 'chosen', selected);
    expect(reasonsFor(chosen, 'Apollo')).toEqual(['Requires a boon from Apollo earlier this run.']);
    expect(reasonsFor(chosen, 'Zeus')).toEqual(['Requires a boon from a second god this run.']);
    // A specific pair names its own missing god.
    expect(reasonsFor(pickers.project(trialDomain(), 'spurned', selected), 'Hera')).toEqual([
      'Requires a boon from Hera earlier this run.',
    ]);
  });

  const countsFor = (model: ReturnType<typeof pickers.project>) =>
    Object.fromEntries(
      model.sections.flatMap((section) => section.items).map((item) => [item.label, item.count]),
    );

  it("shows each reward type's entries left in its counted store", () => {
    const counted = (rewardType: string) =>
      rewardType === 'Boon'
        ? { remaining: 3, total: 4 }
        : rewardType === 'MaxHealthDrop'
          ? { remaining: 0, total: 2 }
          : undefined;
    const domain = (kind: 'incomingReward' | 'shopOffer') => {
      const prepared = prepareRewardDomain(catalog, ['Boon', 'MaxHealthDrop']);
      return projectRewardDomain(
        prepared,
        rewardDomainOffers(prepared).map((value) => {
          const countedStore = kind === 'shopOffer' ? undefined : counted(value.rewardType);
          const evaluation: ProjectCandidateEvaluation = {
            kind,
            result: {
              supported: value.rewardType === 'Boon',
              findings: [],
              ...(countedStore === undefined ? {} : { countedStore }),
            },
          };
          return { value, evaluation };
        }),
      );
    };
    expect(countsFor(pickers.project(domain('incomingReward'), 'type'))).toEqual({
      Boon: '3/4',
      'Max Health': '0/2',
    });
    // The god step and a source without a counted store show none.
    const boon = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    } as const;
    const gods = Object.values(
      countsFor(pickers.project(domain('incomingReward'), 'source', boon)),
    );
    expect(gods.length).toBeGreaterThan(0);
    expect(gods.every((count) => count === undefined)).toBe(true);
    expect(countsFor(pickers.project(domain('shopOffer'), 'type'))).toEqual({
      Boon: undefined,
      'Max Health': undefined,
    });
  });
});
