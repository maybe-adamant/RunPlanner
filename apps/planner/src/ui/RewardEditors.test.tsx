import { catalog } from '@run-planner/catalog';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';

describe('reward editor projections', () => {
  it('renders primitive and payload labels without leaking game source names', () => {
    const markup = renderToStaticMarkup(
      <RewardValueEditor
        catalog={catalog}
        idPrefix="trial"
        onReplace={() => undefined}
        reward={{
          rewardType: 'Devotion',
          payload: { sources: ['ApolloUpgrade', 'ZeusUpgrade'] },
        }}
        rewardTypes={['Devotion']}
      />,
    );

    expect(markup).toContain('Trial');
    expect(markup).toContain('Source 1');
    expect(markup).toContain('>Apollo</option>');
    expect(markup).toContain('>Zeus</option>');
    expect(markup).not.toContain('>ApolloUpgrade</option>');
    expect(markup).not.toContain('>ZeusUpgrade</option>');
  });

  it('renders both declaration-owned reward pools for a multi-store F room', () => {
    const room = catalog.rooms.byKey.F_Combat02;
    if (room?.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat02 counted reward binding is missing');
    }
    const markup = renderToStaticMarkup(
      <CountedRewardEditor
        binding={room.incomingReward}
        catalog={catalog}
        choice={{
          storeKey: room.incomingReward.defaultStoreKey,
          reward: room.incomingReward.defaultReward,
        }}
        idPrefix="combat-02"
        onReplace={() => undefined}
      />,
    );

    expect(markup).toContain('Run Progress');
    expect(markup).toContain('Meta Progress');
  });
});
