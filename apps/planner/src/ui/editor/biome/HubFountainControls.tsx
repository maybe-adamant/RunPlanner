import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { presentCandidateLabel } from '@planner/projections/candidates/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceHubFountain,
  type WorkspaceHubFountainPlacement,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

function FountainPlacementOption({
  armed,
  buttonRef,
  interaction,
  locked,
  placement,
  selected,
}: {
  readonly armed: boolean;
  readonly buttonRef?: (element: HTMLButtonElement | null) => void;
  readonly interaction: WorkspaceHubActionOrderInteraction;
  readonly locked: boolean;
  readonly placement: WorkspaceHubFountainPlacement;
  readonly selected: boolean;
}) {
  const executeIntent = useCommandIntent();
  const proposal = interaction.proposalFor(placement.proposedActions);
  const candidates = useWorkspaceInteraction(proposal);
  const { activate } = candidates;
  // Options are assessed once the group is approached, not on every render of a room.
  useEffect(() => {
    if (armed && !selected) activate();
  }, [activate, armed, selected]);
  const option = selected ? undefined : candidates.result?.[0];
  const impossible = option !== undefined && !candidateMayBeAuthored(option);
  return (
    <button
      aria-busy={candidates.pending || undefined}
      aria-pressed={selected}
      className="quiet-action action-compact"
      disabled={locked || impossible}
      onClick={() => {
        if (selected) return;
        if (!candidateMayBeAuthored((candidates.result ?? activate())?.[0])) return;
        executeIntent(proposal.intent());
      }}
      ref={buttonRef}
      type="button"
      {...candidateSelectState(option)}
    >
      {presentCandidateLabel(placement.label, option)}
    </button>
  );
}

/** Fountain ordering belongs to the Hub Timeline, never the following room. */
export function HubFountainPlacementControls({
  fountain,
  interactions,
}: {
  readonly fountain: WorkspaceHubFountain;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(fountain.hub),
  );
  const focusedOwnerKey = useAppSelector((state) =>
    state.editorSession.focusedSemanticOwner === null
      ? undefined
      : semanticAddressKey(state.editorSession.focusedSemanticOwner),
  );
  const [armed, setArmed] = useState(false);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const locked = findingTarget(fountain.hub).inert;
  // Moving the fountain keeps focus on its Hub ordering control.
  useLayoutEffect(() => {
    if (focusedOwnerKey === fountain.marker.focusKey) {
      selectedButton.current?.focus({ preventScroll: true });
    }
  }, [focusedOwnerKey, fountain.marker.focusKey, fountain.selectedPlacementKey]);
  return (
    <section
      {...findingTarget(fountain.address)}
      aria-label="Fountain order"
      className="hub-fountain-controls"
    >
      <strong>Fountain order</strong>
      <div className="hub-fountain-controls-fields">
        <div
          aria-label="Fountain use"
          className="hub-fountain-placements"
          onFocus={() => setArmed(true)}
          onPointerEnter={() => setArmed(true)}
          role="group"
        >
          {fountain.placements.map((placement) => {
            const selected = placement.key === fountain.selectedPlacementKey;
            return (
              <FountainPlacementOption
                armed={armed}
                {...(selected
                  ? {
                      buttonRef: (element: HTMLButtonElement | null) => {
                        selectedButton.current = element;
                      },
                    }
                  : {})}
                interaction={interaction}
                key={placement.key}
                locked={locked}
                placement={placement}
                selected={selected}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Read-only timing and the Hub-owned Phial target, hosted before the next room. */
export function HubFountainControls({
  fountain,
  interactions,
}: {
  readonly fountain: WorkspaceHubFountain;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  return (
    <section
      aria-label="Hub fountain"
      className="hub-fountain-controls"
      {...(fountain.rarity === undefined ? findingTarget(fountain.outcomeMarker.address) : {})}
      tabIndex={-1}
    >
      <p>
        <strong>Hub fountain</strong>{' '}
        {fountain.controlsHost?.kind === 'room'
          ? `Used in the Hub before ${fountain.controlsHost.label}.`
          : 'Used in the Hub after the planned visits.'}
      </p>
      {fountain.rarity === undefined ? null : (
        <FountainRarityEffectRow control={fountain.rarity} interactions={interactions} />
      )}
    </section>
  );
}
