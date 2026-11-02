// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';

import { TraitOfferOption } from '@planner/ui/editor/rewards/TraitOfferOption';
import { getByHint } from '@planner-test/support/hints';

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

describe('offer line', () => {
  it('shows the offered level and rarity together', () => {
    render(<TraitOfferOption {...baseProps} effectiveLevel={2} effectiveRarity="Rare" />);
    expect(screen.getByLabelText('Final trait values').textContent).toContain('Lvl 2 · Rare');
  });

  it('stays unmounted when no final values are supplied', () => {
    render(<TraitOfferOption {...baseProps} />);
    expect(screen.queryByLabelText('Final trait values')).toBeNull();
  });
});

describe('Rarify', () => {
  const rarifySource = { keepsakeKey: 'RarifyKeepsake', remainingUses: 2 };
  it('offers Rarify where the engine accepts a click', () => {
    render(
      <TraitOfferOption
        {...baseProps}
        onRarify={() => {}}
        rarifiable
        rarifySource={rarifySource}
      />,
    );
    expect(screen.getByRole('button', { name: 'Rarify Option 1' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(screen.queryByRole('button', { name: 'Undo rarify Option 1' })).toBeNull();
  });

  it.each<TraitRarity>(['Duo', 'Legendary'])(
    'shows no Rarify on a %s row the engine does not accept',
    (rarity) => {
      render(
        <TraitOfferOption
          {...baseProps}
          fixedRarity={rarity}
          onRarify={() => {}}
          rarifySource={rarifySource}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Rarify Option 1' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Undo rarify Option 1' })).toBeNull();
    },
  );

  it('keeps an Infusion rarity picker and shows no Rarify', () => {
    render(
      <TraitOfferOption
        {...baseProps}
        infusion
        onRarify={() => {}}
        onSelectRarity={() => {}}
        rarifySource={rarifySource}
        rarityValue="Rare"
      />,
    );
    expect(screen.getByRole('button', { name: 'Option 1 rarity' }).textContent).toContain(
      'Infusion (R)',
    );
    expect(screen.queryByRole('button', { name: 'Rarify Option 1' })).toBeNull();
  });

  it('shows Undo rarify for a row with a click, even with no use left', async () => {
    const onUnrarify = vi.fn();
    render(
      <TraitOfferOption
        {...baseProps}
        onRarify={() => {}}
        onUnrarify={onUnrarify}
        rarified
        rarifySource={{ ...rarifySource, remainingUses: 0 }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Rarify Option 1' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Undo rarify Option 1' }));
    expect(onUnrarify).toHaveBeenCalledTimes(1);
  });

  it("shows a read-only screen's accepted Rarify and its click disabled", () => {
    render(<TraitOfferOption {...baseProps} pickable={false} rarifiable rarified readOnly />);
    expect(screen.getByRole('button', { name: 'Rarify Option 1' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Undo rarify Option 1' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('trait rarity presentation', () => {
  it('presents an infusion while retaining its concrete offer tier', () => {
    render(
      <TraitOfferOption {...baseProps} infusion fixedRarity="Common" effectiveRarity="Common" />,
    );
    expect(getByHint(document.body, 'Infusion (Common)').textContent).toBe('Infusion (C)');
    expect(screen.getByLabelText('Final trait values').textContent).toContain('Infusion');
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
    expect(screen.getByLabelText('Final trait values').textContent).toContain('Infusion');
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
      expect(screen.getByLabelText('Final trait values').textContent).toContain(rarity);
    },
  );
});

describe('a row of a screen rerolled away', () => {
  const rolls = [
    { levelBonus: 0, roll: 0, level: 1 },
    { levelBonus: 1, roll: 2, level: 2 },
  ];

  it('shows its stored Persephone roll, locked until edited, and never a pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = {
      ...baseProps,
      effectiveLevel: 2,
      levelLine: true,
      onPersephoneLevelBonusChange: onChange,
      persephoneAriaLabel: 'Option 1 Persephone roll',
      persephoneLevelBonus: 1,
      persephoneLevelRolls: rolls,
      pickable: false,
      showPersephoneBonus: true,
    };
    const { rerender } = render(<TraitOfferOption {...props} readOnly />);
    const roll = screen.getByRole('button', { name: 'Option 1 Persephone roll' });
    expect(roll.textContent).toContain('+1');
    expect((roll as HTMLButtonElement).disabled).toBe(true);
    const pick = screen.getByRole('radio') as HTMLInputElement;
    expect(pick.disabled && !pick.checked).toBe(true);
    rerender(<TraitOfferOption {...props} pickable />);
    await user.click(screen.getByRole('button', { name: 'Option 1 Persephone roll' }));
    await user.click(screen.getByRole('option', { name: 'Roll 0 · +0' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('shows N/A for an Olympian row whose level is unknown', () => {
    render(
      <TraitOfferOption
        {...baseProps}
        levelLine
        onPersephoneLevelBonusChange={() => {}}
        persephoneAriaLabel="Option 1 Persephone roll"
        pickable={false}
        showPersephoneBonus
      />,
    );
    expect(screen.queryByRole('button', { name: 'Option 1 Persephone roll' })).toBeNull();
    expect(screen.getByText('N/A')).toBeTruthy();
  });
});
