import { catalog } from '@run-planner/hades2-catalog';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
} from './rewardDomainProjection';

function evaluation(
  offer: ResolvedRewardOffer,
  support: 'impossible' | 'possible',
): ProjectCandidateEvaluation {
  return {
    kind: 'incomingReward',
    result: { supported: support === 'possible', findings: [] },
  };
}

describe('relational reward domain projection', () => {
  it('retains an out-of-store selected type without collapsing its payload repair domain', () => {
    const selected = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    };
    const prepared = prepareRewardDomain(catalog, ['MaxHealthDrop'], selected);

    expect(prepared.types.map((option) => option.key)).toEqual(['MaxHealthDrop', 'Boon']);
    expect(prepared.payload.kind).toBe('oneOf');
    if (prepared.payload.kind !== 'oneOf') {
      throw new Error('Boon did not produce a source domain');
    }
    expect(prepared.payload.sources).toHaveLength(9);
    expect(prepared.payload.sources.find((option) => option.key === 'ZeusUpgrade')?.offer).toEqual(
      selected,
    );
  });

  it('aggregates Devotion chosen sources over every complete supported pair', () => {
    const selected = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'AphroditeUpgrade',
        spurnedSource: 'AresUpgrade',
      },
    };
    const prepared = prepareRewardDomain(catalog, ['Devotion'], selected);
    const offers = rewardDomainOffers(prepared);
    const supportedPair = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    const projected = projectRewardDomain(
      prepared,
      offers.map((offer) => ({
        value: offer,
        evaluation: evaluation(
          offer,
          JSON.stringify(offer) === JSON.stringify(supportedPair) ? 'possible' : 'impossible',
        ),
      })),
    );

    expect(offers).toHaveLength(72);
    expect(prepared.payload.kind).toBe('distinctPair');
    if (prepared.payload.kind !== 'distinctPair' || projected.payload.kind !== 'distinctPair') {
      throw new Error('Devotion did not produce a paired domain');
    }
    expect(
      prepared.payload.chosenSources.find((option) => option.key === 'ApolloUpgrade')?.witnesses,
    ).toHaveLength(8);
    expect(prepared.payload.chosenSources).toHaveLength(9);
    expect(
      prepared.payload.chosenSources.find((option) => option.key === 'AresUpgrade')?.witnesses,
    ).toHaveLength(8);
    expect(projected.types[0]).toMatchObject({ supportingOffer: supportedPair });
    expect(projected.types[0]?.evaluation).toMatchObject({
      kind: 'incomingReward',
      result: { supported: true },
    });
    expect(
      projected.payload.chosenSources.find((option) => option.key === 'ApolloUpgrade'),
    ).toMatchObject({
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'AresUpgrade',
        },
      },
      offerEvaluation: { kind: 'incomingReward', result: { supported: false } },
      supportingOffer: supportedPair,
      evaluation: { kind: 'incomingReward', result: { supported: true } },
    });
    expect(
      projected.payload.chosenSources.find((option) => option.key === 'AphroditeUpgrade'),
    ).toMatchObject({
      offer: selected,
      evaluation: { kind: 'incomingReward', result: { supported: false } },
    });
  });
});
