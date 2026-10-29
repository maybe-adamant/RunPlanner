import { useEffect, useRef, useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  projectDreamItineraryDraft,
  replaceDreamItineraryDraftBiome,
} from '@planner/projections/dreamItinerary';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

/** Stages four Dream biomes, starting from an existing itinerary when one is given. */
export function DreamItineraryDialog({
  catalog,
  confirmLabel,
  initialItinerary = [],
  onCancel,
  onConfirm,
  pending,
}: {
  readonly catalog: Catalog;
  readonly confirmLabel: string;
  readonly initialItinerary?: readonly string[];
  readonly onCancel: () => void;
  readonly onConfirm: (itineraryBiomeKeys: readonly string[]) => void;
  readonly pending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<readonly string[]>(initialItinerary);
  const [stage, setStage] = useState(0);
  const projection = projectDreamItineraryDraft(catalog, draft, stage);
  const [pickerOpen, setPickerOpen] = useState(!projection.complete);
  const unchanged =
    draft.length === initialItinerary.length &&
    draft.every((biomeKey, index) => initialItinerary[index] === biomeKey);

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
          </div>
        </header>
        <div aria-label="Route order" className="dream-route-selection">
          {projection.badges.map((badge) => (
            <div className="dream-route-badge" key={badge.index}>
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
            disabled={pending || !projection.complete || unchanged}
            onClick={() => onConfirm(draft)}
            type="button"
          >
            {pending ? 'Please wait…' : confirmLabel}
          </button>
        </footer>
      </section>
    </dialog>
  );
}
