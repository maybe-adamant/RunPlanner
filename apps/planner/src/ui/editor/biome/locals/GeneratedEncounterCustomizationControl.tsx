import { useRef, useState } from 'react';
import type { AuthoredGeneratedEncounterCustomization } from '@run-planner/engine/authored-project';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraftChoice,
  WorkspaceGeneratedFangsDraftChoice,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'generated' } }
>;

const budgetNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: false,
});

function EncounterBudgetSlider({
  id,
  min,
  max,
  value,
  onCommit,
}: {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly value: number | undefined;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | undefined>();
  const pending = useRef<number | undefined>(undefined);
  const commit = () => {
    const next = pending.current;
    pending.current = undefined;
    setDraft(undefined);
    if (next !== undefined && next !== value) onCommit(next);
  };
  return (
    <input
      id={id}
      aria-label="Native base roll"
      min={min}
      max={max}
      step={1}
      type="range"
      value={draft ?? value ?? min}
      onChange={(event) => {
        pending.current = event.currentTarget.valueAsNumber;
        setDraft(pending.current);
      }}
      onPointerDown={(event) => event.currentTarget.setPointerCapture?.(event.pointerId)}
      onPointerUp={commit}
      onLostPointerCapture={commit}
      onBlur={commit}
      onKeyUp={(event) => {
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
            'Enter',
          ].includes(event.key)
        )
          commit();
      }}
    />
  );
}

function EnemyBudgetInput({
  value,
  label,
  onCommit,
}: {
  readonly value: number | undefined;
  readonly label: string;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>();
  const commit = () => {
    if (draft === undefined) return;
    const next = draft.trim() === '' ? NaN : Number(draft);
    setDraft(undefined);
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(next);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      type="text"
      value={draft ?? (value === undefined ? '' : budgetNumber.format(value))}
      placeholder="NA"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(undefined);
        }
      }}
    />
  );
}

function authored(decision: Decision): AuthoredGeneratedEncounterCustomization {
  return decision.value?.kind === 'generated' ? decision.value : { kind: 'generated' };
}

function empty(
  value: AuthoredGeneratedEncounterCustomization,
): AuthoredGeneratedEncounterCustomization | null {
  return value.baseRoll === undefined &&
    value.waveCount === undefined &&
    value.highlightKey === undefined &&
    value.fangs === undefined &&
    !value.waves?.length
    ? null
    : value;
}

function replaceMemberAllocation(
  allocations: Readonly<Record<string, number>>,
  previousKey: string | undefined,
  nextKey: string,
) {
  const next = { ...allocations };
  const inherited = previousKey === undefined ? 0 : (next[previousKey] ?? 0);
  if (previousKey !== undefined) delete next[previousKey];
  if (nextKey !== '') next[nextKey] = inherited;
  return next;
}

function withWave(
  value: AuthoredGeneratedEncounterCustomization,
  waveIndex: number,
  change: (
    wave: NonNullable<AuthoredGeneratedEncounterCustomization['waves']>[number],
  ) => NonNullable<AuthoredGeneratedEncounterCustomization['waves']>[number] | undefined,
): AuthoredGeneratedEncounterCustomization {
  const current = value.waves?.find((wave) => wave.waveIndex === waveIndex) ?? {
    waveIndex,
    typeKeys: [],
  };
  const next = change(current);
  const waves = [
    ...(value.waves?.filter((wave) => wave.waveIndex !== waveIndex) ?? []),
    ...(next === undefined ? [] : [next]),
  ].sort((left, right) => left.waveIndex - right.waveIndex);
  const base = {
    kind: 'generated' as const,
    ...(value.baseRoll === undefined ? {} : { baseRoll: value.baseRoll }),
    ...(value.waveCount === undefined ? {} : { waveCount: value.waveCount }),
    ...(value.highlightKey === undefined ? {} : { highlightKey: value.highlightKey }),
    ...(value.fangs === undefined ? {} : { fangs: value.fangs }),
  };
  return waves.length === 0 ? base : { ...base, waves };
}

const emptyDraftPicker: ContextualPickerModel<WorkspaceGeneratedWaveDraftChoice> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyHighlightPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyFangsPicker: ContextualPickerModel<WorkspaceGeneratedFangsDraftChoice> = Object.freeze({
  sections: Object.freeze([]),
});

function GeneratedFangsPicker({
  interaction,
  presentation,
  value,
  update,
}: {
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
  readonly presentation: {
    readonly choices: readonly { readonly key: string; readonly label: string }[];
    readonly perks: Readonly<
      Record<string, { readonly label: string; readonly maxPerRoom?: number }>
    >;
  };
  readonly value: AuthoredGeneratedEncounterCustomization;
  readonly update: (
    change: (
      current: AuthoredGeneratedEncounterCustomization,
    ) => AuthoredGeneratedEncounterCustomization,
  ) => void;
}) {
  const [perkDraft, setPerkDraft] = useState<readonly string[] | undefined>();
  const targetProduct = interaction.generatedFangsDraftFor?.(undefined, true);
  const perkProduct =
    value.fangs === undefined || perkDraft === undefined
      ? undefined
      : interaction.generatedFangsDraftFor?.(
          { typeKey: value.fangs.typeKey, perkKeys: perkDraft },
          false,
        );
  const display =
    value.fangs === undefined
      ? 'Default'
      : (presentation.choices.find((choice) => choice.key === value.fangs!.typeKey)?.label ??
        'Unavailable enemy');
  return (
    <div className="encounter-customization-row encounter-fangs-controls" aria-label="Vow of Fangs">
      <ContextualPicker<WorkspaceGeneratedFangsDraftChoice>
        ariaLabel="Fangs target"
        choiceLabel={targetProduct?.stepLabel ?? 'Fangs target'}
        disabled={interaction.generatedFangsDraftFor === undefined}
        id={`generated-fangs-target-${interaction.key}`}
        label="Fangs target"
        layout="inline"
        model={targetProduct?.picker ?? emptyFangsPicker}
        onSelect={(choice) => {
          if (choice.kind === 'default') {
            update((current) => {
              const next = { ...current };
              delete next.fangs;
              return next;
            });
            setPerkDraft(undefined);
          } else if (choice.kind === 'type')
            update((current) => ({
              ...current,
              fangs: { typeKey: choice.key, perkKeys: current.fangs?.perkKeys ?? [] },
            }));
        }}
        placeholder="Default"
        triggerLabel={display}
      />
      <ContextualPicker<WorkspaceGeneratedFangsDraftChoice>
        ariaLabel="Fangs perks"
        cancelLabel="Cancel"
        choiceLabel={perkProduct?.stepLabel ?? 'Fangs perks'}
        closeOnSelect={false}
        disabled={value.fangs === undefined || interaction.generatedFangsDraftFor === undefined}
        id={`generated-fangs-perks-${interaction.key}`}
        label="Perks"
        layout="inline"
        model={perkProduct?.picker ?? emptyFangsPicker}
        onOpenChange={(open) => setPerkDraft(open ? Object.freeze([]) : undefined)}
        onSelect={(choice) => {
          if (perkDraft === undefined || value.fangs === undefined) return;
          if (choice.kind === 'finish') {
            update((current) => ({
              ...current,
              fangs: { typeKey: value.fangs!.typeKey, perkKeys: perkDraft },
            }));
            setPerkDraft(undefined);
          } else if (choice.kind === 'perkPrefix') setPerkDraft(choice.perkKeys);
          else if (choice.kind === 'perk') setPerkDraft(Object.freeze([...perkDraft, choice.key]));
        }}
        open={perkDraft !== undefined}
        placeholder="Select perks"
        triggerLabel={
          value.fangs === undefined
            ? 'Select target first'
            : value.fangs.perkKeys.length === 0
              ? 'No perks'
              : value.fangs.perkKeys.map((key) => presentation.perks[key]?.label ?? key).join(' · ')
        }
      />
    </div>
  );
}

function replacementWave(
  value: AuthoredGeneratedEncounterCustomization,
  waveIndex: number,
  typeKeys: readonly string[],
  highlightKeys: readonly string[],
  sampledBudgetKeys: readonly string[],
) {
  const previous = value.waves?.find((wave) => wave.waveIndex === waveIndex);
  const previousAllocations = previous?.allocations;
  const members = [...highlightKeys, ...typeKeys];
  if (previousAllocations === undefined) return { waveIndex, typeKeys: [...typeKeys] };
  const previousTypeKeys = previous?.typeKeys ?? [];
  const allocations: Record<string, number> = {};
  for (const key of highlightKeys) {
    const allocation = previousAllocations[key];
    if (Object.hasOwn(previousAllocations, key) && allocation !== undefined)
      allocations[key] = allocation;
  }
  for (const [index, key] of typeKeys.entries()) {
    const previousKey = previousTypeKeys[index];
    const allocation = previousKey === undefined ? undefined : previousAllocations[previousKey];
    if (
      previousKey !== undefined &&
      Object.hasOwn(previousAllocations, previousKey) &&
      allocation !== undefined
    )
      allocations[key] = allocation;
  }
  for (const key of members) if (!sampledBudgetKeys.includes(key)) delete allocations[key];
  return Object.keys(allocations).length === 0
    ? { waveIndex, typeKeys: [...typeKeys] }
    : { waveIndex, typeKeys: [...typeKeys], allocations };
}

function withoutWavesFrom(value: AuthoredGeneratedEncounterCustomization, waveIndex: number) {
  const next = { ...value };
  const waves = value.waves?.filter((entry) => entry.waveIndex < waveIndex);
  if (waves?.length) next.waves = waves;
  else delete next.waves;
  return next;
}

function GeneratedEncounterWaveDraftPicker({
  interaction,
  hasAuthoredEnemies,
  selection,
  update,
  wave,
}: {
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
  readonly hasAuthoredEnemies: boolean;
  readonly selection: readonly {
    readonly key: string;
    readonly label: string;
    readonly kind?: 'fixed' | 'highlight';
  }[];
  readonly update: (
    change: (
      current: AuthoredGeneratedEncounterCustomization,
    ) => AuthoredGeneratedEncounterCustomization,
  ) => void;
  readonly wave: WorkspaceGeneratedEncounterAssessment['waves'][number];
}) {
  const [draft, setDraft] = useState<
    { readonly confirmedSeedCount: number; readonly typeKeys: readonly string[] } | undefined
  >();
  const product =
    draft === undefined
      ? undefined
      : interaction.generatedWaveDraftFor?.(
          wave.waveIndex,
          draft.confirmedSeedCount,
          draft.typeKeys,
        );
  const actionLabel = hasAuthoredEnemies ? 'Edit enemies' : 'Select enemies';
  return (
    <div className="encounter-wave-picker">
      <div className="encounter-generated-wave-heading">
        <ContextualPicker<WorkspaceGeneratedWaveDraftChoice>
          ariaLabel={`Wave ${wave.waveIndex} enemies`}
          cancelLabel="Cancel"
          choiceLabel={product?.stepLabel ?? `Wave ${wave.waveIndex} enemies`}
          closeOnSelect={false}
          disabled={interaction.generatedWaveDraftFor === undefined}
          id={`generated-wave-${interaction.key}-${wave.waveIndex}`}
          label={`Wave ${wave.waveIndex}`}
          layout="inline"
          model={product?.picker ?? emptyDraftPicker}
          onOpenChange={(open) =>
            setDraft(open ? { confirmedSeedCount: 0, typeKeys: Object.freeze([]) } : undefined)
          }
          onSelect={(choice) => {
            if (draft === undefined) return;
            if (choice.kind === 'default') {
              update((current) => withoutWavesFrom(current, wave.waveIndex));
              setDraft(undefined);
              return;
            }
            if (choice.kind === 'finish') {
              update((current) =>
                withWave(current, wave.waveIndex, () =>
                  replacementWave(
                    current,
                    wave.waveIndex,
                    draft.typeKeys,
                    wave.seeds.filter((seed) => seed.kind === 'highlight').map((seed) => seed.key),
                    product!.sampledBudgetKeys,
                  ),
                ),
              );
              setDraft(undefined);
              return;
            }
            setDraft(
              choice.kind === 'confirmSeed'
                ? { ...draft, confirmedSeedCount: draft.confirmedSeedCount + 1 }
                : { ...draft, typeKeys: Object.freeze([...draft.typeKeys, choice.key]) },
            );
          }}
          open={draft !== undefined}
          placeholder={actionLabel}
          triggerLabel={
            selection.length === 0
              ? actionLabel
              : selection.map((member) => member.label).join(' · ')
          }
        />
      </div>
    </div>
  );
}

export function GeneratedEncounterCustomizationControl({
  decision,
  encounterKey,
  interaction,
}: {
  readonly decision: Decision;
  readonly encounterKey: string;
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
}) {
  const execute = useCommandIntent();
  const value = authored(decision);
  const assessment = interaction.generatedAssessment;
  const [selectedWave, setSelectedWave] = useState(1);
  const activeWave =
    assessment?.waves.find((wave) => wave.waveIndex === selectedWave)?.waveIndex ??
    assessment?.waves[0]?.waveIndex;
  const budgets = assessment?.budget;
  const budgetDomain = assessment?.budgetDomain;
  const budgetMinimums =
    budgets?.waveBudgets.map((budget) => (typeof budget === 'number' ? budget : budget.min)) ?? [];
  const totalMinimum = budgetMinimums.reduce((sum, budget) => sum + budget, 0);
  const encounterBudget =
    budgets === undefined
      ? 'Game computed'
      : budgets.kind === 'exact'
        ? budgetNumber.format(
            (budgets.waveBudgets as readonly number[]).reduce((sum, budget) => sum + budget, 0),
          )
        : `${budgetNumber.format((budgets.waveBudgets as readonly { min: number; max: number }[]).reduce((sum, budget) => sum + budget.min, 0))}–${budgetNumber.format((budgets.waveBudgets as readonly { min: number; max: number }[]).reduce((sum, budget) => sum + budget.max, 0))}`;
  const waveBudget = (index: number) => {
    const budget = budgets?.waveBudgets[index - 1];
    return budget === undefined
      ? 'Game computed'
      : typeof budget === 'number'
        ? budgetNumber.format(budget)
        : `${budgetNumber.format(budget.min)}–${budgetNumber.format(budget.max)}`;
  };
  const label = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.label ??
    decision.selection.fixedEnemies.find((choice) => choice.key === key)?.label ??
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable enemy';
  const cost = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.difficultyRating ??
    decision.selection.fixedEnemies.find((choice) => choice.key === key)?.difficultyRating;
  const replace = (next: AuthoredGeneratedEncounterCustomization | null) =>
    execute(interaction.intentFor(decision.key, next));
  const update = (
    change: (
      current: AuthoredGeneratedEncounterCustomization,
    ) => AuthoredGeneratedEncounterCustomization,
  ) => replace(empty(change(value)));
  const resetWavesFrom = (waveIndex: number) =>
    update((current) => withoutWavesFrom(current, waveIndex));
  const lastWave = Math.max(
    0,
    ...(assessment?.waves.map((wave) => wave.waveIndex) ?? []),
    ...(value.waves?.map((wave) => wave.waveIndex) ?? []),
  );
  const fixedCount = decision.selection.waveCount.min === decision.selection.waveCount.max;
  const retainedWaves = (value.waves ?? []).filter(
    (row) => !assessment?.waves.some((wave) => wave.waveIndex === row.waveIndex),
  );
  const fieldIssues = (field: 'baseRoll' | 'waveCount' | 'highlight') =>
    assessment?.issues
      .filter((issue) => issue.field === field)
      .map((issue) => (
        <p className="encounter-customization-repair" key={issue.message}>
          {issue.message}
        </p>
      ));
  return (
    <section className="encounter-generated-customization">
      <div className="encounter-generated-heading">
        <h3>Encounter Composition</h3>
        <span className="encounter-generated-context">{encounterKey}</span>
        <button
          className="danger-action action-compact"
          disabled={decision.value === undefined}
          onClick={() => replace(null)}
          type="button"
        >
          Reset customization
        </button>
      </div>
      <div className="encounter-summary-controls">
        {budgetDomain === undefined ? (
          <div className="encounter-budget-control">
            <span>Budget</span>
            <span>{encounterBudget}</span>
            {value.baseRoll !== undefined ? (
              <button
                className="quiet-action"
                type="button"
                onClick={() =>
                  update((current) => {
                    const next = { ...current };
                    delete next.baseRoll;
                    return next;
                  })
                }
              >
                Default
              </button>
            ) : null}
            {fieldIssues('baseRoll')}
          </div>
        ) : null}
        {budgetDomain !== undefined ? (
          <div className="encounter-budget-control">
            <label htmlFor={`generated-base-roll-${interaction.key}`}>Budget</label>
            <span>{budgetNumber.format(budgetDomain.total.min)}</span>
            <EncounterBudgetSlider
              id={`generated-base-roll-${interaction.key}`}
              min={budgetDomain.baseRoll.min}
              max={budgetDomain.baseRoll.max}
              value={value.baseRoll}
              onCommit={(baseRoll) => update((current) => ({ ...current, baseRoll }))}
            />
            <span>{budgetNumber.format(budgetDomain.total.max)}</span>
            <button
              className="quiet-action"
              disabled={value.baseRoll === undefined}
              onClick={() =>
                update((current) => {
                  const next = { ...current };
                  delete next.baseRoll;
                  return next;
                })
              }
              type="button"
            >
              Default
            </button>
            {fieldIssues('baseRoll')}
          </div>
        ) : null}
        <div className="encounter-customization-row encounter-waves-control">
          <span>Waves</span>
          <div className="encounter-wave-count" role="radiogroup" aria-label="Waves">
            {[
              ...(fixedCount ? [] : [undefined]),
              ...Array.from(
                { length: decision.selection.waveCount.max - decision.selection.waveCount.min + 1 },
                (_, index) => decision.selection.waveCount.min + index,
              ),
            ].map((count) => (
              <label key={count ?? 'default'}>
                <input
                  type="radio"
                  name={`generated-wave-count-${interaction.key}`}
                  checked={
                    (fixedCount
                      ? (value.waveCount ?? decision.selection.waveCount.min)
                      : value.waveCount) === count
                  }
                  onChange={() =>
                    update((current) => {
                      const base = {
                        kind: 'generated' as const,
                        ...(current.baseRoll === undefined ? {} : { baseRoll: current.baseRoll }),
                        ...(current.highlightKey === undefined
                          ? {}
                          : { highlightKey: current.highlightKey }),
                        ...(current.fangs === undefined ? {} : { fangs: current.fangs }),
                        ...(current.waves === undefined ? {} : { waves: current.waves }),
                      };
                      return count === undefined || fixedCount
                        ? base
                        : { ...base, waveCount: count };
                    })
                  }
                />
                {count ?? 'Default'}
              </label>
            ))}
            {value.waveCount !== undefined &&
            (value.waveCount < decision.selection.waveCount.min ||
              value.waveCount > decision.selection.waveCount.max) ? (
              <span className="encounter-customization-repair">
                {value.waveCount} (unavailable)
              </span>
            ) : null}
          </div>
          {fieldIssues('waveCount')}
        </div>
      </div>
      {decision.selection.waveCount.max > 1 || value.highlightKey !== undefined ? (
        <div className="encounter-customization-row" title="Only used with multiple waves">
          <ContextualPicker
            ariaLabel="Shared Enemy"
            choiceLabel="Shared Enemy"
            disabled={interaction.generatedHighlightPicker === undefined}
            id={`generated-highlight-${interaction.key}`}
            label="Shared Enemy"
            layout="inline"
            model={interaction.generatedHighlightPicker ?? emptyHighlightPicker}
            onSelect={(highlightKey) =>
              update((current) => {
                const base = {
                  kind: 'generated' as const,
                  ...(current.baseRoll === undefined ? {} : { baseRoll: current.baseRoll }),
                  ...(current.waveCount === undefined ? {} : { waveCount: current.waveCount }),
                  ...(current.fangs === undefined ? {} : { fangs: current.fangs }),
                  ...(current.waves === undefined
                    ? {}
                    : {
                        waves: current.waves.map((wave) => {
                          if (highlightKey === '' || wave.allocations === undefined) return wave;
                          const retainedHighlightKeys = Object.keys(wave.allocations).filter(
                            (key) => !wave.typeKeys.includes(key),
                          );
                          if (
                            current.highlightKey === undefined &&
                            retainedHighlightKeys.length > 1
                          )
                            return wave;
                          const previousHighlight =
                            current.highlightKey ?? retainedHighlightKeys[0];
                          return {
                            ...wave,
                            allocations: replaceMemberAllocation(
                              wave.allocations,
                              previousHighlight,
                              highlightKey,
                            ),
                          };
                        }),
                      }),
                };
                return highlightKey === '' ? base : { ...base, highlightKey };
              })
            }
            placeholder="Default"
          />
          {fieldIssues('highlight')}
        </div>
      ) : null}
      {assessment === undefined ? (
        <p className="encounter-customization-repair">
          Complete earlier choices to evaluate this encounter.
        </p>
      ) : assessment.composition === 'nativeWaveCount' ? (
        <p className="encounter-customization-explanation">Choose Waves to customize enemies.</p>
      ) : assessment.composition === 'nativeHighlight' ? (
        <p className="encounter-customization-explanation">
          Choose a shared enemy to customize enemies.
        </p>
      ) : (
        <div className="encounter-generated-waves">
          {assessment.waves.map((wave) => {
            const current = value.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
            return (
              <GeneratedEncounterWaveDraftPicker
                key={wave.waveIndex}
                hasAuthoredEnemies={current !== undefined}
                interaction={interaction}
                selection={[
                  ...wave.seeds.map((seed) => ({
                    key: seed.key,
                    label: label(seed.key),
                    kind: seed.kind,
                  })),
                  ...(current?.typeKeys ?? []).map((key) => ({ key, label: label(key) })),
                ]}
                update={update}
                wave={wave}
              />
            );
          })}
          <p className="encounter-budget-note">
            Set the enemy budget for each wave. The last enemy uses what remains. Enemy counts are
            derived from their budget and cost. Costs are shown next to enemy names.
          </p>
          {assessment.fangs !== undefined ? (
            <GeneratedFangsPicker
              interaction={interaction}
              presentation={{
                choices: [...decision.selection.choices, ...decision.selection.fixedEnemies],
                perks: decision.selection.fangs?.perks ?? {},
              }}
              value={value}
              update={update}
            />
          ) : null}
          <div className="encounter-budget-tabs-header">
            <nav className="run-state-tabs" aria-label="Wave budgets" role="tablist">
              {assessment.waves.map((wave, index) => (
                <button
                  key={wave.waveIndex}
                  id={`wave-budget-tab-${interaction.key}-${wave.waveIndex}`}
                  aria-controls={`wave-budget-panel-${interaction.key}-${wave.waveIndex}`}
                  aria-selected={activeWave === wave.waveIndex}
                  tabIndex={activeWave === wave.waveIndex ? 0 : -1}
                  role="tab"
                  type="button"
                  onClick={() => setSelectedWave(wave.waveIndex)}
                  onKeyDown={(event) => {
                    const nextIndex =
                      event.key === 'ArrowRight'
                        ? (index + 1) % assessment.waves.length
                        : event.key === 'ArrowLeft'
                          ? (index + assessment.waves.length - 1) % assessment.waves.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? assessment.waves.length - 1
                              : undefined;
                    if (nextIndex === undefined) return;
                    event.preventDefault();
                    setSelectedWave(assessment.waves[nextIndex]!.waveIndex);
                    const tabs =
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      );
                    tabs?.[nextIndex]?.focus();
                  }}
                >
                  Wave {wave.waveIndex}
                  {assessment.issues.some((issue) => issue.waveIndex === wave.waveIndex)
                    ? ' · Needs attention'
                    : ''}
                </button>
              ))}
            </nav>
          </div>
          {assessment.waves
            .filter((wave) => wave.waveIndex === activeWave)
            .map((wave) => {
              const current = value.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
              const adjusting = current?.allocations !== undefined;
              const automaticBudget =
                wave.equalAllocations !== undefined &&
                Object.keys(wave.equalAllocations).length === 0;
              const selected = current?.typeKeys ?? [];
              const tableKeys = [
                ...wave.seeds.map((seed) => seed.key),
                ...selected.slice(0, wave.additionalTypeCount.max),
              ];
              const allocationsFor = (key: string, position: number) => {
                if (!adjusting && !automaticBudget)
                  return <span className="encounter-generated-context">NA</span>;
                const enabled = wave.sampledBudgetKeys.includes(key);
                const allocation = current?.allocations?.[key];
                const name = label(key);
                const effective = wave.countPreview?.find((entry) => entry.key === key)?.effective;
                if (!enabled)
                  return (
                    <span className="encounter-generated-context">
                      {wave.seeds.some((seed) => seed.key === key && seed.kind === 'fixed')
                        ? 'Fixed'
                        : effective === undefined
                          ? 'NA'
                          : budgetNumber.format(effective)}
                    </span>
                  );
                return (
                  <label className="encounter-budget-input" key={`allocation-${position}`}>
                    <EnemyBudgetInput
                      label={`Wave ${wave.waveIndex} ${name} budget`}
                      onCommit={(next) => {
                        update((state) =>
                          withWave(state, wave.waveIndex, (row) => ({
                            ...row,
                            allocations: { ...row.allocations, [key]: next },
                          })),
                        );
                      }}
                      value={allocation}
                    />
                  </label>
                );
              };
              return (
                <section
                  className="encounter-customization-group encounter-generated-wave"
                  key={wave.waveIndex}
                  role="tabpanel"
                  id={`wave-budget-panel-${interaction.key}-${wave.waveIndex}`}
                  aria-labelledby={`wave-budget-tab-${interaction.key}-${wave.waveIndex}`}
                >
                  <div className="encounter-budget-panel-heading">
                    <p className="encounter-generated-context">
                      {totalMinimum > 0
                        ? `This wave takes ${budgetNumber.format((budgetMinimums[wave.waveIndex - 1]! / totalMinimum) * 100)}% of the encounter and has a budget of ${waveBudget(wave.waveIndex)} / ${encounterBudget}.`
                        : 'The wave budget is game computed.'}
                    </p>
                    <button
                      className={`${adjusting ? 'danger-action' : 'encounter-adjust-budgets'} action-compact`}
                      type="button"
                      disabled={
                        !adjusting && (wave.equalAllocations === undefined || automaticBudget)
                      }
                      title={
                        automaticBudget
                          ? 'This enemy uses the entire remaining wave budget.'
                          : !adjusting && wave.equalAllocations === undefined
                            ? 'Choose the enemies and a definite encounter budget first.'
                            : undefined
                      }
                      onClick={() =>
                        update((state) =>
                          withWave(state, wave.waveIndex, (row) => {
                            const next = { ...row };
                            if (adjusting) delete next.allocations;
                            else if (wave.equalAllocations !== undefined && !automaticBudget)
                              next.allocations = wave.equalAllocations;
                            return next;
                          }),
                        )
                      }
                    >
                      {adjusting ? 'Reset Budgets' : 'Adjust Budgets'}
                    </button>
                  </div>
                  {current === undefined && wave.seeds.length === 0 ? (
                    <p className="encounter-generated-context">
                      Select enemies to edit their budgets.
                    </p>
                  ) : (
                    <div className="encounter-budget-table-scroll">
                      <table
                        className="encounter-budget-table"
                        aria-label={`Wave ${wave.waveIndex} enemy budgets`}
                      >
                        <thead>
                          <tr>
                            <th scope="col" />
                            {tableKeys.map((key, index) => (
                              <th scope="col" key={`${index}-${key}`}>
                                {label(key)}
                                {cost(key) === undefined
                                  ? ''
                                  : ` (${budgetNumber.format(cost(key)!)})`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th scope="row">Budget</th>
                            {tableKeys.map((key, index) => (
                              <td key={`${index}-${key}`}>{allocationsFor(key, index)}</td>
                            ))}
                          </tr>
                          <tr>
                            <th scope="row">Count</th>
                            {tableKeys.map((key, index) => (
                              <td key={`${index}-${key}`}>
                                {adjusting || automaticBudget
                                  ? (wave.countPreview?.find((entry) => entry.key === key)?.count ??
                                    'NA')
                                  : 'NA'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selected.length > wave.additionalTypeCount.max ? (
                    <div className="encounter-generated-retained">
                      <span>Extra enemies</span>
                      <p className="encounter-generated-context">
                        Remove extra enemies from the end.
                      </p>
                      {selected.slice(wave.additionalTypeCount.max).map((key, index) => {
                        const position = wave.additionalTypeCount.max + index;
                        return (
                          <div key={`${position}-${key}`}>
                            <span>
                              Enemy {wave.seeds.length + position + 1}: {label(key)}
                            </span>
                            {position === selected.length - 1 ? (
                              <button
                                aria-label={`Remove Wave ${wave.waveIndex} Enemy ${wave.seeds.length + position + 1}`}
                                className="quiet-action"
                                onClick={() =>
                                  update((state) =>
                                    withWave(state, wave.waveIndex, (row) => {
                                      const typeKeys = row.typeKeys.slice(0, -1);
                                      const next = { ...row, typeKeys };
                                      if (row.allocations !== undefined) {
                                        const allocations = replaceMemberAllocation(
                                          row.allocations,
                                          row.typeKeys.at(-1),
                                          '',
                                        );
                                        if (Object.keys(allocations).length)
                                          next.allocations = allocations;
                                        else delete next.allocations;
                                      }
                                      return typeKeys.length === 0 ? undefined : next;
                                    }),
                                  )
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {assessment.issues
                    .filter((issue) => issue.waveIndex === wave.waveIndex)
                    .map((issue) => (
                      <p className="encounter-customization-repair" key={issue.message}>
                        {issue.message}
                      </p>
                    ))}
                </section>
              );
            })}
        </div>
      )}
      {retainedWaves.map((wave) => (
        <section
          className="encounter-customization-group encounter-generated-wave"
          key={wave.waveIndex}
        >
          <h4>Wave {wave.waveIndex}</h4>
          <p className="encounter-generated-context">
            {wave.typeKeys.map(label).join(', ') || 'No additional types'}
          </p>
          {assessment?.issues
            .filter((issue) => issue.waveIndex === wave.waveIndex)
            .map((issue) => (
              <p className="encounter-customization-repair" key={issue.message}>
                {issue.message}
              </p>
            ))}
          <button
            className="danger-action action-compact"
            type="button"
            onClick={() => resetWavesFrom(wave.waveIndex)}
          >
            Reset Wave {wave.waveIndex}
            {wave.waveIndex < lastWave ? ' onward' : ''}
          </button>
        </section>
      ))}
    </section>
  );
}
