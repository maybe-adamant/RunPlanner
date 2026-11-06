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
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { AutomaticEffectTarget } from './AutomaticEffectTarget';
import { TimelineRow } from './TimelineRow';
import { hintProps } from '@planner/ui/controls/hint';

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
    <TimelineRow
      aria-label="Steady Growth"
      aria-description="Automatic effect"
      data-action-accent="automatic"
      editors={
        <AutomaticEffectTarget
          disabledHint={
            domain?.emptyNoOp === true && selected === '' ? 'No eligible trait' : undefined
          }
          owner={control.address}
          model={domain?.picker ?? { sections: Object.freeze([]) }}
          name="Steady Growth target"
          onOpenChange={onOpenChange}
          onSelect={(target) => executeIntent(interaction.intentFor(target))}
          open={open}
          sourceIcon={traitIcon(control.sourceTraitKey)}
          target={
            selected === ''
              ? undefined
              : {
                  key: selected,
                  label: interaction.traitLabel(selected),
                  ...(control.settledRarity === undefined ? {} : { rarity: control.settledRarity }),
                }
          }
        />
      }
      kind="effect"
      placement={
        selected !== '' ? (
          <button
            aria-label="Clear recorded target"
            className="quiet-action action-compact effect-repair-action"
            disabled={domain?.selectedPossible !== false}
            data-inactive={domain?.selectedPossible !== false || undefined}
            {...hintProps(
              domain?.selectedPossible === false
                ? undefined
                : 'Nothing to clear; the recorded choice is still possible.',
            )}
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
