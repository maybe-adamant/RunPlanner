import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createApplication } from '@planner/composition/createApplication';
import { EditorDialog } from '@planner/ui/controls/EditorDialog';

/** The title-bar finding a dialog shows: its first issue and how many more. */
export function dialogFinding(container: ParentNode): string | undefined {
  return container.querySelector('.editor-dialog-finding')?.getAttribute('aria-label') ?? undefined;
}

/** A draft editor dialog around content; needs a store Provider above it. */
export function HeaderDialog({
  children,
  onCancel = () => {},
}: {
  readonly children: ReactNode;
  readonly onCancel?: () => void;
}) {
  return (
    <EditorDialog model={{ kind: 'draft', onCancel }} title="Editor">
      {children}
    </EditorDialog>
  );
}

/** Renders dialog content inside a draft editor dialog. */
export function renderInHeaderDialog(content: ReactNode, onCancel: () => void = () => {}) {
  const application = createApplication();
  const view = render(
    <Provider store={application.store}>
      <HeaderDialog onCancel={onCancel}>{content}</HeaderDialog>
    </Provider>,
  );
  return { ...view, application };
}
