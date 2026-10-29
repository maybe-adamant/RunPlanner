import { useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { routeArtwork } from '@planner/ui/artwork/route-icons/routeArtwork';
import { ModalDialog } from '@planner/ui/controls/ModalDialog';
import { DreamItineraryDialog } from './DreamItineraryDialog';

/** Chooses the route of a new blank plan, which opens once created. */
export function NewPlanDialog({
  catalog,
  folder,
  onClose,
  operations,
  routes,
}: {
  readonly catalog: Catalog;
  /** The Library folder the plan is filed in. */
  readonly folder: string;
  readonly onClose: () => void;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dreamOpen, setDreamOpen] = useState(false);
  const create = async (routeKey: string, itineraryBiomeKeys?: readonly string[]) => {
    setPending(true);
    setProblem(null);
    try {
      const result = await operations.createNew(routeKey, itineraryBiomeKeys, folder);
      if (result.status === 'failure') setProblem(result.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <ModalDialog
      className="game-publication-dialog new-plan-dialog"
      labelledBy="new-plan-title"
      onCancel={onClose}
      pending={pending}
    >
      <header className="panel-heading">
        <div>
          <p className="eyebrow">New plan</p>
          <h2 id="new-plan-title">Choose a route</h2>
        </div>
      </header>
      <fieldset className="route-chooser route-chooser-entry" aria-label="Choose route">
        <legend className="visually-hidden">Choose route</legend>
        <div className="route-choice-grid">
          {routes.map((route) => (
            <button
              aria-label={`Create ${route.label} plan`}
              className="route-choice-card"
              disabled={pending}
              key={route.routeKey}
              onClick={() => {
                if (route.itinerarySelectionRequired) setDreamOpen(true);
                else void create(route.routeKey);
              }}
              type="button"
            >
              <ArtworkIcon
                className="route-choice-icon"
                source={routeArtwork[route.routeKey] ?? undefined}
              />
              <span className="route-choice-name">{route.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {problem === null ? null : (
        <p className="game-publication-message" role="alert">
          {problem}
        </p>
      )}
      <footer className="game-publication-actions">
        <button className="quiet-action" disabled={pending} onClick={onClose} type="button">
          Cancel
        </button>
      </footer>
      {dreamOpen && (
        <DreamItineraryDialog
          catalog={catalog}
          confirmLabel="Create project"
          onCancel={() => setDreamOpen(false)}
          onConfirm={(itineraryBiomeKeys) => void create('Dream', itineraryBiomeKeys)}
          pending={pending}
        />
      )}
    </ModalDialog>
  );
}
