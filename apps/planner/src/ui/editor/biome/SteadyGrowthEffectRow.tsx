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
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { RandomTraitTargetPicker } from '../rewards/PomResolutionEditor';
import { TimelineRow } from './TimelineRow';

/** React owner for the automatic Steady Growth timeline effect. */
export function SteadyGrowthEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceSteadyGrowthControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
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
    <TimelineRow
      aria-label="Steady Growth"
      aria-description="Automatic effect"
      data-action-accent="automatic"
      data-steady-growth={control.address.phaseKey}
      editors={
        <div className="scheduled-trait-effect-identity">
          <RandomTraitTargetPicker
            findingTarget={findingTarget(control.address)}
            ariaLabel="Steady Growth target"
            disabled={domain?.emptyNoOp === true && selected === ''}
            placeholder={domain?.emptyNoOp === true ? 'No eligible trait' : 'Choose a trait'}
            id={semanticOwnerControlElementId(control.address)}
            interaction={interaction}
            label="Target"
            layout="inline"
            model={domain?.picker ?? { sections: Object.freeze([]) }}
            onSelect={(target) => executeIntent(interaction.intentFor(target))}
            onOpenChange={onOpenChange}
            open={domain?.emptyNoOp === true && selected === '' ? false : open}
            selected={selected === '' ? null : selected}
          />
        </div>
      }
      kind="effect"
      placement={
        selected !== '' ? (
          <button
            aria-label="Clear recorded target"
            className="quiet-action action-compact effect-repair-action"
            disabled={domain?.selectedPossible !== false}
            data-inactive={domain?.selectedPossible !== false || undefined}
            title={
              domain?.selectedPossible === false
                ? undefined
                : 'Nothing to clear; the recorded choice is still possible.'
            }
            onClick={() => executeIntent(interaction.intentFor(null))}
            type="button"
          >
            Clear
          </button>
        ) : null
      }
      label={<strong>Steady Growth</strong>}
    />
  );
}
