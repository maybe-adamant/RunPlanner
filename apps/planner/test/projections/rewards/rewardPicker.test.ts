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
      const allBranches = !(
        payload?.kind === 'DevotionPair' && payload.chosenSource === 'ApolloUpgrade'
      );
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
              allBranches,
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
    // A reason held only in some branches keeps its scope on the row rule.
    expect(reasonsFor(chosen, 'Apollo')).toEqual([
      'Depending on earlier rolls: Requires a boon from Apollo earlier this run.',
    ]);
    expect(reasonsFor(chosen, 'Zeus')).toEqual(['Requires a boon from a second god this run.']);
    // A specific pair names its own missing god.
    expect(reasonsFor(pickers.project(trialDomain(), 'spurned', selected), 'Hera')).toEqual([
      'Requires a boon from Hera earlier this run.',
    ]);
  });
});
