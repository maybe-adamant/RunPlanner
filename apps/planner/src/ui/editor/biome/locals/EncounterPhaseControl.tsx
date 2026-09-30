import { useEffect, useRef, useState } from 'react';
import type { AuthoredNemesisRandomEventKind } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useFindingExplanations, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { NemesisEventSelector } from '../NemesisEventEditor';
import { EncounterCompositionControl } from './EncounterCompositionControl';
import { CocoonCountControl } from './CocoonCountControl';
import { CocoonRewardPointControl } from './CocoonRewardPointControl';
import { InfiniteRosterControl } from './InfiniteRosterControl';

const emptyEncounterPicker: import('@planner/projections/contextual/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });

const isCompositionFinding = (finding: { readonly code: string }): boolean =>
  finding.code === 'encounterCustomizationUnavailable' ||
  finding.code === 'encounterCustomizationRequired' ||
  finding.code === 'encounterIntroductionRequired';

function isGeneratedEncounterDecision(
  decision: NonNullable<WorkspaceEncounterPhase['customization']>[number],
): decision is Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'generated' } }
> {
  return decision.selection.kind === 'generated';
}

function EncounterCustomizationControl({
  interactions,
  phase,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const executeIntent = useCommandIntent();
  const [manualOpen, setManualOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const interactionKey = workspaceInteractionKey(phase.address);
  const interaction =
    phase.customization === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.encounterCustomizations, interactionKey);
  const composition = interaction?.generatedComposition ?? phase.composition;
  // A retained removal-only decision on a fixed identity is still an edit.
  const editable = composition?.editable === true || phase.customization !== undefined;
  const findingTarget = useFindingTarget();
  const required = useFindingExplanations(
    phase.address,
    (finding) => finding.code === 'encounterCustomizationRequired',
  );
  const customizationId =
    phase.customizable || interaction === undefined
      ? `encounter-customization-${semanticOwnerControlElementId(phase.address)}`
      : semanticOwnerControlElementId(phase.address);
  const triggerTarget =
    interaction === undefined
      ? { id: customizationId }
      : findingTarget(phase.address, customizationId, phase.address, isCompositionFinding);
  const generatedDecision = phase.customization?.find(isGeneratedEncounterDecision);
  // A decision whose candidate support is unreached waits on an earlier choice: a
  // generating composition without its assessment, or a roster without its drafts.
  // A fixed identity's retained value stays removable; the other decisions are static.
  const contextUnreached =
    (generatedDecision !== undefined &&
      interaction?.generatedComposition?.editable === true &&
      interaction.generatedAssessment === undefined) ||
    (phase.customization?.some((decision) => decision.selection.kind === 'infiniteRoster') ===
      true &&
      interaction?.infiniteRosterDraftFor === undefined);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (manualOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      } else dialog.setAttribute('open', '');
    }
    if (!manualOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [manualOpen]);
  const close = (): void => {
    setManualOpen(false);
  };
  const retainedLabel = (decision: NonNullable<typeof phase.customization>[number], key: string) =>
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable choice';
  return (
    <>
      <button
        {...triggerTarget}
        className="quiet-action"
        disabled={
          ('aria-disabled' in triggerTarget ? triggerTarget['aria-disabled'] : undefined) ||
          contextUnreached ||
          undefined
        }
        onClick={() => setManualOpen(true)}
        title={contextUnreached ? 'Waits on an earlier choice' : undefined}
        type="button"
      >
        {editable ? 'Customize encounter' : 'Inspect encounter'}
      </button>
      {manualOpen ? (
        <dialog
          aria-labelledby={`encounter-customization-title-${customizationId}`}
          aria-modal="true"
          className="trait-offer-dialog-backdrop"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          ref={dialogRef}
        >
          <div className="trait-offer-dialog encounter-customization-dialog">
            <header className="encounter-customization-header">
              <h2 id={`encounter-customization-title-${customizationId}`}>
                {composition === undefined
                  ? 'Customize'
                  : `${composition.label} (${phase.selectedEncounter.nativeEncounterDefinitionKey ?? phase.selectedEncounter.key})`}
              </h2>
              <button
                aria-label="Close encounter customization"
                className="quiet-action"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </header>
            <div className="encounter-customization-fields">
              {composition === undefined ? (
                generatedDecision?.value === undefined || interaction === undefined ? null : (
                  <section className="encounter-generated-customization">
                    <div className="encounter-generated-heading">
                      <h3>Encounter Composition</h3>
                      <button
                        className="danger-action action-compact"
                        onClick={() =>
                          executeIntent(interaction.intentFor(generatedDecision.key, null))
                        }
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="encounter-customization-repair">Needs repair</p>
                  </section>
                )
              ) : (
                <EncounterCompositionControl
                  requiredFindings={required}
                  composition={composition}
                  {...(generatedDecision === undefined ? {} : { decision: generatedDecision })}
                  idKey={interactionKey}
                  {...(interaction === undefined ? {} : { interaction })}
                />
              )}
              {phase.customization?.map((decision) => {
                const value = decision.value;
                if (interaction === undefined || isGeneratedEncounterDecision(decision))
                  return null;
                if (decision.selection.kind === 'cocoonCount') {
                  return (
                    <CocoonCountControl
                      decision={{ ...decision, selection: decision.selection }}
                      id={`encounter-customization-${customizationId}-${decision.key}`}
                      interaction={interaction}
                      key={decision.key}
                    />
                  );
                }
                if (decision.selection.kind === 'cocoonRewardPoint') {
                  return (
                    <CocoonRewardPointControl
                      key={decision.key}
                      decision={{ ...decision, selection: decision.selection }}
                      id={`encounter-customization-${customizationId}-${decision.key}`}
                      interaction={interaction}
                    />
                  );
                }
                if (decision.selection.kind === 'infiniteRoster') {
                  return (
                    <InfiniteRosterControl
                      decision={{ ...decision, selection: decision.selection }}
                      id={`encounter-customization-${customizationId}-${decision.key}`}
                      interaction={interaction}
                      key={decision.key}
                    />
                  );
                }
                if (decision.selection.kind === 'single') {
                  const selected = value?.kind === 'single' ? value.choiceKey : '';
                  return (
                    <label className="encounter-customization-row" key={decision.key}>
                      <span>{decision.label}</span>
                      <select
                        aria-label={decision.label}
                        id={`encounter-customization-${customizationId}-${decision.key}`}
                        onChange={(event) =>
                          executeIntent(
                            interaction.intentFor(
                              decision.key,
                              event.target.value === ''
                                ? null
                                : { kind: 'single', choiceKey: event.target.value },
                            ),
                          )
                        }
                        value={selected}
                      >
                        <option value="">Default</option>
                        {!decision.valueSupported &&
                        selected !== '' &&
                        !decision.selection.choices.some((choice) => choice.key === selected) ? (
                          <option disabled value={selected}>
                            {`${retainedLabel(decision, selected)} (unavailable)`}
                          </option>
                        ) : null}
                        {decision.selection.choices.map((choice) => (
                          <option key={choice.key} value={choice.key}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                      {!decision.valueSupported && value !== undefined ? (
                        <span className="encounter-customization-repair">Needs repair</span>
                      ) : null}
                    </label>
                  );
                }
                const prefixSelection = decision.selection;
                const selected = value?.kind === 'orderedPrefix' ? value.choiceKeys : [];
                const replace = (index: number, choiceKey: string): void => {
                  const next =
                    choiceKey === ''
                      ? selected.slice(0, index)
                      : (() => {
                          const preserved = [...selected];
                          preserved[index] = choiceKey;
                          return preserved;
                        })();
                  executeIntent(
                    interaction.intentFor(
                      decision.key,
                      next.length === 0 ? null : { kind: 'orderedPrefix', choiceKeys: next },
                    ),
                  );
                };
                return (
                  <section
                    aria-labelledby={`encounter-customization-group-${customizationId}-${decision.key}`}
                    className="encounter-customization-group"
                    key={decision.key}
                  >
                    <h3 id={`encounter-customization-group-${customizationId}-${decision.key}`}>
                      {decision.label}
                    </h3>
                    {Array.from({ length: prefixSelection.maximumLength }, (_, index) => (
                      <label className="encounter-customization-row" key={index}>
                        <span>Use {index + 1}</span>
                        <select
                          aria-label={`${decision.label} use ${index + 1}`}
                          disabled={index > 0 && selected[0] === undefined}
                          {...(index === 0
                            ? {
                                id: `encounter-customization-${customizationId}-${decision.key}`,
                              }
                            : {})}
                          onChange={(event) => replace(index, event.target.value)}
                          value={selected[index] ?? ''}
                        >
                          <option value="">Default</option>
                          {!decision.valueSupported &&
                          selected[index] !== undefined &&
                          !prefixSelection.choices.some(
                            (choice) => choice.key === selected[index],
                          ) ? (
                            <option disabled value={selected[index]}>
                              {`${retainedLabel(decision, selected[index]!)} (unavailable)`}
                            </option>
                          ) : null}
                          {prefixSelection.choices.map((choice) => (
                            <option
                              disabled={selected.some(
                                (selectedKey, selectedIndex) =>
                                  selectedIndex !== index && selectedKey === choice.key,
                              )}
                              key={choice.key}
                              value={choice.key}
                            >
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    {!decision.valueSupported && value !== undefined ? (
                      <p className="encounter-customization-repair">Needs repair</p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

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
      findingTarget={findingTarget(
        phase.address,
        semanticOwnerControlElementId(phase.address),
        phase.address,
        (finding) =>
          !isCompositionFinding(finding) && finding.code !== 'aetosAppearanceUnavailable',
      )}
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
      <label className="encounter-event-control">
        <input
          checked={figLeafInteraction.selected}
          disabled={!figLeafInteraction.supported && !figLeafInteraction.selected}
          onChange={(event) => executeIntent(figLeafInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Skip with Fig Leaf</span>
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
      <label className="encounter-event-control">
        <input
          checked={gorgonInteraction.selected}
          disabled={!gorgonInteraction.supported && !gorgonInteraction.selected}
          onChange={(event) => executeIntent(gorgonInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Gorgon Amulet: Death Defiance</span>
      </label>
    );
  const aetosInteraction =
    phase.aetos === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.aetosAppearances, phase.aetos.interactionKey);
  const aetosControl =
    aetosInteraction === undefined ? null : (
      <div className="encounter-event-control">
        <label className="encounter-event-control">
          <input
            {...findingTarget(
              phase.address,
              `aetos-${semanticOwnerControlElementId(phase.address)}`,
              phase.address,
              (finding) => finding.code === 'aetosAppearanceUnavailable',
            )}
            checked={aetosInteraction.selectedWave !== undefined}
            disabled={
              aetosInteraction.selectedWave === undefined && aetosInteraction.waves.length === 0
            }
            onChange={(event) => {
              if (!event.target.checked) executeIntent(aetosInteraction.intentFor(null));
              else if (aetosInteraction.enableIntent !== undefined)
                executeIntent(aetosInteraction.enableIntent);
            }}
            type="checkbox"
          />
          <span>Aetos appearance</span>
        </label>
        <span className="encounter-event-wave-slot">
          {aetosInteraction.selectedWave === undefined ? null : (
            <select
              aria-label="Aetos wave"
              value={aetosInteraction.selectedWave}
              onChange={(event) =>
                executeIntent(aetosInteraction.intentFor(Number(event.target.value)))
              }
            >
              {!aetosInteraction.waves.includes(aetosInteraction.selectedWave) ? (
                <option disabled value={aetosInteraction.selectedWave}>
                  Wave {aetosInteraction.selectedWave} (unavailable)
                </option>
              ) : null}
              {aetosInteraction.waves.map((wave) => (
                <option key={wave} value={wave}>
                  Wave {wave}
                </option>
              ))}
            </select>
          )}
        </span>
      </div>
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
  const customizationControl =
    phase.customization === undefined && phase.composition === undefined ? null : (
      <EncounterCustomizationControl interactions={interactions} phase={phase} />
    );
  return (
    <section
      {...(!phase.customizable &&
      phase.customization === undefined &&
      phase.nemesisFeature === undefined
        ? {
            ...findingTarget(
              phase.address,
              undefined,
              phase.address,
              (finding) =>
                !isCompositionFinding(finding) && finding.code !== 'aetosAppearanceUnavailable',
            ),
            tabIndex: -1,
          }
        : {})}
      aria-label={ariaLabel}
      className="encounter-phase-control"
    >
      <div className="local-reward-heading">
        <h4>{phase.label}</h4>
      </div>
      <div className="encounter-phase-settings">
        {phase.customizable ? (
          <CustomizableEncounterPhaseControl
            interaction={requireWorkspaceInteraction(
              interactions.encounterPhases,
              workspaceInteractionKey(phase.address),
            )}
            phase={phase}
          />
        ) : (
          <div className="field-control field-control-inline">
            <span>Encounter</span>
            <div className="encounter-fixed-value">{phase.selectedEncounter.label}</div>
          </div>
        )}
        {customizationControl}
        {phase.customizable ? null : nemesisEventSelector}
      </div>
      {figLeafControl !== null || gorgonControl !== null || aetosControl !== null ? (
        <div
          aria-label="Events"
          className="field-control field-control-inline encounter-events"
          role="group"
        >
          <span>Events</span>
          <div className="encounter-event-controls">
            {figLeafControl}
            {gorgonControl}
            {aetosControl}
          </div>
        </div>
      ) : null}
    </section>
  );
}
