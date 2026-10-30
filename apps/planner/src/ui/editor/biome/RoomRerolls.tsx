import { useState, type ReactNode } from 'react';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomRerolls,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingMark, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RewardOfferPicker } from '../rewards/RewardEditors';

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
 * A Hub stay's list: its presses, each with its Move, among the other rows of
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

/** One surface's rerolls in order, with a new press appended at the end. */
export function RoomRerolls({
  interactions,
  order,
  rerolls,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  /** The list's rows in order, where other rows stand among the presses. */
  readonly order?: RoomRerollsOrder;
  readonly rerolls: WorkspaceRoomRerolls;
}) {
  const interaction = requireWorkspaceInteraction(interactions.roomRerolls, rerolls.interactionKey);
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const findingMark = useFindingMark();
  const [pendingTarget, setPendingTarget] = useState<string>();
  const idPrefix = `rerolls-${rerolls.interactionKey}`;
  const lockedHint = appendHint(rerolls.appendLocked);
  // A target picked before an edit that no longer offers it is forgotten.
  const pending =
    pendingTarget !== undefined &&
    rerolls.appendLocked === undefined &&
    interaction.targets(pendingTarget).selected !== undefined
      ? pendingTarget
      : undefined;
  const targets = interaction.targets(pending);
  const noun = targetNouns[rerolls.targetNoun];
  const pressRow = (row: WorkspaceRoomRerolls['rows'][number], index: number, move: ReactNode) => (
    <li className="room-reroll-row" key={row.key}>
      <span className="room-reroll-index">{index + 1}</span>
      <span className="room-reroll-target">{row.targetLabel}</span>
      <RewardOfferPicker
        ariaLabel={`Reroll ${index + 1} reward`}
        findingTarget={findingTarget(row.address)}
        id={semanticOwnerControlElementId(row.address)}
        label=""

        offer={row.reward}
        onReplace={(reward) => executeIntent(interaction.replaceRewardIntent(row.key, reward))}
        resolver={interaction.rowReward(row.key)}
      />
      {move}
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
  return (
    <section
      aria-label="Rerolls"
      className="room-rerolls"
      {...(order === undefined ? {} : { 'data-movable': 'true' })}
    >
      <header className="room-rerolls-heading">
        <h4>Rerolls</h4>
        {rerolls.poolRemaining === undefined ? null : (
          <span className="room-rerolls-pool">{`${rerolls.poolRemaining} left`}</span>
        )}
      </header>
      <ol className="room-rerolls-list">
        {order === undefined
          ? rerolls.rows.map((row, index) => pressRow(row, index, undefined))
          : orderedRows(order, rerolls.rows).map((entry) =>
              entry.kind === 'row' ? entry.row : pressRow(entry.press, entry.index, entry.move),
            )}
        <li className="room-reroll-row room-reroll-append">
          <span className="room-reroll-index">{rerolls.rows.length + 1}</span>
          <ContextualPicker<string>
            ariaLabel={`New reroll ${noun.lower}`}
            {...(lockedHint === undefined ? {} : { disabledHint: lockedHint })}
            id={`${idPrefix}-target`}
            label=""
            model={lockedHint === undefined ? targets : emptyTargets}
            onSelect={setPendingTarget}
            placeholder={`Choose ${noun.lower}`}
            {...(targets.selected === undefined ? {} : { triggerLabel: targets.selected.label })}
          />
          {pending === undefined ? (
            <ContextualPicker<string>
              ariaLabel="New reroll reward"
              disabledHint={lockedHint ?? `Choose the ${noun.lower} first.`}
              id={`${idPrefix}-reward`}
              label=""
              model={emptyTargets}
              onSelect={() => undefined}
              placeholder="Choose reward"
            />
          ) : (
            <RewardOfferPicker
              ariaLabel="New reroll reward"
              id={`${idPrefix}-reward`}
              key={pending}
              label=""
              offer={null}
              onReplace={(reward) => {
                setPendingTarget(undefined);
                executeIntent(interaction.appendIntent(pending, reward));
              }}
              resolver={interaction.pendingReward(pending)}
            />
          )}
          {order === undefined ? null : (
            <span aria-hidden="true" className="room-reroll-move-slot" />
          )}
          <span aria-hidden="true" className="room-reroll-remove-slot" />
        </li>
      </ol>
    </section>
  );
}
