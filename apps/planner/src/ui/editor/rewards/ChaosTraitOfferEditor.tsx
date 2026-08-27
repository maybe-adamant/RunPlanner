import type { AuthoredChaosTraitOffer, TraitOptionKey } from '@run-planner/engine/authored-project';
import type { ChaosNumericOperand, TraitRarity } from '@run-planner/engine/catalog-schema';
import type { WorkspaceChaosOfferInteraction } from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function operandDomain(operand: ChaosNumericOperand, rarity: TraitRarity) {
  const domain =
    operand.byRarity?.[
      rarity as Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary'>
    ];
  return domain === undefined
    ? operand
    : {
        ...operand,
        minimum: domain.minimum,
        maximum: domain.maximum,
        step: domain.step,
        authoringDefault: domain.authoringDefault,
        ...(domain.integer === true ? { integer: true as const } : {}),
      };
}

function reconcileValues(
  operands: readonly ChaosNumericOperand[],
  values: Readonly<Record<string, number>>,
  rarity?: TraitRarity,
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      operands.map((operand) => {
        const effective = rarity === undefined ? operand : operandDomain(operand, rarity);
        const value = values[operand.key];
        const steps = value === undefined ? NaN : (value - effective.minimum) / effective.step;
        const legal =
          value !== undefined &&
          Number.isFinite(value) &&
          value >= effective.minimum &&
          value <= effective.maximum &&
          (effective.integer !== true || Number.isInteger(value)) &&
          Math.abs(steps - Math.round(steps)) <= 1e-8;
        return [operand.key, legal ? value : effective.authoringDefault];
      }),
    ),
  );
}

function selectedCurseKey(value: AuthoredChaosTraitOffer): string {
  return value.curseOptions[OPTION_KEYS.indexOf(value.selectedOptionKey)]!.curseKey;
}

function selectablePickerValues<T>(model: ContextualPickerModel<T>): readonly T[] {
  return model.sections.flatMap((section) =>
    section.items.filter((item) => !item.disabled).map((item) => item.value),
  );
}

function resetSelectedDetails(
  value: AuthoredChaosTraitOffer,
  selectedOptionKey: TraitOptionKey,
  interaction: WorkspaceChaosOfferInteraction,
): AuthoredChaosTraitOffer {
  const next = Object.freeze({ ...value, selectedOptionKey });
  const domain = interaction.domainFor(next);
  if (domain === undefined) return next;
  const blessingKeys = selectablePickerValues(domain.blessingPicker);
  const blessingKey = blessingKeys.includes(value.blessingKey)
    ? value.blessingKey
    : blessingKeys[0];
  if (blessingKey === undefined) return next;
  const rarity = domain.rarities.includes(value.rarity) ? value.rarity : domain.rarities[0];
  if (rarity === undefined) return next;
  const blessingOperands = domain.blessingOperands[blessingKey] ?? [];
  return Object.freeze({
    ...next,
    selectedCurseValues: reconcileValues(domain.selectedCurseOperands, value.selectedCurseValues),
    blessingKey,
    rarity,
    blessingValues: reconcileValues(blessingOperands, value.blessingValues, rarity),
  });
}

export function ChaosTraitOfferEditor({
  value,
  interaction,
  onUpdate,
}: {
  readonly value: AuthoredChaosTraitOffer;
  readonly interaction: WorkspaceChaosOfferInteraction;
  readonly onUpdate: (value: AuthoredChaosTraitOffer) => void;
}) {
  const domain = interaction.domainFor(value);
  if (domain === undefined) {
    return <p role="status">Chaos outcome is unavailable at the current route frontier.</p>;
  }
  const updateCurse = (index: number, curseKey: string): void => {
    const options = [...value.curseOptions] as AuthoredChaosTraitOffer['curseOptions'][number][];
    const current = options[index]!;
    const requirement = domain.curseOptions[index]!.requirements[curseKey];
    if (requirement === undefined) return;
    options[index] = Object.freeze({
      ...current,
      curseKey,
      requirementCount: requirement.authoringDefault,
    });
    const next = Object.freeze({
      ...value,
      curseOptions: Object.freeze(options) as AuthoredChaosTraitOffer['curseOptions'],
    });
    onUpdate(
      index === OPTION_KEYS.indexOf(value.selectedOptionKey)
        ? resetSelectedDetails(next, value.selectedOptionKey, interaction)
        : next,
    );
  };
  const updateRequirement = (index: number, requirementCount: number): void => {
    const options = [...value.curseOptions] as AuthoredChaosTraitOffer['curseOptions'][number][];
    options[index] = Object.freeze({ ...options[index]!, requirementCount });
    onUpdate(
      Object.freeze({
        ...value,
        curseOptions: Object.freeze(options) as AuthoredChaosTraitOffer['curseOptions'],
      }),
    );
  };
  const selectOption = (selectedOptionKey: TraitOptionKey): void => {
    if (selectedOptionKey === value.selectedOptionKey) return;
    onUpdate(resetSelectedDetails(value, selectedOptionKey, interaction));
  };
  const selectedOperands = domain.selectedCurseOperands;
  const blessingOperands = domain.blessingOperands[value.blessingKey] ?? [];
  const updateSelectedCurseValue = (operand: ChaosNumericOperand, raw: string): void => {
    onUpdate(
      Object.freeze({
        ...value,
        selectedCurseValues: reconcileValues(selectedOperands, {
          ...value.selectedCurseValues,
          [operand.key]: Number(raw),
        }),
      }),
    );
  };
  const updateBlessingValue = (operand: ChaosNumericOperand, raw: string): void => {
    onUpdate(
      Object.freeze({
        ...value,
        blessingValues: reconcileValues(
          blessingOperands,
          { ...value.blessingValues, [operand.key]: Number(raw) },
          value.rarity,
        ),
      }),
    );
  };
  const changeBlessing = (blessingKey: string): void => {
    const operands = domain.blessingOperands[blessingKey] ?? [];
    const candidate = Object.freeze({ ...value, blessingKey });
    const nextDomain = interaction.domainFor(candidate);
    const rarity = nextDomain?.rarities.includes(value.rarity)
      ? value.rarity
      : (nextDomain?.rarities[0] ?? value.rarity);
    onUpdate(
      Object.freeze({
        ...candidate,
        blessingKey,
        rarity,
        blessingValues: reconcileValues(operands, value.blessingValues, rarity),
      }),
    );
  };
  const changeRarity = (rarity: Exclude<TraitRarity, 'Duo'>): void => {
    onUpdate(
      Object.freeze({
        ...value,
        rarity,
        blessingValues: reconcileValues(blessingOperands, value.blessingValues, rarity),
      }),
    );
  };
  return (
    <div className="chaos-trait-offer-editor">
      <div aria-label="Chaos curse options" className="trait-offer-options" role="group">
        {OPTION_KEYS.map((optionKey, index) => {
          const option = value.curseOptions[index]!;
          const optionDomain = domain.curseOptions[index]!;
          const requirement = optionDomain.requirements[option.curseKey];
          return (
            <div key={optionKey}>
              <fieldset className="trait-offer-option">
                <legend>{`Option ${index + 1}`}</legend>
                <ContextualPicker
                  ariaLabel={`${optionKey} curse`}
                  id={`chaos-${optionKey}-curse`}
                  label="Curse"
                  model={optionDomain.cursePicker}
                  onSelect={(curseKey) => updateCurse(index, curseKey)}
                  placeholder="Choose a curse"
                  triggerLabel={interaction.curseLabel(option.curseKey)}
                />
                <label className="field-control">
                  <span>Requirement</span>
                  <span className="chaos-option-requirement-control">
                    <input
                      aria-label={`${optionKey} requirement`}
                      max={requirement?.maximum}
                      min={requirement?.minimum}
                      onChange={(event) =>
                        updateRequirement(index, Number(event.currentTarget.value))
                      }
                      step={requirement?.step}
                      type="number"
                      value={option.requirementCount}
                    />
                    <span>{requirement?.unit ?? 'requirement'}</span>
                  </span>
                </label>
                <label className="trait-option-selected">
                  <input
                    aria-label={`${optionKey} selected`}
                    checked={value.selectedOptionKey === optionKey}
                    name="chaos-selected-option"
                    onChange={() => selectOption(optionKey)}
                    type="radio"
                  />
                  Selected
                </label>
              </fieldset>
            </div>
          );
        })}
      </div>
      <section aria-label="Selected Chaos outcome" className="trait-selected-outcome">
        <h3>Selected Chaos outcome</h3>
        <p className="trait-selected-outcome-name">
          {`${interaction.curseLabel(selectedCurseKey(value))} → ${interaction.blessingLabel(value.blessingKey)}`}
        </p>
        <div className="chaos-selected-details">
          <div className="trait-selected-outcome-detail">
            <strong>{`Curse · ${interaction.curseLabel(selectedCurseKey(value))}`}</strong>
            {selectedOperands.map((operand) => {
              const current = value.selectedCurseValues[operand.key] ?? operand.authoringDefault;
              return (
                <label className="field-control" key={operand.key}>
                  <span>{operand.label}</span>
                  <input
                    aria-label={operand.label}
                    max={operand.maximum}
                    min={operand.minimum}
                    onChange={(event) =>
                      updateSelectedCurseValue(operand, event.currentTarget.value)
                    }
                    step={operand.step}
                    type="number"
                    value={current}
                  />
                </label>
              );
            })}
          </div>
          <div className="chaos-blessing-row">
            <ContextualPicker
              ariaLabel="Chaos blessing"
              id="chaos-selected-blessing"
              label="Blessing"
              model={domain.blessingPicker}
              onSelect={changeBlessing}
              placeholder="Choose a blessing"
              triggerLabel={interaction.blessingLabel(value.blessingKey)}
            />
            <label className="field-control">
              <span>Rarity</span>
              <select
                aria-label="Chaos blessing rarity"
                onChange={(event) =>
                  changeRarity(event.currentTarget.value as Exclude<TraitRarity, 'Duo'>)
                }
                value={value.rarity}
              >
                {domain.rarities.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>
            {blessingOperands.map((operand) => {
              const effective = operandDomain(operand, value.rarity);
              const current = value.blessingValues[operand.key] ?? effective.authoringDefault;
              return (
                <label className="field-control" key={operand.key}>
                  <span>{effective.label}</span>
                  <input
                    aria-label={effective.label}
                    max={effective.maximum}
                    min={effective.minimum}
                    onChange={(event) => updateBlessingValue(operand, event.currentTarget.value)}
                    step={effective.step}
                    type="number"
                    value={current}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
