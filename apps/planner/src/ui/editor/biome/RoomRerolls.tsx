import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  ContextualPickerItem,
  ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceLockedDoors,
  type WorkspaceRoomRerolls,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingMark, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RewardOfferPicker } from '../rewards/RewardEditors';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { hintProps } from '@planner/ui/controls/hint';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { RoomNumberIcon } from './RoomNumberIcon';
import { TimelineRow } from './TimelineRow';
import { DoorChips } from './DecisionWorkbench';
import type { DoorChip } from './doorSummary';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';

const emptyTargets: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function appendHint(locked: WorkspaceRoomRerolls['appendLocked']): string | undefined {
  switch (locked) {
    case undefined:
      return undefined;
    case 'unreached':
      return candidateWaitingHint;
    case 'notEnabled':
      return 'Rerolls are not enabled.';
    case 'poolEmpty':
      return 'No rerolls left.';
  }
}

const targetNouns = {
  door: { lower: 'door' },
  offer: { lower: 'offer' },
} as const;

/**
 * A Hub stay's list: its presses, each with its drag handle, among the other rows of
 * the stay. It places every one of the surface's presses exactly once.
 */
export type RoomRerollsOrder = readonly (
  | { readonly kind: 'press'; readonly key: string; readonly move: ReactNode }
  | { readonly kind: 'row'; readonly key: string; readonly row: ReactNode }
)[];

/** Resolves each ordered press to its row, refusing an order that drops or invents one. */
function orderedRows(order: RoomRerollsOrder, rows: WorkspaceRoomRerolls['rows']) {
  const pressKeys = order.flatMap((entry) => (entry.kind === 'press' ? [entry.key] : []));
  const resolved = order.map((entry) => {
    if (entry.kind === 'row') return entry;
    const index = rows.findIndex((row) => row.key === entry.key);
    if (index < 0) throw new Error(`Reroll order names unknown press ${entry.key}`);
    return { kind: 'press' as const, press: rows[index]!, index, move: entry.move };
  });
  if (pressKeys.length !== rows.length || new Set(pressKeys).size !== rows.length) {
    throw new Error(`Reroll order places ${pressKeys.length} of ${rows.length} presses`);
  }
  return resolved;
}

/** The run's rerolls left, as the reroll die and its count. */
export function RerollCount({ remaining }: { readonly remaining: number }) {
  return (
    <span
      {...hintProps('Rerolls left', undefined, `${remaining} rerolls left`)}
      aria-label={`${remaining} rerolls left`}
      className="room-rerolls-count"
      role="img"
      tabIndex={0}
    >
      <img alt="" src={rerollDieArtwork} />
      <span aria-hidden="true">{remaining}</span>
    </span>
  );
}

/** One surface's rerolls in order, with a new press appended at the end. */
export function RoomRerolls({
  heading,
  interactions,
  label = 'Rerolls',
  order,
  rerolls,
  showCount = true,
}: {
  /** The list's own header; its die then adds a press from the header. */
  readonly heading?: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  /** The list's rows in order, where other rows stand among the presses. */
  readonly order?: RoomRerollsOrder;
  readonly rerolls: WorkspaceRoomRerolls;
  /** False where one count stands for several lists. */
  readonly showCount?: boolean;
}) {
  const interaction = requireWorkspaceInteraction(interactions.roomRerolls, rerolls.interactionKey);
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const findingMark = useFindingMark();
  const [pendingTarget, setPendingTarget] = useState<string>();
  // Ending a pending press unmounts its row; focus returns to the next press's trigger.
  const refocusAppend = useRef(false);
  const endPending = () => {
    refocusAppend.current = true;
    setPendingTarget(undefined);
  };
  const idPrefix = `rerolls-${rerolls.interactionKey}`;
  const lockedHint = appendHint(rerolls.appendLocked);
  // A target picked before an edit that no longer offers it is forgotten.
  const pending =
    pendingTarget !== undefined &&
    rerolls.appendLocked === undefined &&
    interaction.targets(pendingTarget).selected !== undefined
      ? pendingTarget
      : undefined;
  const targets = interaction.targets(undefined);
  const pendingLabel =
    pending === undefined ? undefined : interaction.targets(pending).selected?.label;
  const noun = targetNouns[rerolls.targetNoun];
  useEffect(() => {
    if (pending !== undefined || !refocusAppend.current) return;
    refocusAppend.current = false;
    document.getElementById(`${idPrefix}-target`)?.focus();
  });
  const arrow = (
    <span aria-hidden="true" className="row-reward-arrow">
      →
    </span>
  );
  const verb = (
    <span aria-label="Reroll" className="room-reroll-verb" role="img">
      <img alt="" src={rerollDieArtwork} />
    </span>
  );
  const pressRow = (row: WorkspaceRoomRerolls['rows'][number], index: number, move: ReactNode) => (
    <li className="room-reroll-row" data-reorder-anchor={row.key} key={row.key}>
      {move}
      {verb}
      {row.targetRoom === undefined ? (
        <FixedValueChip label={row.targetLabel} />
      ) : (
        <span aria-label={row.targetLabel} className="room-reroll-target-room" role="img">
          <RoomNumberIcon number={row.targetRoom.roomNumber} room={row.targetRoom.roomIcon} />
        </span>
      )}
      {arrow}
      <RewardOfferPicker
        ariaLabel={`Reroll ${index + 1} reward`}
        findingTarget={findingTarget(row.address)}
        id={semanticOwnerControlElementId(row.address)}
        label=""
        offer={row.reward}
        onReplace={(reward) => executeIntent(interaction.replaceRewardIntent(row.key, reward))}
        resolver={interaction.rowReward(row.key)}
        triggerSize="icon"
      />
      <button
        {...findingMark(row.address, 'delete')}
        aria-label={`Remove reroll ${index + 1}`}
        className="danger-action room-action-delete"
        onClick={() => executeIntent(interaction.removeIntent(row.key))}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />
        </svg>
      </button>
    </li>
  );
  const appendPicker = (
    <ContextualPicker<string>
      ariaLabel={`New reroll ${noun.lower}`}
      {...(lockedHint === undefined ? {} : { disabledHint: lockedHint })}
      id={`${idPrefix}-target`}
      label=""
      model={lockedHint === undefined ? targets : emptyTargets}
      onSelect={setPendingTarget}
      placeholder="+"
      searchable={false}
      triggerIcon={rerollDieArtwork}
      triggerLabel="+"
      triggerSize="content"
    />
  );
  return (
    <section
      aria-label={label}
      className="room-rerolls"
      {...(order === undefined ? {} : { 'data-movable': 'true' })}
    >
      <header className="room-rerolls-heading">
        {heading === undefined ? <h4 className="visually-hidden">{label}</h4> : heading}
        {rerolls.poolRemaining === undefined || !showCount ? null : (
          <RerollCount remaining={rerolls.poolRemaining} />
        )}
        {heading === undefined || pending !== undefined ? null : (
          <span className="room-reroll-append">{appendPicker}</span>
        )}
      </header>
      <ol className="room-rerolls-list">
        {order === undefined
          ? rerolls.rows.map((row, index) => pressRow(row, index, undefined))
          : orderedRows(order, rerolls.rows).map((entry) =>
              entry.kind === 'row' ? entry.row : pressRow(entry.press, entry.index, entry.move),
            )}
        {pending === undefined ? (
          heading === undefined ? (
            <li className="room-reroll-append">{appendPicker}</li>
          ) : null
        ) : (
          <li className="room-reroll-row room-reroll-pending">
            {order === undefined ? null : (
              <span aria-hidden="true" className="room-reroll-move-slot" />
            )}
            {verb}
            <FixedValueChip label={pendingLabel ?? ''} />
            {arrow}
            <RewardOfferPicker
              ariaLabel="New reroll reward"
              defaultOpen
              id={`${idPrefix}-reward`}
              key={pending}
              label=""
              offer={null}
              onDismiss={endPending}
              onReplace={(reward) => {
                endPending();
                executeIntent(interaction.appendIntent(pending, reward));
              }}
              resolver={interaction.pendingReward(pending)}
              triggerSize="icon"
            />
          </li>
        )}
      </ol>
    </section>
  );
}

const unlockPrefix = 'unlock:';

/**
 * The room's Doors as an object beside its Timeline: a reroll pick names the
 * door (or its cage) to reroll, then its new reward; an unlock pick presses a
 * locked door. Each appends one action after the room's other actions.
 */
export function DoorsRerollEntry({
  interactions,
  name = 'Doors',
  pressIcon,
  rerolls,
  unlocks,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  /** The object's name: the room's Doors, or a Ship phase's Wheel. */
  readonly name?: string;
  /** The reward an unlock's door or a reroll's target shows, by option key. */
  readonly pressIcon?: (key: string) => ArtworkSource | undefined;
  readonly rerolls?: WorkspaceRoomRerolls;
  /** The locked doors' presses the Doors object can add. */
  readonly unlocks?: NonNullable<WorkspaceLockedDoors['unlocks']>;
}) {
  const interaction =
    rerolls === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomRerolls, rerolls.interactionKey);
  const unlockInteraction =
    unlocks === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomObjectEntries, unlocks.interactionKey);
  const executeIntent = useCommandIntent();
  const [pendingTarget, setPendingTarget] = useState<string>();
  // Ending a pending press brings back the object's picker, which takes focus again.
  const refocus = useRef(false);
  const endPending = () => {
    refocus.current = true;
    setPendingTarget(undefined);
  };
  const idPrefix = `doors-object-${rerolls?.interactionKey ?? unlocks?.interactionKey ?? name}`;
  useEffect(() => {
    if (pendingTarget !== undefined || !refocus.current) return;
    refocus.current = false;
    document.getElementById(`${idPrefix}-target`)?.focus();
  });
  const rerollHint = rerolls === undefined ? undefined : appendHint(rerolls.appendLocked);
  const pending =
    interaction !== undefined &&
    pendingTarget !== undefined &&
    rerolls?.appendLocked === undefined &&
    interaction.targets(pendingTarget).selected !== undefined
      ? pendingTarget
      : undefined;
  const pendingLabel =
    pending === undefined ? undefined : interaction?.targets(pending).selected?.label;
  // Each option is one press: the die marks it, then the rerolls left before it and its cost.
  const spend =
    rerolls?.poolRemaining === undefined || rerolls.pressCost === undefined
      ? undefined
      : `· ${rerolls.poolRemaining} (\u2212${rerolls.pressCost})`;
  const targets =
    interaction === undefined || rerollHint !== undefined
      ? undefined
      : interaction.targets(undefined);
  const unlockSection =
    unlocks === undefined || unlocks.options.length === 0
      ? []
      : [
          Object.freeze({
            collapsible: false,
            items: Object.freeze(
              unlocks.options.map((option) =>
                Object.freeze({
                  disabled: false,
                  key: `${unlockPrefix}${option.exitKey}`,
                  label: option.label,
                  selected: false,
                  state: 'possible' as const,
                  value: `${unlockPrefix}${option.exitKey}`,
                }),
              ),
            ),
            key: 'category:unlock',
            kind: 'category' as const,
            label: 'Unlock',
          }),
        ];
  const presses: ContextualPickerModel<string> = Object.freeze({
    sections: Object.freeze([
      ...unlockSection,
      ...(targets?.sections ?? []).map((section) =>
        Object.freeze({
          ...section,
          items: section.items.map((item) =>
            Object.freeze({
              ...item,
              label: `Reroll ${item.label}`,
              ...(spend === undefined ? {} : { status: spend }),
            }),
          ),
        }),
      ),
    ]),
  });
  const empty = presses.sections.length === 0;
  const lockedHint = empty ? (rerollHint ?? candidateWaitingHint) : undefined;
  return (
    <TimelineRow
      className="room-action-feature-roll"
      data-feature="doors"
      kind="insertion"
      label={
        pending === undefined ? (
          <ContextualPicker<string>
            ariaLabel={name}
            {...(lockedHint === undefined ? {} : { disabledHint: lockedHint })}
            id={`${idPrefix}-target`}
            {...(pressIcon === undefined
              ? {}
              : {
                  itemIcon: (item: ContextualPickerItem<string>) =>
                    pressIcon(
                      item.value.startsWith(unlockPrefix)
                        ? item.value.slice(unlockPrefix.length)
                        : item.value,
                    ),
                })}
            itemTrailIcon={(item) =>
              item.value.startsWith(unlockPrefix) ? undefined : rerollDieArtwork
            }
            label=""
            model={empty ? emptyTargets : presses}
            onSelect={(value) => {
              if (value.startsWith(unlockPrefix)) {
                if (unlockInteraction !== undefined)
                  executeIntent(unlockInteraction.intentFor(value.slice(unlockPrefix.length)));
                return;
              }
              setPendingTarget(value);
            }}
            placeholder={name}
            searchable={false}
          />
        ) : (
          // The target picker gives way while the reward is picked, so closing it does not dismiss that.
          <FixedValueChip label={`Reroll ${pendingLabel ?? ''}`} />
        )
      }
      editors={
        pending === undefined || interaction === undefined ? null : (
          <RewardOfferPicker
            ariaLabel="New reroll reward"
            defaultOpen
            id={`${idPrefix}-reward`}
            key={pending}
            label=""
            offer={null}
            onDismiss={endPending}
            onReplace={(reward) => {
              endPending();
              executeIntent(interaction.appendIntent(pending, reward));
            }}
            resolver={interaction.pendingReward(pending)}
            triggerSize="icon"
          />
        )
      }
    />
  );
}

/** One door press on its Timeline row: its new reward, picked in place. */
export function DoorRerollRowReward({
  chips,
  interactions,
  rerolls,
  rowKey,
}: {
  /** The room's door chips as first drawn; the row shows them as this press leaves them. */
  readonly chips?: readonly DoorChip[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rerolls: WorkspaceRoomRerolls;
  readonly rowKey: string;
}) {
  const interaction = requireWorkspaceInteraction(interactions.roomRerolls, rerolls.interactionKey);
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const row = rerolls.rows.find((candidate) => candidate.key === rowKey);
  if (row === undefined) return null;
  const doors = row.doors;
  const after = doors?.after;
  const chipsAfter =
    chips === undefined || after === undefined
      ? undefined
      : chips.map((chip) => {
          const door = after.find((candidate) => candidate.exitKey === chip.key);
          return door === undefined
            ? chip
            : {
                ...chip,
                locked: door.locked === true,
                rewards: door.rewards.flatMap((offer) =>
                  offer === null ? [] : [offerIcon(offer)],
                ),
              };
        });
  return (
    <>
      <span className="room-reroll-row-inline">
        <span>{doors?.doorLabel ?? row.targetLabel}</span>
        {doors?.before == null ? null : (
          <ArtworkIcon className="artwork-label-icon" source={offerIcon(doors.before)} />
        )}
        <span aria-hidden="true" className="row-reward-arrow">
          →
        </span>
        <RewardOfferPicker
          ariaLabel={`${row.targetLabel} reroll reward`}
          findingTarget={findingTarget(row.address)}
          id={semanticOwnerControlElementId(row.address)}
          label=""
          offer={row.reward}
          onReplace={(reward) => executeIntent(interaction.replaceRewardIntent(row.key, reward))}
          resolver={interaction.rowReward(row.key)}
          triggerSize="icon"
        />
      </span>
      {chipsAfter === undefined ? null : (
        <span className="room-reroll-row-doors">
          <DoorChips chips={chipsAfter} />
        </span>
      )}
    </>
  );
}
