import { useEffect, useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import { selectProfileSession, selectProfileStatus, useAppSelector } from '@planner/state/store';
import { ActionIcon } from '../controls/ActionIcon';
import { DreamItineraryDialog } from './DreamItineraryDialog';
import { ProjectFileFeedback } from './ProjectFileFeedback';

export function ProjectFileControls({
  catalog,
  operations,
  routes,
  hasProject,
  entryOpen,
  beforeFileMenu,
  onEntryOpenChange,
}: {
  readonly catalog: Catalog;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
  readonly hasProject: boolean;
  readonly entryOpen: boolean;
  readonly beforeFileMenu?: ReactNode;
  readonly onEntryOpenChange: (open: boolean) => void;
}) {
  const profileSession = useAppSelector(selectProfileSession);
  const profileStatus = useAppSelector(selectProfileStatus);
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<ProjectOperation | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [dreamItineraryOpen, setDreamItineraryOpen] = useState(false);
  useEffect(() => {
    if (result?.status !== 'success') return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);
  const runProfileOperation = async (
    operation: ProjectOperation,
    run: () => Promise<ProjectOperationResult>,
  ): Promise<ProjectOperationResult> => {
    setPendingOperation(operation);
    setResult(null);
    try {
      const operationResult = await run();
      setResult(operationResult);
      if (
        (operation === 'loadProfile' || operation === 'new') &&
        operationResult.status === 'success'
      ) {
        onEntryOpenChange(false);
      }
      return operationResult;
    } finally {
      setPendingOperation(null);
    }
  };

  const queueFileMenuAction = (action: () => void) => {
    setFileMenuOpen(false);
    window.setTimeout(action, 0);
  };

  const feedback = (
    <ProjectFileFeedback
      status={hasProject ? profileStatus : undefined}
      session={profileSession}
      result={result}
    />
  );

  if (entryOpen || !hasProject) {
    return (
      <section
        className="project-entry-panel"
        aria-busy={pendingOperation !== null}
        aria-labelledby="project-entry-title"
      >
        <header className="project-entry-heading">
          <p className="eyebrow">New project</p>
          <h2 id="project-entry-title">
            {hasProject ? 'Choose a new route' : 'Choose your route'}
          </h2>
        </header>
        {feedback}
        <fieldset className="route-chooser route-chooser-entry" aria-label="Choose route">
          <legend className="visually-hidden">Choose route</legend>
          <div className="route-choice-grid">
            {routes.map((route) => (
              <button
                aria-label={route.label}
                className="route-choice-card"
                disabled={pendingOperation !== null}
                key={route.routeKey}
                onClick={() => {
                  if (route.itinerarySelectionRequired) {
                    setDreamItineraryOpen(true);
                    return;
                  }
                  void runProfileOperation('new', () => operations.createNew(route.routeKey));
                }}
                type="button"
              >
                <span className="route-choice-name">{route.label}</span>
                <span className="route-choice-action">Create project</span>
              </button>
            ))}
          </div>
        </fieldset>
        <footer className="project-entry-footer">
          <span>Already have a run plan?</span>
          <button
            className="secondary-action"
            disabled={pendingOperation !== null}
            onClick={() => void runProfileOperation('loadProfile', () => operations.loadProfile())}
            type="button"
          >
            <ActionIcon name="load" />
            {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load'}
          </button>
          {profileSession.recoveryStatus === 'blocked' && (
            <>
              <button
                className="secondary-action"
                disabled={pendingOperation !== null}
                onClick={() =>
                  void runProfileOperation('exportRecovery', () =>
                    operations.exportAutosaveRecovery(),
                  )
                }
                type="button"
              >
                <ActionIcon name="save" />
                {pendingOperation === 'exportRecovery' ? 'Exporting…' : 'Export Autosave'}
              </button>
              <button
                className="danger-action"
                disabled={pendingOperation !== null}
                onClick={() => setResult(operations.discardAutosaveRecovery())}
                type="button"
              >
                <ActionIcon name="discard" />
                Discard
              </button>
            </>
          )}
          {hasProject && (
            <button className="quiet-action" onClick={() => onEntryOpenChange(false)} type="button">
              Cancel
            </button>
          )}
        </footer>
        {dreamItineraryOpen && (
          <DreamItineraryDialog
            catalog={catalog}
            onCancel={() => setDreamItineraryOpen(false)}
            onCreate={(itineraryBiomeKeys) => {
              void runProfileOperation('new', () =>
                operations.createNew('Dream', itineraryBiomeKeys),
              ).then((operationResult) => {
                if (operationResult.status === 'success') setDreamItineraryOpen(false);
              });
            }}
            pending={pendingOperation === 'new'}
          />
        )}
      </section>
    );
  }

  return (
    <section
      className="project-file-controls"
      aria-busy={pendingOperation !== null}
      aria-label="Project profile"
    >
      {feedback}
      <div className="project-file-actions">
        {beforeFileMenu}
        <DropdownMenu.Root onOpenChange={setFileMenuOpen} open={fileMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              aria-label="File"
              className="secondary-action action-compact project-file-menu-trigger"
              disabled={pendingOperation !== null}
              type="button"
            >
              File
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="project-file-menu"
              collisionPadding={12}
              sideOffset={8}
            >
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null || !hasProject}
                onSelect={() => queueFileMenuAction(() => onEntryOpenChange(true))}
              >
                <ActionIcon name="new" />
                New
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null}
                onSelect={() =>
                  queueFileMenuAction(() => {
                    void runProfileOperation('loadProfile', () => operations.loadProfile());
                  })
                }
              >
                <ActionIcon name="load" />
                {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load…'}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="project-file-menu-separator" />
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null || !hasProject}
                onSelect={() =>
                  queueFileMenuAction(() => {
                    void runProfileOperation('saveProfile', () => operations.saveProfile());
                  })
                }
              >
                <ActionIcon name="save" />
                {pendingOperation === 'saveProfile' ? 'Saving…' : 'Save'}
              </DropdownMenu.Item>
              {operations.saveAsAvailable && (
                <DropdownMenu.Item
                  className="project-file-menu-item"
                  disabled={pendingOperation !== null || !hasProject}
                  onSelect={() =>
                    queueFileMenuAction(() => {
                      void runProfileOperation('saveProfileAs', () => operations.saveProfileAs());
                    })
                  }
                >
                  <ActionIcon name="saveAs" />
                  {pendingOperation === 'saveProfileAs' ? 'Saving…' : 'Save As…'}
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {profileSession.recoveryStatus === 'blocked' && (
          <>
            <button
              className="secondary-action action-compact"
              disabled={pendingOperation !== null}
              onClick={() =>
                void runProfileOperation('exportRecovery', () =>
                  operations.exportAutosaveRecovery(),
                )
              }
              type="button"
            >
              <ActionIcon name="save" />
              {pendingOperation === 'exportRecovery' ? 'Exporting…' : 'Export Autosave'}
            </button>
            <button
              className="danger-action action-compact"
              disabled={pendingOperation !== null}
              onClick={() => setResult(operations.discardAutosaveRecovery())}
              type="button"
            >
              <ActionIcon name="discard" />
              Discard
            </button>
          </>
        )}
      </div>
    </section>
  );
}
