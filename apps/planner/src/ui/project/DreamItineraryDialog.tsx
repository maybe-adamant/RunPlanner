import { useEffect, useRef, useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  projectDreamItineraryDraft,
  replaceDreamItineraryDraftBiome,
} from '@planner/projections/dreamItinerary';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

export function DreamItineraryDialog({
  catalog,
  onCancel,
  onCreate,
  pending,
}: {
  readonly catalog: Catalog;
  readonly onCancel: () => void;
  readonly onCreate: (itineraryBiomeKeys: readonly string[]) => void;
  readonly pending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<readonly string[]>([]);
  const [stage, setStage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(true);
  const projection = projectDreamItineraryDraft(catalog, draft, stage);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
  }, []);

  return (
    <dialog
      aria-labelledby="dream-itinerary-dialog-title"
      aria-modal="true"
      className="game-publication-dialog-backdrop"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      ref={dialogRef}
    >
      <section className="game-publication-dialog dream-route-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Dream Dive</p>
            <h2 id="dream-itinerary-dialog-title">Choose four biomes</h2>
            <p>Route is fixed after creation.</p>
          </div>
        </header>
        <div aria-label="Route order" className="encounter-wave-selection">
          {projection.badges.map((badge) => (
            <div className="encounter-enemy-badge" key={badge.index}>
              <button
                className="quiet-action action-compact"
                disabled={pending || !badge.selected}
                onClick={() => {
                  setStage(badge.index);
                  setPickerOpen(true);
                }}
                type="button"
              >
                {badge.label}
              </button>
            </div>
          ))}
        </div>
        <ContextualPicker
          choiceLabel={`Biome ${stage + 1} of ${projection.biomeCount}`}
          closeOnSelect={false}
          disabled={pending || projection.picker.sections[0]?.items.length === 0}
          id="dream-itinerary-picker"
          label="Route order"
          model={projection.picker}
          onOpenChange={setPickerOpen}
          onSelect={(biomeKey) => {
            const next = replaceDreamItineraryDraftBiome(catalog, draft, stage, biomeKey);
            setDraft(next);
            setStage(Math.min(next.length, projection.biomeCount - 1));
            setPickerOpen(next.length < projection.biomeCount);
          }}
          open={pickerOpen}
          placeholder={`Choose biome ${stage + 1}`}
          side="top"
          triggerLabel={
            projection.complete
              ? projection.badges.map((badge) => badge.label).join(' · ')
              : 'Choose biomes'
          }
        />
        <footer className="game-publication-actions">
          <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="secondary-action"
            disabled={pending || !projection.complete}
            onClick={() => onCreate(draft)}
            type="button"
          >
            {pending ? 'Creating…' : 'Create project'}
          </button>
        </footer>
      </section>
    </dialog>
  );
}
