import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceTranscendentEmbryoControl,
  type WorkspaceTranscendentEmbryoDomain,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { RandomTraitTargetPicker } from '../rewards/PomResolutionEditor';
import { TranscendentEmbryoOutcomeFields } from '../rewards/TranscendentEmbryoOutcomeFields';
import { TimelineRow } from './TimelineRow';
import { hintProps } from '@planner/ui/controls/hint';

/** React owner for the automatic Transcendent Embryo transformation row. */
export function TranscendentEmbryoEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceTranscendentEmbryoControl;
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
  const requestedInteraction = requireWorkspaceInteraction(
    interactions.transcendentEmbryo,
    workspaceInteractionKey(control.address),
  );
  const loadable = useMemo(
    () => requestedInteraction.forBlessing(control.value),
    [control.value, requestedInteraction],
  );
  const [binding, setBinding] = useState(() => ({
    interaction: requestedInteraction,
    loadable,
    outcome: control.value,
  }));
  const controller = useWorkspaceInteractionController<
    WorkspaceTranscendentEmbryoDomain | undefined
  >();
  const loaded = controller.observe(binding.loadable);
  useLayoutEffect(() => {
    // Keep the outcome and its activated domain coherent so an authored
    // magnitude update does not detach the slider that owns the drag.
    controller.activate(loadable);
    // The activated capability and its controlled inputs must commit atomically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBinding({ interaction: requestedInteraction, loadable, outcome: control.value });
  }, [controller, loadable, requestedInteraction, control.value]);
  const domain = loaded.result;
  const { interaction, outcome } = binding;
  const selected = outcome?.blessingKey ?? '';
  const focused =
    focusedSemanticOwner?.kind === 'transcendentEmbryoOutcome' &&
    semanticAddressKey(focusedSemanticOwner) === semanticAddressKey(control.address);
  const open = manualOpen || (focused && closedAtNavigationRevision !== semanticNavigationRevision);
  const onOpenChange = (nextOpen: boolean): void => {
    setManualOpen(nextOpen);
    if (!nextOpen && focused) setClosedAtNavigationRevision(semanticNavigationRevision);
  };
  return (
    <TimelineRow
      aria-label="Transcendent Embryo"
      aria-description="Automatic effect"
      data-action-accent="automatic"
      data-transcendent-embryo={control.address.phaseKey}
      editors={
        <div className="transcendent-embryo-outcome-row">
          <RandomTraitTargetPicker
            findingTarget={findingTarget(control.address)}
            ariaLabel="Transcendent Embryo blessing"
            disabled={domain?.emptyNoOp === true && outcome === undefined}
            placeholder={domain?.emptyNoOp === true ? 'No eligible blessing' : 'Choose a trait'}
            id={semanticOwnerControlElementId(control.address)}
            interaction={{ traitLabel: interaction.blessingLabel }}
            label="Target"
            layout="inline"
            model={domain?.picker ?? { sections: Object.freeze([]) }}
            onSelect={(blessingKey) =>
              executeIntent(interaction.intentFor(interaction.outcomeFor(blessingKey)))
            }
            onOpenChange={onOpenChange}
            open={domain?.emptyNoOp === true && outcome === undefined ? false : open}
            selected={selected === '' ? null : selected}
          />
          {domain?.operands === undefined ||
          domain.rarity === undefined ||
          outcome === undefined ? null : (
            <TranscendentEmbryoOutcomeFields
              onChange={(blessingValues) =>
                executeIntent(interaction.intentFor(Object.freeze({ ...outcome, blessingValues })))
              }
              operands={domain.operands}
              rarity={domain.rarity}
              values={outcome.blessingValues}
            />
          )}
        </div>
      }
      kind="effect"
      placement={
        selected !== '' ? (
          <button
            aria-label="Clear recorded blessing"
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
      label={<strong>Transcendent Embryo</strong>}
    />
  );
}
