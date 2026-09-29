import { useEffect, useState, useSyncExternalStore, type Ref } from 'react';

import type {
  GamePlanSlotNumber,
  GameStatusController,
  GameStatusSnapshot,
} from '@planner/persistence/gameModuleHost';
import {
  describeSent,
  gameSaveState,
  projectGameIndicator,
  projectGameSendButton,
  type GameSendActivity,
  type GameSendProject,
} from '@planner/projections/gamePanel';
import { selectProfileStatus, useAppSelector, type RootState } from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';

const EMPTY_SNAPSHOT: GameStatusSnapshot = Object.freeze({ status: null, error: null, readAt: 0 });
const NO_SNAPSHOT = () => EMPTY_SNAPSHOT;
const NO_SUBSCRIPTION = () => () => undefined;
const IDLE: GameSendActivity = Object.freeze({ kind: 'idle' });
/** How long a send's result stays on the button. */
const GAME_SEND_RESULT_MS = 3000;

function sendProjectId(state: RootState): string | null {
  const workspace = state.projectWorkspace;
  return workspace.kind === 'openProject' ? workspace.history.present.projectId : null;
}

function sendRouteKey(state: RootState): string | null {
  const workspace = state.projectWorkspace;
  return workspace.kind === 'openProject' ? workspace.history.present.route.routeKey : null;
}

// The engine's eligibility, already evaluated, decides sendability without compiling.
function sendEligible(state: RootState): boolean {
  const workspace = state.projectWorkspace;
  return (
    workspace.kind === 'openProject' &&
    workspace.assembly.evaluation.route.summary.eligibleForExecutionPlan
  );
}

export function GameHeaderControls({
  buttonRef,
  gameStatus,
  onOpen,
  onOpenPlans,
  operations,
}: {
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly gameStatus?: GameStatusController;
  readonly onOpen: () => void;
  readonly onOpenPlans: () => void;
  readonly operations: ProjectOperations;
}) {
  const snapshot = useSyncExternalStore(
    gameStatus?.subscribe ?? NO_SUBSCRIPTION,
    gameStatus?.getSnapshot ?? NO_SNAPSHOT,
    NO_SNAPSHOT,
  );
  const projectId = useAppSelector(sendProjectId);
  const eligible = useAppSelector(sendEligible);
  const routeKey = useAppSelector(sendRouteKey);
  const lastSentSlot = useAppSelector((state) => state.gameSendSession.lastSentSlot);
  const lastSendFailed = useAppSelector((state) => state.gameSendSession.lastFailure !== null);
  const activationFailure = useAppSelector((state) => state.gameSendSession.lastActivationFailure);
  const saveState = useAppSelector((state) =>
    gameSaveState(selectProfileStatus(state), state.profileSession.fileName),
  );
  const [activity, setActivity] = useState<GameSendActivity>(IDLE);
  // A successful send is announced from state, so it reflects the slot as last read.
  const [announcement, setAnnouncement] = useState<string | { readonly sent: GamePlanSlotNumber }>(
    '',
  );

  useEffect(() => {
    if (gameStatus === undefined) return;
    const refresh = () => {
      gameStatus.refresh().catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [gameStatus]);
  // A send's result shows for a fixed time, then the button returns to its state.
  useEffect(() => {
    if (activity.kind !== 'sent' && activity.kind !== 'failed') return;
    const timer = window.setTimeout(() => setActivity(IDLE), GAME_SEND_RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [activity]);

  const indicator =
    gameStatus === undefined ? null : projectGameIndicator(snapshot, lastSendFailed);
  const restriction = routeKey === null ? null : operations.gamePublicationRestriction(routeKey);
  const project: GameSendProject | null =
    projectId === null
      ? null
      : { projectId, eligible, ...(restriction === null ? {} : { restriction }) };
  const button = projectGameSendButton(
    snapshot.status,
    project,
    lastSentSlot,
    saveState,
    activity,
    activationFailure,
  );

  // The plan is compiled only here, by the publish path, when the user asks to send.
  const send = async (slot: GamePlanSlotNumber) => {
    setActivity({ kind: 'sending' });
    setAnnouncement('');
    try {
      const result = await operations.publishGame(slot);
      if (result.status === 'success') {
        setActivity({ kind: 'sent', slot, atMs: Date.now() });
        setAnnouncement({ sent: slot });
      } else if (result.status === 'failure') {
        setActivity({ kind: 'failed' });
        setAnnouncement(`Not sent: ${result.message}`);
      } else {
        setActivity(IDLE);
        setAnnouncement(result.message);
      }
      await gameStatus?.refresh();
    } catch (error) {
      setActivity({ kind: 'failed' });
      setAnnouncement(`Not sent: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <>
      <button
        aria-describedby={button.description === null ? undefined : 'game-send-description'}
        aria-disabled={button.action === null || undefined}
        className="secondary-action action-compact game-send-button"
        data-state={button.state}
        onClick={() => {
          const action = button.action;
          if (action === null) return;
          if (action.kind === 'openPlans') onOpenPlans();
          else void send(action.slot);
        }}
        title={button.description ?? undefined}
        type="button"
      >
        {button.label}
      </button>
      <span hidden id="game-send-description">
        {button.description}
      </span>
      <span className="visually-hidden game-send-status" role="status">
        {typeof announcement === 'string'
          ? announcement
          : describeSent(announcement.sent, activationFailure, snapshot.status)}
      </span>
      <button
        {...(indicator === null ? {} : { 'aria-label': indicator.accessibleName })}
        className="quiet-action action-compact"
        onClick={onOpen}
        ref={buttonRef}
        type="button"
      >
        Game
        {indicator === null ? null : (
          <span aria-hidden="true" className="game-indicator" data-state={indicator.state}>
            {indicator.symbol}
          </span>
        )}
      </button>
    </>
  );
}
