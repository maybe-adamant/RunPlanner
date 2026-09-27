import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import {
  GAME_PLAN_SLOT_NUMBERS,
  type GamePlanSlotNumber,
} from '@planner/persistence/gameModuleHost';
import {
  projectGamePublicationReadiness,
  type GamePublicationReadiness,
} from '@planner/projections/gameModuleSettings';
import { selectProfileSession, selectProfileStatus, useAppSelector } from '@planner/state/store';
import { ActionIcon } from '../controls/ActionIcon';
import { ExternalPageLink } from '../controls/ExternalPageLink';
import { DreamItineraryDialog } from './DreamItineraryDialog';
import { ProjectFileFeedback } from './ProjectFileFeedback';

function GamePublicationDialog({
  readiness,
  pending,
  selectedSlot,
  onCancel,
  onOpenPage,
  onOpenSettings,
  onPublish,
  onSlotChange,
  error,
}: {
  readonly readiness: GamePublicationReadiness;
  readonly pending: boolean;
  readonly selectedSlot: GamePlanSlotNumber | '';
  readonly onCancel: () => void;
  readonly onOpenPage: (url: string) => void;
  readonly onOpenSettings?: (() => void) | undefined;
  readonly onPublish: () => void;
  readonly onSlotChange: (slot: GamePlanSlotNumber | '') => void;
  readonly error: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      if (!pending) onCancel();
    };
    dialog.addEventListener('cancel', cancel);
    return () => dialog.removeEventListener('cancel', cancel);
  }, [onCancel, pending]);

  const blocked = !readiness.ready || error !== null;

  return (
    <dialog
      aria-labelledby="game-publication-dialog-title"
      aria-modal="true"
      className="game-publication-dialog-backdrop"
      ref={dialogRef}
    >
      <section className="game-publication-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Game module</p>
            <h2 id="game-publication-dialog-title">Publish to game</h2>
          </div>
        </header>
        <p className="game-publication-location">
          {readiness.targetLocation === null
            ? 'No game target is set.'
            : `Target: ${readiness.targetLocation}`}
        </p>
        {readiness.ready ? null : (
          <ul aria-label="Publication blocked" className="game-publication-reasons" role="alert">
            {readiness.reasons.map((reason) => (
              <li key={reason.text}>
                {reason.text}
                {reason.link === null ? null : (
                  <>
                    {' — '}
                    <ExternalPageLink link={reason.link} onOpen={onOpenPage} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {error === null ? null : (
          <p className="game-publication-message" role="alert">
            {error}
          </p>
        )}
        {readiness.ready && (
          <fieldset className="game-publication-selection">
            <legend className="visually-hidden">Publication slot</legend>
            <label htmlFor="game-plan-slot">Slot</label>
            <select
              id="game-plan-slot"
              disabled={pending}
              onChange={(event) => {
                const value = Number(event.target.value);
                onSlotChange(
                  GAME_PLAN_SLOT_NUMBERS.includes(value as GamePlanSlotNumber)
                    ? (value as GamePlanSlotNumber)
                    : '',
                );
              }}
              value={selectedSlot}
            >
              <option value="">Choose slot…</option>
              {GAME_PLAN_SLOT_NUMBERS.map((slotNumber) => (
                <option key={slotNumber} value={slotNumber}>
                  Slot {slotNumber}
                </option>
              ))}
            </select>
          </fieldset>
        )}
        <footer className="game-publication-actions">
          <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
          {blocked && onOpenSettings !== undefined && (
            <button
              className="quiet-action"
              disabled={pending}
              onClick={onOpenSettings}
              type="button"
            >
              Open Settings
            </button>
          )}
          {readiness.ready && (
            <button
              className="secondary-action"
              disabled={pending || selectedSlot === ''}
              onClick={onPublish}
              type="button"
            >
              {pending ? 'Please wait…' : 'Publish'}
            </button>
          )}
        </footer>
      </section>
    </dialog>
  );
}

export function ProjectFileControls({
  catalog,
  operations,
  routes,
  hasProject,
  entryOpen,
  beforeFileMenu,
  onEntryOpenChange,
  onOpenSettings,
}: {
  readonly catalog: Catalog;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
  readonly hasProject: boolean;
  readonly entryOpen: boolean;
  readonly beforeFileMenu?: ReactNode;
  readonly onEntryOpenChange: (open: boolean) => void;
  readonly onOpenSettings?: () => void;
}) {
  const profileSession = useAppSelector(selectProfileSession);
  const profileStatus = useAppSelector(selectProfileStatus);
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<ProjectOperation | null>(null);
  const [gameReadiness, setGameReadiness] = useState<GamePublicationReadiness | null>(null);
  const [selectedGameSlot, setSelectedGameSlot] = useState<GamePlanSlotNumber | ''>('');
  const [gamePublicationError, setGamePublicationError] = useState<string | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [dreamItineraryOpen, setDreamItineraryOpen] = useState(false);
  useEffect(() => {
    if (result?.status !== 'success') return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);
  const closeGamePublication = useCallback(() => {
    setGameReadiness(null);
    setGamePublicationError(null);
    setSelectedGameSlot('');
  }, []);
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

  const openGamePublication = async () => {
    setPendingOperation('publishGame');
    setResult(null);
    try {
      let readiness: GamePublicationReadiness;
      try {
        readiness = projectGamePublicationReadiness(await operations.inspectGamePublication());
      } catch (error) {
        readiness = {
          ready: false,
          targetLocation: null,
          reasons: [
            {
              text: `Could not inspect the game target: ${error instanceof Error ? error.message : String(error)}`,
              link: null,
            },
          ],
        };
      }
      setGameReadiness(readiness);
      setGamePublicationError(null);
      setSelectedGameSlot('');
    } finally {
      setPendingOperation(null);
    }
  };

  const publishSelectedGamePlan = async () => {
    if (selectedGameSlot === '') return;
    setGamePublicationError(null);
    const publication = await runProfileOperation('publishGame', () =>
      operations.publishGame(selectedGameSlot),
    );
    if (publication.status === 'success') {
      closeGamePublication();
    } else if (publication.status === 'failure') {
      setGamePublicationError(publication.message);
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
              {operations.gamePlanAvailable && (
                <>
                  <DropdownMenu.Separator className="project-file-menu-separator" />
                  <DropdownMenu.Item
                    className="project-file-menu-item"
                    disabled={pendingOperation !== null || !hasProject}
                    onSelect={() =>
                      queueFileMenuAction(() => {
                        void openGamePublication();
                      })
                    }
                  >
                    <ActionIcon name="publish" />
                    {pendingOperation === 'publishGame' ? 'Publishing…' : 'Publish to Game…'}
                  </DropdownMenu.Item>
                </>
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
      {gameReadiness !== null && (
        <GamePublicationDialog
          readiness={gameReadiness}
          onCancel={closeGamePublication}
          onOpenPage={(url) => {
            operations.openGamePage(url).catch((error: unknown) => {
              setGamePublicationError(error instanceof Error ? error.message : String(error));
            });
          }}
          onOpenSettings={
            onOpenSettings === undefined
              ? undefined
              : () => {
                  closeGamePublication();
                  onOpenSettings();
                }
          }
          onPublish={() => void publishSelectedGamePlan()}
          onSlotChange={setSelectedGameSlot}
          error={gamePublicationError}
          pending={pendingOperation === 'publishGame'}
          selectedSlot={selectedGameSlot}
        />
      )}
    </section>
  );
}
