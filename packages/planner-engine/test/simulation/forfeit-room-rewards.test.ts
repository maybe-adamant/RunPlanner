import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createRouteAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createCompleteFGProject, goldenFStartId } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { simulateProject } from '../../src/simulation';
import { createPreparedProjectCandidateSession } from '../../src/simulation/candidates';
import { simulateProjectAssembly } from '../../src/simulation/project';

const biome = createBiomeAddress('Underworld', 'F');

function simulated(rewardType: 'Boon' | 'HermesUpgrade') {
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BoonSkipShrineUpgrade',
    rank: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, goldenFStartId),
    value:
      rewardType === 'Boon'
        ? { rewardType, payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } }
        : { rewardType },
  });
  if (rewardType === 'HermesUpgrade') {
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(
        biome,
        goldenFStartId,
        roomActionKey({
          kind: 'interactIncomingReward',
          producerPoint: 'roomRewardPickup',
          acquisitionRole: 'source',
        }),
      ),
    });
  }
  const result = simulateProject(catalog, project);
  const f = result.route?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

function rewardsFor(project: ReturnType<typeof createCompleteFGProject>) {
  const result = simulateProject(catalog, project);
  const f = result.route?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

describe('Vow of Forfeit Red Onion substitution', () => {
  it.each(['Boon', 'HermesUpgrade'] as const)(
    'substitutes the first ordinary %s acquisition with a required Red Onion',
    (rewardType) => {
      const rewards = simulated(rewardType);
      const branch = rewards.branches[0];
      if (branch === undefined) throw new Error('expected reward branch');
      expect(branch.arcanaFear.fear.forfeitConsumed).toBe(true);
      expect(branch.events).toContainEqual(
        expect.objectContaining({
          kind: 'rewardForfeited',
          rewardType,
          replacementRewardType: 'RoomRewardConsolationPrize',
        }),
      );
      expect(
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) ===
              semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)) &&
            event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
        ),
      ).toBe(true);
      expect(
        rewards.selectedTraitOffers.some(
          (offer) =>
            semanticAddressKey(offer.address.owner) ===
            semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)),
        ),
      ).toBe(false);
    },
  );

  it('substitutes the picked Thessaly Ship-wheel Boon while keeping its trait child dormant', () => {
    const owner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const value = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(session.evaluate({ kind: 'rewardWheelOffer', offer: owner, value })).toMatchObject({
      kind: 'rewardWheelOffer',
      result: { supported: true, findings: [] },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: owner,
      value,
    });
    const result = simulateProject(catalog, project);
    const o = result.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (o?.authoring !== 'complete') throw new Error('expected complete O simulation');
    const branch = o.rewards.branches[0];
    if (branch === undefined) throw new Error('expected reward branch');

    expect(branch.arcanaFear.fear.forfeitConsumed).toBe(true);
    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardForfeited',
        origin: owner,
        rewardType: 'Boon',
        replacementRewardType: 'RoomRewardConsolationPrize',
      }),
    );
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(owner) &&
          event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
      ),
    ).toBe(true);
    expect(
      o.rewards.selectedTraitOffers.some(
        (offer) => semanticAddressKey(offer.address.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
  });

  it('does not forfeit a qualifying unpicked Ship-wheel preview', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const pickedOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const previewOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer2',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: previewOwner,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const result = simulateProject(catalog, project);
    const o = result.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (o?.authoring !== 'complete') throw new Error('expected complete O simulation');
    const branch = o.rewards.branches[0];
    if (branch === undefined) throw new Error('expected reward branch');

    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        origin: pickedOwner,
        acquisition: expect.objectContaining({
          acquisition: expect.objectContaining({ gameName: 'MaxHealthDrop' }),
        }),
      }),
    );
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'rewardForfeited' &&
          semanticAddressKey(event.origin) === semanticAddressKey(previewOwner),
      ),
    ).toBe(false);
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(previewOwner),
      ),
    ).toBe(false);
  });

  it('keeps the selected door/bag outcome while its invalid dormant child produces no evaluation or finding', () => {
    const owner = createIncomingRewardAddress(biome, goldenFStartId);
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: owner,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(owner, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const withoutForfeit = rewardsFor(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'BoonSkipShrineUpgrade',
        rank: 0,
      }),
    );
    expect(withoutForfeit.findings).toContainEqual(
      expect.objectContaining({
        code: 'missingAttackOrSpecial',
        origin: createTraitOfferAddress(owner, 'source'),
      }),
    );
    const rewards = rewardsFor(project);
    const branch = rewards.branches[0]!;
    expect(branch.bags.RunProgress?.remainingEntryCounts).toBeDefined();
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(owner) &&
          event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
      ),
    ).toBe(true);
    expect(
      rewards.selectedTraitOffers.some(
        (offer) => semanticAddressKey(offer.address.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
    expect(rewards.findings).not.toContainEqual(
      expect.objectContaining({ origin: createTraitOfferAddress(owner, 'source') }),
    );
    expect(
      (branch.traitHistory?.events ?? []).some(
        (event) =>
          'owner' in event && semanticAddressKey(event.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
  });

  it('keeps the unavailable acquisition in the progressive candidate frontier without exposing its dormant trait child', () => {
    const owner = createIncomingRewardAddress(biome, goldenFStartId);
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: owner,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({
        kind: 'traitOffer',
        trait: createTraitOfferAddress(owner, 'source'),
        value: {
          kind: 'traits',
          giverKey: 'Apollo',
          options: [{ traitKey: 'ApolloCastBoon', rarity: 'Common' }],
          selectedOptionKey: 'option1',
        },
      }),
    ).toMatchObject({ kind: 'unavailable' });
  });
});
