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
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';

/** Complete intent-bound editor for every authored reward leaf. */
export function RewardControlEditor({
  ariaLabel,
  control,
  idPrefix,
  interactions,
  label = 'Reward',
  labelIcon,
  showOffer = true,
  offerStartStep,
  offerSummaryMode = 'offer',
}: {
  /** The accessible name where the visible label is shortened. */
  readonly ariaLabel?: string;
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  /** An image shown before the field label. */
  readonly labelIcon?: ArtworkSource | undefined;
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
  const realized =
    control.realizedAcquisition === undefined
      ? {}
      : { realizedLabel: control.realizedAcquisition.label };
  return (
    <>
      {control.shopOption !== undefined ? (
        <ShopOfferEditor
          {...(ariaLabel === undefined ? {} : { ariaLabel })}
          control={control}
          interactions={interactions}
          label={label}
          {...(labelIcon === undefined ? {} : { labelIcon })}
        />
      ) : control.kind === 'countedReward' ? (
        <CountedRewardEditor
          {...(ariaLabel === undefined ? {} : { ariaLabel })}
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          label={label}
          {...(labelIcon === undefined ? {} : { labelIcon })}
          offer={control.offer}
          onReplace={onReplace}
          {...realized}
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
          {...(ariaLabel === undefined ? {} : { ariaLabel })}
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          label={label}
          {...(labelIcon === undefined ? {} : { labelIcon })}
          offer={control.offer}
          onReplace={onReplace}
          {...realized}
          {...(control.authoringSeed === undefined
            ? {}
            : { unresolvedSeed: control.authoringSeed })}
          {...((offerStartStep ?? control.authoringStartStep) === undefined
            ? {}
            : { initialStep: offerStartStep ?? control.authoringStartStep })}
          summaryMode={offerSummaryMode}
        />
      )}
    </>
  );
}
