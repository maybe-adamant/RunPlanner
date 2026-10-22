import { useState } from 'react';

import { folderLocation } from '@planner/projections/libraryHome';
import { ModalDialog } from '../controls/ModalDialog';

/** Names a new folder, or renames one; the name is checked when it is applied. */
export function FolderNameDialog({
  initial,
  onApply,
  onCancel,
  title,
}: {
  readonly initial: string;
  /** Resolves a problem to show, or null once applied. */
  readonly onApply: (name: string) => Promise<string | null>;
  readonly onCancel: () => void;
  readonly title: string;
}) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const apply = async () => {
    setPending(true);
    setProblem(null);
    try {
      setProblem(await onApply(name));
    } finally {
      setPending(false);
    }
  };
  return (
    <ModalDialog
      className="game-publication-dialog library-dialog"
      labelledBy="folder-name-title"
      onCancel={onCancel}
      pending={pending}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void apply();
        }}
      >
        <header className="panel-heading">
          <h2 id="folder-name-title">{title}</h2>
        </header>
        <label className="library-dialog-field">
          Folder name
          <input
            autoFocus
            onChange={(event) => setName(event.target.value)}
            spellCheck={false}
            type="text"
            value={name}
          />
        </label>
        {problem === null ? null : (
          <p className="home-problem" role="alert">
            {problem}
          </p>
        )}
        <footer className="game-publication-actions">
          <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-action" disabled={pending || name.trim() === ''} type="submit">
            {title === 'New folder' ? 'Create' : 'Rename'}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}

/** Chooses the folder a plan moves to; the folder it is in is shown but cannot be chosen. */
export function MoveToDialog({
  current,
  folders,
  name,
  onCancel,
  onMove,
}: {
  readonly current: string;
  readonly folders: readonly string[];
  readonly name: string;
  readonly onCancel: () => void;
  /** Resolves a problem to show, or null once moved. */
  readonly onMove: (folder: string) => Promise<string | null>;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const choices = ['', ...folders];
  return (
    <ModalDialog
      className="game-publication-dialog library-dialog"
      labelledBy="move-to-title"
      onCancel={onCancel}
      pending={pending}
    >
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Move to</p>
          <h2 id="move-to-title">{name}</h2>
        </div>
      </header>
      <fieldset className="move-to-tree">
        <legend className="visually-hidden">Folder</legend>
        {choices.map((folder) => {
          const depth = folder === '' ? 0 : folder.split('/').length;
          return (
            <label
              data-current={folder === current || undefined}
              key={folder}
              style={{ paddingLeft: `${10 + depth * 18}px` }}
            >
              <input
                checked={target === folder}
                disabled={folder === current}
                name="move-to-folder"
                onChange={() => setTarget(folder)}
                type="radio"
              />
              <span>{folder === '' ? 'Library' : folder.slice(folder.lastIndexOf('/') + 1)}</span>
              {folder === current ? <span className="home-muted"> · here now</span> : null}
            </label>
          );
        })}
      </fieldset>
      {problem === null ? null : (
        <p className="home-problem" role="alert">
          {problem}
        </p>
      )}
      <footer className="game-publication-actions">
        <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary-action"
          disabled={pending || target === null}
          onClick={() => {
            if (target === null) return;
            setPending(true);
            setProblem(null);
            void onMove(target)
              .then(setProblem)
              .finally(() => setPending(false));
          }}
          type="button"
        >
          {target === null ? 'Move' : `Move to ${folderLocation(target)}`}
        </button>
      </footer>
    </ModalDialog>
  );
}
