import { useRef, useState } from 'react';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'cocoonCount' } }
>;

const commitKeys = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Enter',
];

/** Slider stop 0 is Default; later stops are the declared counts in order. */
export function CocoonCountControl({
  decision,
  id,
  interaction,
}: {
  readonly decision: Decision;
  readonly id: string;
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
}) {
  const executeIntent = useCommandIntent();
  const { minimum, maximum } = decision.selection;
  const count = decision.value?.kind === 'cocoonCount' ? decision.value.count : undefined;
  const position =
    count === undefined ? 0 : Math.min(Math.max(count, minimum), maximum) - minimum + 1;
  // An unsupported retained count sits on a clamped stop but never equals it.
  const persisted = count !== undefined && !decision.valueSupported ? undefined : position;
  const [draft, setDraft] = useState<number | undefined>();
  const pending = useRef<number | undefined>(undefined);
  // Choosing the clamped stop fires no change event; it is still an explicit repair.
  const armRepair = (): void => {
    if (persisted === undefined) pending.current ??= position;
  };
  const commit = (): void => {
    const next = pending.current;
    pending.current = undefined;
    setDraft(undefined);
    if (next === undefined || next === persisted) return;
    executeIntent(
      interaction.intentFor(
        decision.key,
        next === 0 ? null : { kind: 'cocoonCount', count: minimum + next - 1 },
      ),
    );
  };
  const shown = draft ?? position;
  const shownText = shown === 0 ? 'Default' : String(minimum + shown - 1);
  return (
    <div className="encounter-customization-row">
      <label htmlFor={id}>{decision.label}</label>
      <div className="encounter-cocoon-count">
        <input
          aria-valuetext={shownText}
          id={id}
          max={maximum - minimum + 1}
          min={0}
          onBlur={commit}
          onChange={(event) => {
            pending.current = event.currentTarget.valueAsNumber;
            setDraft(pending.current);
          }}
          onKeyDown={(event) => {
            if (commitKeys.includes(event.key)) armRepair();
          }}
          onKeyUp={(event) => {
            if (commitKeys.includes(event.key)) commit();
          }}
          onLostPointerCapture={commit}
          onPointerDown={(event) => {
            armRepair();
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerUp={commit}
          step={1}
          type="range"
          value={shown}
        />
        <output htmlFor={id}>
          {draft === undefined && count !== undefined && !decision.valueSupported
            ? `${count} (unavailable)`
            : shownText}
        </output>
        <button
          className="quiet-action"
          disabled={count === undefined}
          onClick={() => executeIntent(interaction.intentFor(decision.key, null))}
          type="button"
        >
          Reset
        </button>
      </div>
      {!decision.valueSupported && count !== undefined ? (
        <span className="encounter-customization-repair">Needs repair</span>
      ) : null}
    </div>
  );
}
