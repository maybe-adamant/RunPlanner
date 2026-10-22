import { useEffect, useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import { selectLibrarySession, selectRevertAvailable, useAppSelector } from '@planner/state/store';
import { ActionIcon } from '../controls/ActionIcon';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { routeArtwork } from '@planner/ui/artwork/route-icons/routeArtwork';
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
  const librarySession = useAppSelector(selectLibrarySession);
  const revertAvailable = useAppSelector(selectRevertAvailable);
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<ProjectOperation | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [dreamItineraryOpen, setDreamItineraryOpen] = useState(false);
  useEffect(() => {
    if (result?.status !== 'success') return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);
  const runOperation = async (
    operation: ProjectOperation,
    run: () => Promise<ProjectOperationResult>,
  ): Promise<ProjectOperationResult> => {
    setPendingOperation(operation);
    setResult(null);
    try {
      const operationResult = await run();
      setResult(operationResult);
      if (operation !== 'revert' && operationResult.status === 'success') {
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
    <ProjectFileFeedback savesAsYouEdit={hasProject} session={librarySession} result={result} />
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
                aria-label={`Create ${route.label} project`}
                className="route-choice-card"
                disabled={pendingOperation !== null}
                key={route.routeKey}
                onClick={() => {
                  if (route.itinerarySelectionRequired) {
                    setDreamItineraryOpen(true);
                    return;
                  }
                  void runOperation('new', () => operations.createNew(route.routeKey));
                }}
                type="button"
              >
                <ArtworkIcon
                  className="route-choice-icon"
                  source={routeArtwork[route.routeKey] ?? undefined}
                />
                <span className="route-choice-name">{route.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <footer className="project-entry-footer">
          <span>Already have a run plan?</span>
          <button
            className="secondary-action"
            disabled={pendingOperation !== null}
            onClick={() => void runOperation('importPlan', () => operations.importPlan())}
            type="button"
          >
            <ActionIcon name="load" />
            {pendingOperation === 'importPlan' ? 'Opening…' : 'Open file…'}
          </button>
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
              void runOperation('new', () =>
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
      aria-label="Plan actions"
    >
      {feedback}
      <div className="project-file-actions">
        {beforeFileMenu}
        <DropdownMenu.Root onOpenChange={setFileMenuOpen} open={fileMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              aria-label="Plan"
              className="secondary-action action-compact project-file-menu-trigger"
              disabled={pendingOperation !== null}
              type="button"
            >
              Plan
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
                disabled={pendingOperation !== null}
                onSelect={() => queueFileMenuAction(() => onEntryOpenChange(true))}
              >
                <ActionIcon name="new" />
                New…
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null}
                onSelect={() =>
                  queueFileMenuAction(() => {
                    void runOperation('importPlan', () => operations.importPlan());
                  })
                }
              >
                <ActionIcon name="load" />
                {pendingOperation === 'importPlan' ? 'Opening…' : 'Open file…'}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null}
                onSelect={() =>
                  queueFileMenuAction(() => {
                    void runOperation('duplicate', () => operations.duplicate());
                  })
                }
              >
                <ActionIcon name="duplicate" />
                {pendingOperation === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="project-file-menu-separator" />
              <DropdownMenu.Item
                className="project-file-menu-item"
                disabled={pendingOperation !== null || !revertAvailable}
                onSelect={() =>
                  queueFileMenuAction(() => {
                    setResult(operations.revertToOpened());
                  })
                }
              >
                <ActionIcon name="undo" />
                Revert to opened
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </section>
  );
}
