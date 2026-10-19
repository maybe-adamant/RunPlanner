import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { beforeAll, describe, expect, it } from 'vitest';

import type { WorkspaceHubSlot } from '@planner/projections/structured-workspace';
import { hubMapReward } from '@planner/ui/editor/biome/hub-map/hubMapReward';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { loadSurfaceNCompleteHubFrontierProject } from '@run-planner/test-fixtures/surface';

let slot: WorkspaceHubSlot;
beforeAll(() => {
  const { workspace } = projectStructuredWorkspaceFixture(loadSurfaceNCompleteHubFrontierProject());
  const hub = workspace.route.biomes
    .find((biome) => biome.biomeKey === 'N')
    ?.nodes.find((node) => node.kind === 'hubDecision');
  const openSlot =
    hub?.kind === 'hubDecision'
      ? hub.slots.find((candidate) => candidate.hubSlotKey === 'combat01')
      : undefined;
  if (openSlot === undefined) throw new Error('Fixture is missing open Combat 01.');
  slot = openSlot;
});

function withReward(
  offer: ResolvedRewardOffer | null,
  summary = 'Projected reward',
): WorkspaceHubSlot {
  const door = slot.door;
  const reward = door?.offerRewardSurface.rewards[0];
  if (door === undefined || reward === undefined) throw new Error('Fixture has no door reward.');
  return {
    ...slot,
    door: {
      ...door,
      offerRewardSurface: {
        visibility: 'visible',
        rewards: [{ ...reward, offer, summary }],
      },
    },
  };
}

describe('Hub map reward presentation', () => {
  it.each([
    'Aphrodite',
    'Apollo',
    'Ares',
    'Demeter',
    'Hephaestus',
    'Hera',
    'Hestia',
    'Poseidon',
    'Zeus',
  ])('maps %s from structured BoonSource identity, independently of its display text', (god) => {
    const reward = hubMapReward(
      withReward({
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: `${god}Upgrade` },
      }),
    );
    expect(decodeURIComponent(reward.icon!)).toMatch(new RegExp(`/${god}\\.webp$`));
    expect(reward.summary).toBe('Projected reward');
  });

  it.each([
    ['HermesUpgrade', 'Hermes'],
    ['MaxHealthDropBig', 'MaxHealthDropBigPreview'],
    ['MaxManaDropBig', 'MaxManaDropBigPreview'],
    ['WeaponUpgrade', 'Hammer'],
    ['SpellDrop', 'SelenesGift'],
  ])('maps the %s Hub reward to its packaged icon', (rewardType, filename) => {
    const reward = hubMapReward(withReward({ rewardType }));
    expect(decodeURIComponent(reward.icon!).endsWith(`/${filename}.webp`)).toBe(true);
  });

  it('retains full projected names and shows no god before one is chosen', () => {
    expect(hubMapReward(slot).summary).toBe('Big Max Health');
    expect(hubMapReward(withReward(null, 'Choose reward'))).toEqual({ summary: 'Choose reward' });
    const unchosen = hubMapReward(withReward({ rewardType: 'Boon' }, 'Choose god'));
    expect(unchosen.summary).toBe('Choose god');
    expect(decodeURIComponent(unchosen.icon!).endsWith('/Boon2.webp')).toBe(true);
    expect(hubMapReward({ ...slot, open: false })).toEqual({ summary: 'Reward unavailable.' });
  });
});
