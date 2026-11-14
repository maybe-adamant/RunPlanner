import { describe, expect, it } from 'vitest';

import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import underworldFghFixture from './fixtures/underworld-fgh.execution.json';
import { overview } from '../../src/execution-plan/codec/overview';

const decode = (fields: Record<string, unknown>) =>
  overview({ encounterPhases: [], requiredObjects: [], ...fields }, 'overview');

const initialWell = [
  { generationKey: 'initial:healing', offerKey: 'HealDropRange' },
  { generationKey: 'initial:secondLeft', offerKey: 'LastStandShopItem' },
  { generationKey: 'initial:secondRight', offerKey: 'RandomStoreItem' },
];

// The codec refuses, by field, every position and stock slot the Lua decoder requires.
describe('execution codec required positions and stock', () => {
  it('requires each anchor object to name its anchor', () => {
    expect(decode({ purgingPool: { traits: [], anchorId: 1 } }).purgingPool?.anchorId).toBe(1);
    expect(() => decode({ purgingPool: { traits: [] } })).toThrow(
      'overview.purgingPool.anchorId is required',
    );
    expect(() => decode({ stygianWell: { offers: initialWell } })).toThrow(
      'overview.stygianWell.anchorId is required',
    );
    expect(() =>
      decode({ challengeSwitch: { variantKey: 'Switch', encounterKey: 'Encounter' } }),
    ).toThrow('overview.challengeSwitch.anchorId is required');
  });

  it("requires the Well's initial roll to stock all three slots", () => {
    expect(() => decode({ stygianWell: { anchorId: 1, offers: initialWell.slice(0, 2) } })).toThrow(
      'must stock the healing, secondLeft and secondRight slots',
    );
  });

  it("requires a Fields optional reward's point", () => {
    expect(() =>
      decode({
        fields: {
          cagePoints: [],
          optionalRewards: [
            {
              slotKey: 'optional1',
              reward: {
                rewardType: 'MaxManaDropSmall',
                producerLifecycleKey: 'RoomReward',
                resolvedStoreKey: 'FieldsOptionalRewards',
              },
            },
          ],
        },
      }),
    ).toThrow('optionalRewards[0].pointId');
  });

  it('requires a point for every active cage and a Nemesis point exactly with a Nemesis', () => {
    // A decoded plan's checks run before its fingerprint, so an edited copy reports by field.
    const edited = (edit: (fields: Record<string, unknown>) => void) => {
      const plan = structuredClone(underworldFghFixture) as {
        occurrences: { id: string; overview: { fields?: Record<string, unknown> } }[];
      };
      edit(plan.occurrences.find((room) => room.id === 'golden-h-combat02')!.overview.fields!);
      return () => decodeExecutionPlan(plan);
    };
    expect(
      edited((fields) => {
        fields.cagePoints = (fields.cagePoints as unknown[]).slice(0, 1);
      }),
    ).toThrow('cagePoints must use canonical ordered cage slots');
    expect(
      edited((fields) => {
        fields.nemesisPointId = 7;
      }),
    ).toThrow('nemesisPointId requires a NemesisRandomEvent phase');
  });
});
