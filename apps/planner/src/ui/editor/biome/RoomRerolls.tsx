import { useState } from 'react';
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
      return 'Door rerolls are not enabled.';
    case 'poolEmpty':
      return 'No rerolls left.';
  }
}

/** A room's door and cage rerolls in order, with a new press appended at the end. */
export function RoomRerolls({
  interactions,
  rerolls,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
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
  return (
    <section aria-label="Rerolls" className="room-rerolls">
      <header className="room-rerolls-heading">
        <h4>Rerolls</h4>
        {rerolls.poolRemaining === undefined ? null : (
          <span className="room-rerolls-pool">{`${rerolls.poolRemaining} left`}</span>
        )}
      </header>
      <ol className="room-rerolls-list">
        {rerolls.rows.map((row, index) => (
          <li className="room-reroll-row" key={row.key}>
            <span className="room-reroll-index">{index + 1}</span>
            <RewardOfferPicker
              ariaLabel={`Reroll ${index + 1} reward`}
              findingTarget={findingTarget(row.address)}
              id={semanticOwnerControlElementId(row.address)}
              label={row.targetLabel}
              offer={row.reward}
              onReplace={(reward) =>
                executeIntent(interaction.replaceRewardIntent(row.key, reward))
              }
              resolver={interaction.rowReward(row.key)}
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
        ))}
        <li className="room-reroll-row room-reroll-append">
          <span className="room-reroll-index">{rerolls.rows.length + 1}</span>
          <ContextualPicker<string>
            ariaLabel="New reroll door"
            {...(lockedHint === undefined ? {} : { disabledHint: lockedHint })}
            id={`${idPrefix}-target`}
            label="Door"
            layout="inline"
            model={lockedHint === undefined ? targets : emptyTargets}
            onSelect={setPendingTarget}
            placeholder="Choose door"
            {...(targets.selected === undefined ? {} : { triggerLabel: targets.selected.label })}
          />
          {pending === undefined ? (
            <ContextualPicker<string>
              ariaLabel="New reroll reward"
              disabledHint={lockedHint ?? 'Choose the door first.'}
              id={`${idPrefix}-reward`}
              label="Reward"
              layout="inline"
              model={emptyTargets}
              onSelect={() => undefined}
              placeholder="Choose reward"
            />
          ) : (
            <RewardOfferPicker
              ariaLabel="New reroll reward"
              id={`${idPrefix}-reward`}
              key={pending}
              label="Reward"
              offer={null}
              onReplace={(reward) => {
                setPendingTarget(undefined);
                executeIntent(interaction.appendIntent(pending, reward));
              }}
              resolver={interaction.pendingReward(pending)}
            />
          )}
        </li>
      </ol>
    </section>
  );
}
