import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { projectDraftShareCode, projectDraftSharePaste } from '@planner/projections/draftSpec';
import { authoredProjectCommandsDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';

/** Copies the draft inputs as a code, or pastes one over the spec and loadout as one edit. */
export function DraftShareControls({
  catalog,
  project,
}: {
  readonly catalog: Catalog;
  readonly project: ProjectDocument;
}) {
  const dispatch = useAppDispatch();
  const [copyLabel, setCopyLabel] = useState<'Copy code' | 'Copied' | 'Failed'>('Copy code');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | undefined>();
  useEffect(() => {
    if (copyLabel === 'Copy code') return;
    const timer = globalThis.setTimeout(() => setCopyLabel('Copy code'), 1500);
    return () => globalThis.clearTimeout(timer);
  }, [copyLabel]);
  const copy = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(projectDraftShareCode(catalog, project));
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Failed');
    }
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    setText('');
    setRefusal(undefined);
  };
  const apply = () => {
    const paste = projectDraftSharePaste(catalog, project, text);
    if (paste.kind === 'refused') {
      setRefusal(paste.message);
      return;
    }
    dispatch(authoredProjectCommandsDispatched(paste.commands));
    changeOpen(false);
  };
  return (
    <>
      <span aria-hidden="true" className="draft-meta-separator">
        ·
      </span>
      <button
        className="draft-ghost-action draft-share-copy"
        onClick={() => void copy()}
        type="button"
      >
        {/* Every label shares one grid cell, so the button keeps the widest label's width. */}
        {(['Copy code', 'Copied', 'Failed'] as const).map((label) => (
          <span aria-hidden={label === copyLabel ? undefined : true} key={label}>
            {label}
          </span>
        ))}
      </button>
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <span aria-hidden="true" className="draft-meta-separator">
          ·
        </span>
        <Popover.Trigger asChild>
          <button className="draft-ghost-action" type="button">
            Paste code
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            aria-label="Paste a draft code"
            className="contextual-picker-popover draft-share-popover"
            collisionPadding={12}
            sideOffset={4}
          >
            <form
              className="draft-share-paste"
              onSubmit={(event) => {
                event.preventDefault();
                if (text.trim() !== '') apply();
              }}
            >
              <input
                aria-describedby="draft-share-refusal"
                aria-invalid={refusal === undefined ? undefined : true}
                aria-label="Draft code"
                autoFocus
                className="draft-share-input"
                onChange={(event) => {
                  setText(event.target.value);
                  setRefusal(undefined);
                }}
                placeholder="Draft code"
                spellCheck={false}
                type="text"
                value={text}
              />
              <button className="secondary-action" disabled={text.trim() === ''} type="submit">
                Apply
              </button>
              <p className="draft-share-refusal" id="draft-share-refusal" role="alert">
                {refusal ?? ''}
              </p>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
