import type {
  WorkspaceInteractionCatalog,
  WorkspaceRewardControl,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { AnvilResultLauncher } from '../rewards/AnvilResultEditor';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** Pickup outcome and Sea Star controls for one acquisition role of a timeline row. */
function PickupOutcomeControls({
  conversion,
  idPrefix,
  interactions,
}: {
  readonly conversion: NonNullable<WorkspaceRewardControl['conversions']>[number];
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.acquisitionConversions,
    workspaceInteractionKey(conversion.address),
  );
  if (!interaction.visible) return null;
  const seaStarApplies = interaction.seaStarSupported || interaction.seaStarProcced;
  return (
    <div className="reward-acquisition-conversion">
      <div className="pickup-outcome-control">
        <ContextualPicker
          id={`${idPrefix}-pickup-outcome-${workspaceInteractionKey(conversion.address)}`}
          label="Outcome"
          ariaLabel={`Pickup outcome for ${conversion.acquisitionRoleLabel}`}
          layout="inline"
          placeholder="Choose a pickup outcome"
          model={declaredChoicesPicker(
            [
              { key: 'normal', value: 'normal', label: 'Pickup' },
              {
                key: 'timePiece',
                value: 'timePiece',
                label: 'Timepiece',
                disabled: !interaction.timePieceSupported && conversion.value.kind !== 'timePiece',
              },
              {
                key: 'artificer',
                value: 'artificer',
                label: 'Artificer',
                disabled: !interaction.artificerSupported && conversion.value.kind !== 'artificer',
              },
            ],
            conversion.value.kind,
          )}
          onSelect={(kind) => {
            if (kind === 'normal' || kind === 'timePiece') {
              executeIntent(interaction.intentFor(Object.freeze({ kind })));
              return;
            }
            if (kind === 'artificer')
              executeIntent(interaction.intentFor(Object.freeze({ kind: 'artificer' })));
          }}
        />
      </div>
      <label
        className="pickup-outcome-control"
        {...(seaStarApplies ? {} : { title: 'Sea Star does not apply here.' })}
      >
        <input
          aria-label={`Sea Star procced for ${conversion.acquisitionRoleLabel}`}
          checked={interaction.seaStarProcced}
          disabled={!seaStarApplies}
          onChange={(event) => executeIntent(interaction.seaStarIntentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Sea Star procced</span>
      </label>
    </div>
  );
}

/** Pickup outcome first, then what follows from it: trait, Pom, Anvil, Artificer output, Fountain. */
export function RoomActionInlineEditors({
  inlineRewardOffer = false,
  row,
  interactions,
}: {
  readonly inlineRewardOffer?: boolean;
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const traitControls = [
    ...(row.traitOffer === undefined ? [] : [row.traitOffer]),
    ...(row.rewardPayload?.inlineTraitOffers ?? []),
  ];
  const payload = row.rewardPayload;
  const levels = payload?.inlineLevelResolutions ?? [];
  const conversions = payload?.control.conversions ?? [];
  const anvilInteractions = conversions.flatMap((control) => {
    const interaction = requireWorkspaceInteraction(
      interactions.acquisitionConversions,
      workspaceInteractionKey(control.address),
    );
    return interaction.anvil === undefined
      ? []
      : [{ anvil: interaction.anvil, owner: interaction.owner }];
  });
  return (
    <>
      {!inlineRewardOffer || row.rewardPayload === undefined ? null : (
        <div className="room-action-inline-reward">
          <RewardControlEditor
            control={row.rewardPayload.control}
            idPrefix={`room-action-inline-${row.rewardPayload.control.marker.focusKey}`}
            interactions={interactions}
            offerSummaryMode="source"
            {...(row.rewardPayload.control.offerEditStartStep === undefined
              ? {}
              : { offerStartStep: row.rewardPayload.control.offerEditStartStep })}
          />
        </div>
      )}
      {payload === undefined
        ? null
        : conversions.map((conversion) => (
            <PickupOutcomeControls
              conversion={conversion}
              idPrefix={`room-action-${payload.control.marker.focusKey}`}
              interactions={interactions}
              key={workspaceInteractionKey(conversion.address)}
            />
          ))}
      {traitControls.map((control) => (
        <TraitOfferLauncher
          control={control}
          interactions={interactions}
          key={workspaceInteractionKey(control.address)}
        />
      ))}
      {levels.map((control) => (
        <PomResolutionLauncher
          control={control}
          interactions={interactions}
          key={workspaceInteractionKey(control.address)}
        />
      ))}
      {anvilInteractions.map(({ anvil, owner }) => (
        <AnvilResultLauncher
          interaction={anvil}
          key={workspaceInteractionKey(owner)}
          owner={owner}
        />
      ))}
      {row.artificerOutput === undefined ? null : (
        <div className="room-action-artificer-output">
          <RewardControlEditor
            control={row.artificerOutput.control}
            idPrefix={`room-action-artificer-${row.artificerOutput.control.marker.focusKey}`}
            interactions={interactions}
            label={row.artificerOutput.label}
            {...(row.artificerOutput.control.offerEditStartStep === undefined
              ? {}
              : { offerStartStep: row.artificerOutput.control.offerEditStartStep })}
          />
        </div>
      )}
      {row.fountainRarity === undefined ? null : (
        <FountainRarityEffectRow control={row.fountainRarity} interactions={interactions} />
      )}
    </>
  );
}
