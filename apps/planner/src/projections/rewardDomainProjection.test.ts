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
  it.each(['Boon', 'BlindBoxLoot'])(
    'keeps %s possible when an acquisition entry has a legal God besides its stale selection',
    (rewardType) => {
      const selected = {
        rewardType,
        payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
      };
      const supported = {
        rewardType,
        payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
      };
      const prepared = prepareRewardDomain(catalog, [rewardType], selected);
      const projected = projectRewardDomain(
        prepared,
        rewardDomainOffers(prepared).map((offer) => ({
          value: offer,
          evaluation: {
            kind: 'acquisitionEntryOffer' as const,
            result: {
              supported: JSON.stringify(offer) === JSON.stringify(supported),
              findings: [],
            },
          },
        })),
      );

      expect(projected.types[0]).toMatchObject({
        supportingOffer: supported,
        evaluation: { kind: 'acquisitionEntryOffer', result: { supported: true } },
      });
      expect(projected.payload.kind).toBe('oneOf');
      if (projected.payload.kind !== 'oneOf') {
        throw new Error(`${rewardType} did not produce a God source domain`);
      }
      expect(
        projected.payload.sources.find((option) => option.key === 'AresUpgrade'),
      ).toMatchObject({
        offer: selected,
        offerEvaluation: {
          kind: 'acquisitionEntryOffer',
          result: { supported: false },
        },
      });
      expect(
        projected.payload.sources.find((option) => option.key === 'ZeusUpgrade'),
      ).toMatchObject({
        offer: supported,
        offerEvaluation: {
          kind: 'acquisitionEntryOffer',
          result: { supported: true },
        },
      });
    },
  );

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

    expect(prepared.payload.kind).toBe('distinctPair');
    if (prepared.payload.kind !== 'distinctPair' || projected.payload.kind !== 'distinctPair') {
      throw new Error('Devotion did not produce a paired domain');
    }
    expect(
      prepared.payload.chosenSources.find((option) => option.key === 'ApolloUpgrade')?.witnesses,
    ).toHaveLength(8);
    expect(prepared.payload.chosenSources).toHaveLength(9);
    expect(prepared.payload.spurnedSources).toHaveLength(8);
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
    expect(
      projected.payload.spurnedSources.find((option) => option.key === 'ZeusUpgrade'),
    ).toMatchObject({
      key: 'ZeusUpgrade',
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
  });
});
