import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { NemesisEventEditor } from '../NemesisEventEditor';

const emptyEncounterPicker: import('@planner/projections/contextual/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });

export function CustomizableEncounterPhaseControl({
  interaction,
  phase,
}: {
  readonly interaction: WorkspaceEncounterInteraction;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const candidates = useWorkspaceInteraction(interaction);
  return (
    <>
      <ContextualPicker
        findingTarget={findingTarget(phase.address)}
        id={semanticOwnerControlElementId(phase.address)}
        label="Encounter"
        layout="inline"
        loading={candidates.pending}
        model={candidates.result ?? emptyEncounterPicker}
        onOpenChange={(open) => {
          if (open) candidates.activate();
        }}
        onSelect={(encounterKey) => executeIntent(interaction.intentFor(encounterKey))}
        placeholder="Choose an encounter"
        triggerLabel={phase.selectedEncounter.label}
      />
      {phase.resettable ? (
        <button
          className="quiet-action action-compact"
          onClick={() => executeIntent(interaction.resetIntent)}
          type="button"
        >
          Reset to default
        </button>
      ) : null}
    </>
  );
}

export function EncounterPhaseControl({
  interactions,
  phase,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const figLeafInteraction =
    phase.figLeaf === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.figLeafSkips, phase.figLeaf.interactionKey);
  const figLeafControl =
    figLeafInteraction === undefined ? null : (
      <label className="field-control fig-leaf-skip-control">
        <input
          checked={figLeafInteraction.selected}
          disabled={!figLeafInteraction.supported && !figLeafInteraction.selected}
          onChange={(event) => executeIntent(figLeafInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Skip combat with Fig Leaf</span>
      </label>
    );
  const gorgonInteraction =
    phase.gorgonCondition === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.gorgonConditions,
          phase.gorgonCondition.interactionKey,
        );
  const gorgonControl =
    gorgonInteraction === undefined ? null : (
      <label className="field-control gorgon-condition-control">
        <span>Death Defiance condition</span>
        <input
          checked={gorgonInteraction.selected}
          disabled={!gorgonInteraction.supported && !gorgonInteraction.selected}
          onChange={(event) => executeIntent(gorgonInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
      </label>
    );
  const ariaLabel = phase.label.endsWith('encounter')
    ? `${phase.label} phase`
    : `${phase.label} encounter phase`;
  const nemesisEditor =
    phase.nemesisEvent === undefined
      ? null
      : (() => {
          const interaction = interactions.nemesisEvents.get(
            workspaceInteractionKey(phase.nemesisEvent.owner),
          );
          return interaction === undefined ? null : (
            <NemesisEventEditor
              interaction={interaction}
              key={`${interaction.key}:${JSON.stringify(interaction.value)}`}
            />
          );
        })();
  if (!phase.customizable) {
    return (
      <section
        {...findingTarget(phase.address)}
        tabIndex={-1}
        aria-label={ariaLabel}
        className="encounter-phase-control"
        data-read-only="true"
      >
        <div className="local-reward-heading">
          <h4>{phase.label}</h4>
        </div>
        <div className="encounter-phase-settings">
          <p className="fixed-room-state">Encounter: {phase.selectedEncounter.label}</p>
          {figLeafControl}
          {gorgonControl}
          {nemesisEditor}
        </div>
      </section>
    );
  }
  const interaction = requireWorkspaceInteraction(
    interactions.encounterPhases,
    workspaceInteractionKey(phase.address),
  );
  return (
    <section aria-label={ariaLabel} className="encounter-phase-control">
      <div className="local-reward-heading">
        <h4>{phase.label}</h4>
      </div>
      <div className="encounter-phase-settings">
        <CustomizableEncounterPhaseControl interaction={interaction} phase={phase} />
        {figLeafControl}
        {gorgonControl}
        {nemesisEditor}
      </div>
    </section>
  );
}
