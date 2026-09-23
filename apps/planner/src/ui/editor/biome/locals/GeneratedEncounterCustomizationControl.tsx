import { useState, type ReactNode } from 'react';
import type { AuthoredGeneratedEncounterCustomization } from '@run-planner/engine/authored-project';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraftChoice,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'generated' } }
>;

function authored(decision: Decision): AuthoredGeneratedEncounterCustomization {
  return decision.value?.kind === 'generated' ? decision.value : { kind: 'generated' };
}

function empty(
  value: AuthoredGeneratedEncounterCustomization,
): AuthoredGeneratedEncounterCustomization | null {
  return value.baseRoll === undefined &&
    value.waveCount === undefined &&
    value.highlightKey === undefined &&
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
  };
  return waves.length === 0 ? base : { ...base, waves };
}

const emptyDraftPicker: ContextualPickerModel<WorkspaceGeneratedWaveDraftChoice> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyHighlightPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function replacementWave(
  value: AuthoredGeneratedEncounterCustomization,
  waveIndex: number,
  typeKeys: readonly string[],
  highlightKeys: readonly string[],
  fixedSeedCount: number,
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
  for (const [index, key] of members.entries())
    if (fixedSeedCount + index + 1 === members.length) delete allocations[key];
  return Object.keys(allocations).length === 0
    ? { waveIndex, typeKeys: [...typeKeys] }
    : { waveIndex, typeKeys: [...typeKeys], allocations };
}

function GeneratedEncounterWaveDraftPicker({
  interaction,
  hasAuthoredEnemies,
  selection,
  actions,
  update,
  wave,
}: {
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
  readonly hasAuthoredEnemies: boolean;
  readonly actions: ReactNode;
  readonly selection: readonly {
    readonly key: string;
    readonly label: string;
    readonly kind?: 'fixed' | 'highlight';
    readonly allocation?: ReactNode;
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
  const begin = () => setDraft({ confirmedSeedCount: 0, typeKeys: Object.freeze([]) });
  return (
    <div className="encounter-wave-picker">
      <div className="encounter-generated-wave-heading">
        <h4>Wave {wave.waveIndex}</h4>
        <ContextualPicker<WorkspaceGeneratedWaveDraftChoice>
          ariaLabel={`Wave ${wave.waveIndex} enemies`}
          cancelLabel="Cancel"
          choiceLabel={product?.stepLabel ?? `Wave ${wave.waveIndex} enemies`}
          closeOnSelect={false}
          disabled={interaction.generatedWaveDraftFor === undefined}
          id={`generated-wave-${interaction.key}-${wave.waveIndex}`}
          label="Enemies"
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
                    wave.seeds.filter((seed) => seed.kind === 'fixed').length,
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
          triggerLabel={actionLabel}
        />
        {actions}
      </div>
      <div className="encounter-wave-selection">
        {selection.map((member) => (
          <div className="encounter-enemy-badge" key={member.key}>
            <button
              className="quiet-action action-compact"
              disabled={interaction.generatedWaveDraftFor === undefined}
              onClick={begin}
              type="button"
              aria-label={`Edit Wave ${wave.waveIndex} enemies: ${member.label}`}
            >
              {member.label}
              {member.kind === 'fixed' ? <small>fixed</small> : null}
            </button>
            {member.allocation}
          </div>
        ))}
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
  const label = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.label ??
    decision.selection.fixedEnemies.find((choice) => choice.key === key)?.label ??
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable enemy';
  const replace = (next: AuthoredGeneratedEncounterCustomization | null) =>
    execute(interaction.intentFor(decision.key, next));
  const update = (
    change: (
      current: AuthoredGeneratedEncounterCustomization,
    ) => AuthoredGeneratedEncounterCustomization,
  ) => replace(empty(change(value)));
  const fixedCount = decision.selection.waveCount.min === decision.selection.waveCount.max;
  const retainedWaves = (value.waves ?? []).filter(
    (row) => !assessment?.waves.some((wave) => wave.waveIndex === row.waveIndex),
  );
  const fieldIssues = (field: 'waveCount' | 'highlight') =>
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
        <h3>Generated composition</h3>
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
      {assessment?.budget?.kind === 'exact' ? (
        <div className="encounter-customization-row">
          <span>Wave budget</span>
          <span className="encounter-fixed-value">
            {(assessment.budget.waveBudgets as readonly number[])
              .map((budget, index) => `Wave ${index + 1}: ${budget}`)
              .join(' · ')}
          </span>
        </div>
      ) : null}
      {assessment?.budget?.baseRoll !== undefined ? (
        <div className="encounter-customization-row">
          <label htmlFor={`generated-base-roll-${interaction.key}`}>Native base roll</label>
          <input
            id={`generated-base-roll-${interaction.key}`}
            aria-label="Native base roll"
            min={assessment.budget.baseRoll?.min}
            max={assessment.budget.baseRoll?.max}
            step={1}
            type="range"
            value={value.baseRoll ?? assessment.budget.baseRoll?.min ?? 0}
            onChange={(event) =>
              update((current) => ({ ...current, baseRoll: event.currentTarget.valueAsNumber }))
            }
          />
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
          <span className="encounter-generated-context">
            {value.baseRoll === undefined
              ? `Default native random · ${(
                  assessment.budget.waveBudgets as readonly {
                    readonly min: number;
                    readonly max: number;
                  }[]
                )
                  .map((budget, index) => `Wave ${index + 1}: ${budget.min}–${budget.max}`)
                  .join(' · ')}`
              : `Native roll ${value.baseRoll}`}
          </span>
        </div>
      ) : null}
      {fixedCount ? (
        <div className="encounter-customization-row">
          <span>Waves</span>
          <span className="encounter-fixed-value">{decision.selection.waveCount.min} (fixed)</span>
          {value.waveCount !== undefined ? (
            <button
              className="quiet-action"
              type="button"
              onClick={() => {
                replace(
                  empty({
                    kind: 'generated',
                    ...(value.baseRoll === undefined ? {} : { baseRoll: value.baseRoll }),
                    ...(value.highlightKey === undefined
                      ? {}
                      : { highlightKey: value.highlightKey }),
                    ...(value.waves === undefined ? {} : { waves: value.waves }),
                  }),
                );
              }}
            >
              Clear stored wave count ({value.waveCount})
            </button>
          ) : null}
          {fieldIssues('waveCount')}
        </div>
      ) : (
        <div className="encounter-customization-row">
          <span>Waves</span>
          <div className="encounter-wave-count" role="radiogroup" aria-label="Waves">
            {[
              undefined,
              ...Array.from(
                { length: decision.selection.waveCount.max - decision.selection.waveCount.min + 1 },
                (_, index) => decision.selection.waveCount.min + index,
              ),
            ].map((count) => (
              <label key={count ?? 'default'}>
                <input
                  type="radio"
                  name={`generated-wave-count-${interaction.key}`}
                  checked={value.waveCount === count}
                  onChange={() =>
                    update((current) => {
                      const base = {
                        kind: 'generated' as const,
                        ...(current.baseRoll === undefined ? {} : { baseRoll: current.baseRoll }),
                        ...(current.highlightKey === undefined
                          ? {}
                          : { highlightKey: current.highlightKey }),
                        ...(current.waves === undefined ? {} : { waves: current.waves }),
                      };
                      return count === undefined ? base : { ...base, waveCount: count };
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
      )}
      {decision.selection.waveCount.max > 1 || value.highlightKey !== undefined ? (
        <div className="encounter-customization-row" title="Only used with multiple waves">
          <ContextualPicker
            aria-label="Shared highlight"
            choiceLabel="Shared highlight"
            disabled={interaction.generatedHighlightPicker === undefined}
            id={`generated-highlight-${interaction.key}`}
            label="Shared highlight"
            layout="inline"
            model={interaction.generatedHighlightPicker ?? emptyHighlightPicker}
            onSelect={(highlightKey) =>
              update((current) => {
                const base = {
                  kind: 'generated' as const,
                  ...(current.baseRoll === undefined ? {} : { baseRoll: current.baseRoll }),
                  ...(current.waveCount === undefined ? {} : { waveCount: current.waveCount }),
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
          Choose a shared highlight to customize enemies.
        </p>
      ) : (
        <div className="encounter-generated-waves">
          <p className="encounter-generated-weight-note">
            Default allocation stays native. Explicit samples guide native allocation; counts remain
            derived.
          </p>
          {assessment.waves.map((wave) => {
            const current = value.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
            const selected = current?.typeKeys ?? [];
            const members = wave.generatedMemberKeys ?? [];
            const allocationsFor = (key: string, position: number) => {
              const generatedIndex = members.indexOf(key);
              const fixedSeedCount = wave.seeds.filter((seed) => seed.kind === 'fixed').length;
              const enabled =
                generatedIndex !== -1 && fixedSeedCount + generatedIndex + 1 !== members.length;
              const allocation = current?.allocations?.[key];
              const name = label(key);
              return (
                <label className="encounter-generated-weight" key={`allocation-${position}`}>
                  <input
                    aria-label={`Wave ${wave.waveIndex} ${name} allocation`}
                    disabled={!enabled}
                    min={0}
                    onChange={(event) => {
                      if (!enabled) return;
                      const next = event.target.valueAsNumber;
                      if (!Number.isFinite(next) || next < 0) return;
                      update((state) =>
                        withWave(state, wave.waveIndex, (row) => ({
                          ...row,
                          allocations:
                            row.allocations === undefined
                              ? Object.fromEntries([[key, next]])
                              : { ...row.allocations, [key]: next },
                        })),
                      );
                    }}
                    placeholder="NA"
                    step={1}
                    type="number"
                    value={allocation ?? ''}
                  />
                </label>
              );
            };
            return (
              <section
                className="encounter-customization-group encounter-generated-wave"
                key={wave.waveIndex}
              >
                <GeneratedEncounterWaveDraftPicker
                  actions={
                    <span>
                      <button
                        className="danger-action action-compact"
                        disabled={current?.allocations === undefined}
                        onClick={() =>
                          update((state) =>
                            withWave(state, wave.waveIndex, (row) => ({
                              waveIndex: row.waveIndex,
                              typeKeys: row.typeKeys,
                            })),
                          )
                        }
                        type="button"
                      >
                        Reset allocations
                      </button>
                      <button
                        className="danger-action action-compact"
                        disabled={current === undefined}
                        onClick={() =>
                          update((state) => withWave(state, wave.waveIndex, () => undefined))
                        }
                        type="button"
                      >
                        Reset wave
                      </button>
                    </span>
                  }
                  hasAuthoredEnemies={current !== undefined}
                  interaction={interaction}
                  selection={[
                    ...wave.seeds.map((seed, index) => ({
                      key: `${seed.kind}-${seed.key}`,
                      label: label(seed.key),
                      kind: seed.kind,
                      allocation:
                        seed.kind === 'highlight' ? allocationsFor(seed.key, index + 1) : null,
                    })),
                    ...selected.slice(0, wave.additionalTypeCount.max).map((key, index) => ({
                      key: `${index}-${key}`,
                      label: label(key),
                      allocation: allocationsFor(key, wave.seeds.length + index + 1),
                    })),
                  ]}
                  update={update}
                  wave={wave}
                />
                {wave.countPreview?.map((entry) => (
                  <span className="encounter-generated-context" key={`count-${entry.key}`}>
                    {label(entry.key)}:{' '}
                    {entry.count === undefined
                      ? 'Native count'
                      : `${entry.count} derived${entry.requested === undefined ? '' : ` (requested ${entry.requested}, effective ${entry.effective})`}`}
                  </span>
                ))}
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
                                    return typeKeys.length === 0
                                      ? undefined
                                      : {
                                          ...row,
                                          typeKeys,
                                          ...(row.allocations === undefined
                                            ? {}
                                            : {
                                                allocations: replaceMemberAllocation(
                                                  row.allocations,
                                                  row.typeKeys.at(-1),
                                                  '',
                                                ),
                                              }),
                                        };
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
            onClick={() => update((state) => withWave(state, wave.waveIndex, () => undefined))}
          >
            Reset wave {wave.waveIndex}
          </button>
        </section>
      ))}
    </section>
  );
}
