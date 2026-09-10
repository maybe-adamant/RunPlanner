import { useCallback, useEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import {
  GAME_PLAN_SLOT_NUMBERS,
  type GamePlanDiscovery,
  type GamePlanSlotNumber,
} from '@planner/persistence/gamePlanPublisher';
import { selectProfileSession, selectProfileStatus, useAppSelector } from '@planner/state/store';
import { ActionIcon } from '../controls/ActionIcon';

function GamePublicationDialog({
  discovery,
  pending,
  selectedProfile,
  selectedSlot,
  onCancel,
  onProfileChange,
  onPublish,
  onSlotChange,
}: {
  readonly discovery: GamePlanDiscovery;
  readonly pending: boolean;
  readonly selectedProfile: string;
  readonly selectedSlot: GamePlanSlotNumber | '';
  readonly onCancel: () => void;
  readonly onProfileChange: (profileId: string) => void;
  readonly onPublish: () => void;
  readonly onSlotChange: (slot: GamePlanSlotNumber | '') => void;
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
        <fieldset className="game-publication-selection">
          <legend className="visually-hidden">Publication target</legend>
          <label htmlFor="game-profile-target">Profile</label>
          <select
            id="game-profile-target"
            disabled={pending}
            onChange={(event) => onProfileChange(event.target.value)}
            value={selectedProfile}
          >
            <option value="">Choose profile…</option>
            {discovery.targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
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
        <footer className="game-publication-actions">
          <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="secondary-action"
            disabled={pending || selectedProfile.length === 0 || selectedSlot === ''}
            onClick={onPublish}
            type="button"
          >
            {pending ? 'Publishing…' : 'Publish'}
          </button>
        </footer>
      </section>
    </dialog>
  );
}

export function ProjectFileControls({
  operations,
  routes,
  hasProject,
  entryOpen,
  onEntryOpenChange,
}: {
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
  readonly hasProject: boolean;
  readonly entryOpen: boolean;
  readonly onEntryOpenChange: (open: boolean) => void;
}) {
  const profileSession = useAppSelector(selectProfileSession);
  const profileStatus = useAppSelector(selectProfileStatus);
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<ProjectOperation | null>(null);
  const [gameDiscovery, setGameDiscovery] = useState<GamePlanDiscovery | null>(null);
  const [selectedGameProfile, setSelectedGameProfile] = useState<string>('');
  const [selectedGameSlot, setSelectedGameSlot] = useState<GamePlanSlotNumber | ''>('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const closeGamePublication = useCallback(() => {
    setGameDiscovery(null);
    setSelectedGameProfile('');
    setSelectedGameSlot('');
  }, []);
  const runProfileOperation = async (
    operation: ProjectOperation,
    run: () => Promise<ProjectOperationResult>,
  ): Promise<ProjectOperationResult> => {
    setPendingOperation(operation);
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

  const discoverAndPublishGamePlan = async () => {
    setPendingOperation('publishGame');
    try {
      const discovery = await operations.discoverGameProfiles();
      setGameDiscovery(discovery);
      if (discovery.status === 'available' && discovery.targets.length > 0) {
        setSelectedGameProfile(discovery.targets.length === 1 ? discovery.targets[0]!.id : '');
        setSelectedGameSlot('');
      } else {
        setResult({
          operation: 'publishGame',
          status: discovery.status === 'available' ? 'cancelled' : 'failure',
          message: discovery.message,
        });
      }
    } finally {
      setPendingOperation(null);
    }
  };

  const publishSelectedGamePlan = async () => {
    if (selectedGameProfile.length === 0 || selectedGameSlot === '') return;
    const publication = await runProfileOperation('publishGame', () =>
      operations.publishGame(selectedGameProfile, selectedGameSlot),
    );
    if (publication.status === 'success') {
      closeGamePublication();
    }
  };

  const queueFileMenuAction = (action: () => void) => {
    setFileMenuOpen(false);
    window.setTimeout(action, 0);
  };

  const feedback = (
    <div className="project-profile-feedback">
      {hasProject && (
        <span
          aria-label={`Profile status: ${profileStatus}`}
          className="profile-status"
          data-profile-status={profileStatus.toLowerCase()}
          role="status"
        >
          {profileStatus}
        </span>
      )}
      {profileSession.recoveryError !== null && (
        <p className="project-operation-result" data-status="failure" role="alert">
          {profileSession.recoveryError}
        </p>
      )}
      {profileSession.autosaveError !== null && (
        <p className="project-operation-result" data-status="failure" role="alert">
          {profileSession.autosaveError}
        </p>
      )}
      {profileSession.profileFileError !== null && (
        <p className="project-operation-result" data-status="failure" role="alert">
          {profileSession.profileFileError}
        </p>
      )}
      {result !== null && (
        <p
          className="project-operation-result"
          data-status={result.status}
          role={result.status === 'failure' ? 'alert' : 'status'}
        >
          {result.message}
        </p>
      )}
    </div>
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
          <p>
            Start with one complete run path. You can configure its rooms, rewards, and run state
            after choosing.
          </p>
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
                  void runProfileOperation('new', () => operations.createNew(route.routeKey));
                }}
                type="button"
              >
                <span className="route-choice-name">{route.label}</span>
                <span className="route-choice-biomes">
                  {route.biomePanels.map((biome) => biome.label).join(' → ')}
                </span>
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
                  <ActionIcon name="save" />
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
                        void discoverAndPublishGamePlan();
                      })
                    }
                  >
                    <ActionIcon name="save" />
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
      {gameDiscovery?.status === 'available' && gameDiscovery.targets.length > 0 && (
        <GamePublicationDialog
          discovery={gameDiscovery}
          onCancel={closeGamePublication}
          onProfileChange={setSelectedGameProfile}
          onPublish={() => void publishSelectedGamePlan()}
          onSlotChange={setSelectedGameSlot}
          pending={pendingOperation === 'publishGame'}
          selectedProfile={selectedGameProfile}
          selectedSlot={selectedGameSlot}
        />
      )}
    </section>
  );
}
