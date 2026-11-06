import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useEffect, useMemo, useState } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceFountainRarityControl,
  type WorkspaceFountainRarityDomain,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { hintProps } from '@planner/ui/controls/hint';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';
import { AutomaticEffectTarget } from './AutomaticEffectTarget';

const pendingPhialTitles = {
  unreached: candidateWaitingHint,
  noPhial: 'No Phial reaches this fountain.',
  noTargetRequired: 'No Phial-eligible boon to target here.',
} as const satisfies Record<NonNullable<WorkspaceFountainRarityControl['pending']>, string>;

const phialTargetName = 'Phial target';

/** Inline editor for the exact target nested under one fountain action row. */
export function FountainRarityEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceFountainRarityControl;
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
    interactions.fountainRarity,
    workspaceInteractionKey(control.address),
  );
  const loadable = useMemo(
    () => interaction.forTarget(control.targetTraitKey),
    [control.targetTraitKey, interaction],
  );
  const controller = useWorkspaceInteractionController<WorkspaceFountainRarityDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  const domain = loaded.result;
  const selected = control.targetTraitKey ?? '';
  const focused =
    focusedSemanticOwner?.kind === 'fountainRarityOutcome' &&
    semanticAddressKey(focusedSemanticOwner) === semanticAddressKey(control.address);
  const open = manualOpen || (focused && closedAtNavigationRevision !== semanticNavigationRevision);
  const onOpenChange = (nextOpen: boolean): void => {
    setManualOpen(nextOpen);
    if (!nextOpen && focused) setClosedAtNavigationRevision(semanticNavigationRevision);
  };
  // The target shows only where a Phial reaches the fountain or a retained target needs repair.
  if (control.pending === 'noPhial' && control.targetTraitKey === undefined) return null;
  return (
    <div
      className="fountain-rarity-inline"
      data-pending={control.pending}
      data-fountain-rarity={
        control.address.action.kind === 'roomAction'
          ? control.address.action.actionKey
          : semanticAddressKey(control.address.action)
      }
    >
      <AutomaticEffectTarget
        disabledHint={
          control.pending === undefined ? undefined : pendingPhialTitles[control.pending]
        }
        owner={control.address}
        model={domain?.picker ?? { sections: Object.freeze([]) }}
        name={phialTargetName}
        onOpenChange={onOpenChange}
        onSelect={(target) => executeIntent(interaction.intentFor(target))}
        open={open}
        sourceIcon={keepsakeArtwork.FountainRarityKeepsake}
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
      {selected !== '' ? (
        <button
          className="quiet-action effect-repair-action"
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
          Clear Phial target
        </button>
      ) : null}
    </div>
  );
}
