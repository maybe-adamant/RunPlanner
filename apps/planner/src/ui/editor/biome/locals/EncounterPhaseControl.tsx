import { useEffect, useRef, useState } from 'react';
import type { AuthoredNemesisRandomEventKind } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import {
  useFindingAnchor,
  useFindingExplanations,
  useFindingTarget,
} from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import type { FeedbackEntry } from '@planner/ui/editor/rewards/TraitOfferForm';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { NemesisEventSelector } from '../NemesisEventEditor';
import {
  compositionIssueMessages,
  CustomizationFindings,
  EncounterCompositionControl,
} from './EncounterCompositionControl';
import { CocoonCountControl } from './CocoonCountControl';
import { CocoonRewardPointControl } from './CocoonRewardPointControl';
import { InfiniteRosterControl } from './InfiniteRosterControl';
import { isCompositionFinding, isIdentityFinding } from './encounterPhaseFindings';

const emptyEncounterPicker: import('@planner/projections/contextual/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });

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
  const [initializationFailure, setInitializationFailure] = useState(false);
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
  // The system closes the dialog when its context is lost; a later reach needs a reopen.
  if (contextUnreached && manualOpen) setManualOpen(false);
  const retainedLabel = (decision: NonNullable<typeof phase.customization>[number], key: string) =>
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable choice';
  const unavailableTitle = 'Retained choice is unavailable here.';
  // Retained decision values the current context cannot produce; the composition's own
  // issues are listed by its control, so it is named only when no composition exists.
  const assessment =
    generatedDecision?.value === undefined ? undefined : interaction?.generatedAssessment;
  const findingEntries: readonly FeedbackEntry[] = [
    ...(initializationFailure
      ? [['initialization', 'No supported composition is available here.'] as const]
      : []),
    ...required.map((message, index) => [`required-${index}`, message] as const),
    ...(phase.customization ?? []).flatMap((decision) =>
      decision.value !== undefined &&
      (!decision.valueSupported ||
        (decision.selection.kind === 'infiniteRoster' &&
          interaction?.infiniteRosterSupported === false)) &&
      (composition === undefined || !isGeneratedEncounterDecision(decision))
        ? [
            [
              decision.key,
              `${decision.label}: ${unavailableTitle} Choose another value or reset it.`,
            ] as const,
          ]
        : [],
    ),
    ...compositionIssueMessages(assessment).map(
      (message, index) => [`composition-${index}`, message] as const,
    ),
  ];
  const warnings = assessment?.composition === 'active' ? assessment.warnings : [];
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
                  </section>
                )
              ) : (
                <EncounterCompositionControl
                  hasRequiredFindings={required.length > 0}
                  onInitializationFailure={setInitializationFailure}
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
                    <div key={decision.key}>
                      <ContextualPicker
                        label={decision.label}
                        layout="inline"
                        ariaLabel={decision.label}
                        placeholder="Default"
                        {...(!decision.valueSupported && value !== undefined
                          ? { invalid: true, triggerTitle: unavailableTitle }
                          : {})}
                        model={declaredChoicesPicker(
                          [
                            { key: 'default', value: '', label: 'Default' },
                            ...(!decision.valueSupported &&
                            selected !== '' &&
                            !decision.selection.choices.some((choice) => choice.key === selected)
                              ? [
                                  {
                                    key: selected,
                                    value: selected,
                                    label: `${retainedLabel(decision, selected)} (unavailable)`,
                                    disabled: true,
                                  },
                                ]
                              : []),
                            ...decision.selection.choices.map((choice) => ({
                              ...choice,
                              value: choice.key,
                            })),
                          ],
                          selected,
                        )}
                        id={`encounter-customization-${customizationId}-${decision.key}`}
                        onSelect={(choiceKey) =>
                          executeIntent(
                            interaction.intentFor(
                              decision.key,
                              choiceKey === '' ? null : { kind: 'single', choiceKey },
                            ),
                          )
                        }
                      />
                    </div>
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
                      <ContextualPicker
                        key={index}
                        id={`encounter-customization-${customizationId}-${decision.key}${index === 0 ? '' : `-${index}`}`}
                        label={`Use ${index + 1}`}
                        layout="inline"
                        ariaLabel={`${decision.label} use ${index + 1}`}
                        {...(index > 0 && selected[0] === undefined
                          ? { disabledTitle: 'Choose the first summon first' }
                          : !decision.valueSupported && selected[index] !== undefined
                            ? { invalid: true, triggerTitle: unavailableTitle }
                            : {})}
                        placeholder="Default"
                        model={declaredChoicesPicker(
                          [
                            { key: 'default', value: '', label: 'Default' },
                            ...(!decision.valueSupported &&
                            selected[index] !== undefined &&
                            !prefixSelection.choices.some(
                              (choice) => choice.key === selected[index],
                            )
                              ? [
                                  {
                                    key: selected[index]!,
                                    value: selected[index]!,
                                    label: `${retainedLabel(decision, selected[index]!)} (unavailable)`,
                                    disabled: true,
                                  },
                                ]
                              : []),
                            ...prefixSelection.choices.map((choice) => {
                              const alreadyUsed = selected.some(
                                (selectedKey, selectedIndex) =>
                                  selectedIndex !== index && selectedKey === choice.key,
                              );
                              return {
                                ...choice,
                                value: choice.key,
                                disabled: alreadyUsed,
                                ...(alreadyUsed
                                  ? { explanation: 'Already chosen for another use' }
                                  : {}),
                              };
                            }),
                          ],
                          selected[index] ?? '',
                        )}
                        onSelect={(choiceKey) => replace(index, choiceKey)}
                      />
                    ))}
                  </section>
                );
              })}
              <CustomizationFindings entries={findingEntries} warnings={warnings} />
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
        isIdentityFinding,
      )}
      id={semanticOwnerControlElementId(phase.address)}
      label={phase.identityLabel}
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

/** The phase's identity and customization, fixed on entry and authored in the room Overview. */
export function EncounterPhaseControl({
  interactions,
  phase,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const findingAnchor = useFindingAnchor();
  const customizationControl =
    phase.customization === undefined && phase.composition === undefined ? null : (
      <EncounterCustomizationControl interactions={interactions} phase={phase} />
    );
  // A fixed phase's Nemesis family is fixed when Nemesis spawns on entry.
  const nemesisInteraction =
    phase.customizable || phase.nemesisEvent === undefined
      ? undefined
      : interactions.nemesisEvents.get(workspaceInteractionKey(phase.nemesisEvent.owner));
  return (
    <section
      {...(!phase.customizable &&
      phase.customization === undefined &&
      phase.nemesisFeature === undefined
        ? {
            ...findingAnchor(phase.address),
            tabIndex: -1,
          }
        : {})}
      aria-label={`${phase.identityLabel} phase`}
      className="encounter-phase-control"
    >
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
            <span>{phase.identityLabel}</span>
            <div className="encounter-fixed-value">{phase.selectedEncounter.label}</div>
          </div>
        )}
        {nemesisInteraction === undefined ? null : (
          <NemesisEventSelector interaction={nemesisInteraction} />
        )}
        {customizationControl}
      </div>
    </section>
  );
}

/** The events decided when one phase starts (Fig Leaf, Gorgon, Aetos); none renders nothing. */
export function EncounterPhaseEvents({
  interactions,
  phase,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const figLeaf = phase.figLeaf;
  const figLeafInteraction =
    figLeaf === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.figLeafSkips, figLeaf.interactionKey);
  const figLeafControl =
    figLeaf === undefined || figLeafInteraction === undefined ? null : (
      <label className="timeline-checkbox">
        <input
          {...findingTarget(
            figLeaf.address,
            semanticOwnerControlElementId(figLeaf.address),
            phase.address,
          )}
          checked={figLeafInteraction.selected}
          onChange={(event) => executeIntent(figLeafInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Skip with Fig Leaf</span>
      </label>
    );
  const gorgon = phase.gorgonCondition;
  const gorgonInteraction =
    gorgon === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.gorgonConditions, gorgon.interactionKey);
  const gorgonControl =
    gorgon === undefined || gorgonInteraction === undefined ? null : (
      <label className="timeline-checkbox">
        <input
          {...findingTarget(
            gorgon.address,
            semanticOwnerControlElementId(gorgon.address),
            phase.address,
          )}
          checked={gorgonInteraction.selected}
          onChange={(event) => executeIntent(gorgonInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Gorgon Amulet: Death Defiance</span>
      </label>
    );
  const aetos = phase.aetos;
  const aetosInteraction =
    aetos === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.aetosAppearances, aetos.interactionKey);
  const aetosControl =
    aetos === undefined || aetosInteraction === undefined ? null : (
      <div className="encounter-event-control">
        <label className="timeline-checkbox">
          <input
            {...findingTarget(
              aetos.address,
              semanticOwnerControlElementId(aetos.address),
              phase.address,
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
              disabled={!aetosInteraction.contextReached || undefined}
              title={aetosInteraction.contextReached ? undefined : 'Waits on an earlier choice'}
              value={aetosInteraction.selectedWave}
              onChange={(event) =>
                executeIntent(aetosInteraction.intentFor(Number(event.target.value)))
              }
            >
              {!aetosInteraction.waves.includes(aetosInteraction.selectedWave) ? (
                <option disabled value={aetosInteraction.selectedWave}>
                  {aetosInteraction.contextReached
                    ? `Wave ${aetosInteraction.selectedWave} (unavailable)`
                    : `Wave ${aetosInteraction.selectedWave}`}
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
  if (figLeafControl === null && gorgonControl === null && aetosControl === null) return null;
  return (
    <div
      aria-label={`${phase.identityLabel} events`}
      className="encounter-event-controls"
      role="group"
    >
      {figLeafControl}
      {gorgonControl}
      {aetosControl}
    </div>
  );
}
