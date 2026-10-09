import { useEffect, useId, useRef, type ReactNode } from 'react';

import { draftEditorClosed, draftEditorOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ModalDialog, type ModalSurfaceProps } from './ModalDialog';

/**
 * A draft editor saves once and Cancel discards; a live editor commits per
 * control and closes with Done. Escape and Close act as Cancel or Done.
 */
export type EditorDialogModel =
  | { readonly kind: 'draft'; readonly onCancel: () => void }
  | { readonly kind: 'live'; readonly onDone: () => void };

const focusableControls =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The shared popup editor: header, scrolling body, findings region and the sticky footer that is its only visible exit. */
export function EditorDialog({
  anchorProps,
  children,
  eyebrow,
  feedback,
  footer,
  headerAction,
  initialFocusId,
  model,
  returnFocusId,
  size = 'standard',
  title,
}: {
  /** Finding anchor attributes for the dialog surface. */
  readonly anchorProps?: ModalSurfaceProps;
  readonly children: ReactNode;
  readonly eyebrow: string;
  /** The findings region when the dialog, not its content, owns it. */
  readonly feedback?: ReactNode;
  /** A draft footer when the dialog, not its content, owns the draft. */
  readonly footer?: ReactNode;
  /** A control beside the title, such as a help reference. */
  readonly headerAction?: ReactNode;
  /** The exact repair control a navigation targets. */
  readonly initialFocusId?: string;
  readonly model: EditorDialogModel;
  /** The launcher that regains focus after the dialog unmounts. */
  readonly returnFocusId?: string;
  readonly size?: 'standard' | 'narrow' | 'cards' | 'hexTree';
  readonly title: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const close = model.kind === 'draft' ? model.onCancel : model.onDone;
  const draft = model.kind === 'draft';
  useEffect(() => {
    if (!draft) return;
    dispatch(draftEditorOpened());
    return () => {
      dispatch(draftEditorClosed());
    };
  }, [dispatch, draft]);
  const initialFocusIdRef = useRef(initialFocusId);
  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;
    const id = initialFocusIdRef.current;
    const exact = id === undefined ? null : document.getElementById(id);
    // Footer actions take initial focus only as the dismiss action of a body still loading.
    const first = Array.from(body.querySelectorAll<HTMLElement>(focusableControls)).find(
      (control) => control.closest('.editor-dialog-footer') === null,
    );
    const dismiss = body.querySelector<HTMLElement>('[data-editor-dismiss]');
    (exact !== null && body.contains(exact) ? exact : (first ?? dismiss))?.focus();
  }, []);
  return (
    <ModalDialog
      backdropClassName="editor-dialog-backdrop"
      className={`editor-dialog editor-dialog-${size}`}
      labelledBy={titleId}
      onCancel={close}
      {...(returnFocusId === undefined ? {} : { returnFocusId })}
      {...(anchorProps === undefined ? {} : { surfaceProps: anchorProps })}
    >
      <header className="editor-dialog-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        {headerAction}
      </header>
      <div className="editor-dialog-body" ref={bodyRef}>
        {children}
        {feedback}
        {model.kind === 'live' ? (
          <EditorDialogFooter>
            <button
              className="primary-action"
              data-editor-dismiss
              onClick={model.onDone}
              type="button"
            >
              Done
            </button>
          </EditorDialogFooter>
        ) : (
          footer
        )}
      </div>
    </ModalDialog>
  );
}

/**
 * The dialog's one findings region: always mounted with the visible heading
 * "Feedback"; its accessible name tells coexisting regions apart.
 */
export function EditorDialogFeedback({
  children,
  entries = [],
  name,
}: {
  /** Owner-specific rows; when present they replace the empty state. */
  readonly children?: ReactNode;
  readonly entries?: readonly (readonly [key: string, message: string])[];
  readonly name: string;
}) {
  return (
    <section aria-label={name} className="editor-dialog-feedback" role="status">
      <h3>Feedback</h3>
      {children === undefined && entries.length === 0 ? (
        <p className="editor-dialog-feedback-empty">No current findings.</p>
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

/** The sticky footer row; secondary actions sit before the closing actions. */
export function EditorDialogFooter({
  children,
  secondary,
}: {
  readonly children: ReactNode;
  readonly secondary?: ReactNode;
}) {
  return (
    <footer className="editor-dialog-footer">
      <div className="editor-dialog-footer-secondary">{secondary}</div>
      <div className="editor-dialog-footer-primary">{children}</div>
    </footer>
  );
}

/** The draft footer: Cancel discards and Save commits the complete draft once. */
export function EditorDialogDraftActions({
  onCancel,
  onSave,
  saveDisabled,
  saveName,
  secondary,
}: {
  readonly onCancel?: () => void;
  readonly onSave: () => void;
  readonly saveDisabled: boolean;
  /** Accessible name that names what Save commits, when the title alone does not. */
  readonly saveName?: string;
  readonly secondary?: ReactNode;
}) {
  return (
    <EditorDialogFooter secondary={secondary}>
      {onCancel === undefined ? null : (
        <button className="quiet-action" data-editor-dismiss onClick={onCancel} type="button">
          Cancel
        </button>
      )}
      <button
        {...(saveName === undefined ? {} : { 'aria-label': saveName })}
        className="primary-action"
        disabled={saveDisabled}
        onClick={onSave}
        type="button"
      >
        Save
      </button>
    </EditorDialogFooter>
  );
}
