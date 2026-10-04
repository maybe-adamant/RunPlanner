import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardControl,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';
import { ShopOfferEditor } from './ShopOfferEditor';
import type { RewardPickerStep } from '@planner/projections/rewards/rewardPicker';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

/** Complete intent-bound editor for every authored reward leaf. */
export function RewardControlEditor({
  control,
  idPrefix,
  interactions,
  label = 'Reward',
  showOffer = true,
  offerStartStep,
  offerSummaryMode = 'offer',
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  readonly showOffer?: boolean;
  /** A fixed-type producer can expose its payload directly without a redundant type step. */
  readonly offerStartStep?: RewardPickerStep;
  /** A compact fixed-type picker can omit the already-visible reward type. */
  readonly offerSummaryMode?: 'offer' | 'source';
}) {
  const executeIntent = useCommandIntent();
  const interaction =
    control.shopOption === undefined
      ? requireWorkspaceInteraction(
          interactions.rewards,
          workspaceInteractionKey(control.owner.address),
        )
      : undefined;
  const onReplace = (value: ResolvedRewardOffer): void => {
    if (interaction === undefined) throw new Error('Shop offers require an exact option edit');
    executeIntent(interaction.intentFor(value));
  };
  if (!showOffer) return null;
  return (
    <>
      {control.shopOption !== undefined ? (
        <ShopOfferEditor control={control} interactions={interactions} label={label} />
      ) : control.kind === 'countedReward' ? (
        <CountedRewardEditor
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          label={label}
          offer={control.offer}
          onReplace={onReplace}
          {...(control.authoringSeed === undefined
            ? {}
            : { unresolvedSeed: control.authoringSeed })}
          {...((offerStartStep ?? control.authoringStartStep) === undefined
            ? {}
            : { initialStep: offerStartStep ?? control.authoringStartStep })}
          summaryMode={offerSummaryMode}
        />
      ) : (
        <RewardValueEditor
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          label={label}
          offer={control.offer}
          onReplace={onReplace}
          {...(control.authoringSeed === undefined
            ? {}
            : { unresolvedSeed: control.authoringSeed })}
          {...((offerStartStep ?? control.authoringStartStep) === undefined
            ? {}
            : { initialStep: offerStartStep ?? control.authoringStartStep })}
          summaryMode={offerSummaryMode}
        />
      )}
      {control.realizedAcquisition === undefined ? null : (
        // Vow of Forfeit provenance belongs to the reward, not to the action that collects it.
        <span className="neutral-status" title="Vow of Forfeit">
          {`Forfeit → ${control.realizedAcquisition.label}`}
        </span>
      )}
    </>
  );
}
