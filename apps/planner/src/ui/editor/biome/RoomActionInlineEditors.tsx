import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { workspaceInteractionKey } from '@planner/projections/structured-workspace';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** Trait and level controls attached to one projected room-action row. */
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
  const levels = row.rewardPayload?.inlineLevelResolutions ?? [];
  return (
    <>
      {!inlineRewardOffer || row.rewardPayload === undefined ? null : (
        <div className="room-action-inline-reward">
          <RewardControlEditor
            control={row.rewardPayload.control}
            idPrefix={`room-action-inline-${row.rewardPayload.control.marker.focusKey}`}
            interactions={interactions}
            offerSummaryMode="source"
            showAcquisitionChildren={false}
            showLevelResolutions={false}
            showTraitOffers={false}
            {...(row.rewardPayload.control.offerEditStartStep === undefined
              ? {}
              : { offerStartStep: row.rewardPayload.control.offerEditStartStep })}
          />
        </div>
      )}
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
      {row.fountainRarity === undefined ? null : (
        <FountainRarityEffectRow control={row.fountainRarity} interactions={interactions} />
      )}
    </>
  );
}
