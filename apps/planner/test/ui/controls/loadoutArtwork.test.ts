import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { aspectArtwork } from '@planner/ui/controls/aspects/aspectArtwork';
import { familiarArtwork } from '@planner/ui/controls/familiars/familiarArtwork';

describe('loadout artwork', () => {
  it('has an icon for every catalog familiar and no stale keys', () => {
    expect(Object.keys(familiarArtwork).sort()).toEqual(
      catalog.familiars.values.map((f) => f.key).sort(),
    );
  });

  it('has an icon for every catalog aspect and no stale keys', () => {
    expect(Object.keys(aspectArtwork).sort()).toEqual(
      catalog.aspects.values.map((a) => a.key).sort(),
    );
  });
});
