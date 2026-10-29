import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type {
  WorkspaceScreenRerollLock,
  WorkspaceScreenRerolls,
} from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

function lockHint(lock: WorkspaceScreenRerollLock | undefined): string | undefined {
  switch (lock) {
    case undefined:
      return undefined;
    case 'unreached':
      return candidateWaitingHint;
    case 'notEnabled':
      return 'Rerolls are not enabled.';
    case 'poolEmpty':
      return 'No rerolls left.';
    case 'poolShort':
      return 'Not enough rerolls left.';
  }
}

/** A screen's tab label: the first draw, then one per reroll. */
function screenTabLabel(index: number): string {
  return index === 0 ? 'Offer' : `Reroll ${index}`;
}

/**
 * One tab per screen of a rerolled single-pick screen, oldest first; the last
 * tab is the final screen with the pick. Rerolling keeps the current rows on
 * their tab and opens a new last tab holding a copy of them and the pick.
 */
export function ScreenRerollTabs({
  active,
  children,
  earlierCount,
  idPrefix,
  marked,
  onRemove,
  onReroll,
  onSelect,
  rerolls,
}: {
  /** The open tab: an earlier screen's index, or `earlierCount` for the final screen. */
  readonly active: number;
  readonly children: ReactNode;
  readonly earlierCount: number;
  readonly idPrefix: string;
  /** Tabs whose screen carries findings. */
  readonly marked: ReadonlySet<number | 'final'>;
  readonly onRemove: () => void;
  readonly onReroll: () => void;
  readonly onSelect: (index: number) => void;
  readonly rerolls: WorkspaceScreenRerolls;
}) {
  const tabList = useRef<HTMLDivElement>(null);
  const count = earlierCount + 1;
  const atMax = earlierCount >= rerolls.maxCount;
  const hint = atMax ? lockHint(rerolls.lockAtMax) : undefined;
  const focusTab = (index: number): void => {
    onSelect(index);
    tabList.current
      ?.querySelector<HTMLButtonElement>(`[data-screen-tab="${index}"]`)
      ?.focus({ preventScroll: true });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next =
      event.key === 'ArrowRight'
        ? (active + 1) % count
        : event.key === 'ArrowLeft'
          ? (active + count - 1) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    focusTab(next);
  };
  return (
    <div className="screen-reroll-tabs">
      <div className="screen-reroll-tab-row">
        <div
          aria-label="Screens"
          className="room-workbench-tabs"
          onKeyDown={onKeyDown}
          ref={tabList}
          role="tablist"
        >
          {Array.from({ length: count }, (_, index) => {
            const final = index === earlierCount;
            const hasFindings = marked.has(final ? 'final' : index);
            return (
              <button
                aria-controls={`${idPrefix}-screen-panel`}
                aria-selected={active === index}
                className="room-workbench-tab"
                data-has-findings={hasFindings || undefined}
                data-screen-tab={index}
                id={`${idPrefix}-screen-tab-${index}`}
                key={index}
                onClick={() => onSelect(index)}
                role="tab"
                tabIndex={active === index ? 0 : -1}
                type="button"
              >
                {screenTabLabel(index)}
              </button>
            );
          })}
        </div>
        <div className="screen-reroll-actions">
          <button
            className="secondary-action action-compact"
            disabled={atMax}
            onClick={onReroll}
            {...hintProps(hint)}
            type="button"
          >
            {`Reroll · costs ${earlierCount + 1}`}
          </button>
          <button
            className="quiet-action action-compact"
            disabled={earlierCount === 0}
            onClick={onRemove}
            type="button"
          >
            Remove last reroll
          </button>
        </div>
      </div>
      <div
        aria-labelledby={`${idPrefix}-screen-tab-${active}`}
        className="screen-reroll-panel"
        id={`${idPrefix}-screen-panel`}
        role="tabpanel"
      >
        {children}
      </div>
    </div>
  );
}

/** An earlier screen not authored yet; it starts as a copy of the final rows. */
export function UnsetScreen({ onCopy }: { readonly onCopy: () => void }) {
  return (
    <section className="trait-offer-fallback">
      <p>This screen isn’t set.</p>
      <button className="secondary-action action-compact" onClick={onCopy} type="button">
        Copy the final screen
      </button>
    </section>
  );
}
