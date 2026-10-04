import { useCallback, useEffect, useState, type ReactNode } from 'react';

/** Draft feedback from a sub-editor, keyed for the dialog's one fixed feedback region. */
export type OutcomeFeedbackReporter = (key: string, message: string | undefined) => void;

/** One feedback row: the reporter's key and its current message. */
export type FeedbackEntry = readonly [key: string, message: string];

// eslint-disable-next-line react-refresh/only-export-components -- The hooks and region form one feedback boundary.
export const ignoreOutcomeFeedback: OutcomeFeedbackReporter = () => undefined;

/** Reports one keyed message while it is defined and clears it on change or unmount. */
// eslint-disable-next-line react-refresh/only-export-components -- The hooks and region form one feedback boundary.
export function useReportedFeedback(
  onFeedback: OutcomeFeedbackReporter,
  key: string,
  message: string | undefined,
): void {
  useEffect(() => {
    onFeedback(key, message);
    return () => onFeedback(key, undefined);
  }, [key, message, onFeedback]);
}

/** Collects keyed sub-editor messages for the dialog's feedback region. */
// eslint-disable-next-line react-refresh/only-export-components -- The hooks and region form one feedback boundary.
export function useOutcomeFeedback(): readonly [readonly FeedbackEntry[], OutcomeFeedbackReporter] {
  const [feedback, setFeedback] = useState<ReadonlyMap<string, string>>(() => new Map());
  const report = useCallback<OutcomeFeedbackReporter>((key, message) => {
    setFeedback((current) => {
      if (current.get(key) === message) return current;
      const next = new Map(current);
      if (message === undefined) next.delete(key);
      else next.set(key, message);
      return next;
    });
  }, []);
  return [[...feedback], report];
}

/** The always-mounted feedback region at the bottom of a trait-form dialog body. */
export function TraitOfferFeedbackRegion({
  children,
  label,
  entries,
}: {
  readonly children?: ReactNode;
  readonly label: string;
  readonly entries: readonly FeedbackEntry[];
}) {
  return (
    <section aria-label={label} className="trait-offer-feedback" role="status">
      <h3>{label}</h3>
      {children === undefined && entries.length === 0 ? (
        <p className="trait-offer-feedback-empty">No current findings.</p>
      ) : null}
      {children}
      {entries.map(([key, message]) => (
        <p className="feedback-text" key={key}>
          {message}
        </p>
      ))}
    </section>
  );
}

export function TraitOfferShapeActions({
  onAdd,
  onRemove,
  addDisabled = false,
  removeDisabled = false,
}: {
  readonly onAdd?: () => void;
  readonly onRemove?: () => void;
  readonly addDisabled?: boolean;
  readonly removeDisabled?: boolean;
}) {
  if (onAdd === undefined && onRemove === undefined) return null;
  return (
    <div aria-label="Offer shape actions" className="trait-offer-shape-actions" role="group">
      {onAdd === undefined ? null : (
        <button
          className="quiet-action action-compact"
          disabled={addDisabled}
          onClick={onAdd}
          type="button"
        >
          Add option
        </button>
      )}
      {onRemove === undefined ? null : (
        <button
          className="quiet-action action-compact"
          disabled={removeDisabled}
          onClick={onRemove}
          type="button"
        >
          Remove last option
        </button>
      )}
    </div>
  );
}

/**
 * The shared trait-form layout. Carrier controllers bind their own draft
 * semantics and pass only rendered, supported sections and actions.
 */
export function TraitOfferForm({
  content,
  feedback,
  options,
  recovery,
  reset,
  save,
  selectedOutcome,
  shapeActions,
  state,
}: {
  readonly content?: ReactNode;
  readonly feedback?: ReactNode;
  readonly options: ReactNode;
  readonly recovery?: ReactNode;
  readonly reset?: ReactNode;
  readonly save: {
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick: () => void;
  };
  readonly selectedOutcome?: ReactNode;
  readonly shapeActions?: ReactNode;
  readonly state?: ReactNode;
}) {
  return (
    <div className="trait-offer-editor">
      {content === undefined ? (
        <>
          {state}
          <div className="trait-offer-options">{options}</div>
          {selectedOutcome}
          {shapeActions}
        </>
      ) : (
        <>
          {content}
          {shapeActions}
        </>
      )}
      {feedback}
      {recovery}
      <button
        className="primary-action"
        disabled={save.disabled}
        onClick={save.onClick}
        type="button"
      >
        {save.label}
      </button>
      {reset}
    </div>
  );
}
