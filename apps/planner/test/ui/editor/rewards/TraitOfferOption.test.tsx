// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';

import { TraitOfferOption } from '@planner/ui/editor/rewards/TraitOfferOption';

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

describe('trait rarity presentation', () => {
  it.each([
    'ElementalUnifiedBoon',
    'ElementalRarityUpgradeBoon',
    'ElementalDamageBoon',
    'ElementalOlympianDamageBoon',
    'ElementalBaseDamageBoon',
    'ElementalRallyBoon',
    'ElementalDamageFloorBoon',
    'ElementalDodgeBoon',
    'ElementalDamageCapBoon',
    'ElementalHealthBoon',
  ])('presents %s as Infusion while retaining its concrete offer tier', (traitKey) => {
    render(
      <TraitOfferOption
        {...baseProps}
        traitKey={traitKey}
        fixedRarity="Common"
        effectiveRarity="Common"
      />,
    );
    expect(screen.getByText('Infusion (C)').getAttribute('title')).toBe('Infusion (Common)');
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
      ...(value === 'Common' ? { explanation: 'Below the current rarity floor.' } : {}),
    }));
    render(
      <TraitOfferOption
        {...baseProps}
        traitKey="ElementalRarityUpgradeBoon"
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
      render(
        <TraitOfferOption
          {...baseProps}
          traitKey="ApolloWeaponBoon"
          fixedRarity={rarity}
          effectiveRarity={rarity}
        />,
      );
      expect(screen.getByLabelText('Option 1 fixed rarity').textContent).toBe(`Rarity${rarity}`);
      expect(
        within(screen.getByLabelText('Effective trait values')).getByText(rarity),
      ).toBeTruthy();
    },
  );
});
