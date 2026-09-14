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
    <li
      aria-label="Transcendent Embryo"
      className="room-action-row room-timeline-effect-row"
      data-transcendent-embryo={control.address.phaseKey}
    >
      <div className="owner-markers room-action-identity scheduled-trait-effect-identity">
        <span aria-hidden="true" className="hub-roster-rank">
          ·
        </span>
        <strong>Transcendent Embryo</strong>
        {domain?.emptyNoOp === true && outcome === undefined ? (
          <span>No eligible blessing (no-op)</span>
        ) : (
          <div className="transcendent-embryo-outcome-row">
            <RandomTraitTargetPicker
              findingTarget={findingTarget(control.address)}
              ariaLabel="Transcendent Embryo blessing"
              id={semanticOwnerControlElementId(control.address)}
              interaction={{ traitLabel: interaction.blessingLabel }}
              label="Target"
              layout="inline"
              model={domain?.picker ?? { sections: Object.freeze([]) }}
              onSelect={(blessingKey) =>
                executeIntent(interaction.intentFor(interaction.outcomeFor(blessingKey)))
              }
              onOpenChange={onOpenChange}
              open={open}
              selected={selected === '' ? null : selected}
            />
            {domain?.operands === undefined ||
            domain.rarity === undefined ||
            outcome === undefined ? null : (
              <TranscendentEmbryoOutcomeFields
                onChange={(blessingValues) =>
                  executeIntent(
                    interaction.intentFor(Object.freeze({ ...outcome, blessingValues })),
                  )
                }
                operands={domain.operands}
                rarity={domain.rarity}
                values={outcome.blessingValues}
              />
            )}
          </div>
        )}
        {domain?.selectedPossible === false && selected !== '' ? (
          <>
            <span className="finding-badge">Needs repair</span>
            <button
              className="quiet-action"
              onClick={() => executeIntent(interaction.intentFor(null))}
              type="button"
            >
              Clear recorded blessing
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
