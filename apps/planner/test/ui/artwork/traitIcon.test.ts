import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { arcanaArtwork, arcanaTraitArtwork } from '@planner/ui/controls/arcana-fear/arcanaArtwork';

describe('traitIcon', () => {
  it('maps each Arcana trait to its card art with no stale keys', () => {
    const cards = catalog.arcanaCards.values;
    expect(Object.keys(arcanaTraitArtwork).sort()).toEqual(cards.map((c) => c.traitKey).sort());
    for (const card of cards) expect(traitIcon(card.traitKey)).toBe(arcanaArtwork[card.key]);
  });

  it('shows Champion of Elysium with its reward art and Blessing of Strife with its own', () => {
    expect(traitIcon('InfernalContractBoon')).toBe(rewardIcon('InfernalContractBoon'));
    expect(traitIcon('InfernalContractBoon')).toBeDefined();
    expect(traitIcon('ErisCurseTrait')).toBeDefined();
  });
});
