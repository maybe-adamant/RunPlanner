import type { ReactNode } from 'react';
import {
  EditorDialog,
  EditorDialogDraftActions,
  type EditorDialogIssue,
} from '@planner/ui/controls/EditorDialog';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { keepsakeArtwork } from './keepsakeArtwork';

export interface KeepsakeRackEntry {
  readonly key: string;
  readonly label: string;
  readonly disabled: boolean;
  /** Shown on hover only where the reason a keepsake is dimmed isn't obvious. */
  readonly hint?: string | undefined;
}

const rackOrder = new Map(Object.keys(keepsakeArtwork).map((key, index) => [key, index]));

/** A keepsake launcher: the held keepsake's icon and name, plus its target when it has one. */
export function KeepsakeLauncher({
  disabledHint,
  findingTarget,
  id,
  keepsakeKey,
  label,
  onOpen,
  text,
}: {
  /** Shown on hover while the launcher can't open. */
  readonly disabledHint?: string;
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
        disabled={disabledHint !== undefined}
        onClick={onOpen}
        {...hintProps(disabledHint, findingTarget?.['aria-description'])}
      >
        {artwork === undefined ? null : (
          <img src={artwork} alt="" className="keepsake-launcher-icon" width={150} height={150} />
        )}
        <span onMouseEnter={showTruncatedTitle}>{text}</span>
      </button>
    </div>
  );
}

/**
 * The in-game keepsake rack as a draft dialog: a card chooses the draft keepsake, `detail` holds
 * its own controls, and Save commits the draft.
 */
export function KeepsakeRackDialog({
  detail,
  draftKey,
  entries,
  issues,
  loading,
  onCancel,
  onChoose,
  onSave,
  returnFocusId,
  saveDisabled,
  title,
}: {
  readonly detail?: ReactNode;
  /** The drafted keepsake; the card it names shows as chosen. */
  readonly draftKey: string | undefined;
  readonly entries: readonly KeepsakeRackEntry[];
  readonly issues?: readonly EditorDialogIssue[];
  readonly loading?: boolean;
  readonly onCancel: () => void;
  readonly onChoose: (keepsakeKey: string) => void;
  readonly onSave: () => void;
  readonly returnFocusId: string;
  readonly saveDisabled: boolean;
  readonly title: string;
}) {
  const ordered = [...entries].sort(
    (a, b) => (rackOrder.get(a.key) ?? rackOrder.size) - (rackOrder.get(b.key) ?? rackOrder.size),
  );
  const chosen = ordered.find((entry) => entry.key === draftKey);
  const chosenArtwork = draftKey === undefined ? undefined : keepsakeArtwork[draftKey];
  return (
    <EditorDialog
      {...(chosenArtwork === undefined
        ? {}
        : {
            icon: (
              <img
                alt=""
                className="artwork-label-icon"
                height={150}
                src={chosenArtwork}
                width={150}
              />
            ),
          })}
      layout="header"
      model={{ kind: 'draft', onCancel }}
      returnFocusId={returnFocusId}
      size="cards"
      title={title}
    >
      <EditorDialogDraftActions
        {...(issues === undefined ? {} : { issues })}
        onCancel={onCancel}
        onSave={onSave}
        saveDisabled={saveDisabled}
      />
      {loading === true && ordered.length === 0 ? (
        <p className="contextual-picker-loading" role="status">
          Loading keepsakes…
        </p>
      ) : (
        <div className="keepsake-rack" role="group" aria-label="Keepsakes">
          {ordered.map((entry) => {
            const artwork = keepsakeArtwork[entry.key];
            const selected = entry.key === draftKey;
            return (
              <button
                aria-disabled={(entry.disabled && !selected) || undefined}
                aria-pressed={selected}
                className="keepsake-card"
                key={entry.key}
                onClick={() => {
                  if (!entry.disabled && !selected) onChoose(entry.key);
                }}
                type="button"
                {...hintProps(entry.disabled && !selected ? entry.hint : undefined)}
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
        <p className="keepsake-rack-detail-name">{chosen?.label ?? 'No keepsake'}</p>
        {detail}
      </div>
    </EditorDialog>
  );
}
