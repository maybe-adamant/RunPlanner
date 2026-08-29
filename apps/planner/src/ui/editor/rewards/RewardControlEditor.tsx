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
  showLevelResolutions = true,
  showTraitOffers = true,
  offerStartStep,
  offerSummaryMode = 'offer',
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  readonly showOffer?: boolean;
  /** Trait, level, and conversion controls belong to the owning Room Timeline row. */
  readonly showAcquisitionChildren?: boolean;
  /** A Room Timeline row can promote Pom/level controls into its compact action heading. */
  readonly showLevelResolutions?: boolean;
  /** A Room Timeline row can promote trait launchers into its compact action heading. */
  readonly showTraitOffers?: boolean;
  /** A fixed-type producer can expose its payload directly without a redundant type step. */
  readonly offerStartStep?: RewardPickerStep;
  /** A compact fixed-type picker can omit the already-visible reward type. */
  readonly offerSummaryMode?: 'offer' | 'source';
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
      {!showOffer ? null : control.fixedOfferEdit !== undefined ? (
        <button
          className="quiet-action action-compact"
          onClick={() => onReplace(control.fixedOfferEdit!.offer)}
          type="button"
        >
          {control.fixedOfferEdit.actionLabel}
        </button>
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
      {!showAcquisitionChildren ? null : (
        <div className="trait-offer-launchers">
          {control.realizedAcquisition === undefined ? null : (
            <p className="reward-acquisition-outcome" role="status">
              Vow of Forfeit: {control.realizedAcquisition.label}
            </p>
          )}
          {showTraitOffers
            ? (control.traitOffers ?? []).map((trait) => (
                <TraitOfferLauncher
                  control={trait}
                  interactions={interactions}
                  key={workspaceInteractionKey(trait.address)}
                />
              ))
            : null}
          {showLevelResolutions
            ? (control.levelResolutions ?? []).map((resolution) => (
                <PomResolutionLauncher
                  control={resolution}
                  interactions={interactions}
                  key={workspaceInteractionKey(resolution.address)}
                />
              ))
            : null}
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
                <label className="pickup-outcome-control">
                  <span>
                    Pickup outcome
                    {control.realizedAcquisition === undefined
                      ? ''
                      : ` · ${control.realizedAcquisition.label}`}
                  </span>
                  <select
                    aria-label={`Pickup outcome for ${conversion.acquisitionRoleLabel}`}
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
                    <option value="normal">
                      Pick up {control.realizedAcquisition?.label ?? 'reward'}
                    </option>
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
                {!interaction.seaStarSupported && !interaction.seaStarProcced ? null : (
                  <label className="pickup-outcome-control">
                    <input
                      aria-label={`Sea Star procced for ${conversion.acquisitionRoleLabel}`}
                      checked={interaction.seaStarProcced}
                      disabled={!interaction.seaStarSupported && !interaction.seaStarProcced}
                      onChange={(event) =>
                        executeIntent(interaction.seaStarIntentFor(event.target.checked))
                      }
                      type="checkbox"
                    />
                    <span>Sea Star procced</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
