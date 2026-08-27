// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredChaosTraitOffer } from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type {
  WorkspaceChaosOfferDomain,
  WorkspaceChaosOfferInteraction,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ChaosTraitOfferEditor } from './ChaosTraitOfferEditor';

function pickerModel(keys: readonly string[], selectedKey: string): ContextualPickerModel<string> {
  const items = keys.map((key) => ({
    key,
    value: key,
    label: key,
    state: 'possible' as const,
    selected: key === selectedKey,
    disabled: false,
  }));
  const selected = items.find((item) => item.selected);
  return {
    ...(selected === undefined ? {} : { selected }),
    sections: [
      { key: 'available', kind: 'category', label: 'Available', collapsible: false, items },
    ],
  };
}

function requirementDomain(
  optionKey: 'option1' | 'option2' | 'option3',
  selectedKey: string,
): WorkspaceChaosOfferDomain['curseOptions'][number] {
  const curseKeys = [
    'ChaosNoMoneyCurse',
    'ChaosHealthCurse',
    'ChaosDamageCurse',
    'ChaosMetaUpgradeCurse',
    'ChaosTimeCurse',
  ];
  return {
    optionKey,
    cursePicker: pickerModel(curseKeys, selectedKey),
    requirements: Object.freeze(
      Object.fromEntries(
        curseKeys.map((curseKey) => {
          const curse = catalog.chaos.curses.byKey[curseKey];
          if (curse === undefined) throw new Error(`Unknown fixture curse ${curseKey}`);
          return [
            curseKey,
            {
              minimum: curse.duration.minimum,
              maximum: curse.duration.maximum,
              step: curse.duration.step,
              authoringDefault: curse.duration.authoringDefault,
              unit: curse.duration.label,
            },
          ];
        }),
      ),
    ),
  };
}

function domainFor(value: AuthoredChaosTraitOffer): WorkspaceChaosOfferDomain {
  const selected =
    value.curseOptions[['option1', 'option2', 'option3'].indexOf(value.selectedOptionKey)]!;
  const curse = catalog.chaos.curses.byKey[selected.curseKey]!;
  const blessing = catalog.chaos.blessings.byKey[value.blessingKey]!;
  const rarities: readonly Exclude<TraitRarity, 'Duo'>[] =
    blessing.fixedRarity === 'Legendary'
      ? ['Legendary']
      : curse.semanticTag === 'Barren'
        ? ['Heroic']
        : ['Common', 'Rare', 'Epic'];
  return {
    curseOptions: [
      requirementDomain('option1', value.curseOptions[0].curseKey),
      requirementDomain('option2', value.curseOptions[1].curseKey),
      requirementDomain('option3', value.curseOptions[2].curseKey),
    ],
    selectedCurseKey: selected.curseKey,
    selectedCurseOperands: curse.operands,
    blessingPicker: pickerModel(
      ['ChaosWeaponBlessing', 'ChaosHealthBlessing', 'ChaosLastStandBlessing'],
      value.blessingKey,
    ),
    rarities,
    blessingOperands: {
      ChaosWeaponBlessing: catalog.chaos.blessings.byKey.ChaosWeaponBlessing!.operands,
      ChaosHealthBlessing: catalog.chaos.blessings.byKey.ChaosHealthBlessing!.operands,
      ChaosLastStandBlessing: catalog.chaos.blessings.byKey.ChaosLastStandBlessing!.operands,
    },
  };
}

function offer(): AuthoredChaosTraitOffer {
  return Object.freeze({
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: Object.freeze([
      { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
      { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
    ]) as AuthoredChaosTraitOffer['curseOptions'],
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.freeze({}),
    blessingKey: 'ChaosWeaponBlessing',
    rarity: 'Common',
    blessingValues: Object.freeze({}),
  });
}

function interaction(): WorkspaceChaosOfferInteraction {
  return {
    blessingLabel: (key) => key,
    curseLabel: (key) => key,
    domainFor,
    startingDraft: offer,
  };
}

describe('ChaosTraitOfferEditor', () => {
  afterEach(cleanup);

  it('starts numeric fields from declaration defaults and keeps option edits isolated', async () => {
    cleanup();
    const user = userEvent.setup();
    let current = offer();
    const view = render(
      <ChaosTraitOfferEditor
        interaction={interaction()}
        onUpdate={() => undefined}
        value={current}
      />,
    );
    const update = (next: AuthoredChaosTraitOffer): void => {
      current = next;
      view.rerender(
        <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
      );
    };
    view.rerender(
      <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
    );

    expect((screen.getByLabelText('Damage bonus') as HTMLInputElement).value).toBe(
      String(catalog.chaos.blessings.byKey.ChaosWeaponBlessing!.operands[0]!.authoringDefault),
    );
    expect(
      screen
        .getByRole('group', { name: 'Chaos curse options' })
        .querySelectorAll('.trait-offer-option'),
    ).toHaveLength(3);
    expect(
      screen
        .getByRole('region', { name: 'Selected Chaos outcome' })
        .classList.contains('trait-selected-outcome'),
    ).toBe(true);
    expect(screen.getAllByText('encounters')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'option3 curse' }));
    await user.click(screen.getByRole('option', { name: 'ChaosTimeCurse' }));
    expect(current.curseOptions[0]?.curseKey).toBe('ChaosNoMoneyCurse');
    expect(current.curseOptions[1]?.curseKey).toBe('ChaosHealthCurse');
    expect(current.curseOptions[2]?.curseKey).toBe('ChaosTimeCurse');
    expect(current.curseOptions[2]?.requirementCount).toBe(
      catalog.chaos.curses.byKey.ChaosTimeCurse!.duration.authoringDefault,
    );
  });

  it('resets selected curse details while retaining a legal blessing identity and rarity', async () => {
    cleanup();
    const user = userEvent.setup();
    const updates: AuthoredChaosTraitOffer[] = [];
    let current: AuthoredChaosTraitOffer = Object.freeze({
      ...offer(),
      blessingValues: Object.freeze({ damageBonus: 0.35 }),
    });
    const view = render(
      <ChaosTraitOfferEditor
        interaction={interaction()}
        onUpdate={() => undefined}
        value={current}
      />,
    );
    const update = (next: AuthoredChaosTraitOffer): void => {
      current = next;
      updates.push(next);
      view.rerender(
        <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
      );
    };
    view.rerender(
      <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
    );

    await user.click(screen.getByRole('radio', { name: 'option2 selected' }));
    expect(current.selectedOptionKey).toBe('option2');
    expect(current.blessingKey).toBe('ChaosWeaponBlessing');
    expect(current.rarity).toBe('Common');
    expect(updates.at(-1)?.selectedCurseValues).toEqual({ healthPenalty: -24 });

    await user.click(screen.getByRole('button', { name: 'Chaos blessing' }));
    await user.click(screen.getByRole('option', { name: 'ChaosLastStandBlessing' }));
    expect(current.blessingKey).toBe('ChaosLastStandBlessing');
    expect(current.rarity).toBe('Legendary');
  });

  it('drops incompatible selected values while retaining legal values across domains and rarities', async () => {
    const user = userEvent.setup();
    const updates: AuthoredChaosTraitOffer[] = [];
    let current: AuthoredChaosTraitOffer = Object.freeze({
      ...offer(),
      curseOptions: Object.freeze([
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 4 },
        { curseKey: 'ChaosHealthCurse', requirementCount: 4 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 4 },
      ]) as AuthoredChaosTraitOffer['curseOptions'],
      selectedCurseValues: Object.freeze({}),
      blessingValues: Object.freeze({ damageBonus: 0.35 }),
    });
    const view = render(
      <ChaosTraitOfferEditor
        interaction={interaction()}
        onUpdate={() => undefined}
        value={current}
      />,
    );
    const update = (next: AuthoredChaosTraitOffer): void => {
      current = next;
      updates.push(next);
      view.rerender(
        <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
      );
    };
    view.rerender(
      <ChaosTraitOfferEditor interaction={interaction()} onUpdate={update} value={current} />,
    );

    await user.click(screen.getByRole('radio', { name: 'option2 selected' }));
    expect(current.selectedCurseValues).toEqual({ healthPenalty: -24 });
    await user.click(screen.getByRole('button', { name: 'option2 curse' }));
    await user.click(screen.getByRole('option', { name: 'ChaosDamageCurse' }));
    expect(current.selectedCurseValues).toEqual({ damageTaken: 0.35 });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Chaos blessing rarity' }),
      'Rare',
    );
    expect(current.blessingValues).toEqual({ damageBonus: 0.35 });
    expect(updates.length).toBeGreaterThan(0);
  });
});
