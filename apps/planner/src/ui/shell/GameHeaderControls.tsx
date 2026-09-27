import { useEffect, useState, useSyncExternalStore, type Ref } from 'react';

import type {
  GamePlanSlotNumber,
  GameStatusController,
  GameStatusSnapshot,
} from '@planner/persistence/gameModuleHost';
import { projectGameIndicator, projectGameQuickSend } from '@planner/projections/gamePanel';
import { useAppSelector, type RootState } from '@planner/state/store';
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

interface QuickSendFeedback {
  readonly tone: 'success' | 'failure';
  readonly text: string;
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
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<QuickSendFeedback | null>(null);

  useEffect(() => {
    if (gameStatus === undefined) return;
    const refresh = () => {
      gameStatus.refresh().catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [gameStatus]);
  useEffect(() => {
    if (feedback?.tone !== 'success') return;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const indicator = gameStatus === undefined ? null : projectGameIndicator(snapshot);
  const quickSend = projectGameQuickSend(snapshot.status, projectId);

  // The plan is compiled only here, by the publish path, when the user asks to send.
  const send = async (slot: GamePlanSlotNumber) => {
    if (pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = await operations.publishGame(slot);
      setFeedback(
        result.status === 'success'
          ? { tone: 'success', text: `Sent to slot ${slot}.` }
          : { tone: 'failure', text: `${result.message} Open Game to check.` },
      );
      await gameStatus?.refresh();
    } catch (error) {
      setFeedback({
        tone: 'failure',
        text: `${error instanceof Error ? error.message : String(error)} Open Game to check.`,
      });
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
