import { useState } from 'react';
import { createProjectAddress, normalizeProjectName } from '@run-planner/engine/authored-project';

import { useAppDispatch } from '@planner/state/store';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';

/** The plan's name, renamed in place; mount it keyed by the name so outside changes reset it. */
export function ProjectNameField({ name }: { readonly name: string }) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const next = normalizeProjectName(draft);
    if (next === null || next === name) {
      setDraft(name);
      return;
    }
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: next,
      }),
    );
  };
  return (
    <input
      aria-label="Plan name"
      className="app-plan-name"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          const input = event.currentTarget;
          setDraft(name);
          // Blurs after the reset renders, so the blur commits nothing.
          window.setTimeout(() => input.blur(), 0);
        }
      }}
      spellCheck={false}
      type="text"
      value={draft}
    />
  );
}
