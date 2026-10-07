import { describe, expect, it } from 'vitest';

import { projectAnvilResultPickers } from '@planner/projections/contextual/anvilResultPickers';

const domain = {
  removedTraitKeys: ['Old'],
  addedTraitKeysFor: (removed: string | null, prior: readonly string[]) =>
    removed === 'Old' ? (prior.length === 0 ? ['First', 'Second'] : ['Second']) : [],
  traitLabel: (traitKey: string) => `Hammer ${traitKey}`,
};

const values = <T>(model: {
  readonly sections: readonly {
    readonly kind: string;
    readonly items: readonly { readonly value: T }[];
  }[];
}) => model.sections.map((section) => [section.kind, section.items.map((item) => item.value)]);

describe('Anvil result pickers', () => {
  it('opens each added domain only after its earlier choices', () => {
    const empty = projectAnvilResultPickers(domain, {
      removedTraitKey: undefined,
      firstAddedTraitKey: undefined,
      secondAddedTraitKey: undefined,
    });
    expect(values(empty.removed)).toEqual([['category', ['Old']]]);
    expect(values(empty.firstAdded)).toEqual([['category', []]]);

    const chosen = projectAnvilResultPickers(domain, {
      removedTraitKey: 'Old',
      firstAddedTraitKey: 'First',
      secondAddedTraitKey: undefined,
    });
    expect(chosen.removed.selected?.label).toBe('Hammer Old');
    expect(values(chosen.firstAdded)).toEqual([['category', ['First', 'Second']]]);
    expect(values(chosen.secondAdded)).toEqual([['category', ['Second']]]);
  });

  it('labels the engine removal of nothing and pins a stale selection', () => {
    const pickers = projectAnvilResultPickers(
      { ...domain, removedTraitKeys: [null] },
      { removedTraitKey: 'Old', firstAddedTraitKey: undefined, secondAddedTraitKey: undefined },
    );
    expect(pickers.removed.sections[0]).toMatchObject({
      kind: 'selectedInvalid',
      items: [{ value: 'Old', disabled: true, status: 'Current · unavailable' }],
    });
    expect(pickers.removed.sections[1]?.items).toMatchObject([
      { value: null, label: 'No removable Hammer' },
    ]);
  });
});
