import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useEffect, useMemo, useState } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceSteadyGrowthControl,
  type WorkspaceSteadyGrowthDomain,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { RandomTraitTargetPicker } from '../rewards/PomResolutionEditor';

/** React owner for the automatic Steady Growth timeline effect. */
export function SteadyGrowthEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceSteadyGrowthControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const semanticNavigationRevision = useAppSelector(
    (state) => state.editorSession.semanticNavigationRevision,
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [closedAtNavigationRevision, setClosedAtNavigationRevision] = useState<number>();
  const interaction = requireWorkspaceInteraction(
    interactions.steadyGrowth,
    workspaceInteractionKey(control.address),
  );
  const loadable = useMemo(
    () => interaction.forTarget(control.targetTraitKey),
    [control.targetTraitKey, interaction],
  );
  const controller = useWorkspaceInteractionController<WorkspaceSteadyGrowthDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  const domain = loaded.result;
  const selected = control.targetTraitKey ?? '';
  const focused =
    focusedSemanticOwner?.kind === 'steadyGrowthOutcome' &&
    semanticAddressKey(focusedSemanticOwner) === semanticAddressKey(control.address);
  const open = manualOpen || (focused && closedAtNavigationRevision !== semanticNavigationRevision);
  const onOpenChange = (nextOpen: boolean): void => {
    setManualOpen(nextOpen);
    if (!nextOpen && focused) setClosedAtNavigationRevision(semanticNavigationRevision);
  };
  return (
    <li
      aria-label="Steady Growth"
      className="room-action-row room-timeline-effect-row"
      data-steady-growth={control.address.phaseKey}
    >
      <div className="owner-markers room-action-identity">
        <span aria-hidden="true" className="hub-roster-rank">
          ·
        </span>
        <strong>Steady Growth</strong>
        {domain?.emptyNoOp === true && control.targetTraitKey === undefined ? (
          <span>No eligible trait (no-op)</span>
        ) : (
          <RandomTraitTargetPicker
            ariaLabel="Steady Growth target"
            id={semanticOwnerControlElementId(control.address)}
            interaction={interaction}
            model={domain?.picker ?? { sections: Object.freeze([]) }}
            onSelect={(target) => executeIntent(interaction.intentFor(target))}
            onOpenChange={onOpenChange}
            open={open}
            selected={selected === '' ? null : selected}
          />
        )}
        {domain?.selectedPossible === false && selected !== '' ? (
          <>
            <span className="finding-badge">Needs repair</span>
            <button
              className="quiet-action"
              onClick={() => executeIntent(interaction.intentFor(null))}
              type="button"
            >
              Clear recorded target
            </button>
          </>
        ) : null}
        <SemanticOwnerMarker address={control.address} />
      </div>
    </li>
  );
}
