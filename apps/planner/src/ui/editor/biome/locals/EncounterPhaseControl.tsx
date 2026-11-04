import { useMemo, useState, type ReactNode } from 'react';
import type {
  AuthoredEncounterCustomization,
  SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterCustomizationDraft,
  type WorkspaceEncounterCustomizationInteraction,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import {
  useCustomizationFindingExplanations,
  useFindingAnchor,
  useFindingTarget,
  type FindingTargetFilter,
} from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import {
  EditorDialog,
  EditorDialogDraftActions,
  type EditorDialogIssue,
} from '@planner/ui/controls/EditorDialog';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { authoredProjectCommandsDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { NemesisEventSelector } from '../NemesisEventEditor';
import { compositionIssues, EncounterCompositionControl } from './EncounterCompositionControl';
import { CocoonCountControl } from './CocoonCountControl';
import { CocoonRewardPointControl } from './CocoonRewardPointControl';
import { InfiniteRosterControl } from './InfiniteRosterControl';
import { isCompositionFinding, isIdentityFinding } from './encounterPhaseFindings';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { aetosIcon, npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';
import { encounterIcon, minibossIcon } from '@planner/ui/artwork/encounterArtwork';

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

type CustomizationDecision = NonNullable<WorkspaceEncounterPhase['customization']>[number];
type DraftValues = Readonly<Record<string, AuthoredEncounterCustomization | undefined>>;

const retainedLabel = (decision: CustomizationDecision, key: string) =>
  decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
  'Unavailable choice';

/**
 * Retained decision values the context cannot produce, then the composition's own
 * issues; a generated value is named only when no composition exists. A saved
 * value keeps its finding's explanation.
 */
function customizationIssues(
  decisions: readonly CustomizationDecision[],
  draft: WorkspaceEncounterCustomizationDraft,
  hasComposition: boolean,
  savedExplanation: (decision: CustomizationDecision) => string | undefined,
): readonly EditorDialogIssue[] {
  const generated = decisions.find(isGeneratedEncounterDecision);
  return [
    ...decisions.flatMap((decision) =>
      decision.value !== undefined &&
      (!decision.valueSupported ||
        (decision.selection.kind === 'infiniteRoster' &&
          draft.infiniteRosterSupported === false)) &&
      (!hasComposition || !isGeneratedEncounterDecision(decision))
        ? [
            [
              decision.key,
              savedExplanation(decision) ??
                `${decision.label}: The chosen value can't occur in this room. Choose another or reset it.`,
            ] as const,
          ]
        : [],
    ),
    ...compositionIssues(generated?.value === undefined ? undefined : draft.generatedAssessment),
  ];
}

/** What a customization launcher edits: one encounter's decisions under their finding owner. */
export interface EncounterCustomizationSubject {
  readonly address: SemanticAddress;
  /** The launcher's element id, where the dialog returns focus. */
  readonly controlId: string;
  /** The encounter's engine key, the dialog title's hint. */
  readonly definitionKey: string;
  /** The encounter's name, titling the dialog without a composition. */
  readonly label: string;
  /** Names the launcher, as "Customize <identity>". */
  readonly identityLabel: string;
  readonly customization?: readonly CustomizationDecision[];
  readonly composition?: WorkspaceEncounterPhase['composition'];
  /** The owner's findings its launcher repairs. */
  readonly findingFilter: FindingTargetFilter;
}

/** The dialog title names the encounter; its engine key is the title's hint. */
function encounterDialogTitle(label: string, subject: EncounterCustomizationSubject): ReactNode {
  return (
    <span className="encounter-dialog-title" {...hintProps(subject.definitionKey)}>
      {label}
    </span>
  );
}

/** The encounter's decisions as one draft: Save commits every changed decision as one edit. */
function EncounterCustomizationDialog({
  customizationId,
  interaction,
  interactionKey,
  onClose,
  subject,
  savedDecisions,
}: {
  readonly customizationId: string;
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
  readonly interactionKey: string;
  readonly onClose: () => void;
  readonly subject: EncounterCustomizationSubject;
  readonly savedDecisions: readonly CustomizationDecision[];
}) {
  const dispatch = useAppDispatch();
  const [initializationFailure, setInitializationFailure] = useState(false);
  const saved = useMemo<DraftValues>(
    () => Object.fromEntries(savedDecisions.map((decision) => [decision.key, decision.value])),
    [savedDecisions],
  );
  // A changed authored value replaces the draft; a changed context keeps it.
  const savedIdentity = draftValueIdentity(saved);
  const [draftState, setDraftState] = useState(() => ({ identity: savedIdentity, values: saved }));
  const values = draftState.identity === savedIdentity ? draftState.values : saved;
  const setValue = (decisionKey: string, value: AuthoredEncounterCustomization | null): void =>
    setDraftState({
      identity: savedIdentity,
      values: { ...values, [decisionKey]: value ?? undefined },
    });
  const atRest = draftValueIdentity(values) === savedIdentity;
  const restView = useMemo(() => interaction.draftFor(saved), [interaction, saved]);
  const draftView = useMemo(
    () => (atRest ? restView : interaction.draftFor(values)),
    [atRest, interaction, restView, values],
  );
  const decisions = draftView.decisions;
  const composition = draftView.generatedComposition ?? subject.composition;
  const generatedDecision = decisions.find(isGeneratedEncounterDecision);
  const findingExplanations = useCustomizationFindingExplanations(subject.address);
  const savedExplanation = (decision: CustomizationDecision) =>
    draftValueIdentity(decision.value) === draftValueIdentity(saved[decision.key])
      ? findingExplanations.get(decision.key)
      : undefined;
  const restIssues = customizationIssues(
    restView.decisions,
    restView,
    (restView.generatedComposition ?? subject.composition) !== undefined,
    savedExplanation,
  );
  const draftIssues = customizationIssues(
    decisions,
    draftView,
    composition !== undefined,
    savedExplanation,
  );
  const issues: readonly EditorDialogIssue[] = [
    ...(initializationFailure
      ? [['initialization', 'No supported composition is available here.'] as const]
      : []),
    ...(atRest ? restIssues : draftIssues),
  ];
  // A finding this draft introduced blocks Save; inherited findings do not.
  const introduced = introducesIssue(draftIssues, restIssues);
  const save = (): void => {
    const commands = savedDecisions
      .filter(
        (decision) =>
          draftValueIdentity(values[decision.key]) !== draftValueIdentity(decision.value),
      )
      .map((decision) => interaction.intentFor(decision.key, values[decision.key] ?? null).command);
    if (commands.length > 0) dispatch(authoredProjectCommandsDispatched(commands));
    onClose();
  };
  const savedComposition = interaction.generatedComposition ?? subject.composition;
  return (
    <EditorDialog
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={customizationId}
      size="narrow"
      title={encounterDialogTitle(savedComposition?.label ?? subject.label, subject)}
    >
      <EditorDialogDraftActions
        issues={issues}
        onCancel={onClose}
        // Reset returns every customization of the encounter to game control.
        onReset={() =>
          setDraftState({
            identity: savedIdentity,
            values: Object.fromEntries(Object.keys(values).map((key) => [key, undefined])),
          })
        }
        onSave={save}
        resetDisabled={Object.values(values).every((value) => value === undefined)}
        saveDisabled={atRest || introduced}
      />
      <div className="encounter-customization-fields">
        {composition === undefined ? (
          generatedDecision?.value === undefined ? null : (
            <section className="encounter-generated-customization">
              <div className="encounter-generated-heading">
                <h3>Encounter Composition</h3>
              </div>
            </section>
          )
        ) : (
          <EncounterCompositionControl
            onInitializationFailure={setInitializationFailure}
            composition={composition}
            {...(generatedDecision === undefined ? {} : { decision: generatedDecision })}
            draft={draftView}
            idKey={interactionKey}
            {...(interaction.initializeGenerated === undefined
              ? {}
              : { initializeGenerated: interaction.initializeGenerated })}
            onValue={(value) => {
              if (generatedDecision !== undefined) setValue(generatedDecision.key, value ?? null);
            }}
          />
        )}
        {decisions.map((decision) => {
          const value = decision.value;
          const onValue = (next: AuthoredEncounterCustomization | null) =>
            setValue(decision.key, next);
          if (isGeneratedEncounterDecision(decision)) return null;
          if (decision.selection.kind === 'cocoonCount') {
            return (
              <CocoonCountControl
                decision={{ ...decision, selection: decision.selection }}
                id={`encounter-customization-${customizationId}-${decision.key}`}
                key={decision.key}
                onValue={onValue}
                resettable={decisions.length > 1}
              />
            );
          }
          if (decision.selection.kind === 'cocoonRewardPoint') {
            return (
              <CocoonRewardPointControl
                key={decision.key}
                decision={{ ...decision, selection: decision.selection }}
                id={`encounter-customization-${customizationId}-${decision.key}`}
                onValue={onValue}
              />
            );
          }
          if (decision.selection.kind === 'infiniteRoster') {
            return (
              <InfiniteRosterControl
                decision={{ ...decision, selection: decision.selection }}
                draftFor={interaction.infiniteRosterDraftFor}
                id={`encounter-customization-${customizationId}-${decision.key}`}
                key={decision.key}
                onValue={onValue}
                resettable={decisions.length > 1}
                supported={draftView.infiniteRosterSupported}
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
                  {...(!decision.valueSupported && value !== undefined ? { invalid: true } : {})}
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
                    onValue(choiceKey === '' ? null : { kind: 'single', choiceKey })
                  }
                />
              </div>
            );
          }
          const prefixSelection = decision.selection;
          const selected = value?.kind === 'orderedPrefix' ? value.choiceKeys : [];
          return (
            <section
              aria-labelledby={`encounter-customization-group-${customizationId}-${decision.key}`}
              className="encounter-customization-group"
              key={decision.key}
            >
              <h3 id={`encounter-customization-group-${customizationId}-${decision.key}`}>
                {decision.label}
              </h3>
              {prefixSelection.uses.map((use, index) => (
                <ContextualPicker
                  key={index}
                  id={`encounter-customization-${customizationId}-${decision.key}${index === 0 ? '' : `-${index}`}`}
                  label={`Use ${index + 1}`}
                  layout="inline"
                  ariaLabel={`${decision.label} use ${index + 1}`}
                  {...(use.requiresEarlierUse
                    ? { locked: true }
                    : !decision.valueSupported && selected[index] !== undefined
                      ? { invalid: true }
                      : {})}
                  placeholder="Default"
                  model={declaredChoicesPicker(
                    [
                      { key: 'default', value: '', label: 'Default' },
                      ...(!decision.valueSupported &&
                      selected[index] !== undefined &&
                      !prefixSelection.choices.some((choice) => choice.key === selected[index])
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
                        const held = !use.availableChoiceKeys.includes(choice.key);
                        return {
                          ...choice,
                          value: choice.key,
                          disabled: held,
                          ...(held ? { explanations: ['Already chosen for another use'] } : {}),
                        };
                      }),
                    ],
                    selected[index] ?? '',
                  )}
                  onSelect={(choiceKey) => {
                    const next =
                      choiceKey === '' ? use.defaultValue : use.valueByChoiceKey[choiceKey];
                    if (next !== undefined) onValue(next);
                  }}
                />
              ))}
            </section>
          );
        })}
      </div>
    </EditorDialog>
  );
}

/** Opens an encounter's customization dialog, or a fixed roster's read-only view. */
export function EncounterCustomizationLauncher({
  interaction,
  subject,
}: {
  readonly interaction: WorkspaceEncounterCustomizationInteraction | undefined;
  readonly subject: EncounterCustomizationSubject;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const interactionKey = workspaceInteractionKey(subject.address);
  const composition = interaction?.generatedComposition ?? subject.composition;
  // A retained removal-only decision on a fixed identity is still an edit.
  const editable = composition?.editable === true || subject.customization !== undefined;
  const findingTarget = useFindingTarget();
  const customizationId = subject.controlId;
  const triggerTarget =
    interaction === undefined
      ? { id: customizationId }
      : findingTarget(subject.address, customizationId, subject.address, subject.findingFilter);
  const generatedDecision = subject.customization?.find(isGeneratedEncounterDecision);
  // A decision whose candidate support is unreached waits on an earlier choice: a
  // generating composition without its assessment, or a roster without its drafts.
  // A fixed identity's retained value stays removable; the other decisions are static.
  const contextUnreached =
    (generatedDecision !== undefined &&
      interaction?.generatedComposition?.editable === true &&
      interaction.generatedAssessment === undefined) ||
    (subject.customization?.some((decision) => decision.selection.kind === 'infiniteRoster') ===
      true &&
      interaction?.infiniteRosterDraftFor === undefined);
  const close = (): void => {
    setManualOpen(false);
  };
  // The system closes the dialog when its context is lost; a later reach needs a reopen.
  if (contextUnreached && manualOpen) setManualOpen(false);
  return (
    <>
      <button
        {...triggerTarget}
        className="dialog-launcher quiet-action"
        disabled={
          ('aria-disabled' in triggerTarget ? triggerTarget['aria-disabled'] : undefined) ||
          contextUnreached ||
          undefined
        }
        onClick={() => setManualOpen(true)}
        {...hintProps(
          contextUnreached ? candidateWaitingHint : undefined,
          'aria-description' in triggerTarget ? triggerTarget['aria-description'] : undefined,
        )}
        aria-label={`${editable ? 'Customize' : 'View roster for'} ${subject.identityLabel.toLowerCase()}`}
        type="button"
      >
        {editable ? 'Customize' : 'View roster'}
      </button>
      {!manualOpen ? null : interaction !== undefined && subject.customization !== undefined ? (
        <EncounterCustomizationDialog
          customizationId={customizationId}
          interaction={interaction}
          interactionKey={interactionKey}
          onClose={close}
          subject={subject}
          savedDecisions={subject.customization}
        />
      ) : composition === undefined ? null : (
        // A fixed roster has nothing to edit: a read-only view that closes from its title row.
        <EditorDialog
          model={{ kind: 'view', onClose: close }}
          returnFocusId={customizationId}
          size="narrow"
          title={encounterDialogTitle(composition.label, subject)}
        >
          <div className="encounter-customization-fields">
            <EncounterCompositionControl composition={composition} idKey={interactionKey} />
          </div>
        </EditorDialog>
      )}
    </>
  );
}

/** A phase's customization launcher: its decisions under the phase's finding owner. */
function EncounterCustomizationControl({
  interactions,
  phase,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const interactionKey = workspaceInteractionKey(phase.address);
  const interaction =
    phase.customization === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.encounterCustomizations, interactionKey);
  return (
    <EncounterCustomizationLauncher
      interaction={interaction}
      subject={{
        address: phase.address,
        controlId:
          phase.customizable || interaction === undefined
            ? `encounter-customization-${semanticOwnerControlElementId(phase.address)}`
            : semanticOwnerControlElementId(phase.address),
        definitionKey:
          phase.selectedEncounter.nativeEncounterDefinitionKey ?? phase.selectedEncounter.key,
        label: phase.selectedEncounter.label,
        identityLabel: phase.identityLabel,
        ...(phase.customization === undefined ? {} : { customization: phase.customization }),
        ...(phase.composition === undefined ? {} : { composition: phase.composition }),
        findingFilter: isCompositionFinding,
      }}
    />
  );
}

const npcIcon = (npcKey: string | undefined): string | undefined =>
  npcKey === undefined ? undefined : (npcArtwork[npcKey] ?? undefined);

/** An encounter's own icon (such as a cocoon), else its NPC, else its miniboss. */
const encounterChoiceIcon = (definitionKey: string, npcKey: string | undefined) =>
  encounterIcon(definitionKey) ?? npcIcon(npcKey) ?? minibossIcon(definitionKey);

const selectedEncounterIcon = (
  encounter: WorkspaceEncounterPhase['selectedEncounter'],
): string | undefined =>
  encounterChoiceIcon(encounter.nativeEncounterDefinitionKey ?? encounter.key, encounter.npcKey);

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
  const [open, setOpen] = useState(false);
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel="Encounter"
      findingTarget={findingTarget(
        phase.address,
        semanticOwnerControlElementId(phase.address),
        phase.address,
        isIdentityFinding,
      )}
      id={semanticOwnerControlElementId(phase.address)}
      label={phase.label}
      layout="inline"
      loading={open && candidates.pending}
      model={candidates.result ?? emptyEncounterPicker}
      onOpenChange={(nextOpen) => {
        if (nextOpen) candidates.activate();
        setOpen(nextOpen);
      }}
      onSelect={(value) => {
        executeIntent(interaction.intentFor(value));
        setOpen(false);
      }}
      itemIcon={(item: { readonly value: string }) =>
        encounterChoiceIcon(
          interaction.definitionKeyFor(item.value),
          interaction.npcKeyFor(item.value),
        )
      }
      triggerIcon={selectedEncounterIcon(phase.selectedEncounter)}
      open={open}
      placeholder="Choose an encounter"
      triggerLabel={phase.selectedEncounter.label}
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
    phase.nemesisEvent === undefined
      ? undefined
      : interactions.nemesisEvents.get(workspaceInteractionKey(phase.nemesisEvent.owner));
  return (
    <section
      {...(!phase.customizable && phase.customization === undefined
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
            <span>{phase.label}</span>
            <div className="encounter-fixed-value">
              {selectedEncounterIcon(phase.selectedEncounter) === undefined ? null : (
                <ArtworkIcon
                  className="encounter-npc-icon"
                  source={selectedEncounterIcon(phase.selectedEncounter)}
                />
              )}
              <span>{phase.selectedEncounter.label}</span>
            </div>
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

const skippedWithFigLeaf = 'Skipped with Fig Leaf';

function EncounterEventGroup({
  children,
  label,
  slotted = false,
}: {
  readonly children: readonly ReactNode[];
  readonly label: string;
  /** Start events keep fixed slots, so each one lines up across banners. */
  readonly slotted?: boolean;
}) {
  if (children.every((child) => child === null)) return null;
  return (
    <div
      aria-label={label}
      className="encounter-event-controls"
      data-slotted={slotted ? '' : undefined}
      role="group"
    >
      {children}
    </div>
  );
}

/**
 * One encounter event as an icon toggle: dim when off, lit when on. Its icon alone
 * does not say what it means, so its name is also its hint on hover and focus.
 */
function EncounterEventToggle({
  icon,
  inapplicable,
  inapplicableHint,
  name,
  onToggle,
  pressed,
  slot,
  target,
}: {
  readonly icon: string | undefined;
  /** A retained value with no effect here: still clearable, but quiet. */
  readonly inapplicable?: boolean;
  readonly inapplicableHint?: string;
  readonly name: string;
  /** The fixed banner slot this toggle keeps, so icons line up across banners. */
  readonly slot: 'gorgon' | 'figLeaf';
  readonly onToggle: (next: boolean) => void;
  readonly pressed: boolean;
  readonly target: ReturnType<ReturnType<typeof useFindingTarget>>;
}) {
  const description = 'aria-description' in target ? target['aria-description'] : undefined;
  const hint = inapplicableHint === undefined ? name : `${name} · ${inapplicableHint}`;
  return (
    <button
      {...target}
      {...hintProps(hint, description, name)}
      aria-label={name}
      aria-pressed={pressed}
      className="encounter-event-toggle"
      data-inapplicable={inapplicable === true ? '' : undefined}
      data-slot={slot}
      onClick={() => onToggle(!pressed)}
      type="button"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
    </button>
  );
}

/**
 * What is settled as a phase starts, on its banner's line: the Fig Leaf skip and
 * Gorgon condition toggles and the Aetos wave; none renders nothing. A retained
 * condition its skipped phase cannot use stays shown and clearable, marked quiet.
 */
export function EncounterStartControls({
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
      <EncounterEventToggle
        icon={keepsakeArtwork.SkipEncounterKeepsake ?? undefined}
        key="figLeaf"
        name="Fig Leaf skip"
        slot="figLeaf"
        onToggle={(next) => executeIntent(figLeafInteraction.intentFor(next))}
        pressed={figLeafInteraction.selected}
        target={findingTarget(
          figLeaf.address,
          semanticOwnerControlElementId(figLeaf.address),
          phase.address,
        )}
      />
    );
  const gorgon = phase.gorgonCondition;
  const gorgonInteraction =
    gorgon === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.gorgonConditions, gorgon.interactionKey);
  // An unsupported retained condition owns its finding, so it stays clearable.
  const gorgonControl =
    gorgon === undefined || gorgonInteraction === undefined ? null : (
      <EncounterEventToggle
        icon={keepsakeArtwork.AthenaEncounterKeepsake ?? undefined}
        inapplicable={!gorgon.supported}
        {...(!gorgon.supported && phase.skippedByFigLeaf === true
          ? { inapplicableHint: skippedWithFigLeaf }
          : {})}
        key="gorgon"
        name="No Death Defiance"
        slot="gorgon"
        onToggle={(next) => executeIntent(gorgonInteraction.intentFor(next))}
        pressed={gorgonInteraction.selected}
        target={findingTarget(
          gorgon.address,
          semanticOwnerControlElementId(gorgon.address),
          phase.address,
        )}
      />
    );
  const aetos = phase.aetos;
  const aetosInteraction =
    aetos === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.aetosAppearances, aetos.interactionKey);
  // One picker: no appearance, or the wave Aetos joins; each pick is one command. A
  // stored wave stays clearable while its context waits on an earlier choice.
  const aetosControl =
    aetos === undefined || aetosInteraction === undefined
      ? null
      : (() => {
          const selected = aetosInteraction.selectedWave;
          const reached = aetosInteraction.contextReached;
          const waveLabel = (wave: number) => `Wave ${wave}`;
          const id = semanticOwnerControlElementId(aetos.address);
          const retainedUnavailable =
            selected !== undefined && !aetosInteraction.waves.includes(selected);
          return (
            <span className="encounter-aetos-picker" data-slot="aetos" key="aetos">
              <ContextualPicker<string>
                ariaLabel={`Aetos appearance: ${selected === undefined ? 'No' : waveLabel(selected)}`}
                findingTarget={findingTarget(aetos.address, id, phase.address)}
                id={id}
                {...(selected !== undefined
                  ? {}
                  : !reached
                    ? { disabledHint: candidateWaitingHint }
                    : aetosInteraction.waves.length === 0
                      ? { locked: true }
                      : {})}
                {...(retainedUnavailable && reached ? { invalid: true } : {})}
                label=""
                layout="inline"
                model={declaredChoicesPicker(
                  [
                    { key: 'none', value: '', label: 'No' },
                    ...(retainedUnavailable
                      ? [
                          {
                            key: `retained-${selected}`,
                            value: String(selected),
                            label: reached
                              ? `${waveLabel(selected)} (unavailable)`
                              : waveLabel(selected),
                            disabled: true,
                            ...(reached ? {} : { explanation: candidateWaitingHint }),
                          },
                        ]
                      : []),
                    ...aetosInteraction.waves.map((wave) => ({
                      key: String(wave),
                      value: String(wave),
                      label: waveLabel(wave),
                      ...(reached ? {} : { disabled: true, explanation: candidateWaitingHint }),
                    })),
                  ],
                  selected === undefined ? '' : String(selected),
                )}
                onSelect={(value) => {
                  const next = value === '' ? undefined : Number(value);
                  // Picking the current choice is no edit.
                  if (next === selected) return;
                  executeIntent(aetosInteraction.intentFor(next ?? null));
                }}
                placeholder="No"
                searchable={false}
                triggerHint="Aetos appearance"
                triggerIcon={aetosIcon}
                triggerLabel={selected === undefined ? 'No' : waveLabel(selected)}
                triggerSize="content"
              />
            </span>
          );
        })();
  return (
    <EncounterEventGroup label={`${phase.identityLabel} start`} slotted>
      {[aetosControl, gorgonControl, figLeafControl]}
    </EncounterEventGroup>
  );
}

/** What a finished phase settled: its kill-race outcome; none renders nothing. */
export function EncounterEndControls({
  interactions,
  phase,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const executeIntent = useCommandIntent();
  const nemesisBet = phase.nemesisBet;
  const nemesisBetInteraction =
    nemesisBet === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.nemesisBets, nemesisBet.interactionKey);
  const nemesisBetControl =
    nemesisBetInteraction === undefined ? null : (
      <label className="encounter-event-control" key="nemesisBet">
        <span>Outcome</span>
        <select
          className="nemesis-contest-result"
          onChange={(event) => {
            const choice = nemesisBetInteraction.choices.find(
              (option) => option.value === event.target.value,
            );
            if (choice !== undefined) executeIntent(nemesisBetInteraction.intentFor(choice.value));
          }}
          value={nemesisBetInteraction.outcome}
        >
          {nemesisBetInteraction.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <EncounterEventGroup label={`${phase.identityLabel} end`}>
      {[nemesisBetControl]}
    </EncounterEventGroup>
  );
}
