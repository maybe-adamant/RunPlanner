import type { ReactNode } from 'react';
import { EditorDialog } from '@planner/ui/controls/EditorDialog';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { keepsakeArtwork } from './keepsakeArtwork';

export interface KeepsakeRackEntry {
  readonly key: string;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  /** Shown on hover only where the reason a keepsake is dimmed isn't obvious. */
  readonly hint?: string | undefined;
}

const rackOrder = new Map(Object.keys(keepsakeArtwork).map((key, index) => [key, index]));

/** A keepsake launcher: the held keepsake's icon and name, plus its target when it has one. */
export function KeepsakeLauncher({
  findingTarget,
  id,
  keepsakeKey,
  label,
  onOpen,
  text,
}: {
  readonly findingTarget?: FindingTargetProps;
  readonly id: string;
  readonly keepsakeKey: string | undefined;
  readonly label: string;
  readonly onOpen: () => void;
  readonly text: string;
}) {
  const artwork = keepsakeKey === undefined ? undefined : keepsakeArtwork[keepsakeKey];
  return (
    <div className="field-control field-control-inline loadout-dialog-launcher">
      <label htmlFor={id}>{label}</label>
      <button
        {...findingTarget}
        id={id}
        className="contextual-picker-trigger keepsake-launcher"
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {artwork === undefined ? null : (
          <img src={artwork} alt="" className="keepsake-launcher-icon" width={150} height={150} />
        )}
        <span onMouseEnter={showTruncatedTitle}>{text}</span>
      </button>
    </div>
  );
}

/** The in-game keepsake rack as a dialog; `detail` holds the selected keepsake's own controls. */
export function KeepsakeRackDialog({
  detail,
  entries,
  loading,
  onClose,
  onSelect,
  returnFocusId,
  title,
}: {
  readonly detail?: ReactNode;
  readonly entries: readonly KeepsakeRackEntry[];
  readonly loading?: boolean;
  readonly onClose: () => void;
  readonly onSelect: (keepsakeKey: string) => void;
  readonly returnFocusId: string;
  readonly title: string;
}) {
  const ordered = [...entries].sort(
    (a, b) => (rackOrder.get(a.key) ?? rackOrder.size) - (rackOrder.get(b.key) ?? rackOrder.size),
  );
  const selected = ordered.find((entry) => entry.selected);
  return (
    <EditorDialog
      eyebrow="Keepsake"
      model={{ kind: 'live', onDone: onClose }}
      returnFocusId={returnFocusId}
      size="cards"
      title={title}
    >
      {loading === true && ordered.length === 0 ? (
        <p className="contextual-picker-loading" role="status">
          Loading keepsakes…
        </p>
      ) : (
        <div className="keepsake-rack" role="group" aria-label="Keepsakes">
          {ordered.map((entry) => {
            const artwork = keepsakeArtwork[entry.key];
            return (
              <button
                aria-disabled={entry.disabled || undefined}
                aria-pressed={entry.selected}
                className="keepsake-card"
                key={entry.key}
                onClick={() => {
                  if (!entry.disabled && !entry.selected) onSelect(entry.key);
                }}
                type="button"
                {...hintProps(entry.disabled ? entry.hint : undefined)}
              >
                {artwork === undefined ? (
                  <span className="keepsake-card-icon" aria-hidden="true" />
                ) : (
                  <img
                    src={artwork}
                    alt=""
                    className="keepsake-card-icon"
                    width={150}
                    height={150}
                  />
                )}
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="keepsake-rack-detail">
        <p className="keepsake-rack-detail-name">{selected?.label ?? 'No keepsake'}</p>
        {detail}
      </div>
    </EditorDialog>
  );
}
