import * as Popover from '@radix-ui/react-popover';
import { useRef, useState } from 'react';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { hintProps } from '@planner/ui/controls/hint';

type WorkspaceStartPointControl = NonNullable<WorkspaceRoute['runModifiers']['startPoint']>;
type WorkspaceStartPointRow = ReturnType<WorkspaceStartPointControl['loadDomain']>[number];

/** Practice mode: a checkbox, then the start point and its gold, always laid out. */
export function RunStartPointModifier({
  control,
  id,
}: {
  readonly control: WorkspaceStartPointControl;
  readonly id: string;
}) {
  const dispatch = useAppDispatch();
  const [domain, setDomain] = useState<readonly WorkspaceStartPointRow[]>();
  const [open, setOpen] = useState(false);
  const switchRef = useRef<HTMLLabelElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const { declaration, value } = control;
  // Checked only while a start point is set, or while choosing the first one.
  const checked = value !== undefined || open;
  const authoredGold = value?.gold === undefined ? '' : String(value.gold);
  const [draft, setDraft] = useState<{
    readonly source: string;
    readonly text: string;
    readonly error?: string;
  }>();
  // An authored replacement (including history restoration) supersedes its draft.
  if (draft !== undefined && draft.source !== authoredGold) setDraft(undefined);
  const goldText = value === undefined ? '' : (draft?.text ?? authoredGold);
  const error = draft?.error;
  const updateOpen = (next: boolean) => {
    // The domain is evaluated when the picker opens; a later projection replaces the control.
    if (next) setDomain(control.loadDomain());
    setOpen(next);
  };
  const toggle = (enabled: boolean) => {
    setDraft(undefined);
    if (enabled) {
      updateOpen(true);
      return;
    }
    setOpen(false);
    if (value !== undefined)
      dispatch(authoredProjectCommandDispatched(control.selectIntent(undefined).command));
  };
  const choose = (next: Parameters<WorkspaceStartPointControl['selectIntent']>[0]) => {
    setOpen(false);
    dispatch(authoredProjectCommandDispatched(control.selectIntent(next).command));
  };
  const commitGold = () => {
    if (draft === undefined) return;
    const result = control.goldDraftIntent(draft.text);
    if (result.kind === 'invalid') {
      setDraft({ ...draft, error: result.message });
      return;
    }
    setDraft(undefined);
    dispatch(authoredProjectCommandDispatched(result.intent.command));
  };
  return (
    <div className="route-run-modifier-practice">
      <label ref={switchRef} className="route-run-modifier-switch">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          onChange={(event) => toggle(event.target.checked)}
        />
        <span>{declaration.label}</span>
      </label>
      <div className="route-run-modifier-practice-fields">
        <label id={`${id}-label`} className="route-run-modifier-field-label" htmlFor={id}>
          Start at
        </label>
        <Popover.Root open={open} onOpenChange={updateOpen}>
          <Popover.Trigger asChild>
            <button
              id={id}
              type="button"
              className="contextual-picker-trigger"
              aria-labelledby={`${id}-label ${id}-value`}
              disabled={!checked}
            >
              <span id={`${id}-value`}>
                {control.valueLabel}
                {control.unavailable === undefined ? null : (
                  <>
                    {' '}
                    <span className="route-start-point-unavailable">(unavailable)</span>
                  </>
                )}
              </span>
              <span className="contextual-picker-trigger-icon" aria-hidden="true">
                ▾
              </span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              className="contextual-picker-popover route-start-point-popover"
              collisionPadding={12}
              sideOffset={4}
              aria-label="Start at choices"
              // The Practice mode checkbox cancels an unchosen start itself.
              onInteractOutside={(event) => {
                if (switchRef.current?.contains(event.target as Node)) event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                // With nothing chosen the trigger disables, so focus returns to the checkbox.
                if (value !== undefined) return;
                event.preventDefault();
                checkboxRef.current?.focus();
              }}
            >
              <div className="route-start-point-grid" role="group" aria-label="Start points">
                {(domain ?? []).map((row) => (
                  <div
                    key={row.biomeKey}
                    className="route-start-point-row"
                    role="group"
                    aria-labelledby={`${id}-${row.biomeKey}`}
                  >
                    <span id={`${id}-${row.biomeKey}`} className="route-start-point-biome">
                      {row.label}
                    </span>
                    {row.options.map((option) => (
                      <button
                        key={option.point}
                        type="button"
                        className="route-start-point-option"
                        aria-label={`${row.label} ${option.label}`}
                        aria-pressed={option.selected}
                        aria-disabled={option.available ? undefined : true}
                        {...hintProps(option.unavailableHint)}
                        onClick={() => {
                          if (!option.available) return;
                          choose({ biomeKey: option.biomeKey, point: option.point });
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <label className="route-run-modifier-field-label" htmlFor={`${id}-gold`}>
          Gold
        </label>
        <input
          id={`${id}-gold`}
          className="route-run-modifier-gold"
          type="text"
          inputMode="numeric"
          placeholder={value === undefined ? undefined : '0'}
          disabled={value === undefined}
          aria-invalid={error === undefined ? undefined : true}
          {...hintProps(error)}
          value={goldText}
          onChange={(event) => setDraft({ source: authoredGold, text: event.target.value })}
          onBlur={commitGold}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitGold();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(undefined);
            }
          }}
        />
      </div>
    </div>
  );
}
