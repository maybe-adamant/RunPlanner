import { useEffect, useState, useSyncExternalStore, type Ref } from 'react';

import type {
  GamePlanSlotNumber,
  GameStatusController,
  GameStatusSnapshot,
} from '@planner/persistence/gameModuleHost';
import {
  gameSaveState,
  projectGameIndicator,
  projectGameQuickSend,
} from '@planner/projections/gamePanel';
import { gameSendFeedbackShown } from '@planner/state/gameSendSessionSlice';
import {
  selectProfileStatus,
  useAppDispatch,
  useAppSelector,
  type RootState,
} from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';

const EMPTY_SNAPSHOT: GameStatusSnapshot = Object.freeze({ status: null, error: null, readAt: 0 });
const NO_SNAPSHOT = () => EMPTY_SNAPSHOT;
const NO_SUBSCRIPTION = () => () => undefined;

// The engine's eligibility, already evaluated, decides sendability without compiling.
function sendableProjectId(state: RootState): string | null {
  const workspace = state.projectWorkspace;
  return workspace.kind === 'openProject' &&
    workspace.assembly.evaluation.route.summary.eligibleForExecutionPlan
    ? workspace.history.present.projectId
    : null;
}

function sentAt(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function GameHeaderControls({
  buttonRef,
  gameStatus,
  onOpen,
  operations,
}: {
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly gameStatus?: GameStatusController;
  readonly onOpen: () => void;
  readonly operations: ProjectOperations;
}) {
  const snapshot = useSyncExternalStore(
    gameStatus?.subscribe ?? NO_SUBSCRIPTION,
    gameStatus?.getSnapshot ?? NO_SNAPSHOT,
    NO_SNAPSHOT,
  );
  const projectId = useAppSelector(sendableProjectId);
  const lastSentSlot = useAppSelector((state) => state.gameSendSession.lastSentSlot);
  const feedback = useAppSelector((state) => state.gameSendSession.feedback);
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (gameStatus === undefined) return;
    const refresh = () => {
      gameStatus.refresh().catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [gameStatus]);
  const indicator = gameStatus === undefined ? null : projectGameIndicator(snapshot);
  const saveState = useAppSelector((state) =>
    gameSaveState(selectProfileStatus(state), state.profileSession.fileName),
  );
  const quickSend = projectGameQuickSend(snapshot.status, projectId, lastSentSlot, saveState);

  // The plan is compiled only here, by the publish path, when the user asks to send.
  const send = async (slot: GamePlanSlotNumber) => {
    if (pending) return;
    setPending(true);
    try {
      const result = await operations.publishGame(slot);
      dispatch(
        gameSendFeedbackShown(
          result.status === 'success'
            ? { tone: 'success', text: `Sent to slot ${slot} · ${sentAt()}` }
            : result.status === 'cancelled'
              ? { tone: 'success', text: `${result.message} · ${sentAt()}` }
              : { tone: 'failure', text: `${result.message} Open Game to check. · ${sentAt()}` },
        ),
      );
      await gameStatus?.refresh();
    } catch (error) {
      dispatch(
        gameSendFeedbackShown({
          tone: 'failure',
          text: `${error instanceof Error ? error.message : String(error)} Open Game to check. · ${sentAt()}`,
        }),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {quickSend === null ? null : (
        <button
          aria-disabled={pending || undefined}
          className="secondary-action action-compact"
          onClick={() => void send(quickSend.slot)}
          type="button"
        >
          {pending ? 'Sending…' : quickSend.label}
        </button>
      )}
      {gameStatus === undefined ? null : (
        <span className="game-header-feedback" data-tone={feedback?.tone} role="status">
          {feedback?.text ?? ''}
        </span>
      )}
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
