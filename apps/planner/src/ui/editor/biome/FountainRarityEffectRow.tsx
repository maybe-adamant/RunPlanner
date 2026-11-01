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
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { RandomTraitTargetPicker } from '../rewards/PomResolutionEditor';
import { hintProps } from '@planner/ui/controls/hint';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';

const pendingPhialTitles = {
  unreached: candidateWaitingHint,
  noPhial: 'No Phial reaches this fountain.',
  noTargetRequired: 'No Phial-eligible boon to target here.',
} as const satisfies Record<NonNullable<WorkspaceFountainRarityControl['pending']>, string>;

const phialTargetName = 'Aromatic Phial target';

/** Inline editor for the exact target nested under one fountain action row. */
export function FountainRarityEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceFountainRarityControl;
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
      {/* The icon labels the picker, so the two never wrap apart. */}
      <span className="fountain-rarity-target">
        <span
          {...hintProps(phialTargetName, undefined, phialTargetName)}
          aria-label={phialTargetName}
          className="fountain-rarity-icon"
          role="img"
          tabIndex={0}
        >
          <img alt="" src={keepsakeArtwork.FountainRarityKeepsake} />
        </span>
        <RandomTraitTargetPicker
          findingTarget={findingTarget(control.address)}
          ariaLabel={phialTargetName}
          {...(control.pending === undefined
            ? {}
            : { disabledHint: pendingPhialTitles[control.pending] })}
          id={semanticOwnerControlElementId(control.address)}
          interaction={interaction}
          label=""
          layout="inline"
          model={domain?.picker ?? { sections: Object.freeze([]) }}
          onSelect={(target) => executeIntent(interaction.intentFor(target))}
          onOpenChange={onOpenChange}
          open={open}
          selected={selected === '' ? null : selected}
        />
      </span>
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
