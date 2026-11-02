import * as Popover from '@radix-ui/react-popover';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { ActionIcon, type ActionIconName } from './ActionIcon';
import { hintProps } from './hint';
import { draftEditorClosed, draftEditorOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ModalDialog, type ModalSurfaceProps } from './ModalDialog';
import { showTruncatedTitle } from './truncatedTitle';

/** A title-bar icon action, hinted with its name since the glyph alone may mislead. */
function EditorDialogIconAction({
  dismiss = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  /** The dialog's dismiss action, the focus fallback while the body loads. */
  readonly dismiss?: boolean;
  readonly disabled?: boolean;
  readonly icon: ActionIconName;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="icon-action editor-dialog-icon-action"
      {...(dismiss ? { 'data-editor-dismiss': true } : {})}
      disabled={disabled}
      onClick={onClick}
      type="button"
      {...hintProps(label, undefined, label)}
    >
      <ActionIcon name={icon} />
    </button>
  );
}

/**
 * A draft editor saves once and Cancel discards; a view edits nothing and
 * closes from its title bar. Escape acts as Cancel or Close.
 */
export type EditorDialogModel =
  | { readonly kind: 'draft'; readonly onCancel: () => void }
  | { readonly kind: 'view'; readonly onClose: () => void };

/** The title line's trailing slot, which dialog content can fill. */
const headerSlot = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Renders content at the right end of the enclosing editor dialog's title
 * line; outside a dialog it renders in place.
 */
export function EditorDialogTitleAction({ children }: { readonly children: ReactNode }) {
  const slot = useContext(headerSlot);
  if (slot === undefined) return children;
  return slot === null ? null : createPortal(children, slot);
}

/**
 * The dialog's help, an info button on the title line that opens a popover;
 * long guidance lives here rather than in the body.
 */
export function EditorDialogHelp({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  /** Extra popover classes for help with its own layout. */
  readonly className?: string;
  /** Names both the button and its popover, such as "Fear help". */
  readonly label: string;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  return (
    <EditorDialogTitleAction>
      <Popover.Root>
        <Popover.Trigger asChild ref={captureTrigger}>
          <button aria-label={label} className="trait-offer-state-button" type="button">
            i
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="end"
            aria-label={label}
            className={`trait-offer-state-popover editor-dialog-help${className === undefined ? '' : ` ${className}`}`}
            collisionPadding={12}
            side="bottom"
            sideOffset={6}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </EditorDialogTitleAction>
  );
}

/** The title bar's action slot; undefined outside an editor dialog. */
const actionsSlot = createContext<HTMLElement | null | undefined>(undefined);

const focusableControls =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The shared popup editor: one sticky title bar carries the icon, title, first
 * finding and the draft's Reset, Cancel and Save, or a view's Close, above a
 * scrolling body.
 */
export function EditorDialog({
  anchorProps,
  children,
  headerBelow,
  icon,
  initialFocusId,
  model,
  returnFocusId,
  size = 'standard',
  title,
  titleExtra,
}: {
  /** Finding anchor attributes for the dialog surface. */
  readonly anchorProps?: ModalSurfaceProps;
  readonly children: ReactNode;
  /** Controls pinned under the title, such as tabs. */
  readonly headerBelow?: ReactNode;
  /** The portrait or icon before the title. */
  readonly icon?: ReactNode;
  /** The exact repair control a navigation targets. */
  readonly initialFocusId?: string;
  readonly model: EditorDialogModel;
  /** The launcher that regains focus after the dialog unmounts. */
  readonly returnFocusId?: string;
  readonly size?: 'standard' | 'narrow' | 'cards' | 'hexTree';
  readonly title: ReactNode;
  /** A control that continues the title, such as a variant picker; outside the dialog's name. */
  readonly titleExtra?: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsElement, setActionsElement] = useState<HTMLElement | null>(null);
  const close = model.kind === 'draft' ? model.onCancel : model.onClose;
  const draft = model.kind === 'draft';
  useEffect(() => {
    if (!draft) return;
    dispatch(draftEditorOpened());
    return () => {
      dispatch(draftEditorClosed());
    };
  }, [dispatch, draft]);
  const initialFocusIdRef = useRef(initialFocusId);
  const focusedRef = useRef(false);
  // Initial focus waits for the title bar's action slot, where the dismiss action mounts.
  useEffect(() => {
    const body = bodyRef.current;
    if (body === null || actionsElement === null || focusedRef.current) return;
    focusedRef.current = true;
    const id = initialFocusIdRef.current;
    const exact = id === undefined ? null : document.getElementById(id);
    const first = body.querySelector<HTMLElement>(focusableControls);
    // The dismiss action takes initial focus only while the body has no enabled control.
    const dismiss = (body.parentElement ?? body).querySelector<HTMLElement>(
      '[data-editor-dismiss]',
    );
    (exact !== null && body.contains(exact) ? exact : (first ?? dismiss))?.focus();
  }, [actionsElement]);
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
        <div className="editor-dialog-title-line">
          {icon}
          <h2 id={titleId} onMouseEnter={showTruncatedTitle}>
            {title}
          </h2>
          {titleExtra === undefined ? null : (
            <span className="editor-dialog-title-extra">{titleExtra}</span>
          )}
          <span className="editor-dialog-title-action" ref={setTitleSlot} />
        </div>
        <div className="editor-dialog-header-actions" ref={setActionsElement}>
          {model.kind === 'view' ? (
            <EditorDialogIconAction dismiss icon="close" label="Close" onClick={model.onClose} />
          ) : null}
        </div>
      </header>
      {headerBelow === undefined ? null : (
        <div className="editor-dialog-header-below">{headerBelow}</div>
      )}
      <div className="editor-dialog-body" ref={bodyRef}>
        <headerSlot.Provider value={titleSlot}>
          <actionsSlot.Provider value={actionsElement}>{children}</actionsSlot.Provider>
        </headerSlot.Provider>
      </div>
    </ModalDialog>
  );
}

/** One dialog finding: a stable key and its one-line title. */
export type EditorDialogIssue = readonly [key: string, message: string];

/** Focuses the first marked or invalid control in the dialog body. */
function focusFirstIssue(from: HTMLElement): void {
  const body = from.closest('.editor-dialog')?.querySelector('.editor-dialog-body');
  const marked = body?.querySelector<HTMLElement>(
    '[data-has-findings="true"], [aria-invalid="true"]',
  );
  if (marked === null || marked === undefined) return;
  const control = marked.matches(focusableControls)
    ? marked
    : (marked.querySelector<HTMLElement>(focusableControls) ?? marked);
  control.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  marked.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

/**
 * The header's finding button: the first issue and how many more. Its slot
 * stays mounted when there is none, so the title never shifts.
 */
function EditorDialogFinding({
  blocking,
  issues,
}: {
  readonly blocking: boolean;
  readonly issues: readonly EditorDialogIssue[];
}) {
  const first = issues[0];
  const tone = blocking ? 'invalid' : 'incomplete';
  return (
    <span className="editor-dialog-finding-slot">
      {first === undefined ? null : (
        <button
          aria-label={issues.length > 1 ? `${first[1]} (${issues.length - 1} more)` : first[1]}
          className="assessment-issue-button editor-dialog-finding"
          data-tone={tone}
          onClick={(event) => focusFirstIssue(event.currentTarget)}
          type="button"
        >
          <span aria-hidden="true" className="navigation-status-marker" data-tone={tone}>
            !
          </span>
          <span className="finding-title" onMouseEnter={showTruncatedTitle}>
            {first[1]}
          </span>
          {issues.length > 1 ? (
            <span className="editor-dialog-finding-more">+{issues.length - 1}</span>
          ) : null}
        </button>
      )}
    </span>
  );
}

/**
 * The draft actions on the title bar after the first finding: Reset returns the
 * draft to its default (empty, the game's control or the layout default), not to
 * the saved value; Cancel discards the draft and Save commits it once. Outside
 * an editor dialog they render in place.
 */
export function EditorDialogDraftActions({
  issues = [],
  onCancel,
  onReset,
  onSave,
  resetDisabled = false,
  saveDisabled,
  saveName,
}: {
  /** The draft's findings, first one shown; blocking while Save is disabled. */
  readonly issues?: readonly EditorDialogIssue[];
  readonly onCancel?: () => void;
  /** Returns the whole draft to its default; a part's own reset stays in the body. */
  readonly onReset?: () => void;
  readonly onSave: () => void;
  readonly resetDisabled?: boolean;
  readonly saveDisabled: boolean;
  /** Accessible name that names what Save commits, when the title alone does not. */
  readonly saveName?: string;
}) {
  const slot = useContext(actionsSlot);
  const actions = (
    <>
      <EditorDialogFinding blocking={saveDisabled} issues={issues} />
      {onReset === undefined ? null : (
        <EditorDialogIconAction
          disabled={resetDisabled}
          icon="reset"
          label="Reset"
          onClick={onReset}
        />
      )}
      {onCancel === undefined ? null : (
        <EditorDialogIconAction dismiss icon="close" label="Cancel" onClick={onCancel} />
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
    </>
  );
  if (slot === undefined) return actions;
  return slot === null ? null : createPortal(actions, slot);
}
