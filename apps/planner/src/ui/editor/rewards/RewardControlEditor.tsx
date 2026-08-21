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
  label = 'Reward',
  showOffer = true,
  showAcquisitionChildren = false,
  offerStartStep,
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  readonly showOffer?: boolean;
  /** Trait, level, and conversion controls belong to the owning Room Actions row. */
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
          label={label}
          offer={control.offer}
          onReplace={onReplace}
          {...(control.authoringSeed === undefined
            ? {}
            : { unresolvedSeed: control.authoringSeed })}
          {...((offerStartStep ?? control.authoringStartStep) === undefined
            ? {}
            : { initialStep: offerStartStep ?? control.authoringStartStep })}
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
        />
      )}
      {!showAcquisitionChildren ? null : control.acquisitionOutcome === 'forfeitedByVow' ? (
        <p className="reward-acquisition-outcome" role="status">
          Removed by Vow of Forfeit
        </p>
      ) : (
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
          {(control.conversions ?? []).map((conversion) => {
            const interaction = requireWorkspaceInteraction(
              interactions.acquisitionConversions,
              workspaceInteractionKey(conversion.address),
            );
            return !interaction.visible ? null : (
              <div
                className="reward-acquisition-conversion"
                key={workspaceInteractionKey(conversion.address)}
              >
                <label>
                  <span>{conversion.acquisitionRoleLabel} outcome</span>
                  <select
                    aria-label={`Reward outcome for ${conversion.acquisitionRoleLabel}`}
                    onChange={(event) => {
                      const kind = event.target.value;
                      if (kind === 'normal' || kind === 'timePiece') {
                        executeIntent(interaction.intentFor(Object.freeze({ kind })));
                        return;
                      }
                      if (kind === 'artificer')
                        executeIntent(interaction.intentFor(Object.freeze({ kind: 'artificer' })));
                    }}
                    value={conversion.value.kind}
                  >
                    <option value="normal">Pick up reward</option>
                    <option
                      disabled={
                        !interaction.timePieceSupported && conversion.value.kind !== 'timePiece'
                      }
                      value="timePiece"
                    >
                      Time Piece · convert to Gold
                    </option>
                    <option
                      disabled={
                        !interaction.artificerSupported && conversion.value.kind !== 'artificer'
                      }
                      value="artificer"
                    >
                      Artificer · replace reward
                    </option>
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
