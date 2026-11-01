import { describe, expect, it } from 'vitest';
import { roomObjectIcon, wellItemIcon } from '@planner/ui/artwork/roomArtwork';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';

describe('wellItemIcon', () => {
  it("shows a Well item's own art, never its gold reward type", () => {
    expect(wellItemIcon('TemporaryMoveSpeedTrait')).toBe(wellArtwork.TemporaryMoveSpeedTrait);
    expect(wellItemIcon('TemporaryMoveSpeedTrait')).not.toBe(rewardIcon('RoomMoneyDrop'));
  });

  it('falls back to the Well itself for an item without art', () => {
    expect(wellItemIcon('NoSuchWellItem')).toBe(roomObjectIcon('stygianWell'));
    expect(wellItemIcon('NoSuchWellItem')).toBeDefined();
  });
});
