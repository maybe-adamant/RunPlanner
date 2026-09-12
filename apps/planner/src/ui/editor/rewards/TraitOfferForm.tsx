import type { ReactNode } from 'react';

export function TraitOfferShapeActions({
  onAdd,
  onRemove,
  onFallback,
}: {
  readonly onAdd?: () => void;
  readonly onRemove?: () => void;
  readonly onFallback?: () => void;
}) {
  if (onAdd === undefined && onRemove === undefined && onFallback === undefined) return null;
  return (
    <div aria-label="Offer shape actions" className="trait-offer-shape-actions" role="group">
      {onAdd === undefined ? null : (
        <button className="quiet-action action-compact" onClick={onAdd} type="button">
          Add option
        </button>
      )}
      {onRemove === undefined ? null : (
        <button className="quiet-action action-compact" onClick={onRemove} type="button">
          Remove last option
        </button>
      )}
      {onFallback === undefined ? null : (
        <button className="quiet-action action-compact" onClick={onFallback} type="button">
          Select Fallback Gold
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
        content
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
