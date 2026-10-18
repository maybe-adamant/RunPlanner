import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { countedRewardBinding } from '../../../src/authored-project/room-state/reward-binding';

const incoming = { kind: 'incomingReward' } as const;

describe('counted reward binding', () => {
  it("reads an ordinary room's incoming counted reward", () => {
    const room = catalog.rooms.byKey.F_Combat01!;
    expect(countedRewardBinding(room, 'counted', incoming)).toBe(room.incomingReward);
  });

  it("gives a free Preboss door its takeover's remaining offers", () => {
    const room = catalog.rooms.byKey.F_PreBoss01!;
    const policy = room.prebossBatchPolicy;
    if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted')
      throw new Error('F_PreBoss01 must carry counted remaining offers');
    expect(countedRewardBinding(room, 'freeReward', incoming)).toBe(policy.remainingOffers.reward);
  });

  it('reads the Fields cage and optional reward groups', () => {
    const room = catalog.rooms.byKey.H_Combat01!;
    const cages = room.localChildren.find((child) => child.key === 'cages');
    if (cages?.kind !== 'boundedRewardSlots') throw new Error('H_Combat01 must declare cages');
    const local = (groupKey: string) => ({ kind: 'localReward' as const, groupKey });
    expect(countedRewardBinding(room, 'fieldsCombat', local('cages'))).toBe(cages.reward);
    expect(countedRewardBinding(room, 'fieldsCombat', local('optionalRewards'))).toBe(
      room.fieldsOptionalRewards?.reward,
    );
    expect(countedRewardBinding(room, 'fieldsCombat', local('missing'))).toBeUndefined();
  });
});
