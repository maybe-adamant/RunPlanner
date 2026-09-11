import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('room boon rarity overrides', () => {
  it('declares the audited sparse F-Q Miniboss rarity overrides and no ordinary-room override', () => {
    const expected = {
      F_MiniBoss01: { Rare: 0.9, Epic: 0.07, Legendary: 0.05 },
      F_MiniBoss02: { Rare: 0.9, Epic: 0.07, Legendary: 0.05 },
      F_MiniBoss03: { Rare: 0.9, Epic: 0.07, Legendary: 0.05 },
      G_MiniBoss01: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      G_MiniBoss02: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      G_MiniBoss03: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      H_MiniBoss01: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      H_MiniBoss02: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      I_MiniBoss01: { Rare: 0.9, Epic: 0.1, Duo: 0.2, Legendary: 0.2 },
      I_MiniBoss02: { Rare: 0.9, Epic: 0.1, Duo: 0.2, Legendary: 0.2 },
      N_MiniBoss01: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      N_MiniBoss02: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      O_MiniBoss01: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      O_MiniBoss02: { Rare: 0.9, Epic: 0.1, Legendary: 0.05 },
      P_MiniBoss01: { Rare: 0.9, Epic: 0.1, Duo: 0.2, Legendary: 0.2 },
      P_MiniBoss02: { Rare: 0.9, Epic: 0.1, Duo: 0.2, Legendary: 0.2 },
      Q_MiniBoss02: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
      Q_MiniBoss03: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
      Q_MiniBoss04: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
      Q_MiniBoss05: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
    } as const;
    for (const [gameName, override] of Object.entries(expected))
      expect(catalog.rooms.byKey[gameName]?.boonRarityOverride).toEqual(override);
    for (const gameName of ['F_Combat01', 'I_WorldShop', 'Q_Combat01'])
      expect(catalog.rooms.byKey[gameName]?.boonRarityOverride).toBeUndefined();
  });
});
