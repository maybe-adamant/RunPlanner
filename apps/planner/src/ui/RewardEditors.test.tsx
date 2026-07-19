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
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        }}
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
        catalog={catalog}
        offer={room.incomingReward.defaultOffersByStore.RunProgress!}
        idPrefix="combat-02"
        onReplace={() => undefined}
      />,
    );

    expect(markup).toContain('Boon');
    expect(markup).not.toContain('Reward pool');
  });
});
