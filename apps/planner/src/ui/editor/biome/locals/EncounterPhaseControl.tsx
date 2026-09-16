import { useState } from 'react';
import type { AuthoredNemesisRandomEventKind } from '@run-planner/engine/authored-project';
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
import { NemesisEventSelector } from '../NemesisEventEditor';

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
  const [selection, setSelection] = useState<{
    readonly interaction: WorkspaceEncounterInteraction;
    readonly step: 'encounter' | 'event';
  }>();
  const step = selection?.interaction === interaction ? selection.step : undefined;
  const event = interaction.nemesisEvent;
  const selectedFamily =
    phase.nemesisEvent === undefined ? undefined : event?.familyPicker.selected;
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel={step === 'event' ? 'Nemesis event' : 'Encounter'}
      closeOnSelect={false}
      findingTarget={findingTarget(phase.address)}
      id={semanticOwnerControlElementId(phase.address)}
      label="Encounter"
      layout="inline"
      loading={step === 'encounter' && candidates.pending}
      model={
        step === 'event' && event !== undefined
          ? event.familyPicker
          : (candidates.result ?? emptyEncounterPicker)
      }
      onOpenChange={(open) => {
        if (open) {
          candidates.activate();
          setSelection({ interaction, step: 'encounter' });
        } else {
          setSelection(undefined);
        }
      }}
      onSelect={(value) => {
        if (step === 'event' && event !== undefined) {
          executeIntent(event.familyIntentFor(value as AuthoredNemesisRandomEventKind));
        } else if (value === event?.encounterKey && event !== undefined) {
          setSelection({ interaction, step: 'event' });
          return;
        } else {
          executeIntent(interaction.intentFor(value));
        }
        setSelection(undefined);
      }}
      open={step !== undefined}
      placeholder="Choose an encounter"
      triggerLabel={
        selectedFamily === undefined
          ? phase.selectedEncounter.label
          : `${phase.selectedEncounter.label} · ${selectedFamily.label}`
      }
    />
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
  const nemesisEventSelector =
    phase.nemesisEvent === undefined
      ? null
      : (() => {
          const interaction = interactions.nemesisEvents.get(
            workspaceInteractionKey(phase.nemesisEvent.owner),
          );
          return interaction === undefined ? null : (
            <NemesisEventSelector interaction={interaction} />
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
          {nemesisEventSelector}
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
      </div>
    </section>
  );
}
