import * as Popover from '@radix-ui/react-popover';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { AuthoredGeneratedEncounterCustomization } from '@run-planner/engine/authored-project';
import { EditorDialogTitleAction } from '@planner/ui/controls/EditorDialog';
import type {
  WorkspaceEncounterComposition,
  WorkspaceEncounterCustomizationDraft,
  WorkspaceEncounterPhase,
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraftChoice,
  WorkspaceGeneratedFangsDraftChoice,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { NavigationStatusMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { hintProps } from '@planner/ui/controls/hint';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { enemyIcon, fangsPerkIcon } from '@planner/ui/artwork/encounterArtwork';

type GeneratedEdits = NonNullable<WorkspaceEncounterCustomizationDraft['generatedEdits']>;
type GeneratedEdit = (
  build: (edits: GeneratedEdits) => AuthoredGeneratedEncounterCustomization,
) => void;

/** Writes one bound generated-composition edit into the dialog draft when the draft publishes them. */
function generatedEdit(
  draft: WorkspaceEncounterCustomizationDraft | undefined,
  onValue: (value: AuthoredGeneratedEncounterCustomization | undefined) => void,
): GeneratedEdit {
  return (build) => {
    if (draft?.generatedEdits !== undefined) onValue(build(draft.generatedEdits));
  };
}

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'generated' } }
>;

const budgetNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: false,
});

function EncounterBudgetSlider({
  hasIssues,
  id,
  min,
  max,
  value,
  onCommit,
}: {
  readonly hasIssues: boolean | undefined;
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
      data-has-issues={hasIssues}
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
      autoComplete="off"
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
        autoComplete="off"
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
  draft,
  edit,
  idKey,
  presentation,
  value,
}: {
  readonly draft: WorkspaceEncounterCustomizationDraft;
  readonly edit: GeneratedEdit;
  readonly idKey: string;
  readonly presentation: {
    readonly choices: readonly { readonly key: string; readonly label: string }[];
    readonly perks: Readonly<
      Record<string, { readonly label: string; readonly maxPerRoom?: number }>
    >;
  };
  readonly value: AuthoredGeneratedEncounterCustomization;
}) {
  const [perkDraft, setPerkDraft] = useState<readonly string[] | undefined>();
  const targetProduct = draft.generatedFangsDraftFor?.(undefined);
  const perkProduct =
    value.fangs === undefined || perkDraft === undefined
      ? undefined
      : draft.generatedFangsDraftFor?.({ typeKey: value.fangs.typeKey, perkKeys: perkDraft });
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
        disabled={draft.generatedFangsDraftFor === undefined}
        id={`generated-fangs-target-${idKey}`}
        itemIcon={(item) => (item.value.kind === 'type' ? enemyIcon(item.value.key) : undefined)}
        label="Fangs target"
        layout="inline"
        model={targetProduct?.picker ?? emptyFangsPicker}
        onSelect={(choice) => {
          if (choice.kind === 'type') edit((edits) => edits.setFangsTarget(choice.key));
        }}
        placeholder="Select target"
        triggerIcon={enemyIcon(value.fangs?.typeKey)}
        triggerLabel={display}
      />
      <ContextualPicker<WorkspaceGeneratedFangsDraftChoice>
        ariaLabel="Fangs perks"
        cancelLabel="Cancel"
        choiceLabel={perkProduct?.stepLabel ?? 'Fangs perks'}
        closeOnSelect={false}
        disabled={value.fangs === undefined || draft.generatedFangsDraftFor === undefined}
        id={`generated-fangs-perks-${idKey}`}
        itemIcon={(item) =>
          item.value.kind === 'perk'
            ? fangsPerkIcon(item.value.key)
            : item.value.kind === 'perkPrefix'
              ? fangsPerkIcon(perkDraft?.[item.value.perkKeys.length])
              : undefined
        }
        label="Perks"
        layout="inline"
        model={perkProduct?.picker ?? emptyFangsPicker}
        onOpenChange={(open) => setPerkDraft(open ? Object.freeze([]) : undefined)}
        onSelect={(choice) => {
          if (perkDraft === undefined || value.fangs === undefined) return;
          if (choice.kind === 'finish') {
            edit((edits) => edits.setFangsPerks(perkDraft));
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
        {...(value.fangs === undefined
          ? {}
          : {
              triggerParts: value.fangs.perkKeys.map((key) => ({
                label: presentation.perks[key]?.label ?? key,
                icon: fangsPerkIcon(key),
              })),
            })}
      />
    </div>
  );
}

function GeneratedEncounterWaveDraftPicker({
  draft: customizationDraft,
  edit,
  idKey,
  hasIssues,
  hasAuthoredEnemies,
  selection,
  trailing,
  wave,
}: {
  readonly draft: WorkspaceEncounterCustomizationDraft;
  readonly edit: GeneratedEdit;
  readonly idKey: string;
  readonly hasIssues: boolean;
  readonly hasAuthoredEnemies: boolean;
  readonly selection: readonly {
    readonly key: string;
    readonly label: string;
    readonly kind?: 'fixed' | 'template' | 'highlight';
  }[];
  readonly wave: WorkspaceGeneratedEncounterAssessment['waves'][number];
  /** Read-only figures at the right end of the picker line. */
  readonly trailing?: ReactNode;
}) {
  const [draft, setDraft] = useState<
    { readonly confirmedSeedCount: number; readonly typeKeys: readonly string[] } | undefined
  >();
  const product =
    draft === undefined
      ? undefined
      : customizationDraft.generatedWaveDraftFor?.(
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
          disabled={customizationDraft.generatedWaveDraftFor === undefined}
          id={`generated-wave-${idKey}-${wave.waveIndex}`}
          itemIcon={(item) =>
            item.value.kind === 'finish' ? undefined : enemyIcon(item.value.key)
          }
          label={`Wave ${wave.waveIndex}`}
          layout="inline"
          model={product?.picker ?? emptyDraftPicker}
          onOpenChange={(open) =>
            setDraft(open ? { confirmedSeedCount: 0, typeKeys: Object.freeze([]) } : undefined)
          }
          onSelect={(choice) => {
            if (draft === undefined) return;
            if (choice.kind === 'finish') {
              edit((edits) =>
                edits.replaceWaveEnemies(
                  wave.waveIndex,
                  draft.typeKeys,
                  product!.sampledBudgetKeys,
                ),
              );
              setDraft(undefined);
              return;
            }
            const next =
              choice.kind === 'confirmSeed'
                ? { ...draft, confirmedSeedCount: draft.confirmedSeedCount + 1 }
                : { ...draft, typeKeys: Object.freeze([...draft.typeKeys, choice.key]) };
            const nextProduct = customizationDraft.generatedWaveDraftFor?.(
              wave.waveIndex,
              next.confirmedSeedCount,
              next.typeKeys,
            );
            if (nextProduct?.completesAutomatically) {
              edit((edits) =>
                edits.replaceWaveEnemies(
                  wave.waveIndex,
                  next.typeKeys,
                  nextProduct.sampledBudgetKeys,
                ),
              );
              setDraft(undefined);
            } else setDraft(next);
          }}
          open={draft !== undefined}
          placeholder={actionLabel}
          triggerLabel={
            selection.length === 0
              ? actionLabel
              : selection.map((member) => member.label).join(' · ')
          }
          triggerParts={selection.map((member) => ({
            label: member.label,
            icon: enemyIcon(member.key),
          }))}
        />
        {trailing}
      </div>
    </div>
  );
}

type CompositionWave = WorkspaceEncounterComposition['waves'][number];

/** A declaration-owned or native wave in the same label/value layout as the editor. */
function ReadOnlyWavePanel({
  idKey,
  wave,
}: {
  readonly idKey: string;
  readonly wave: CompositionWave;
}) {
  const summary =
    wave.spawns.length === 0
      ? 'Native generation'
      : wave.spawns.map((spawn) => spawn.label).join(' · ');
  return (
    <>
      <div className="encounter-wave-picker">
        <div className="encounter-generated-wave-heading">
          <div className="field-control field-control-inline encounter-wave-readonly">
            <span className="encounter-wave-label">Wave {wave.waveIndex}</span>
            <span
              className="encounter-wave-readonly-value"
              id={`generated-wave-${idKey}-${wave.waveIndex}`}
            >
              {wave.spawns.length === 0 ? summary : 'Fixed enemies'}
            </span>
          </div>
        </div>
      </div>
      {wave.spawns.length === 0 ? (
        <p className="encounter-generated-context">The game generates this wave’s enemies.</p>
      ) : (
        <div className="encounter-budget-table-scroll">
          <table className="encounter-budget-table" aria-label={`Wave ${wave.waveIndex} enemies`}>
            <thead>
              <tr>
                <th scope="col">{wave.source === 'fixed' ? 'Fixed' : 'Native'}</th>
                {wave.spawns.map((spawn, index) => (
                  <th scope="col" key={`${index}-${spawn.enemyKey}`}>
                    <span className="encounter-enemy-label">
                      <ArtworkIcon
                        className="artwork-label-icon"
                        source={enemyIcon(spawn.enemyKey)}
                      />
                      {spawn.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Count</th>
                {wave.spawns.map((spawn, index) => (
                  <td key={`${index}-${spawn.enemyKey}`}>{spawn.count ?? 'NA'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** The composition's editing help, opened from an info button on the dialog's title line. */
function EncounterCompositionHelp({
  composition,
}: {
  readonly composition: WorkspaceEncounterComposition;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  return (
    <EditorDialogTitleAction>
      <Popover.Root>
        <Popover.Trigger asChild ref={captureTrigger}>
          <button
            aria-label="Encounter composition help"
            className="trait-offer-state-button"
            type="button"
          >
            i
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="end"
            aria-label="Encounter composition help"
            className="trait-offer-state-popover encounter-composition-help"
            collisionPadding={12}
            side="bottom"
            sideOffset={6}
          >
            <h4>Waves and enemies</h4>
            <p>Choose the number of waves and use each wave’s picker to select its enemies.</p>
            {composition.waves.some((wave) => wave.source === 'fixed') ? (
              <p>Fixed waves cannot be edited. Customize the remaining waves.</p>
            ) : null}
            {composition.sharedEnemy ? (
              <p>The shared enemy appears in every generated wave.</p>
            ) : null}
            <h4>Budgets</h4>
            <p>Allocate a budget to each enemy type. The last type uses what remains.</p>
            <p>
              Counts round up, with at least one of each selected type, so the resulting cost can
              exceed the allocation.
            </p>
            {composition.fangs ? (
              <>
                <h4>Fangs</h4>
                <p>
                  Choose one elite enemy type and its perks. This selection applies across all
                  waves.
                </p>
              </>
            ) : null}
            {composition.menace ? (
              <>
                <h4>Menace</h4>
                <p>
                  Set how many enemies to replace. Some replacement types are fixed; others can be
                  selected. For grouped enemies, each conversion replaces one whole group.
                </p>
                <p>
                  The table’s counts and costs describe the original enemies. Menace does not
                  recalculate them.
                </p>
                {composition.fangs ? (
                  <p>
                    Replacements do not inherit the original enemy’s Fangs perks. If every instance
                    of the Fangs target is replaced, those perks go unused.
                  </p>
                ) : null}
              </>
            ) : null}
            <h4>Reset</h4>
            <p>Reset removes the customization and returns the encounter to game control.</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </EditorDialogTitleAction>
  );
}

/**
 * One stable composition editor for every combat phase: the engine view owns
 * each wave's source and editability; generated edits bind only authored waves.
 */
export function EncounterCompositionControl({
  composition,
  decision,
  draft,
  idKey,
  initializeGenerated,
  onInitializationFailure,
  onValue,
}: {
  readonly composition: WorkspaceEncounterComposition;
  readonly decision?: Decision;
  /** The dialog draft's products; absent for a read-only composition. */
  readonly draft?: WorkspaceEncounterCustomizationDraft;
  readonly idKey: string;
  readonly initializeGenerated?: () => AuthoredGeneratedEncounterCustomization | undefined;
  /** Reports whether the last Edit attempt found no supported composition. */
  readonly onInitializationFailure?: (failed: boolean) => void;
  /** Writes the generated decision's next value into the dialog draft. */
  readonly onValue?: (value: AuthoredGeneratedEncounterCustomization | undefined) => void;
}) {
  const edit = generatedEdit(draft, (next) => onValue?.(next));
  const [selectedWave, setSelectedWave] = useState<number>();
  const value = decision?.value === undefined ? undefined : authored(decision);
  const assessment = value === undefined ? undefined : draft?.generatedAssessment;
  // A retained removal-only value on a non-editable composition authors nothing.
  const authorable = value !== undefined && composition.editable;
  const waveCountUnavailable =
    value?.waveCount !== undefined &&
    (value.waveCount < composition.waveCount.min || value.waveCount > composition.waveCount.max);
  // Authored rows have content only in an active assessed composition.
  const rows = composition.waves.filter(
    (wave) => wave.source !== 'authored' || assessment?.composition === 'active',
  );
  const activeWave = rows.some((wave) => wave.waveIndex === selectedWave)
    ? selectedWave
    : (rows.find((wave) => wave.editable)?.waveIndex ?? rows[0]?.waveIndex);
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
    decision?.selection.choices.find((choice) => choice.key === key)?.label ??
    decision?.selection.fixedEnemies.find((choice) => choice.key === key)?.label ??
    decision?.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    composition.waves.flatMap((wave) => wave.spawns).find((spawn) => spawn.enemyKey === key)
      ?.label ??
    'Unavailable enemy';
  const cost = (key: string) =>
    decision?.selection.choices.find((choice) => choice.key === key)?.difficultyRating ??
    decision?.selection.fixedEnemies.find((choice) => choice.key === key)?.difficultyRating;
  const groupSize = (key: string) =>
    decision?.selection.choices.find((choice) => choice.key === key)?.unitGroupSize ??
    decision?.selection.fixedEnemies.find((choice) => choice.key === key)?.unitGroupSize;
  const retainedWaves = (value?.waves ?? []).filter(
    (row) =>
      !composition.waves.some(
        (wave) => wave.source === 'fixed' && wave.waveIndex === row.waveIndex,
      ) && !assessment?.waves.some((wave) => wave.waveIndex === row.waveIndex),
  );
  const issuesAt = (waveIndex: number) =>
    assessment?.issues.some((issue) => issue.waveIndex === waveIndex) === true;
  const authoredPanel = (
    wave: WorkspaceGeneratedEncounterAssessment['waves'][number],
    active: WorkspaceGeneratedEncounterAssessment,
    bound: WorkspaceEncounterCustomizationDraft,
  ) => {
    const current = value?.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
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
      const remainder = preview?.remainder;
      const unitCost = cost(key);
      const finalCost =
        preview?.count === undefined || unitCost === undefined
          ? 'NA'
          : budgetNumber.format(preview.count * unitCost);
      const costHint =
        finalCost === 'NA'
          ? undefined
          : `${name} takes ${finalCost} of this wave’s ${waveBudget(wave.waveIndex)} budget.`;
      if (!enabled)
        return (
          <span className="encounter-budget-input encounter-generated-context">
            <span className="encounter-budget-value">
              {wave.seeds.some((seed) => seed.key === key && seed.kind === 'fixed')
                ? 'Fixed'
                : remainder === undefined
                  ? 'NA'
                  : budgetNumber.format(remainder)}
            </span>
            <span className="encounter-budget-result" {...hintProps(costHint)}>
              → {finalCost}
            </span>
          </span>
        );
      return (
        <label className="encounter-budget-input" key={`allocation-${position}`}>
          <EnemyBudgetInput
            label={`Wave ${wave.waveIndex} ${name} budget`}
            onCommit={(next) => edit((edits) => edits.setAllocation(wave.waveIndex, key, next))}
            value={allocation}
          />
          <span className="encounter-budget-result" {...hintProps(costHint)}>
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
        id={`wave-budget-panel-${idKey}-${wave.waveIndex}`}
        aria-labelledby={`wave-budget-tab-${idKey}-${wave.waveIndex}`}
      >
        <GeneratedEncounterWaveDraftPicker
          hasIssues={active.issues.some(
            (issue) => issue.waveIndex === wave.waveIndex && issue.field === 'enemies',
          )}
          hasAuthoredEnemies={current !== undefined}
          draft={bound}
          edit={edit}
          idKey={idKey}
          selection={[
            ...wave.seeds.map((seed) => ({
              key: seed.key,
              label: label(seed.key),
              kind: seed.kind,
            })),
            ...(current?.typeKeys ?? []).map((key) => ({ key, label: label(key) })),
          ]}
          trailing={
            <span className="encounter-wave-budget-ratio encounter-wave-budget">
              Wave budget {waveBudget(wave.waveIndex)}/{encounterBudget}
            </span>
          }
          wave={wave}
        />
        {current === undefined && wave.seeds.length === 0 ? (
          <p className="encounter-generated-context">Select enemies to edit their budgets.</p>
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
                      <span className="encounter-enemy-label encounter-enemy-heading">
                        <ArtworkIcon className="artwork-label-icon" source={enemyIcon(key)} />
                        {label(key)}
                        {cost(key) === undefined ? null : ` · ${budgetNumber.format(cost(key)!)}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Allocated</th>
                  {tableKeys.map((key, index) => (
                    <td key={`${index}-${key}`}>{allocationsFor(key, index)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Count</th>
                  {tableKeys.map((key, index) => {
                    const preview = wave.countPreview?.find((entry) => entry.key === key);
                    const count = preview?.count;
                    const size = groupSize(key);
                    // A type's per-wave cap and the counts it absorbed from later capped types.
                    const capNotes = [
                      ...(preview?.cap === undefined ? [] : [`Capped at ${preview.cap} per wave`]),
                      ...(preview?.capOverflow ?? []).map(
                        (spill) => `+${spill.count} from ${label(spill.fromKey)}’s cap`,
                      ),
                    ];
                    return (
                      <td key={`${index}-${key}`}>
                        {count === undefined ? (
                          'NA'
                        ) : capNotes.length === 0 ? (
                          size === undefined ? (
                            count
                          ) : (
                            `${count} (${count * size})`
                          )
                        ) : (
                          <span
                            className="encounter-count-capped"
                            {...hintProps(capNotes.join('\n'))}
                          >
                            {size === undefined ? count : `${count} (${count * size})`}*
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {composition.menace ? (
                  <>
                    <tr>
                      <th scope="row">
                        Menace <br />
                        Target
                      </th>
                      {tableKeys.map((key, index) => {
                        const cell = wave.menaceCells?.[key];
                        if (cell === undefined) return <td key={`${index}-${key}`}>NA</td>;
                        return (
                          <td key={`${index}-${key}`}>
                            <div className="encounter-menace-replacement">
                              {cell.picker === undefined ? (
                                <span className="encounter-enemy-label">
                                  <ArtworkIcon
                                    className="artwork-label-icon"
                                    source={enemyIcon(cell.replacementKey)}
                                  />
                                  {cell.replacementLabel}
                                </span>
                              ) : (
                                <ContextualPicker
                                  ariaLabel={`Wave ${wave.waveIndex} ${label(key)} replacement`}
                                  choiceLabel="Menace replacement"
                                  id={`generated-menace-${idKey}-${wave.waveIndex}-${key}`}
                                  itemIcon={(item) => enemyIcon(item.value)}
                                  label="Replacement"
                                  layout="inline"
                                  model={cell.picker}
                                  onSelect={(target) =>
                                    edit((edits) =>
                                      edits.setMenaceTarget(wave.waveIndex, key, target),
                                    )
                                  }
                                  placeholder="Select replacement"
                                  triggerIcon={enemyIcon(cell.replacementKey)}
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
                        const currentMenace = value?.menace?.find(
                          (entry) => entry.waveIndex === wave.waveIndex,
                        )?.conversions[key];
                        if (cell === undefined) return <td key={`${index}-${key}`}>NA</td>;
                        return (
                          <td key={`${index}-${key}`}>
                            <ConvertedInput
                              label={`Wave ${wave.waveIndex} ${label(key)} converted`}
                              value={currentMenace?.count ?? 0}
                              onCommit={(count) =>
                                edit((edits) => edits.setMenaceCount(wave.waveIndex, key, count))
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
            <p className="encounter-generated-context">Remove extra enemies from the end.</p>
            {selected.slice(wave.additionalTypeCount.max).map((key, index) => {
              const position = wave.additionalTypeCount.max + index;
              return (
                <div key={`${position}-${key}`}>
                  <span className="encounter-enemy-label">
                    Enemy {wave.seeds.length + position + 1}:
                    <ArtworkIcon className="artwork-label-icon" source={enemyIcon(key)} />
                    {label(key)}
                  </span>
                  {position === selected.length - 1 ? (
                    <button
                      aria-label={`Remove Wave ${wave.waveIndex} Enemy ${wave.seeds.length + position + 1}`}
                      className="quiet-action"
                      onClick={() => edit((edits) => edits.removeLastEnemy(wave.waveIndex))}
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
  };
  const panelFor = (row: CompositionWave) => {
    if (row.source !== 'authored')
      return (
        <section
          className="encounter-customization-group encounter-generated-wave"
          key={row.waveIndex}
          role="tabpanel"
          id={`wave-budget-panel-${idKey}-${row.waveIndex}`}
          aria-labelledby={`wave-budget-tab-${idKey}-${row.waveIndex}`}
        >
          <ReadOnlyWavePanel idKey={idKey} wave={row} />
        </section>
      );
    const wave =
      assessment?.composition === 'active'
        ? assessment.waves.find((entry) => entry.waveIndex === row.waveIndex)
        : undefined;
    return wave === undefined || assessment === undefined || draft === undefined
      ? null
      : authoredPanel(wave, assessment, draft);
  };
  return (
    <section className="encounter-generated-customization">
      {value === undefined ? (
        <div className="encounter-generated-heading">
          {composition.statusLabel === undefined ? null : (
            <span className="encounter-generated-context encounter-composition-status">
              {composition.statusLabel}
            </span>
          )}
          {decision === undefined || draft === undefined ? null : (
            <button
              className="secondary-action action-compact encounter-composition-edit"
              disabled={initializeGenerated === undefined}
              onClick={() => {
                const initial = initializeGenerated?.();
                onInitializationFailure?.(initial === undefined);
                if (initial === undefined) return;
                onValue?.(initial);
              }}
              type="button"
            >
              Edit
            </button>
          )}
        </div>
      ) : null}
      {value === undefined && decision !== undefined && draft !== undefined ? (
        <p className="encounter-customization-explanation">
          The game chooses these enemies unless you select Edit.
        </p>
      ) : null}
      <div className="encounter-summary-controls">
        {authorable && budgetDomain === undefined ? (
          <div className="encounter-budget-control">
            <span>Encounter budget</span>
            <span>{encounterBudget}</span>
          </div>
        ) : null}
        {authorable && budgetDomain !== undefined ? (
          <div className="encounter-budget-control">
            <label htmlFor={`generated-base-roll-${idKey}`}>Encounter budget</label>
            <span>{budgetNumber.format(budgetDomain.total.min)}</span>
            <EncounterBudgetSlider
              hasIssues={assessment?.issues.some((issue) => issue.field === 'baseRoll')}
              id={`generated-base-roll-${idKey}`}
              min={budgetDomain.baseRoll.min}
              max={budgetDomain.baseRoll.max}
              value={value.baseRoll}
              onCommit={(baseRoll) => edit((edits) => edits.setBaseRoll(baseRoll))}
            />
            <span>{budgetNumber.format(budgetDomain.total.max)}</span>
          </div>
        ) : null}
        <div className="encounter-customization-row encounter-waves-control">
          <span>Waves</span>
          <div
            aria-invalid={waveCountUnavailable || undefined}
            data-has-issues={assessment?.issues.some((issue) => issue.field === 'waveCount')}
            className="encounter-wave-count"
            role="radiogroup"
            aria-label="Waves"
            {...hintProps(
              waveCountUnavailable
                ? `${value?.waveCount} waves can’t occur in this room.`
                : undefined,
            )}
          >
            {Array.from(
              { length: composition.waveCount.max - composition.waveCount.min + 1 },
              (_, index) => composition.waveCount.min + index,
            ).map((count) => (
              <label key={count}>
                <input
                  type="radio"
                  name={`generated-wave-count-${idKey}`}
                  checked={composition.waveCount.value === count}
                  disabled={!authorable}
                  onChange={() => edit((edits) => edits.setWaveCount(count))}
                />
                {count}
              </label>
            ))}
          </div>
        </div>
        {value === undefined ? null : (
          <>
            <EncounterCompositionHelp composition={composition} />
            <button
              className="quiet-action action-compact encounter-composition-reset"
              onClick={() => onValue?.(undefined)}
              type="button"
            >
              Reset
            </button>
          </>
        )}
        {composition.sharedEnemy ? (
          <div
            className="encounter-customization-row encounter-shared-enemy"
            {...hintProps('Only used with multiple waves.')}
          >
            <ContextualPicker
              ariaLabel="Shared Enemy"
              hasIssues={assessment?.issues.some((issue) => issue.field === 'highlight') === true}
              choiceLabel="Shared Enemy"
              disabled={draft?.generatedHighlightPicker === undefined}
              id={`generated-highlight-${idKey}`}
              itemIcon={(item) => enemyIcon(item.value)}
              label="Shared Enemy"
              layout="inline"
              model={draft?.generatedHighlightPicker ?? emptyHighlightPicker}
              onSelect={(highlightKey) => edit((edits) => edits.setSharedEnemy(highlightKey))}
              placeholder="Select shared enemy"
              triggerIcon={enemyIcon(draft?.generatedHighlightPicker?.selected?.value)}
            />
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? null : (
        <div className="encounter-generated-waves">
          <div className="encounter-budget-tabs-header">
            <nav className="run-state-tabs" aria-label="Wave budgets" role="tablist">
              {rows.map((wave, index) => (
                <button
                  className="run-state-tab"
                  key={wave.waveIndex}
                  id={`wave-budget-tab-${idKey}-${wave.waveIndex}`}
                  aria-controls={`wave-budget-panel-${idKey}-${wave.waveIndex}`}
                  aria-selected={activeWave === wave.waveIndex}
                  tabIndex={activeWave === wave.waveIndex ? 0 : -1}
                  role="tab"
                  aria-label={`Wave ${wave.waveIndex}${wave.source === 'fixed' ? ', fixed' : ''}${issuesAt(wave.waveIndex) ? ', needs attention' : ''}`}
                  type="button"
                  onClick={() => setSelectedWave(wave.waveIndex)}
                  onKeyDown={(event) => {
                    const nextIndex =
                      event.key === 'ArrowRight'
                        ? (index + 1) % rows.length
                        : event.key === 'ArrowLeft'
                          ? (index + rows.length - 1) % rows.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? rows.length - 1
                              : undefined;
                    if (nextIndex === undefined) return;
                    event.preventDefault();
                    setSelectedWave(rows[nextIndex]!.waveIndex);
                    const tabs =
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      );
                    tabs?.[nextIndex]?.focus();
                  }}
                >
                  Wave {wave.waveIndex}
                  {wave.source === 'fixed' ? (
                    <span aria-hidden="true" className="encounter-wave-fixed-tag">
                      Fixed
                    </span>
                  ) : null}
                  {issuesAt(wave.waveIndex) ? (
                    <NavigationStatusMarker
                      status={{ tone: 'invalid', label: 'Needs attention' }}
                    />
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
          {rows.filter((wave) => wave.waveIndex === activeWave).map((wave) => panelFor(wave))}
        </div>
      )}
      {composition.fangs && value !== undefined && draft !== undefined && decision !== undefined ? (
        <GeneratedFangsPicker
          draft={draft}
          edit={edit}
          idKey={idKey}
          presentation={{
            choices: [...decision.selection.choices, ...decision.selection.fixedEnemies],
            perks: decision.selection.fangs?.perks ?? {},
          }}
          value={value}
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
    </section>
  );
}

/** Issue messages of an assessed composition, each named by its field or wave. */
// eslint-disable-next-line react-refresh/only-export-components -- Formats the control's own assessment for the dialog region.
export function compositionIssueMessages(
  assessment: WorkspaceEncounterCustomizationDraft['generatedAssessment'] | undefined,
): readonly string[] {
  return (
    assessment?.issues.map(
      (issue) =>
        `${
          issue.waveIndex === undefined
            ? issue.field === undefined
              ? 'Composition'
              : {
                  baseRoll: 'Budget',
                  waveCount: 'Waves',
                  highlight: 'Shared Enemy',
                  fangs: 'Fangs',
                  enemies: 'Enemies',
                }[issue.field]
            : `Wave ${issue.waveIndex}`
        }: ${issue.message}`,
    ) ?? []
  );
}
