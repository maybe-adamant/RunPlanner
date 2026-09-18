import type { AuthoredGeneratedEncounterCustomization } from '@run-planner/engine/authored-project';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
} from '@planner/projections/structured-workspace';
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
  return value.waveCount === undefined && value.highlightKey === undefined && !value.waves?.length
    ? null
    : value;
}

function replaceMemberWeight(
  weights: Readonly<Record<string, number>>,
  previousKey: string | undefined,
  nextKey: string,
) {
  const next = { ...weights };
  const inherited = previousKey === undefined ? 1 : (next[previousKey] ?? 1);
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
    ...(value.waveCount === undefined ? {} : { waveCount: value.waveCount }),
    ...(value.highlightKey === undefined ? {} : { highlightKey: value.highlightKey }),
  };
  return waves.length === 0 ? base : { ...base, waves };
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
  return (
    <section className="encounter-generated-customization">
      <div className="encounter-generated-heading">
        <h3>Generated composition</h3>
        <button
          className="danger-action action-compact"
          disabled={decision.value === undefined}
          onClick={() => replace(null)}
          type="button"
        >
          Reset customization
        </button>
      </div>
      <div className="encounter-customization-row">
        <span>Encounter</span>
        <span className="encounter-fixed-value">{encounterKey}</span>
      </div>
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
        </div>
      ) : (
        <label className="encounter-customization-row">
          <span>Waves</span>
          <select
            aria-label="Waves"
            onChange={(event) =>
              update((current) => {
                const base = {
                  kind: 'generated' as const,
                  ...(current.highlightKey === undefined
                    ? {}
                    : { highlightKey: current.highlightKey }),
                  ...(current.waves === undefined ? {} : { waves: current.waves }),
                };
                return event.target.value === ''
                  ? base
                  : { ...base, waveCount: Number(event.target.value) };
              })
            }
            value={value.waveCount ?? ''}
          >
            <option value="">Default</option>
            {value.waveCount !== undefined &&
            (value.waveCount < decision.selection.waveCount.min ||
              value.waveCount > decision.selection.waveCount.max) ? (
              <option value={value.waveCount} disabled>
                {value.waveCount} (unavailable)
              </option>
            ) : null}
            {Array.from(
              { length: decision.selection.waveCount.max - decision.selection.waveCount.min + 1 },
              (_, index) => decision.selection.waveCount.min + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      )}
      {decision.selection.waveCount.max > 1 || value.highlightKey !== undefined ? (
        <label className="encounter-customization-row">
          <span>Shared highlight</span>
          <select
            aria-label="Shared highlight"
            disabled={assessment === undefined && value.highlightKey === undefined}
            onChange={(event) =>
              update((current) => {
                const base = {
                  kind: 'generated' as const,
                  ...(current.waveCount === undefined ? {} : { waveCount: current.waveCount }),
                  ...(current.waves === undefined
                    ? {}
                    : {
                        waves: current.waves.map((wave) => {
                          if (event.target.value === '' || wave.weights === undefined) return wave;
                          // Choosing a highlight after Default has no previous member to replace.
                          if (current.highlightKey === undefined)
                            return { waveIndex: wave.waveIndex, typeKeys: wave.typeKeys };
                          return {
                            ...wave,
                            weights: replaceMemberWeight(
                              wave.weights,
                              current.highlightKey,
                              event.target.value,
                            ),
                          };
                        }),
                      }),
                };
                return event.target.value === ''
                  ? base
                  : { ...base, highlightKey: event.target.value };
              })
            }
            value={value.highlightKey ?? ''}
          >
            <option value="">Default</option>
            {value.highlightKey !== undefined &&
            !assessment?.eligibleHighlightKeys.includes(value.highlightKey) ? (
              <option disabled value={value.highlightKey}>
                {label(value.highlightKey)} (unavailable)
              </option>
            ) : null}
            {decision.selection.choices
              .filter((choice) => assessment?.eligibleHighlightKeys.includes(choice.key))
              .map((choice) => (
                <option key={choice.key} value={choice.key}>
                  {choice.label}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {assessment?.effectiveWaveCount === 1 && value.highlightKey !== undefined ? (
        <p className="encounter-customization-explanation">
          Stored highlight is inactive for one wave.
        </p>
      ) : null}
      {assessment === undefined ? (
        <p className="encounter-customization-repair">
          Encounter context is not available yet. Stored choices remain available to reset.
        </p>
      ) : assessment.composition === 'nativeWaveCount' ? (
        <p className="encounter-customization-explanation">
          Choose a wave count to activate individual wave edits. Stored waves are inactive; the game
          chooses the composition.
        </p>
      ) : assessment.composition === 'nativeHighlight' ? (
        <p className="encounter-customization-explanation">
          Choose a shared highlight to activate individual wave edits. Stored waves are inactive;
          the game chooses the composition.
        </p>
      ) : (
        <div className="encounter-generated-waves">
          <p className="encounter-generated-weight-note">
            NA: native weighting. Editing sets other weights to 1; percentages show requested budget
            shares, not enemy counts.
          </p>
          {assessment.waves.map((wave) => {
            const current = value.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
            const selected = current?.typeKeys ?? [];
            const members = wave.generatedMemberKeys ?? [];
            const weightsFor = (key: string | undefined, position: number) => {
              const enabled = key !== undefined && members.length >= 2 && members.includes(key);
              const weight = key === undefined ? undefined : current?.weights?.[key];
              const share =
                key === undefined ? undefined : wave.normalizedShares?.[members.indexOf(key)];
              const name = key === undefined ? `Enemy ${position}` : label(key);
              return (
                <label className="encounter-generated-weight" key={`weight-${position}`}>
                  <span aria-label={`Wave ${wave.waveIndex} ${name} requested budget share`}>
                    {share === undefined ? '—' : `${Math.round(share * 100)}%`}
                  </span>
                  <input
                    aria-label={`Wave ${wave.waveIndex} ${name} weight`}
                    disabled={!enabled}
                    max={1000}
                    min={0}
                    onChange={(event) => {
                      if (!enabled || key === undefined) return;
                      const next = event.target.valueAsNumber;
                      if (!Number.isFinite(next) || next <= 0 || next > 1000) return;
                      update((state) =>
                        withWave(state, wave.waveIndex, (row) => ({
                          ...row,
                          weights:
                            row.weights === undefined
                              ? Object.fromEntries(
                                  members.map((member) => [member, member === key ? next : 1]),
                                )
                              : { ...row.weights, [key]: next },
                        })),
                      );
                    }}
                    placeholder="NA"
                    step={1}
                    type="number"
                    value={weight ?? ''}
                  />
                </label>
              );
            };
            return (
              <section className="encounter-customization-group" key={wave.waveIndex}>
                <div className="encounter-generated-wave-heading">
                  <h4>Wave {wave.waveIndex}</h4>
                  <p className="encounter-generated-context">
                    {wave.typeCount.min}
                    {wave.typeCount.min === wave.typeCount.max ? '' : `–${wave.typeCount.max}`}{' '}
                    {wave.typeCount.max === 1 ? 'type' : 'types'}
                    {' · '}
                    {wave.additionalTypeCount.min === 0
                      ? 'no required additions'
                      : `${wave.additionalTypeCount.min} required addition${wave.additionalTypeCount.min === 1 ? '' : 's'}`}
                    {wave.additionalTypeCount.max > wave.additionalTypeCount.min
                      ? ` · up to ${wave.additionalTypeCount.max - wave.additionalTypeCount.min} optional addition${wave.additionalTypeCount.max - wave.additionalTypeCount.min === 1 ? '' : 's'}`
                      : ''}
                    {wave.exhausted ? ' · native pool exhausted' : ''}
                  </p>
                  <span>
                    <button
                      className="danger-action action-compact"
                      disabled={current?.weights === undefined}
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
                      Reset weights
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
                </div>
                <div className="encounter-generated-slots">
                  {wave.seeds.map((seed, index) => (
                    <div className="encounter-generated-seed" key={`${seed.kind}-${seed.key}`}>
                      <span>
                        Enemy {index + 1} ({seed.kind === 'fixed' ? 'fixed' : 'highlight'})
                      </span>
                      <output>{label(seed.key)}</output>
                      {seed.kind === 'highlight' ? weightsFor(seed.key, index + 1) : null}
                    </div>
                  ))}
                  {Array.from(
                    {
                      length: wave.additionalTypeCount.max,
                    },
                    (_, index) => ({ index, eligible: wave.eligibleKeysByPosition[index] ?? [] }),
                  ).map(({ index, eligible }) => (
                    <div className="encounter-generated-slot" key={index}>
                      <span>Enemy {wave.seeds.length + index + 1}</span>
                      {selected[index] === undefined && eligible.length === 0 ? (
                        <output className="encounter-generated-unavailable">
                          {index < wave.eligibleKeysByPosition.length
                            ? 'No eligible enemy remains'
                            : 'Finish previous choices'}
                        </output>
                      ) : (
                        <select
                          aria-label={`Wave ${wave.waveIndex} enemy ${wave.seeds.length + index + 1}`}
                          disabled={index > 0 && selected[index - 1] === undefined}
                          onChange={(event) =>
                            update((state) =>
                              withWave(state, wave.waveIndex, (row) => {
                                if (event.target.value === '' && index !== row.typeKeys.length - 1)
                                  return row;
                                const typeKeys =
                                  event.target.value === ''
                                    ? row.typeKeys.slice(0, -1)
                                    : [
                                        ...row.typeKeys.slice(0, index),
                                        event.target.value,
                                        ...row.typeKeys.slice(index + 1),
                                      ];
                                return typeKeys.length === 0
                                  ? undefined
                                  : {
                                      ...row,
                                      typeKeys,
                                      ...(row.weights === undefined
                                        ? {}
                                        : {
                                            weights: replaceMemberWeight(
                                              row.weights,
                                              row.typeKeys[index],
                                              event.target.value,
                                            ),
                                          }),
                                    };
                              }),
                            )
                          }
                          value={selected[index] ?? ''}
                        >
                          <option
                            value=""
                            disabled={
                              selected[index] === undefined || index !== selected.length - 1
                            }
                          >
                            {selected[index] === undefined ? 'Choose enemy' : 'Remove enemy'}
                          </option>
                          {selected[index] !== undefined && !eligible.includes(selected[index]!) ? (
                            <option disabled value={selected[index]}>
                              {label(selected[index]!)} (unavailable)
                            </option>
                          ) : null}
                          {eligible.map((key) => (
                            <option
                              disabled={selected.some(
                                (entry, selectedIndex) => selectedIndex !== index && entry === key,
                              )}
                              key={key}
                              value={key}
                            >
                              {label(key)}
                            </option>
                          ))}
                        </select>
                      )}
                      {weightsFor(selected[index], wave.seeds.length + index + 1)}
                    </div>
                  ))}
                </div>
                {selected.length > wave.additionalTypeCount.max ? (
                  <div className="encounter-generated-retained">
                    <span>Stored excess selections</span>
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
                                          ...(row.weights === undefined
                                            ? {}
                                            : {
                                                weights: replaceMemberWeight(
                                                  row.weights,
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
                          ) : (
                            <span>Remove later enemies first</span>
                          )}
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
        <section className="encounter-customization-group" key={wave.waveIndex}>
          <h4>Stored wave {wave.waveIndex}</h4>
          <p className="encounter-generated-context">
            {wave.typeKeys.map(label).join(', ') || 'No additional types'}
            {wave.weights === undefined ? '' : ' · custom weights retained'}
          </p>
          <button
            className="danger-action action-compact"
            type="button"
            onClick={() => update((state) => withWave(state, wave.waveIndex, () => undefined))}
          >
            Reset wave {wave.waveIndex}
          </button>
        </section>
      ))}
      {assessment !== undefined &&
      !assessment.supported &&
      assessment.issues.some((issue) => issue.waveIndex === undefined) ? (
        <p className="encounter-customization-repair">
          {assessment.issues
            .filter((issue) => issue.waveIndex === undefined)
            .map((issue) => issue.message)
            .join(' ')}
        </p>
      ) : null}
    </section>
  );
}
