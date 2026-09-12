import type { ReactNode } from 'react';

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
