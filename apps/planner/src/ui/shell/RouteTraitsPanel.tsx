import type { ReactNode } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import type { RouteTraitOfferProjection } from '@planner/projections/rewards/traitProjection';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { navigationArtwork } from '@planner/ui/artwork/navigation/navigationArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { traitGiverArtwork } from '@planner/ui/artwork/trait-givers/traitGiverArtwork';
import { IndexRoom, RouteIndexHeader } from './RouteIndexParts';

export function RouteTraitsPanel({
  interactions,
  rows,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rows: readonly RouteTraitOfferProjection[];
}) {
  const dispatch = useAppDispatch();
  const shown = rows.filter((row) => interactions.traitOffers.has(row.interactionKey));
  const rowButton = (row: RouteTraitOfferProjection, children: ReactNode) => (
    <button
      aria-label={`Edit Trait: ${row.selectedTraitLabel}${
        row.rarity === undefined ? '' : ` · ${row.rarity}`
      }`}
      className="route-index-row"
      // An illegal offer trace marks its launcher with the shared finding style.
      data-has-findings={row.invalid}
      data-semantic-owner={semanticAddressKey(row.address)}
      id={`trait-launcher-${semanticAddressKey(row.address)}`}
      onClick={() => dispatch(semanticOwnerNavigated(row.address))}
      type="button"
    >
      {children}
    </button>
  );
  const traitFace = (row: RouteTraitOfferProjection) => (
    <>
      <span className="route-index-chip" data-rarity={row.rarity}>
        <ArtworkIcon className="route-index-chip-icon" source={traitIcon(row.selectedTraitKey)} />
      </span>
      <span className="route-index-name">
        <strong>{row.selectedTraitLabel}</strong>
        {row.selectedReplacement === undefined ? null : (
          <span className="route-index-sub">
            Replaces {row.selectedReplacement.replacedTraitLabel} ·{' '}
            {row.selectedReplacement.oldRarity} to {row.selectedReplacement.requiredRarity}
          </span>
        )}
      </span>
      <span className="route-index-meta">
        <ArtworkIcon
          className="artwork-label-icon-small"
          source={traitGiverArtwork[row.giverKey] ?? undefined}
        />
        {row.giverLabel}
      </span>
    </>
  );
  return (
    <section aria-labelledby="route-traits-title" className="route-index route-traits-panel">
      <RouteIndexHeader
        count={shown.length}
        icon={navigationArtwork.traits}
        id="route-traits-title"
        title="Traits"
      />
      {shown.length === 0 ? (
        <p className="route-index-empty">No reached trait offers in this route.</p>
      ) : (
        <ol className="biome-rail route-index-rail">
          {shown.map((row) => (
            <li className="biome-rail-stop" data-step={row.room?.depth} key={row.interactionKey}>
              {rowButton(
                row,
                <>
                  <IndexRoom name={row.place.hint ?? row.place.text} room={row.room} />
                  {traitFace(row)}
                  <span className="route-index-rarity" data-rarity={row.rarity}>
                    {row.rarity}
                  </span>
                </>,
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
