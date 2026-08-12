import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardControl,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';
import { TraitOfferLauncher } from './TraitOfferEditor';
import { PomResolutionLauncher } from './PomResolutionEditor';
import type { RewardPickerStep } from '@planner/projections/rewardPicker';

/** Complete intent-bound editor for every authored reward leaf. */
export function RewardControlEditor({
  control,
  idPrefix,
  interactions,
  showOffer = true,
  showAcquisitionChildren = true,
  offerStartStep,
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly showOffer?: boolean;
  readonly showAcquisitionChildren?: boolean;
  /** A fixed-type producer can expose its payload directly without a redundant type step. */
  readonly offerStartStep?: RewardPickerStep;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.rewards,
    workspaceInteractionKey(control.owner.address),
  );
  const onReplace = (value: Parameters<typeof interaction.intentFor>[0]): void =>
    executeIntent(interaction.intentFor(value));
  return (
    <>
      {!showOffer ? null : control.kind === 'countedReward' ? (
        <CountedRewardEditor
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          offer={control.offer}
          onReplace={onReplace}
          {...(offerStartStep === undefined ? {} : { initialStep: offerStartStep })}
        />
      ) : (
        <RewardValueEditor
          candidateOwner={control.owner}
          idPrefix={idPrefix}
          interactions={interactions}
          offer={control.offer}
          onReplace={onReplace}
          {...(offerStartStep === undefined ? {} : { initialStep: offerStartStep })}
        />
      )}
      {!showAcquisitionChildren ? null : (
        <div className="trait-offer-launchers">
          {(control.traitOffers ?? []).map((trait) => (
            <TraitOfferLauncher
              control={trait}
              interactions={interactions}
              key={workspaceInteractionKey(trait.address)}
            />
          ))}
          {(control.levelResolutions ?? []).map((resolution) => (
            <PomResolutionLauncher
              control={resolution}
              interactions={interactions}
              key={workspaceInteractionKey(resolution.address)}
            />
          ))}
        </div>
      )}
    </>
  );
}
