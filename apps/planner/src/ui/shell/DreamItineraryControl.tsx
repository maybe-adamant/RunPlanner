import { useState } from 'react';

import { createRouteAddress, type AuthoredRoutePlan } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { projectDreamItineraryReplacementLosses } from '@planner/projections/dreamItinerary';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ConfirmationDialog } from '@planner/ui/controls/ConfirmationDialog';
import { DreamItineraryDialog } from '@planner/ui/project/DreamItineraryDialog';

type Stage =
  | { readonly kind: 'closed' }
  | { readonly kind: 'picking' }
  | {
      readonly kind: 'confirming';
      readonly itineraryBiomeKeys: readonly string[];
      readonly clearedLabels: readonly string[];
    };

/** Re-picks a Dream Dive's biomes, asking first when later biome plans would be cleared. */
export function DreamItineraryControl({
  catalog,
  route,
}: {
  readonly catalog: Catalog;
  readonly route: AuthoredRoutePlan;
}) {
  const dispatch = useAppDispatch();
  const [stage, setStage] = useState<Stage>({ kind: 'closed' });
  const replace = (itineraryBiomeKeys: readonly string[]) => {
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceDreamItinerary',
        route: createRouteAddress(route.routeKey),
        itineraryBiomeKeys,
      }),
    );
    setStage({ kind: 'closed' });
  };
  return (
    <>
      <button
        className="quiet-action action-compact dream-itinerary-change"
        onClick={() => setStage({ kind: 'picking' })}
        type="button"
      >
        Change biomes
      </button>
      {stage.kind === 'picking' && (
        <DreamItineraryDialog
          catalog={catalog}
          confirmLabel="Use these biomes"
          initialItinerary={route.itineraryBiomeKeys}
          onCancel={() => setStage({ kind: 'closed' })}
          onConfirm={(itineraryBiomeKeys) => {
            const clearedLabels = projectDreamItineraryReplacementLosses(
              catalog,
              route,
              itineraryBiomeKeys,
            );
            if (clearedLabels.length === 0) replace(itineraryBiomeKeys);
            else setStage({ kind: 'confirming', itineraryBiomeKeys, clearedLabels });
          }}
          pending={false}
        />
      )}
      {stage.kind === 'confirming' && (
        <ConfirmationDialog
          confirmLabel="Clear and change"
          describedBy="dream-itinerary-clear-description"
          id="dream-itinerary-clear-title"
          onCancel={() => setStage({ kind: 'closed' })}
          onConfirm={() => replace(stage.itineraryBiomeKeys)}
          pending={false}
          title="Clear later biome plans?"
        >
          <div id="dream-itinerary-clear-description">
            <p>These biomes will be cleared:</p>
            <ul aria-label="Biomes to clear">
              {stage.clearedLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </ConfirmationDialog>
      )}
    </>
  );
}
