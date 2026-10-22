import { useState } from 'react';

import type { GamePlanSlotNumber, GameStatusController } from '@planner/persistence/gameModuleHost';
import {
  describeSentNotActivated,
  GAME_SEND_IDLE,
  projectLibrarySendButton,
  projectSendSlots,
} from '@planner/projections/gamePanel';
import { slotNamesBySlot, type LibraryRow } from '@planner/projections/libraryHome';
import type { GameActivationFailure } from '@planner/state/gameSendSessionSlice';
import { viewChanged } from '@planner/state/librarySessionSlice';
import { useAppDispatch } from '@planner/state/store';
import type { CurrentGamePlan, ProjectOperations } from '@planner/workspace/projectOperations';
import { GameSendSplit, ReplaceSlotDialog, SendSlotsPanel } from '../shell/GameSendControls';
import { useSendActivity } from '../shell/useSendActivity';
import { useGameStatusSnapshot, type LibrarySlotIndex } from './useLibrarySlotLinks';

/**
 * A Library row's In game cell: the quiet split send control. Whether the plan can be sent is
 * read only when the picker opens or a send is asked for.
 */
export function LibrarySendCell({
  gameStatus,
  index,
  onOpen,
  operations,
  row,
}: {
  readonly gameStatus: GameStatusController;
  readonly index: LibrarySlotIndex;
  /** Opens the plan in the editor. */
  readonly onOpen: () => void;
  readonly operations: ProjectOperations;
  readonly row: Extract<LibraryRow, { readonly kind: 'ready' }>;
}) {
  const dispatch = useAppDispatch();
  const snapshot = useGameStatusSnapshot(gameStatus);
  const [activity, setActivity] = useSendActivity();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<CurrentGamePlan | null>(null);
  const [replaceSlot, setReplaceSlot] = useState<GamePlanSlotNumber | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [activation, setActivation] = useState<GameActivationFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const status = snapshot.status;
  const button = projectLibrarySendButton(status, row.slots, activity, activation);

  const inspect = () => {
    setPlan(null);
    void operations.inspectLibraryGamePlan(row.key).then(setPlan);
  };
  const openPicker = (next: boolean) => {
    if (next && !open) inspect();
    setOpen(next);
  };
  const send = async (slot: GamePlanSlotNumber) => {
    setReplaceSlot(null);
    setActivity({ kind: 'sending' });
    setAnnouncement('');
    setFailure(null);
    setActivation(null);
    const result = await operations.publishLibraryPlan(row.key, slot);
    if (result.blocked !== null) {
      // Not sendable: the picker says why.
      setActivity(GAME_SEND_IDLE);
      setPlan(result.blocked);
      setOpen(true);
      return;
    }
    if (result.status === 'success') {
      setActivity({ kind: 'sent', slot, atMs: Date.now() });
      if (result.activationProblem !== null) {
        setActivation({ slot, message: result.activationProblem, atMs: Date.now() });
      }
      setAnnouncement(`Sent to slot ${slot}.`);
    } else {
      setActivity({ kind: 'failed' });
      setFailure(result.message);
      setAnnouncement(`Not sent: ${result.message}`);
    }
    await gameStatus.refresh();
  };

  const slots =
    status === null
      ? null
      : projectSendSlots(
          status,
          plan ?? { kind: 'noProject' },
          row.projectId,
          slotNamesBySlot(index.links),
          snapshot.readAt,
        );
  // An unreadable file has no editor to repair it in.
  const repairable = plan !== null && plan.kind !== 'unreadable';

  return (
    <>
      <GameSendSplit
        announcement={announcement}
        button={button}
        ghost
        label={`Send ${row.name} to game`}
        more={button.more}
        onOpenChange={openPicker}
        onSend={(slot) => void send(slot)}
        open={open}
      >
        <SendSlotsPanel
          checking={plan === null}
          failure={failure}
          notActivated={describeSentNotActivated(activation, status)}
          onOpenGame={() => {
            setOpen(false);
            dispatch(viewChanged({ kind: 'home', tab: 'game' }));
          }}
          onSend={(slot, confirm) => {
            setOpen(false);
            if (confirm) setReplaceSlot(slot);
            else void send(slot);
          }}
          pending={activity.kind === 'sending'}
          remedy={
            !repairable
              ? undefined
              : {
                  label: 'Open in editor',
                  run: () => {
                    setOpen(false);
                    onOpen();
                  },
                }
          }
          slots={slots}
        />
      </GameSendSplit>
      {replaceSlot !== null && (
        <ReplaceSlotDialog
          onCancel={() => setReplaceSlot(null)}
          onConfirm={() => void send(replaceSlot)}
          pending={activity.kind === 'sending'}
          slot={replaceSlot}
        />
      )}
    </>
  );
}
