import type { ReactNode } from 'react';

/** The one selected-outcome block: its trait in the heading, then one row per choice. */
export function SelectedOutcomeBlock({
  children,
  name,
  traitLabel,
}: {
  readonly children: ReactNode;
  /** Accessible region name. */
  readonly name: string;
  readonly traitLabel: string;
}) {
  return (
    <section aria-label={name} className="trait-selected-outcome">
      <h3>Selected outcome · {traitLabel}</h3>
      {children}
    </section>
  );
}

/** One labelled row of the selected-outcome block for a control that is not a picker. */
export function SelectedOutcomeRow({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <div className="field-control field-control-inline trait-outcome-row">
      <span>{label}</span>
      <div className="trait-outcome-row-control">{children}</div>
    </div>
  );
}
