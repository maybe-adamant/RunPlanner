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

/** Hub-owned fountain placement and Phial target, shown wherever the projection hosts them. */
export function HubFountainControls({
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
  // A moved fountain focuses its controls at their new position.
  useLayoutEffect(() => {
    if (focusedOwnerKey === fountain.marker.focusKey) {
      selectedButton.current?.focus({ preventScroll: true });
    }
  }, [focusedOwnerKey, fountain.marker.focusKey, fountain.selectedPlacementKey]);
  // Without a target control, the section itself receives Phial outcome findings.
  const outcomeTarget =
    fountain.rarity === undefined ? findingTarget(fountain.outcomeMarker.address) : undefined;
  return (
    <section
      aria-label="Hub fountain"
      className="hub-fountain-controls"
      {...(outcomeTarget === undefined
        ? {}
        : {
            'aria-description': outcomeTarget['aria-description'],
            'data-has-findings': outcomeTarget['data-has-findings'],
            'data-selected-finding': outcomeTarget['data-selected-finding'],
            'data-semantic-owner': outcomeTarget['data-semantic-owner'],
            id: outcomeTarget.id,
            ref: outcomeTarget.ref,
            tabIndex: -1,
          })}
    >
      <p>
        <strong>Hub fountain</strong>{' '}
        {fountain.controlsHost?.kind === 'room'
          ? `Used in the Hub before ${fountain.controlsHost.label}.`
          : 'Used in the Hub after the planned visits.'}
      </p>
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
        {fountain.rarity === undefined ? null : (
          <FountainRarityEffectRow control={fountain.rarity} interactions={interactions} />
        )}
      </div>
    </section>
  );
}
