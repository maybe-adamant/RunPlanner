import type { ReactNode } from 'react';

import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';

/** The one selected-outcome block: its trait in the heading, then one row per choice. */
export function SelectedOutcomeBlock({
  children,
  headingExtra,
  icon,
  name,
  traitLabel,
}: {
  readonly children: ReactNode;
  /** A control continuing the heading, such as the Hex tree's layout. */
  readonly headingExtra?: ReactNode;
  readonly icon: string | undefined;
  /** Accessible region name. */
  readonly name: string;
  readonly traitLabel: string;
}) {
  return (
    <section aria-label={name} className="trait-selected-outcome">
      {headingExtra === undefined ? (
        <h3 className="artwork-label">
          <ArtworkIcon className="artwork-label-icon" source={icon} />
          {traitLabel}
        </h3>
      ) : (
        <div className="trait-selected-outcome-heading">
          <h3 className="artwork-label">
            <ArtworkIcon className="artwork-label-icon" source={icon} />
            {traitLabel}
          </h3>
          {headingExtra}
        </div>
      )}
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
