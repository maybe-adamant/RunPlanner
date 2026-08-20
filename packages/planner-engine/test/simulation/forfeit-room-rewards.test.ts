import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createRouteAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { authorRequiredTestRoomActions } from '@run-planner/test-fixtures/shared';
import { createCompleteFGProject, goldenFStartId } from '@run-planner/test-fixtures/underworld';
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
  const result = simulateProject(catalog, authorRequiredTestRoomActions(project, catalog));
  const f = result.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

function rewardsFor(project: ReturnType<typeof createCompleteFGProject>) {
  const result = simulateProject(catalog, authorRequiredTestRoomActions(project, catalog));
  const f = result.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

describe('Vow of Forfeit ordinary room reward veto', () => {
  it.each(['Boon', 'HermesUpgrade'] as const)(
    'vetoes the first ordinary %s acquisition before its trait child',
    (rewardType) => {
      const rewards = simulated(rewardType);
      const branch = rewards.branches[0];
      if (branch === undefined) throw new Error('expected reward branch');
      expect(branch.arcanaFear.fear.forfeitConsumed).toBe(true);
      expect(branch.events).toContainEqual(
        expect.objectContaining({ kind: 'rewardForfeited', rewardType }),
      );
      expect(
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) ===
              semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)),
        ),
      ).toBe(false);
      expect(
        rewards.selectedTraitOffers.some(
          (offer) =>
            semanticAddressKey(offer.address.owner) ===
            semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)),
        ),
      ).toBe(false);
    },
  );

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
          semanticAddressKey(event.origin) === semanticAddressKey(owner),
      ),
    ).toBe(false);
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

  it('keeps the veto in the progressive candidate frontier without exposing its dormant trait child', () => {
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
      simulateProjectAssembly(catalog, authorRequiredTestRoomActions(project, catalog)),
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
