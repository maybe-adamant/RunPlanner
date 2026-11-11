import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  type WorkspaceDoorContract,
  type WorkspaceDoorReward,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardControl,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { clockworkCountdownArtwork } from '@planner/ui/artwork/clockwork/clockworkCountdownArtwork';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { hintProps } from '@planner/ui/controls/hint';
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
  /** `row` is a door row's reward cell; the row shows a hidden reward's notice itself. */
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

/**
 * A door-table reward: its first draw, then where rerolls changed it, the
 * final reward as its icon carrying the reroll die.
 */
export function RowReward({
  first,
  reward,
}: {
  readonly first: ReactNode;
  readonly reward: Pick<WorkspaceDoorReward, 'rerolledOffer' | 'rerolledSummary'>;
}) {
  return (
    <span className="row-reward-value">
      {first}
      {reward.rerolledSummary === undefined ? null : (
        <>
          <span aria-hidden="true" className="row-reward-arrow">
            →
          </span>
          <span
            aria-label={`Rerolled into ${reward.rerolledSummary}`}
            className="row-reward-rerolled"
            role="img"
            tabIndex={0}
            {...hintProps(`Rerolled into ${reward.rerolledSummary}`)}
          >
            <ArtworkIcon
              className="row-reward-rerolled-icon"
              source={
                reward.rerolledOffer === undefined ? undefined : offerIcon(reward.rerolledOffer)
              }
            />
            <img alt="" className="corner-badge row-reward-rerolled-die" src={rerollDieArtwork} />
          </span>
        </>
      )}
    </span>
  );
}

/** A door row's notice that the game hides this door's reward, shown beside the reward. */
export function DoorRewardHiddenTag({ door }: { readonly door: WorkspaceDoorContract }) {
  return door.offerRewardSurface.visibility === 'hidden' ? (
    <span className="timeline-row-tag">Hidden on door</span>
  ) : null;
}

function RowRewardSurface({
  ariaLabel,
  idPrefix,
  interactions,
  rewards,
}: {
  readonly ariaLabel: string;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rewards: readonly WorkspaceDoorReward[];
}) {
  const findingAnchor = useFindingAnchor();
  const firstEditable = rewards.findIndex((reward) => reward.control !== undefined);
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
    <div aria-label={ariaLabel} className="door-row-rewards">
      {rewards.map((reward, index) => {
        const status = firstEditable < 0 && index === 0;
        const badge = labelled ? reward.badge : undefined;
        const first =
          reward.control === undefined ? (
            <span
              {...findingAnchor(reward.marker.address)}
              aria-live={status ? 'polite' : undefined}
              className="row-reward-fixed"
              {...(status ? { id: `${idPrefix}-status`, tabIndex: -1 } : {})}
            >
              <FixedRewardChip
                badge={badge}
                icon={
                  reward.clockworkGoalsRemaining !== undefined
                    ? (clockworkCountdownArtwork[String(reward.clockworkGoalsRemaining)] ??
                      undefined)
                    : reward.offer === null
                      ? undefined
                      : offerIcon(reward.offer)
                }
                name={rewardChipName(reward, labelled)}
              />
            </span>
          ) : (
            <RewardControlEditor
              ariaLabel={rewardChipName(reward, labelled, reward.control)}
              control={reward.control}
              idPrefix={`${idPrefix}-${reward.key}`}
              interactions={interactions}
              label=""
              triggerSize="icon"
              {...(badge === undefined ? {} : { triggerBadge: badge })}
            />
          );
        return <RowReward first={first} key={reward.key} reward={reward} />;
      })}
    </div>
  );
}

/**
 * A door reward chip's name: its cage, or Reward on a door with one, then the
 * reward and any Vow of Forfeit conversion.
 */
function rewardChipName(
  reward: WorkspaceDoorReward,
  labelled: boolean,
  control?: WorkspaceRewardControl,
): string {
  const owner = labelled ? reward.label : 'Reward';
  if (reward.offer === null) return owner;
  const realized = control?.realizedAcquisition?.label;
  return `${owner}: ${reward.summary}${realized === undefined ? '' : ` (${realized})`}`;
}

/** A fixed door reward: the editable chip's face, read-only, its name on hover. */
export function FixedRewardChip({
  badge,
  icon,
  name,
}: {
  readonly badge: string | undefined;
  readonly icon: ArtworkSource | undefined;
  readonly name: string;
}) {
  return (
    <span
      {...hintProps(name, undefined, name)}
      aria-label={name}
      className="timeline-chip"
      data-chip-state="shown"
      role="img"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
      {badge === undefined ? null : (
        <span aria-hidden="true" className="corner-badge timeline-chip-badge">
          {badge}
        </span>
      )}
    </span>
  );
}

/** A rerolled reward's final draw. */
export function RerolledRewardLine({
  reward,
}: {
  readonly reward: Pick<WorkspaceDoorReward, 'rerollLineReserved' | 'rerolledSummary'>;
}) {
  // Where rerolls are enabled the line keeps its place, so rerolling shifts nothing.
  if (reward.rerolledSummary === undefined)
    return reward.rerollLineReserved === true ? (
      <div aria-hidden="true" className="door-rerolled-line door-rerolled-line-reserved" />
    ) : null;
  return (
    <div className="door-rerolled-line">
      <span className="door-rerolled-reward">
        <span aria-hidden="true">→ </span>
        <span className="visually-hidden">Rerolled to </span>
        {reward.rerolledSummary}
      </span>
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
