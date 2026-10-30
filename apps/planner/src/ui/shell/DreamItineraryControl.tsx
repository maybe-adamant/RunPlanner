import { useState, type CSSProperties } from 'react';

import { createRouteAddress, type AuthoredRoutePlan } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  projectDreamItineraryDraft,
  projectDreamItineraryReplacementLosses,
  replaceDreamItineraryDraftBiome,
} from '@planner/projections/dreamItinerary';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { biomeIcon } from '@planner/ui/artwork/roomArtwork';
import { ConfirmationDialog } from '@planner/ui/controls/ConfirmationDialog';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

interface Confirmation {
  readonly slot: number;
  readonly itineraryBiomeKeys: readonly string[];
  readonly clearedLabels: readonly string[];
}

interface Draft {
  /** The applied itinerary this draft was started from. */
  readonly source: string;
  readonly itineraryBiomeKeys: readonly string[];
  readonly confirmation?: Confirmation;
}

const slotId = (slot: number): string => `dream-itinerary-slot-${slot}`;

function sameItinerary(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((biomeKey, index) => right[index] === biomeKey);
}

/**
 * A Dream Dive's four biome slots, each re-picked in place. A complete
 * itinerary applies at once, asking first when later biome plans would be
 * cleared; an incomplete one stays a local draft until its slots are filled.
 */
export function DreamItineraryControl({
  catalog,
  route,
}: {
  readonly catalog: Catalog;
  readonly route: AuthoredRoutePlan;
}) {
  const dispatch = useAppDispatch();
  // An applied or undone itinerary discards an unfinished draft without
  // remounting, so the picked slot keeps keyboard focus.
  const source = route.itineraryBiomeKeys.join(',');
  const [storedDraft, setStoredDraft] = useState<Draft>();
  const pending = storedDraft?.source === source ? storedDraft : undefined;
  const confirmation = pending?.confirmation;
  const draft = pending?.itineraryBiomeKeys ?? route.itineraryBiomeKeys;
  const setPending = (itineraryBiomeKeys: readonly string[] | undefined, next?: Confirmation) =>
    setStoredDraft(
      itineraryBiomeKeys === undefined
        ? undefined
        : { source, itineraryBiomeKeys, ...(next === undefined ? {} : { confirmation: next }) },
    );
  const replace = (itineraryBiomeKeys: readonly string[]) => {
    setPending(undefined);
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceDreamItinerary',
        route: createRouteAddress(route.routeKey),
        itineraryBiomeKeys,
      }),
    );
  };
  const select = (slot: number, biomeKey: string) => {
    const next = replaceDreamItineraryDraftBiome(catalog, draft, slot, biomeKey);
    if (sameItinerary(next, route.itineraryBiomeKeys)) {
      setPending(undefined);
      return;
    }
    if (!projectDreamItineraryDraft(catalog, next, 0).complete) {
      setPending(next);
      return;
    }
    const clearedLabels = projectDreamItineraryReplacementLosses(catalog, route, next);
    if (clearedLabels.length === 0) {
      replace(next);
      return;
    }
    setPending(next, { slot, itineraryBiomeKeys: next, clearedLabels });
  };
  const slots = projectDreamItineraryDraft(catalog, draft, 0).badges;
  return (
    <div className="route-scope field-control field-control-inline dream-itinerary">
      <span>Biomes</span>
      <div
        aria-label="Dream biomes"
        className="dream-itinerary-slots route-biome-columns"
        role="group"
        style={{ '--route-biome-columns': slots.length } as CSSProperties}
      >
        {slots.map((slot) => {
          const projection = projectDreamItineraryDraft(catalog, draft, slot.index);
          const biomeKey = draft[slot.index];
          return (
            <ContextualPicker
              ariaLabel={`Biome ${slot.index + 1}`}
              choiceLabel={`Biome ${slot.index + 1} of ${projection.biomeCount}`}
              {...(slot.index > draft.length ? { disabledHint: candidateWaitingHint } : {})}
              id={slotId(slot.index)}
              itemIcon={(item) => biomeIcon(item.value)}
              key={slot.index}
              label=""
              model={projection.picker}
              onSelect={(value) => select(slot.index, value)}
              placeholder={slot.label}
              triggerIcon={biomeKey === undefined ? undefined : biomeIcon(biomeKey)}
              triggerLabel={slot.label}
            />
          );
        })}
      </div>
      {confirmation !== undefined && (
        <ConfirmationDialog
          confirmLabel="Clear and change"
          describedBy="dream-itinerary-clear-description"
          id="dream-itinerary-clear-title"
          onCancel={() => setPending(undefined)}
          onConfirm={() => replace(confirmation.itineraryBiomeKeys)}
          pending={false}
          returnFocusId={slotId(confirmation.slot)}
          title="Clear later biome plans?"
        >
          <div id="dream-itinerary-clear-description">
            <p>These biomes will be cleared:</p>
            <ul aria-label="Biomes to clear">
              {confirmation.clearedLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </ConfirmationDialog>
      )}
    </div>
  );
}
