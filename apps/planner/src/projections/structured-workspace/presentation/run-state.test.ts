import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createExitDecisionAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { presentRunState } from './run-state';

describe('Run State presentation', () => {
  it('joins catalog labels while retaining technical store and reward keys', () => {
    const state = presentRunState(catalog, {
      owner: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: 'x' as never,
      }),
      historySequence: 1,
      checkpoint: 'beforeTargetGeneration',
      godPool: {
        acquiredSourceKeys: ['ApolloUpgrade'],
        effectiveSourceKeys: ['ApolloUpgrade'],
        capNarrowed: true,
      },
      traits: {
        equippedTraits: {
          ApolloWeaponBoon: {
            giverKey: 'Apollo',
            providerKind: 'olympian',
            rarity: 'Rare',
            sourceRole: 'main',
            traitKey: 'ApolloWeaponBoon',
          },
        },
        ordinaryBoonSlots: {},
        elementCounts: { Aether: 0, Air: 0, Earth: 0, Fire: 0, Water: 0 },
        godBoonRarityCounts: {},
        upgradableTraitCount: 1,
        minimumScalableGodTraitRarity: 'Rare',
      },
      counters: {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        routeEncounterDepth: 0,
        roomHistoryOrdinal: 0,
        runDepthCache: 0,
        enteredBiomes: 0,
        upgradableTraitCount: 0,
      },
      bags: [
        {
          storeKey: 'RunProgress',
          remaining: { kind: 'exact', count: 1 },
          entries: [
            {
              rewardType: 'Boon',
              eligibility: 'eligible',
              remaining: { kind: 'exact', count: 1 },
              conditions: [
                {
                  remaining: { kind: 'exact', count: 1 },
                  requirement: { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(state.bags[0]).toMatchObject({ label: 'Major Reward', technicalKey: 'RunProgress' });
    expect(state.bags[0]?.eligible.entries[0]).toMatchObject({
      label: 'Boon',
      technicalKey: 'Boon',
    });
    expect(state.bags[0]?.eligible).toMatchObject({ total: 'x1' });
    expect(state.bags[0]?.eligible.entries[0]?.conditions[0]).toMatchObject({
      technicalKey: 'counterRange',
      explanation: 'Requires biomeDepthCache at least 2.',
    });
    expect(state.godPool).toMatchObject({
      capNarrowed: true,
      effective: [{ key: 'ApolloUpgrade', label: 'Apollo' }],
    });
    expect(state.traits).toMatchObject({
      activeMinimumScalableRarity: 'Rare',
      upgradableCount: 1,
      equipped: [{ traitKey: 'ApolloWeaponBoon', giverKey: 'Apollo', rarity: 'Rare' }],
    });
  });
});
