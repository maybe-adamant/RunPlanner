import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import type { RouteTraitOfferProjection } from '@planner/projections/traitProjection';

export function RouteTraitsPanel({
  interactions,
  rows,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rows: readonly RouteTraitOfferProjection[];
}) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-traits-title" className="route-traits-panel">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Chronological loadout</p>
          <h2 id="route-traits-title">Traits</h2>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="route-npc-index-empty">No reached trait offers in this route.</p>
      ) : (
        <ol className="route-traits-list">
          {rows.map((row) => {
            const interaction = interactions.traitOffers.get(row.interactionKey);
            if (interaction === undefined) return null;
            const editLabel = `Edit Trait: ${row.selectedTraitLabel}${
              row.rarity === undefined ? '' : ` · ${row.rarity}`
            }`;
            return (
              <li className="route-trait-row" data-invalid={row.invalid} key={row.interactionKey}>
                <div>
                  <strong>{row.selectedTraitLabel}</strong>
                  <span className="route-trait-meta">
                    {row.biomeKey} · {row.locationLabel} · {row.giverLabel}
                    {row.rarity === undefined ? '' : ` · ${row.rarity}`}
                  </span>
                  {row.selectedReplacement === undefined ? null : (
                    <span className="route-trait-replacement">
                      Replaces {row.selectedReplacement.replacedTraitLabel} ·{' '}
                      {row.selectedReplacement.oldRarity} to{' '}
                      {row.selectedReplacement.requiredRarity}
                    </span>
                  )}
                </div>
                <button
                  aria-label={editLabel}
                  className="quiet-action action-compact"
                  id={`trait-launcher-${semanticAddressKey(row.address)}`}
                  onClick={() => dispatch(semanticOwnerNavigated(row.address))}
                  type="button"
                >
                  {editLabel}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
