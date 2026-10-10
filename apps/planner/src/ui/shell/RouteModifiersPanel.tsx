import { useState } from 'react';
import {
  RUN_MODIFIER_PERCENTAGE,
  type BooleanRunModifierDeclaration,
  type OptionalPercentageRunModifierDeclaration,
} from '@run-planner/engine/authored-project';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';

/** The run modifiers other than Practice mode, which the Route panel hosts. */
export function RouteModifiersPanel({
  workspaceRoute,
}: {
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const control = workspaceRoute.runModifiers;
  const prefix = `${workspaceRoute.routeKey}-run-modifiers`;
  return (
    <section className="route-overview route-run-modifiers" aria-labelledby={`${prefix}-heading`}>
      <header className="panel-heading">
        <h2 id={`${prefix}-heading`} className="eyebrow route-loadout-heading">
          Modifiers
        </h2>
      </header>
      <div className="route-run-modifier-controls">
        {control.declarations.map((declaration) =>
          declaration.kind === 'startPoint' ? null : declaration.kind === 'boolean' ? (
            <BooleanRunModifierToggle
              key={declaration.key}
              control={control}
              declaration={declaration}
            />
          ) : (
            <OptionalPercentageRunModifier
              key={declaration.key}
              control={control}
              declaration={declaration}
              id={`${prefix}-${declaration.key}`}
            />
          ),
        )}
      </div>
    </section>
  );
}

function BooleanRunModifierToggle({
  control,
  declaration,
}: {
  readonly control: WorkspaceRoute['runModifiers'];
  readonly declaration: BooleanRunModifierDeclaration;
}) {
  const dispatch = useAppDispatch();
  const values: Readonly<Record<string, unknown>> = control.value;
  return (
    <label className="route-run-modifier-toggle" {...hintProps(declaration.description)}>
      <span>{declaration.label}</span>
      <input
        type="checkbox"
        aria-description={declaration.description}
        checked={values[declaration.key] === true}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched(
              control.setValue(declaration, event.target.checked).command,
            ),
          )
        }
      />
    </label>
  );
}

const SLIDER_COMMIT_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

/** Enabling with no earlier value in this session starts at the full percentage. */
const PERCENTAGE_ENABLE_DEFAULT = RUN_MODIFIER_PERCENTAGE.max;

export function OptionalPercentageRunModifier({
  control,
  declaration,
  id,
}: {
  readonly control: WorkspaceRoute['runModifiers'];
  readonly declaration: OptionalPercentageRunModifierDeclaration;
  readonly id: string;
}) {
  const dispatch = useAppDispatch();
  const values: Readonly<Record<string, unknown>> = control.value;
  const raw = values[declaration.key];
  const authored = typeof raw === 'number' ? raw : undefined;
  // The last enabled value is UI state only; turning the modifier off removes it from the plan.
  const [remembered, setRemembered] = useState(authored);
  if (authored !== undefined && authored !== remembered) setRemembered(authored);
  const [draft, setDraft] = useState<{
    readonly source: number;
    readonly text: string;
    readonly error?: string;
  }>();
  // An authored replacement (including history restoration) supersedes its draft.
  if (draft !== undefined && draft.source !== authored) setDraft(undefined);
  const currentDraft = authored !== undefined && draft?.source === authored ? draft : undefined;
  const resting = authored ?? remembered ?? PERCENTAGE_ENABLE_DEFAULT;
  const shown = currentDraft?.text ?? String(resting);
  // An off modifier shows no value; the unchecked box already says it is native.
  const valueText = authored === undefined ? undefined : `${shown}${RUN_MODIFIER_PERCENTAGE.unit}`;
  const commit = () => {
    if (currentDraft === undefined) return;
    const result = control.draftIntent(declaration, currentDraft.text);
    if (result.kind === 'invalid') {
      setDraft({ ...currentDraft, error: result.message });
      return;
    }
    setDraft(undefined);
    dispatch(authoredProjectCommandDispatched(result.intent.command));
  };
  const toggle = (enabled: boolean) => {
    setDraft(undefined);
    if (!enabled) {
      dispatch(authoredProjectCommandDispatched(control.clearValue(declaration).command));
      return;
    }
    const result = control.draftIntent(declaration, String(resting));
    if (result.kind === 'valid') dispatch(authoredProjectCommandDispatched(result.intent.command));
  };
  const error = currentDraft?.error;
  return (
    <div className="route-run-modifier-percentage" {...hintProps(error ?? declaration.description)}>
      <label className="route-run-modifier-switch">
        <input
          type="checkbox"
          aria-description={declaration.description}
          checked={authored !== undefined}
          onChange={(event) => toggle(event.target.checked)}
        />
        <span>{declaration.label}</span>
      </label>
      <div className="route-run-modifier-slider">
        <input
          id={id}
          aria-label={declaration.label}
          aria-description={error ?? declaration.description}
          aria-invalid={error === undefined ? undefined : true}
          type="range"
          disabled={authored === undefined}
          min={RUN_MODIFIER_PERCENTAGE.min}
          max={RUN_MODIFIER_PERCENTAGE.max}
          step={RUN_MODIFIER_PERCENTAGE.step}
          value={shown}
          aria-valuetext={valueText}
          onChange={(event) => {
            if (authored !== undefined) setDraft({ source: authored, text: event.target.value });
          }}
          onPointerUp={commit}
          onKeyUp={(event) => {
            if (SLIDER_COMMIT_KEYS.includes(event.key)) commit();
          }}
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
        <output htmlFor={id}>{valueText}</output>
      </div>
    </div>
  );
}
