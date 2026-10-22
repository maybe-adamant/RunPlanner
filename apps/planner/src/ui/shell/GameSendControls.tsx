import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import type { GamePlanSlotNumber, GameStatusController } from '@planner/persistence/gameModuleHost';
import {
  describeLastSendFailure,
  describeSent,
  describeSentNotActivated,
  projectGameSendButton,
  projectSendSlots,
  type GameSendActivity,
  type GameSendProject,
  type SendSlotOccupant,
} from '@planner/projections/gamePanel';
import { viewChanged } from '@planner/state/librarySessionSlice';
import { useAppDispatch, useAppSelector, type RootState } from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import { ConfirmationDialog } from '../controls/ConfirmationDialog';
import { hintProps } from '../controls/hint';
import {
  useGameStatusRefresh,
  useGameStatusSnapshot,
  useLibrarySlotLinks,
} from '../home/useLibrarySlotLinks';

const IDLE: GameSendActivity = Object.freeze({ kind: 'idle' });
/** How long a send's result stays on the button. */
const GAME_SEND_RESULT_MS = 3000;

function sendProjectId(state: RootState): string | null {
  const workspace = state.projectWorkspace;
  return workspace.kind === 'openProject' ? workspace.history.present.projectId : null;
}

// The engine's eligibility, already evaluated, decides sendability without compiling.
function sendEligible(state: RootState): boolean {
  const workspace = state.projectWorkspace;
  return (
    workspace.kind === 'openProject' &&
    workspace.assembly.evaluation.route.summary.eligibleForExecutionPlan
  );
}

function Occupant({ occupant }: { readonly occupant: SendSlotOccupant }) {
  switch (occupant.kind) {
    case 'thisPlan':
      return <span className="send-slot-occupant">This plan · {occupant.marker}</span>;
    case 'plan':
      return <span className="send-slot-occupant">{occupant.name}</span>;
    case 'notInLibrary':
      return <span className="send-slot-occupant home-slot-unlinked">Not in library</span>;
    case 'empty':
      return <span className="send-slot-occupant home-muted">Empty</span>;
    case 'unreadable':
      return <span className="send-slot-occupant home-muted">Unreadable</span>;
  }
}

/** The Slots popover's content, read when it opens. */
function SlotsPanel({
  gameStatus,
  onOpenGame,
  onSend,
  onShowFindings,
  operations,
  pending,
}: {
  readonly gameStatus: GameStatusController;
  readonly onOpenGame: () => void;
  readonly onSend: (slot: GamePlanSlotNumber, confirm: boolean) => void;
  readonly onShowFindings: (() => void) | undefined;
  readonly operations: ProjectOperations;
  readonly pending: boolean;
}) {
  const snapshot = useGameStatusSnapshot(gameStatus);
  const index = useLibrarySlotLinks(operations, gameStatus, { compare: false });
  const projectId = useAppSelector(sendProjectId);
  const lastFailure = useAppSelector((state) => state.gameSendSession.lastFailure);
  const activationFailure = useAppSelector((state) => state.gameSendSession.lastActivationFailure);
  const status = snapshot.status;
  const names = new Map(
    Array.from(index.links.bySlot, ([slot, linked]) => [slot, linked.name] as const),
  );
  const slots =
    status === null
      ? null
      : projectSendSlots(
          status,
          operations.inspectCurrentGamePlan(),
          projectId,
          names,
          snapshot.readAt,
        );
  const notActivated = describeSentNotActivated(activationFailure, status);
  return (
    <div className="send-slots">
      {slots === null ? (
        <p className="home-muted">Choose the game location on the Game tab to send this plan.</p>
      ) : (
        <>
          {slots.own.length === 0 ? null : (
            <ul aria-label="This plan in game" className="send-own-slots">
              {slots.own.map((own) => (
                <li key={own.slot}>
                  <span>
                    Slot {own.slot} ·{' '}
                    <span className="slot-marker" data-marker={own.marker}>
                      {own.marker}
                    </span>
                    {own.playsNext ? ' · plays next' : null}
                  </span>
                  {own.marker === 'current' || slots.unavailableReason !== null ? (
                    own.sent === null ? null : (
                      <span className="home-muted">
                        sent <time dateTime={own.sent.iso}>{own.sent.ago}</time>
                      </span>
                    )
                  ) : (
                    <button
                      className="secondary-action action-compact"
                      disabled={pending}
                      onClick={() => onSend(own.slot, false)}
                      type="button"
                    >
                      Update slot {own.slot}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {slots.unavailableReason === null ? null : (
            <div className="send-unavailable" role="note">
              <p>{slots.unavailableReason}</p>
              {onShowFindings === undefined ? null : (
                <button
                  className="secondary-action action-compact"
                  onClick={onShowFindings}
                  type="button"
                >
                  Show findings
                </button>
              )}
            </div>
          )}
          <h3 className="send-slots-title">
            {slots.own.length === 0 ? 'Send to a slot' : 'Send to another slot'}
          </h3>
          <ul aria-label="Slots" className="send-slot-picks">
            {slots.picks.map((pick) => (
              <li data-occupant={pick.occupant.kind} key={pick.slot}>
                <span className="send-slot-who">
                  <span className="send-slot-number">Slot {pick.slot}</span>
                  <Occupant occupant={pick.occupant} />
                </span>
                {pick.action === null ? null : (
                  <button
                    aria-label={`${pick.action.label} (slot ${pick.slot})`}
                    className={
                      pick.action.label === 'Replace'
                        ? 'quiet-action action-compact'
                        : 'secondary-action action-compact'
                    }
                    disabled={pending || !pick.action.enabled}
                    onClick={() => onSend(pick.slot, pick.action?.confirm === true)}
                    type="button"
                  >
                    {pick.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {lastFailure === null ? null : (
        <p className="home-problem" role="alert">
          {describeLastSendFailure(lastFailure)}
        </p>
      )}
      {notActivated === null ? null : (
        <p className="home-problem" role="alert">
          {notActivated}
        </p>
      )}
      <footer className="send-slots-foot">
        <span className="home-muted">Module, location and events live on Home.</span>
        <button className="text-action" onClick={onOpenGame} type="button">
          Open Game
        </button>
      </footer>
    </div>
  );
}

/** The editor's split send button and slot picker; Home owns everything else about the game. */
export function GameSendControls({
  gameStatus,
  onShowFindings,
  operations,
  startPointBlock,
}: {
  readonly gameStatus: GameStatusController | undefined;
  /** Present only when the evaluation has a finding to navigate to. */
  readonly onShowFindings: (() => void) | undefined;
  readonly operations: ProjectOperations;
  /** The engine's reason the authored start point blocks publication. */
  readonly startPointBlock?: GameSendProject['startPointBlock'];
}) {
  const dispatch = useAppDispatch();
  useGameStatusRefresh(gameStatus);
  const snapshot = useGameStatusSnapshot(gameStatus);
  const projectId = useAppSelector(sendProjectId);
  const eligible = useAppSelector(sendEligible);
  const lastSentSlot = useAppSelector((state) => state.gameSendSession.lastSentSlot);
  const activationFailure = useAppSelector((state) => state.gameSendSession.lastActivationFailure);
  const [activity, setActivity] = useState<GameSendActivity>(IDLE);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [replaceSlot, setReplaceSlot] = useState<GamePlanSlotNumber | null>(null);
  // A successful send is announced from state, so it reflects the slot as last read.
  const [announcement, setAnnouncement] = useState<string | { readonly sent: GamePlanSlotNumber }>(
    '',
  );

  // A send's result shows for a fixed time, then the button returns to its state.
  useEffect(() => {
    if (activity.kind !== 'sent' && activity.kind !== 'failed') return;
    const timer = window.setTimeout(() => setActivity(IDLE), GAME_SEND_RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [activity]);

  if (gameStatus === undefined) return null;

  // Comparing compiles the open plan, so it runs only while the plan is in a slot.
  const inGame =
    projectId !== null &&
    snapshot.status?.inspection?.planSlots.some((slot) => slot.projectId === projectId) === true;
  const current = inGame ? operations.inspectCurrentGamePlan() : null;
  const project: GameSendProject | null =
    projectId === null
      ? null
      : {
          projectId,
          eligible,
          ...(startPointBlock === undefined ? {} : { startPointBlock }),
          ...(current === null
            ? {}
            : { planFingerprint: current.kind === 'publishable' ? current.planFingerprint : null }),
        };
  const button = projectGameSendButton(
    snapshot.status,
    project,
    lastSentSlot,
    activity,
    activationFailure,
  );

  // The plan is compiled only here, by the publish path, when the user asks to send.
  const send = async (slot: GamePlanSlotNumber) => {
    setReplaceSlot(null);
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
      await gameStatus.refresh();
    } catch (error) {
      setActivity({ kind: 'failed' });
      setAnnouncement(`Not sent: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="editor-game-group">
      <Popover.Root onOpenChange={setSlotsOpen} open={slotsOpen}>
        <Popover.Anchor asChild>
          <div
            className="send-split"
            data-state={button.state}
            role="group"
            aria-label="Send to game"
          >
            <button
              aria-disabled={button.action === null || undefined}
              className="send-split-main"
              {...hintProps(button.description ?? undefined)}
              onClick={() => {
                const action = button.action;
                if (action === null) return;
                if (action.kind === 'openPlans') setSlotsOpen(true);
                else void send(action.slot);
              }}
              type="button"
            >
              {button.label}
            </button>
            <Popover.Trigger asChild>
              <button aria-label="Choose slot" className="send-split-toggle" type="button">
                <span aria-hidden="true">▾</span>
              </button>
            </Popover.Trigger>
          </div>
        </Popover.Anchor>
        <span className="visually-hidden game-send-status" role="status">
          {typeof announcement === 'string'
            ? announcement
            : describeSent(announcement.sent, activationFailure, snapshot.status)}
        </span>
        <Popover.Portal>
          <Popover.Content
            align="end"
            aria-label="Slots"
            className="send-slots-popover"
            collisionPadding={12}
            sideOffset={8}
          >
            <SlotsPanel
              gameStatus={gameStatus}
              onOpenGame={() => {
                setSlotsOpen(false);
                dispatch(viewChanged({ kind: 'home', tab: 'game' }));
              }}
              onSend={(slot, confirm) => {
                // The picker closes so the button shows the send's result.
                setSlotsOpen(false);
                if (confirm) setReplaceSlot(slot);
                else void send(slot);
              }}
              onShowFindings={
                onShowFindings === undefined
                  ? undefined
                  : () => {
                      setSlotsOpen(false);
                      onShowFindings();
                    }
              }
              operations={operations}
              pending={activity.kind === 'sending'}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {replaceSlot !== null && (
        <ConfirmationDialog
          confirmLabel="Replace"
          describedBy="game-plan-replace-message"
          id="game-plan-replace-title"
          onCancel={() => setReplaceSlot(null)}
          onConfirm={() => void send(replaceSlot)}
          pending={activity.kind === 'sending'}
          title={`Replace the plan in slot ${replaceSlot}?`}
        >
          <p className="game-publication-message" id="game-plan-replace-message">
            The plan already in this slot is overwritten with this plan. A run already in progress
            keeps the plan it started with.
          </p>
        </ConfirmationDialog>
      )}
    </div>
  );
}
