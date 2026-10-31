import * as Popover from '@radix-ui/react-popover';
import { useId } from 'react';

/** The timeline's row colours and purchase chances, opened from an "i" button. */
export function TimelineLegend() {
  const headingId = useId();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label="Legend" className="timeline-legend-trigger" type="button">
          i
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          aria-labelledby={headingId}
          className="timeline-legend"
          collisionPadding={12}
          sideOffset={6}
        >
          <h3 id={headingId}>Legend</h3>
          <ul aria-label="Row colours" className="room-timeline-legend">
            <li data-action-accent="optional">Optional actions</li>
            <li data-action-accent="phase">Required before this phase ends</li>
            <li data-action-accent="room">Required before leaving this room</li>
            <li data-action-accent="automatic">Actions that trigger automatically</li>
          </ul>
          <div className="timeline-legend-affordability">
            <p>Chance to afford this purchase</p>
            <ul aria-label="Chance to afford" className="timeline-legend-chances">
              <li>
                <span className="purchase-affordability" data-tone="high">
                  Likely
                </span>
              </li>
              <li>
                <span className="purchase-affordability" data-tone="medium">
                  Uncertain
                </span>
              </li>
              <li>
                <span className="purchase-affordability" data-tone="low">
                  Unlikely
                </span>
              </li>
            </ul>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
