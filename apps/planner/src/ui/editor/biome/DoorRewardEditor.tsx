import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  type WorkspaceDoorContract,
  type WorkspaceDoorReward,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { clockworkCountdownArtwork } from '@planner/ui/artwork/clockwork/clockworkCountdownArtwork';
import { useFindingAnchor, useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { useEffect, type ReactNode } from 'react';

/** Shared editor for any complete room-owned offer reward surface. */
export function RewardSurfaceEditor({
  ariaLabel,
  idPrefix,
  interactions,
  focusOwner,
  layout = 'field',
  rewards,
  visibility,
}: {
  readonly ariaLabel: string;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly focusOwner?: SemanticAddress;
  /** `row` is a door row's reward cell: values as chips, a reroll inline after an arrow. */
  readonly layout?: 'field' | 'row';
  readonly rewards: readonly WorkspaceDoorReward[];
  readonly visibility: 'hidden' | 'visible';
}) {
  const findingAnchor = useFindingAnchor();
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const firstEditableReward = rewards.find((reward) => reward.control !== undefined);
  useEffect(() => {
    if (
      focusOwner === undefined ||
      focusedOwner === null ||
      semanticAddressKey(focusedOwner) !== semanticAddressKey(focusOwner)
    ) {
      return;
    }
    const target =
      firstEditableReward === undefined
        ? document.getElementById(`${idPrefix}-status`)
        : document.getElementById(
            semanticOwnerControlElementId(firstEditableReward.control!.owner.address),
          );
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [firstEditableReward, focusOwner, focusedOwner, idPrefix]);
  if (layout === 'row') {
    return (
      <RowRewardSurface
        ariaLabel={ariaLabel}
        idPrefix={idPrefix}
        interactions={interactions}
        rewards={rewards}
        visibility={visibility}
      />
    );
  }
  if (rewards.length === 0) {
    return (
      <div aria-label={ariaLabel} className="door-reward-list">
        <div
          aria-live="polite"
          className="field-control field-control-inline door-fixed-reward"
          id={`${idPrefix}-status`}
          tabIndex={-1}
        >
          <span>Reward</span>
          <span className="fixed-room-state">No reward</span>
        </div>
      </div>
    );
  }
  const showRewardLabels = rewards.length > 1;
  return (
    <div aria-label={ariaLabel} className="door-reward-list">
      {rewards.map((reward, index) => (
        <section key={reward.key}>
          {reward.control === undefined ? (
            <div
              {...findingAnchor(reward.marker.address)}
              aria-live={firstEditableReward === undefined && index === 0 ? 'polite' : undefined}
              className="field-control field-control-inline door-fixed-reward"
              id={
                firstEditableReward === undefined && index === 0 ? `${idPrefix}-status` : undefined
              }
              tabIndex={firstEditableReward === undefined && index === 0 ? -1 : undefined}
            >
              <span>{showRewardLabels ? reward.label : 'Reward'}</span>
              <span className="fixed-room-state">
                {reward.clockworkGoalsRemaining === undefined ? null : (
                  <ArtworkIcon
                    className="door-fixed-reward-icon"
                    source={
                      clockworkCountdownArtwork[String(reward.clockworkGoalsRemaining)] ?? undefined
                    }
                  />
                )}
                {reward.summary}
              </span>
            </div>
          ) : (
            <RewardControlEditor
              control={reward.control}
              idPrefix={`${idPrefix}-${reward.key}`}
              interactions={interactions}
              label={showRewardLabels ? reward.label : 'Reward'}
            />
          )}
          <RerolledRewardLine reward={reward} />
        </section>
      ))}
      {visibility === 'hidden' ? (
        <p className="door-information-note">Reward hidden on this door.</p>
      ) : null}
    </div>
  );
}

/** Adopts the last reroll's reward into a kept reward that no longer matches, or drops it. */
function RerolledRewardRepair({
  repair,
}: {
  readonly repair: NonNullable<WorkspaceDoorReward['rerolledRewardRepair']>;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  return (
    <button
      {...findingMark(repair.owner, 'rerolledReward')}
      className="secondary-action action-compact"
      onClick={() =>
        executeIntent({
          command:
            repair.repair === 'adopt'
              ? { kind: 'AdoptRerolledReward', owner: repair.owner }
              : { kind: 'DropRerolledReward', owner: repair.owner },
        })
      }
      type="button"
    >
      {repair.repair === 'adopt' ? 'Use last reroll' : 'Drop rerolled reward'}
    </button>
  );
}

/** A reward's first draw, then its final one after an arrow where rerolls changed it. */
function RowReward({
  first,
  reward,
}: {
  readonly first: ReactNode;
  readonly reward: WorkspaceDoorReward;
}) {
  const repair = reward.rerolledRewardRepair;
  return (
    <span className="row-reward-value">
      {first}
      {reward.rerolledSummary === undefined ? null : (
        <>
          <span aria-hidden="true" className="row-reward-arrow">
            →
          </span>
          <span className="visually-hidden">Rerolled to </span>
          <FixedValueChip
            icon={reward.rerolledOffer === undefined ? undefined : offerIcon(reward.rerolledOffer)}
            label={reward.rerolledSummary}
          />
        </>
      )}
      {repair === undefined ? null : <RerolledRewardRepair repair={repair} />}
    </span>
  );
}

function RowRewardSurface({
  ariaLabel,
  idPrefix,
  interactions,
  rewards,
  visibility,
}: {
  readonly ariaLabel: string;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rewards: readonly WorkspaceDoorReward[];
  readonly visibility: 'hidden' | 'visible';
}) {
  const findingAnchor = useFindingAnchor();
  const firstEditable = rewards.findIndex((reward) => reward.control !== undefined);
  const hidden =
    visibility === 'hidden' ? <span className="timeline-row-tag">Hidden on door</span> : null;
  if (rewards.length === 0) {
    return (
      <div aria-label={ariaLabel} className="door-row-rewards">
        <span aria-live="polite" className="row-reward-value">
          <FixedValueChip id={`${idPrefix}-status`} label="No reward" />
        </span>
      </div>
    );
  }
  const labelled = rewards.length > 1;
  return (
    <div aria-label={ariaLabel} className="door-row-rewards" data-multiple={labelled || undefined}>
      {rewards.map((reward, index) => {
        const status = firstEditable < 0 && index === 0;
        const first =
          reward.control === undefined ? (
            <span
              {...findingAnchor(reward.marker.address)}
              aria-live={status ? 'polite' : undefined}
              className="row-reward-fixed"
              {...(status ? { id: `${idPrefix}-status`, tabIndex: -1 } : {})}
            >
              {labelled ? <span className="row-reward-label">{reward.label}</span> : null}
              <FixedValueChip
                icon={
                  reward.clockworkGoalsRemaining !== undefined
                    ? (clockworkCountdownArtwork[String(reward.clockworkGoalsRemaining)] ??
                      undefined)
                    : reward.offer === null
                      ? undefined
                      : offerIcon(reward.offer)
                }
                label={reward.summary}
              />
            </span>
          ) : (
            <RewardControlEditor
              {...(labelled ? {} : { ariaLabel: 'Reward' })}
              control={reward.control}
              idPrefix={`${idPrefix}-${reward.key}`}
              interactions={interactions}
              label={labelled ? reward.label : ''}
            />
          );
        return <RowReward first={first} key={reward.key} reward={reward} />;
      })}
      {hidden}
    </div>
  );
}

/** A rerolled reward's final draw, and the repair of a kept reward that no longer matches. */
export function RerolledRewardLine({
  reward,
}: {
  readonly reward: Pick<
    WorkspaceDoorReward,
    'rerollLineReserved' | 'rerolledRewardRepair' | 'rerolledSummary'
  >;
}) {
  const repair = reward.rerolledRewardRepair;
  // Where rerolls are enabled the line keeps its place, so rerolling shifts nothing.
  if (reward.rerolledSummary === undefined && repair === undefined)
    return reward.rerollLineReserved === true ? (
      <div aria-hidden="true" className="door-rerolled-line door-rerolled-line-reserved" />
    ) : null;
  return (
    <div className="door-rerolled-line">
      {reward.rerolledSummary === undefined ? null : (
        <span className="door-rerolled-reward">
          <span aria-hidden="true">→ </span>
          <span className="visually-hidden">Rerolled to </span>
          {reward.rerolledSummary}
        </span>
      )}
      {repair === undefined ? null : <RerolledRewardRepair repair={repair} />}
    </div>
  );
}

/** Exact base reward identity editor for one physical door contract. */
export function DoorRewardEditor({
  door,
  focusOwner,
  idPrefix,
  interactions,
  layout = 'field',
}: {
  readonly door: WorkspaceDoorContract;
  readonly focusOwner?: SemanticAddress;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly layout?: 'field' | 'row';
}) {
  return (
    <RewardSurfaceEditor
      ariaLabel={`${door.room.label} door rewards`}
      idPrefix={idPrefix}
      interactions={interactions}
      layout={layout}
      {...(focusOwner === undefined ? {} : { focusOwner })}
      rewards={door.offerRewardSurface.rewards}
      visibility={door.offerRewardSurface.visibility}
    />
  );
}
