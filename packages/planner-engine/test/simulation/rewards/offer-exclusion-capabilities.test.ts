import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { describe, expect, it } from 'vitest';

function session(project = loadSurfaceNOProject()) {
  return createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, authorLegalTraitOffers(project)),
  );
}

describe('reward wheel offer exclusions', () => {
  const id = oOccurrenceIds.combat04;
  const offer1 = createRewardWheelOfferAddress(oBiome, id, 'wheel1', 'offer1');
  const offer2 = createRewardWheelOfferAddress(oBiome, id, 'wheel1', 'offer2');
  const twoOffers = () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: createRewardWheelAddress(oBiome, id, 'wheel1'),
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: offer2,
      value: { rewardType: 'RoomMoneyDrop' },
    });
    return session(project);
  };

  it('names the wheel peer an offer supported alone cannot share the wheel with', () => {
    expect(
      twoOffers().evaluate({
        kind: 'rewardWheelOffer',
        offer: offer2,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toEqual({
      kind: 'rewardWheelOffer',
      result: {
        findings: [],
        supported: false,
        exclusions: [
          {
            kind: 'peerConflict',
            peers: [{ origin: offer1, offer: { rewardType: 'MaxHealthDrop' } }],
            allBranches: true,
          },
        ],
      },
    });
  });

  it("reports the offer's own cause when it fails alone", () => {
    expect(
      twoOffers().evaluate({
        kind: 'rewardWheelOffer',
        offer: offer2,
        value: { rewardType: 'MetaCurrencyDrop' },
      }),
    ).toMatchObject({
      result: {
        supported: false,
        exclusions: [
          {
            kind: 'notInStore',
            rewardType: 'MetaCurrencyDrop',
            storeKey: 'RunProgress',
            allBranches: true,
          },
        ],
      },
    });
  });
});

describe('Shop offer exclusions', () => {
  const shop = (offerKey: string) =>
    createShopOfferAddress(oBiome, createOccurrenceId('surface-o-preboss'), offerKey);

  it('names a slot that does not stock the offer', () => {
    expect(
      session().evaluate({
        kind: 'shopOffer',
        offer: shop('Minor'),
        value: { rewardType: 'Boon' },
      }),
    ).toEqual({
      kind: 'shopOffer',
      result: {
        findings: [],
        supported: false,
        exclusions: [
          { kind: 'notInShop', profileKey: 'WorldShop', slotIndex: 2, allBranches: true },
        ],
      },
    });
  });

  it("names a stocked option's unmet requirement with its evidence", () => {
    expect(
      session().evaluate({
        kind: 'shopOffer',
        offer: shop('Minor'),
        value: { rewardType: 'SpellDrop' },
      }),
    ).toMatchObject({
      result: {
        supported: false,
        exclusions: [
          {
            kind: 'shopOptionRequirement',
            optionKey: 'SpellDrop',
            rewardType: 'SpellDrop',
            evaluation: { kind: 'all', satisfied: false },
            allBranches: true,
          },
        ],
      },
    });
  });

  it('publishes no exclusions for a stocked offer', () => {
    expect(
      session().evaluate({
        kind: 'shopOffer',
        offer: shop('Minor'),
        value: { rewardType: 'TalentDrop' },
      }),
    ).toEqual({ kind: 'shopOffer', result: { findings: [], supported: true } });
  });
});
