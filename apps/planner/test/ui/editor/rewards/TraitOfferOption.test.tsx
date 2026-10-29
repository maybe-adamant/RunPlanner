// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';

import { TraitOfferOption } from '@planner/ui/editor/rewards/TraitOfferOption';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

const baseProps = {
  controlId: 'offer-option',
  legend: 'Option 1',
  loading: false,
  onSelectTrait: () => {},
  onSelectedChange: () => {},
  selected: true,
  selectedDisabled: false,
  selectedLabel: 'Pick this trait',
  selectedName: 'selected-trait',
  traitAriaLabel: 'Option 1 trait',
  traitPicker: { sections: [] },
};

describe('effective value list', () => {
  it('mounts placeholders before evaluation supplies effective values', () => {
    render(<TraitOfferOption {...baseProps} showEffectiveValues />);
    const summary = screen.getByLabelText('Effective trait values');
    expect(Array.from(summary.querySelectorAll('dd')).map((cell) => cell.textContent)).toEqual([
      '—',
      '—',
    ]);
  });

  it('stays unmounted when no effective values are supplied or expected', () => {
    render(<TraitOfferOption {...baseProps} />);
    expect(screen.queryByLabelText('Effective trait values')).toBeNull();
  });
});

describe('trait rarity presentation', () => {
  it('presents an infusion while retaining its concrete offer tier', () => {
    render(
      <TraitOfferOption {...baseProps} infusion fixedRarity="Common" effectiveRarity="Common" />,
    );
    expect(hintOf(screen.getByText('Infusion (C)'))).toBe('Infusion (Common)');
    expect(
      within(screen.getByLabelText('Effective trait values')).getByText('Infusion'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Option 1 rarity' })).toBeNull();
  });

  it('keeps an unavailable infusion tier visible and lets the user select a legal tier', async () => {
    const user = userEvent.setup();
    const onSelectRarity = vi.fn();
    const items = (['Common', 'Rare', 'Epic'] as const).map((value) => ({
      key: value,
      value,
      label: value,
      state: value === 'Common' ? ('impossible' as const) : ('possible' as const),
      selected: value === 'Common',
      disabled: value === 'Common',
      ...(value === 'Common' ? { explanations: ['Below the current rarity floor.'] } : {}),
    }));
    render(
      <TraitOfferOption
        {...baseProps}
        infusion
        rarityValue="Common"
        effectiveRarity="Rare"
        onSelectRarity={onSelectRarity}
        rarityPicker={{
          selected: items[0]!,
          sections: [
            { key: 'rarity', kind: 'category', label: 'Rarity', collapsible: false, items },
          ],
        }}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Option 1 rarity' });
    expect(trigger.textContent).toContain('Infusion (C)');
    expect(
      within(screen.getByLabelText('Effective trait values')).getByText('Infusion'),
    ).toBeTruthy();
    await user.click(trigger);
    const common = screen.getByRole('option', { name: 'Infusion (Common)' });
    expect(common.textContent).toContain('Infusion (C)');
    expect(common.getAttribute('aria-disabled')).toBe('true');
    expect(common.textContent).toContain('Below the current rarity floor.');
    expect(screen.getByRole('option', { name: 'Infusion (Epic)' }).textContent).toContain(
      'Infusion (E)',
    );
    await user.click(screen.getByRole('option', { name: 'Infusion (Rare)' }));
    expect(onSelectRarity).toHaveBeenCalledExactlyOnceWith('Rare');
    expect(items.map((item) => item.label)).toEqual(['Common', 'Rare', 'Epic']);
  });

  it.each<TraitRarity>(['Rare', 'Duo', 'Legendary'])(
    'retains %s presentation outside infusions',
    (rarity) => {
      render(<TraitOfferOption {...baseProps} fixedRarity={rarity} effectiveRarity={rarity} />);
      expect(screen.getByLabelText('Option 1 fixed rarity').textContent).toBe(`Rarity${rarity}`);
      expect(
        within(screen.getByLabelText('Effective trait values')).getByText(rarity),
      ).toBeTruthy();
    },
  );
});

describe('a row of a screen rerolled away', () => {
  const rolls = [
    { levelBonus: 0, roll: 0 },
    { levelBonus: 1, roll: 2 },
  ];

  it('shows its stored Persephone roll, disabled until edited, and never a pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = {
      ...baseProps,
      onPersephoneLevelBonusChange: onChange,
      persephoneAriaLabel: 'Option 1 Persephone roll',
      persephoneLevelBonus: 1,
      persephoneLevelRolls: rolls,
      pickable: false,
      showPersephoneBonus: true,
    };
    const { rerender } = render(<TraitOfferOption {...props} readOnly />);
    const roll = screen.getByLabelText('Option 1 Persephone roll') as HTMLSelectElement;
    expect(roll.value).toBe('1');
    expect(roll.disabled).toBe(true);
    const pick = screen.getByRole('radio') as HTMLInputElement;
    expect(pick.disabled && !pick.checked).toBe(true);
    rerender(<TraitOfferOption {...props} />);
    await user.selectOptions(screen.getByLabelText('Option 1 Persephone roll'), '0');
    expect(onChange).toHaveBeenCalledWith(0);
    expect((screen.getByRole('radio') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows a disabled empty Persephone roll when no roll domain is known', () => {
    render(
      <TraitOfferOption
        {...baseProps}
        onPersephoneLevelBonusChange={() => {}}
        persephoneAriaLabel="Option 1 Persephone roll"
        pickable={false}
        showPersephoneBonus
      />,
    );
    const roll = screen.getByLabelText('Option 1 Persephone roll') as HTMLSelectElement;
    expect(roll.disabled).toBe(true);
    expect(roll.textContent).toBe('—');
  });
});
