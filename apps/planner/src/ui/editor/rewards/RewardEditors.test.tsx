import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  type ProjectCandidateEvaluation,
  type ProjectCandidateQuery,
} from '@run-planner/engine/simulation';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  CandidateOptionProjection,
  CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';

const biome = createBiomeAddress('Underworld', 'F');
const reward = createIncomingRewardAddress(biome, createOccurrenceId('reward-editor'));
const project = createProjectDocument(catalog, {
  projectId: 'reward-editor',
  name: 'Reward editor',
  configuredBiomeCounts: { Underworld: 1 },
});

function unavailable(query: ProjectCandidateQuery): ProjectCandidateEvaluation {
  return {
    context: 'unavailable',
    query,
    reason: 'upstreamIncomplete',
    evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
  };
}

function projected<T>(
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
): readonly CandidateOptionProjection<T>[] {
  return values.map((value, index) => ({ value, evaluation: unavailable(queries[index]!) }));
}

const candidateProjection: CandidateProjectionService = {
  biomeFields: (_project, owner, values) =>
    projected(
      values,
      values.map((value) => ({ kind: 'biomeField', field: owner, value })),
    ),
  startRooms: (_project, owner, rooms) =>
    projected(
      rooms,
      rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
    ),
  roomTargets: (_project, target, rooms) =>
    projected(
      rooms,
      rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
    ),
  batchRewardStores: (_project, rewardStore, storeKeys) =>
    projected(
      storeKeys,
      storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
    ),
  incomingRewards: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'incomingReward', reward: owner, value })),
    ),
  localRewards: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'localReward', reward: owner, value })),
    ),
  fieldsCageOutcomes: (_project, continuation, outcomes) =>
    projected(
      outcomes,
      outcomes.map((cageOutcome) => ({
        kind: 'fieldsCageOutcome',
        continuation,
        cageOutcome,
      })),
    ),
  shipEncounterCounts: (_project, occurrence, values) =>
    projected(
      values,
      values.map((encounterCount) => ({
        kind: 'shipEncounterCount',
        occurrence,
        encounterCount,
      })),
    ),
  rewardWheelOfferCounts: (_project, wheel, values) =>
    projected(
      values,
      values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
    ),
  rewardWheelStores: (_project, wheel, storeKeys) =>
    projected(
      storeKeys,
      storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
    ),
  rewardWheelOffers: (_project, offer, values) =>
    projected(
      values,
      values.map((value) => ({ kind: 'rewardWheelOffer', offer, value })),
    ),
  rewardWheelPicks: (_project, wheel, values) =>
    projected(
      values,
      values.map((pickedOfferIndex) => ({ kind: 'rewardWheelPicked', wheel, pickedOfferIndex })),
    ),
  hubSlots: (_project, slot, occurrenceId, values) =>
    projected(
      values,
      values.map((open) => ({ kind: 'hubSlot', slot, open, occurrenceId })),
    ),
  hubVisits: (_project, visit, hubSlotKeys) =>
    projected(
      hubSlotKeys,
      hubSlotKeys.map((hubSlotKey) => ({ kind: 'hubVisit', visit, hubSlotKey })),
    ),
  sideRoomGenerations: (_project, sideRoom, values) =>
    projected(
      values,
      values.map((generation) => ({ kind: 'sideRoomGeneration', sideRoom, generation })),
    ),
  sideRoomEntryOrders: (_project, group, values) =>
    projected(
      values,
      values.map((enteredSlotKeys) => ({ kind: 'sideRoomEntryOrder', group, enteredSlotKeys })),
    ),
  shopOffers: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'shopOffer', offer: owner, value })),
    ),
  shopPurchases: (_project, owner, values) =>
    projected(
      values,
      values.map((purchased) => ({ kind: 'shopPurchase', purchase: owner, purchased })),
    ),
};

describe('reward editor projections', () => {
  it('renders primitive and payload labels without leaking game source names', () => {
    const markup = renderToStaticMarkup(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={candidateProjection}
        catalog={catalog}
        idPrefix="trial"
        onReplace={() => undefined}
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        }}
        project={project}
        rewardTypes={['Devotion']}
      />,
    );

    expect(markup).toContain('Trial');
    expect(markup).toContain('Chosen source');
    expect(markup).toContain('>Apollo</option>');
    expect(markup).toContain('>Zeus</option>');
    expect(markup).not.toContain('>ApolloUpgrade</option>');
    expect(markup).not.toContain('>ZeusUpgrade</option>');
  });

  it('renders the static producer reward union without leaf store ownership', () => {
    const room = catalog.rooms.byKey.F_Combat02;
    if (room?.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat02 counted reward binding is missing');
    }
    const markup = renderToStaticMarkup(
      <CountedRewardEditor
        binding={room.incomingReward}
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={candidateProjection}
        catalog={catalog}
        offer={room.incomingReward.defaultOffersByStore.RunProgress!}
        idPrefix="combat-02"
        onReplace={() => undefined}
        project={project}
      />,
    );

    expect(markup).toContain('Boon');
    expect(markup).not.toContain('Reward pool');
  });
});
