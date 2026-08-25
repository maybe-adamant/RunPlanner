import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { workspaceInteractionKey } from '@planner/projections/structured-workspace';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';

/** Trait and level controls attached to one projected room-action row. */
export function RoomActionInlineEditors({
  row,
  interactions,
}: {
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
    </>
  );
}
