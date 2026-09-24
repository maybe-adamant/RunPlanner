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
import { NavigationStatusMarker } from '@planner/ui/feedback/EvaluationFeedback';

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
      onPointerDown={(event) => {
        // A blank required roll is visually positioned at its minimum.  A
        // pointer click at that exact position produces no change event, but
        // it is still an explicit choice.
        if (value === undefined) pending.current = min;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={commit}
      onLostPointerCapture={commit}
      onBlur={commit}
      onKeyDown={(event) => {
        if (
          value === undefined &&
          ['ArrowLeft', 'ArrowDown', 'Home', 'PageDown'].includes(event.key)
        )
          pending.current = min;
      }}
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
    // Over-requests are legal; the engine reports the effective budget.
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

function ConvertedInput({
  value,
  label,
  onCommit,
}: {
  readonly value: number;
  readonly label: string;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>();
  const commit = () => {
    if (draft === undefined) return;
    // A count above the current source count is authored; the engine reports it.
    const next = draft.trim() === '' ? NaN : Number(draft);
    setDraft(undefined);
    if (Number.isInteger(next) && next >= 0 && next !== value) onCommit(next);
  };
  return (
    <span className="encounter-budget-input">
      <input
        aria-label={label}
        inputMode="numeric"
        type="text"
        value={draft ?? value}
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
    </span>
  );
}

function authored(decision: Decision): AuthoredGeneratedEncounterCustomization {
  return decision.value?.kind === 'generated' ? decision.value : { kind: 'generated' };
}

/** Moves only an explicit prior highlight's own allocation onto an unallocated new highlight. */
function transferHighlightAllocation(
  allocations: Readonly<Record<string, number>>,
  typeKeys: readonly string[],
  previousKey: string | undefined,
  nextKey: string,
): Readonly<Record<string, number>> {
  // A listed type owns its allocation even when it was also the highlight.
  if (
    previousKey === undefined ||
    typeKeys.includes(previousKey) ||
    !Object.hasOwn(allocations, previousKey) ||
    Object.hasOwn(allocations, nextKey)
  )
    return allocations;
  const { [previousKey]: inherited, ...rest } = allocations;
  return { ...rest, [nextKey]: inherited! };
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
    ...(value.menace === undefined ? {} : { menace: value.menace }),
  };
  return waves.length === 0 ? base : { ...base, waves };
}

function withMenace(
  value: AuthoredGeneratedEncounterCustomization,
  waveIndex: number,
  sourceKey: string,
  change: { readonly count: number; readonly targetKey?: string },
): AuthoredGeneratedEncounterCustomization {
  const prior = value.menace?.find((wave) => wave.waveIndex === waveIndex);
  const conversions = { ...(prior?.conversions ?? {}), [sourceKey]: change };
  const menace = [
    ...(value.menace?.filter((wave) => wave.waveIndex !== waveIndex) ?? []),
    { waveIndex, conversions },
  ].sort((left, right) => left.waveIndex - right.waveIndex);
  return { ...value, menace };
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
  const targetProduct = interaction.generatedFangsDraftFor?.(undefined);
  const perkProduct =
    value.fangs === undefined || perkDraft === undefined
      ? undefined
      : interaction.generatedFangsDraftFor?.({ typeKey: value.fangs.typeKey, perkKeys: perkDraft });
  const display =
    value.fangs === undefined
      ? 'Select target'
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
          if (choice.kind === 'type')
            update((current) => ({
              ...current,
              fangs: { typeKey: choice.key, perkKeys: current.fangs?.perkKeys ?? [] },
            }));
        }}
        placeholder="Select target"
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

function GeneratedEncounterWaveDraftPicker({
  interaction,
  hasIssues,
  hasAuthoredEnemies,
  selection,
  update,
  wave,
}: {
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
  readonly hasIssues: boolean;
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
    <div className="encounter-wave-picker" data-has-issues={hasIssues}>
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
            if (choice.kind === 'confirmSeed')
              setDraft({ ...draft, confirmedSeedCount: draft.confirmedSeedCount + 1 });
            else if (choice.kind === 'enemy')
              setDraft({ ...draft, typeKeys: Object.freeze([...draft.typeKeys, choice.key]) });
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
  const [selectedWave, setSelectedWave] = useState(1);
  const [initializationFailure, setInitializationFailure] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  if (decision.value === undefined) {
    return (
      <section className="encounter-generated-customization">
        <div className="encounter-generated-heading">
          <h3>Encounter Composition</h3>
          <span className="encounter-generated-context">{encounterKey}</span>
          <button
            className="secondary-action action-compact encounter-composition-edit"
            disabled={interaction.initializeGenerated === undefined}
            title={
              interaction.initializeGenerated === undefined
                ? 'Complete earlier choices to evaluate this encounter.'
                : undefined
            }
            onClick={() => {
              const initial = interaction.initializeGenerated?.();
              if (initial === undefined) {
                setInitializationFailure(true);
                return;
              }
              setInitializationFailure(false);
              execute(interaction.intentFor(decision.key, initial));
            }}
            type="button"
          >
            Edit
          </button>
        </div>
        <p className="encounter-customization-explanation">
          The game currently controls this encounter’s enemies. Select Edit to customize them.
        </p>
        {initializationFailure ? (
          <p className="encounter-customization-repair">
            This encounter has no complete supported composition in the current context.
          </p>
        ) : interaction.initializeGenerated === undefined ? (
          <p className="encounter-customization-repair">
            Complete earlier choices to evaluate this encounter.
          </p>
        ) : null}
      </section>
    );
  }
  const value = authored(decision);
  const assessment = interaction.generatedAssessment;
  const activeWave =
    assessment?.waves.find((wave) => wave.waveIndex === selectedWave)?.waveIndex ??
    assessment?.waves[0]?.waveIndex;
  const budgets = assessment?.budget;
  const budgetDomain = assessment?.budgetDomain;
  const encounterBudget =
    budgets === undefined
      ? 'Choose a budget'
      : budgets.kind === 'exact'
        ? budgetNumber.format(
            (budgets.waveBudgets as readonly number[]).reduce((sum, budget) => sum + budget, 0),
          )
        : `${budgetNumber.format((budgets.waveBudgets as readonly { min: number; max: number }[]).reduce((sum, budget) => sum + budget.min, 0))}–${budgetNumber.format((budgets.waveBudgets as readonly { min: number; max: number }[]).reduce((sum, budget) => sum + budget.max, 0))}`;
  const waveBudget = (index: number) => {
    const budget = budgets?.waveBudgets[index - 1];
    return budget === undefined
      ? 'Choose a budget'
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
  const groupSize = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.unitGroupSize ??
    decision.selection.fixedEnemies.find((choice) => choice.key === key)?.unitGroupSize;
  const replace = (next: AuthoredGeneratedEncounterCustomization | null) =>
    execute(interaction.intentFor(decision.key, next));
  const update = (
    change: (
      current: AuthoredGeneratedEncounterCustomization,
    ) => AuthoredGeneratedEncounterCustomization,
  ) => replace(change(value));
  const fixedCount = decision.selection.waveCount.min === decision.selection.waveCount.max;
  const retainedWaves = (value.waves ?? []).filter(
    (row) => !assessment?.waves.some((wave) => wave.waveIndex === row.waveIndex),
  );
  return (
    <section className="encounter-generated-customization">
      <div className="encounter-generated-heading">
        <h3>Encounter Composition</h3>
        <span className="encounter-generated-context">{encounterKey}</span>
        <button
          className="secondary-action action-compact"
          type="button"
          aria-expanded={helpOpen}
          aria-controls={`encounter-help-${interaction.key}`}
          onClick={() => setHelpOpen(!helpOpen)}
        >
          Help
        </button>
        <button
          className="danger-action action-compact"
          onClick={() => replace(null)}
          type="button"
        >
          Reset
        </button>
      </div>
      {helpOpen ? (
        <section
          id={`encounter-help-${interaction.key}`}
          className="encounter-composition-help"
          aria-label="Encounter composition help"
        >
          <h4>Waves and enemies</h4>
          <p>
            Choose the number of waves. The shared enemy appears in every wave; each wave’s picker
            selects the remaining enemy types.
          </p>
          <h4>Budgets</h4>
          <p>Allocate a budget to each enemy type. The last type uses what remains.</p>
          <p>
            Counts round up, with at least one of each selected type, so the resulting cost can
            exceed the allocation.
          </p>
          <h4>Fangs</h4>
          <p>Choose one elite enemy type and its perks. This selection applies across all waves.</p>
          <h4>Menace</h4>
          <p>
            Set how many enemies to replace. Some replacement types are fixed; others can be
            selected. For grouped enemies, each conversion replaces one whole group.
          </p>
          <p>
            The table’s counts and costs describe the original enemies. Menace does not recalculate
            them.
          </p>
          <p>
            Replacements do not inherit the original enemy’s Fangs perks. If every instance of the
            Fangs target is replaced, those perks go unused.
          </p>
          <h4>Editing</h4>
          <p>
            Changes apply immediately. Undo reverses edits. Reset removes the customization and
            returns the encounter to game control.
          </p>
        </section>
      ) : null}
      <div className="encounter-summary-controls">
        {budgetDomain === undefined ? (
          <div className="encounter-budget-control">
            <span>Budget</span>
            <span>{encounterBudget}</span>
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
          </div>
        ) : null}
        <div className="encounter-customization-row encounter-waves-control">
          <span>Waves</span>
          <div className="encounter-wave-count" role="radiogroup" aria-label="Waves">
            {[
              ...Array.from(
                { length: decision.selection.waveCount.max - decision.selection.waveCount.min + 1 },
                (_, index) => decision.selection.waveCount.min + index,
              ),
            ].map((count) => (
              <label key={count}>
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
                        ...(current.menace === undefined ? {} : { menace: current.menace }),
                        ...(current.waves === undefined ? {} : { waves: current.waves }),
                      };
                      return { ...base, waveCount: count };
                    })
                  }
                />
                {count}
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
        </div>
        {decision.selection.waveCount.max > 1 || value.highlightKey !== undefined ? (
          <div
            className="encounter-customization-row encounter-shared-enemy"
            title="Only used with multiple waves"
          >
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
                    ...(current.menace === undefined ? {} : { menace: current.menace }),
                    ...(current.waves === undefined
                      ? {}
                      : {
                          waves: current.waves.map((wave) =>
                            wave.allocations === undefined
                              ? wave
                              : {
                                  ...wave,
                                  allocations: transferHighlightAllocation(
                                    wave.allocations,
                                    wave.typeKeys,
                                    current.highlightKey,
                                    highlightKey,
                                  ),
                                },
                          ),
                        }),
                  };
                  return { ...base, highlightKey };
                })
              }
              placeholder="Select shared enemy"
            />
          </div>
        ) : null}
      </div>
      {assessment === undefined ? (
        <p className="encounter-customization-repair">
          Complete earlier choices to evaluate this encounter.
        </p>
      ) : assessment.composition === 'missingWaveCount' ? (
        <p className="encounter-customization-explanation">Choose Waves to customize enemies.</p>
      ) : assessment.composition === 'missingHighlight' ? (
        <p className="encounter-customization-explanation">
          Choose a shared enemy to customize enemies.
        </p>
      ) : (
        <div className="encounter-generated-waves">
          {assessment.warnings.map((warning) => (
            <p className="encounter-composition-warning" key={warning}>
              {warning}
            </p>
          ))}
          <div className="encounter-budget-tabs-header">
            <nav className="run-state-tabs" aria-label="Wave budgets" role="tablist">
              {assessment.waves.map((wave, index) => (
                <button
                  className="run-state-tab"
                  key={wave.waveIndex}
                  id={`wave-budget-tab-${interaction.key}-${wave.waveIndex}`}
                  aria-controls={`wave-budget-panel-${interaction.key}-${wave.waveIndex}`}
                  aria-selected={activeWave === wave.waveIndex}
                  tabIndex={activeWave === wave.waveIndex ? 0 : -1}
                  role="tab"
                  aria-label={`Wave ${wave.waveIndex}${assessment.issues.some((issue) => issue.waveIndex === wave.waveIndex) ? ', needs attention' : ''}`}
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
                  {assessment.issues.some((issue) => issue.waveIndex === wave.waveIndex) ? (
                    <NavigationStatusMarker
                      status={{ tone: 'invalid', label: 'Needs attention' }}
                    />
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
          {assessment.waves
            .filter((wave) => wave.waveIndex === activeWave)
            .map((wave) => {
              const current = value.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
              const selected = current?.typeKeys ?? [];
              const tableKeys = [
                ...wave.seeds.map((seed) => seed.key),
                ...selected.slice(0, wave.additionalTypeCount.max),
              ];
              const allocationsFor = (key: string, position: number) => {
                const enabled = wave.sampledBudgetKeys.includes(key);
                const allocation = current?.allocations?.[key];
                const name = label(key);
                const preview = wave.countPreview?.find((entry) => entry.key === key);
                const effective = preview?.effective;
                const unitCost = cost(key);
                const finalCost =
                  preview?.count === undefined || unitCost === undefined
                    ? 'NA'
                    : budgetNumber.format(preview.count * unitCost);
                if (!enabled)
                  return (
                    <span className="encounter-budget-input encounter-generated-context">
                      <span className="encounter-budget-value">
                        {wave.seeds.some((seed) => seed.key === key && seed.kind === 'fixed')
                          ? 'Fixed'
                          : effective === undefined
                            ? 'NA'
                            : budgetNumber.format(effective)}
                      </span>
                      <span
                        className="encounter-budget-result"
                        title="Resulting cost after rounding and minimum counts."
                      >
                        → {finalCost}
                      </span>
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
                    <span
                      className="encounter-budget-result encounter-generated-context"
                      title="Resulting cost after rounding and minimum counts."
                    >
                      → {finalCost}
                    </span>
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
                  <GeneratedEncounterWaveDraftPicker
                    hasIssues={assessment.issues.some(
                      (issue) => issue.waveIndex === wave.waveIndex && issue.field === 'enemies',
                    )}
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
                            <th
                              scope="col"
                              title="Wave budget / total encounter budget."
                              aria-label={`Wave budget ${waveBudget(wave.waveIndex)} / encounter budget ${encounterBudget}`}
                            >
                              Budget
                              <br />
                              <span className="encounter-wave-budget-ratio">
                                {waveBudget(wave.waveIndex)} / {encounterBudget}
                              </span>
                            </th>
                            {tableKeys.map((key, index) => (
                              <th
                                scope="col"
                                key={`${index}-${key}`}
                                title={
                                  cost(key) === undefined
                                    ? undefined
                                    : `Cost: ${budgetNumber.format(cost(key)!)} per ${groupSize(key) === undefined ? 'enemy' : `group of ${groupSize(key)} enemies`}.`
                                }
                              >
                                {label(key)}
                                {cost(key) === undefined ? null : (
                                  <>
                                    <br /> ({budgetNumber.format(cost(key)!)})
                                  </>
                                )}
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
                            {tableKeys.map((key, index) => {
                              const count = wave.countPreview?.find(
                                (entry) => entry.key === key,
                              )?.count;
                              const size = groupSize(key);
                              return (
                                <td key={`${index}-${key}`}>
                                  {count === undefined ? (
                                    'NA'
                                  ) : size === undefined ? (
                                    count
                                  ) : (
                                    <span
                                      title={`${count} ${count === 1 ? 'group' : 'groups'} · ${count * size} individual enemies.`}
                                    >
                                      {count} ({count * size})
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                          {assessment.menace?.active ? (
                            <>
                              <tr>
                                <th scope="row">
                                  Menace <br />
                                  Target
                                </th>
                                {tableKeys.map((key, index) => {
                                  const cell = wave.menaceCells?.[key];
                                  const currentMenace = value.menace?.find(
                                    (entry) => entry.waveIndex === wave.waveIndex,
                                  )?.conversions[key];
                                  if (cell === undefined)
                                    return <td key={`${index}-${key}`}>NA</td>;
                                  return (
                                    <td key={`${index}-${key}`}>
                                      <div
                                        className="encounter-menace-replacement"
                                        title={cell.replacementLabel}
                                      >
                                        {cell.picker === undefined ? (
                                          <span>{cell.replacementLabel}</span>
                                        ) : (
                                          <ContextualPicker
                                            ariaLabel={`Wave ${wave.waveIndex} ${label(key)} replacement`}
                                            choiceLabel="Menace replacement"
                                            id={`generated-menace-${interaction.key}-${wave.waveIndex}-${key}`}
                                            label="Replacement"
                                            layout="inline"
                                            model={cell.picker}
                                            onSelect={(target) =>
                                              update((state) =>
                                                withMenace(state, wave.waveIndex, key, {
                                                  count: currentMenace?.count ?? 0,
                                                  targetKey: target,
                                                }),
                                              )
                                            }
                                            placeholder="Select replacement"
                                            triggerLabel={cell.replacementLabel}
                                          />
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                              <tr>
                                <th scope="row">
                                  Menace <br />
                                  Count
                                </th>
                                {tableKeys.map((key, index) => {
                                  const cell = wave.menaceCells?.[key];
                                  const currentMenace = value.menace?.find(
                                    (entry) => entry.waveIndex === wave.waveIndex,
                                  )?.conversions[key];
                                  if (cell === undefined)
                                    return <td key={`${index}-${key}`}>NA</td>;
                                  return (
                                    <td key={`${index}-${key}`}>
                                      <ConvertedInput
                                        label={`Wave ${wave.waveIndex} ${label(key)} converted`}
                                        value={currentMenace?.count ?? 0}
                                        onCommit={(count) =>
                                          update((state) =>
                                            withMenace(state, wave.waveIndex, key, {
                                              count,
                                              ...(currentMenace?.targetKey === undefined
                                                ? {}
                                                : { targetKey: currentMenace.targetKey }),
                                            }),
                                          )
                                        }
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            </>
                          ) : null}
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
                                        const allocations = { ...row.allocations };
                                        const removedKey = row.typeKeys.at(-1);
                                        if (removedKey !== undefined)
                                          delete allocations[removedKey];
                                        if (Object.keys(allocations).length)
                                          next.allocations = allocations;
                                        else delete next.allocations;
                                      }
                                      return next;
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
                </section>
              );
            })}
        </div>
      )}
      {assessment?.fangs?.active ? (
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
      {retainedWaves.map((wave) => (
        <section
          className="encounter-customization-group encounter-generated-wave"
          key={wave.waveIndex}
        >
          <h4>Wave {wave.waveIndex}</h4>
          <p className="encounter-generated-context">
            {wave.typeKeys.map(label).join(', ') || 'No additional types'}
          </p>
        </section>
      ))}
      {assessment && assessment.issues.length > 0 ? (
        <section className="encounter-composition-findings" aria-label="Customization findings">
          <h4>Findings</h4>
          {assessment.issues.map((issue, index) => (
            <p className="encounter-customization-repair" key={index}>
              {issue.waveIndex === undefined
                ? issue.field === undefined
                  ? 'Composition'
                  : {
                      baseRoll: 'Budget',
                      waveCount: 'Waves',
                      highlight: 'Shared Enemy',
                      fangs: 'Fangs',
                      enemies: 'Enemies',
                    }[issue.field]
                : `Wave ${issue.waveIndex}`}
              : {issue.message}
            </p>
          ))}
        </section>
      ) : null}
    </section>
  );
}
