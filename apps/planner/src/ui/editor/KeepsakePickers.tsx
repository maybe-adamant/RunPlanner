import type { AuthoredKeepsakeEquipResultValue } from '@run-planner/engine/authored-project';
import type {
  WorkspaceCommandIntent,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { dispatchCommandIntent, useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
  useWorkspaceInteractionController,
} from '@planner/ui/controls/useWorkspaceInteraction';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { authoredProjectCommandsDispatched } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import type { EditorDialogIssue } from '@planner/ui/controls/EditorDialog';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TranscendentEmbryoOutcomeFields } from './rewards/TranscendentEmbryoOutcomeFields';
import {
  KeepsakeLauncher,
  KeepsakeRackDialog,
  type KeepsakeRackEntry,
} from '@planner/ui/controls/keepsakes/KeepsakeRack';

type JeweledPomInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'jeweledPom' } }
>;
type ExperimentalHammerInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'experimentalHammer' } }
>;
type TranscendentEmbryoInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
>;

/** The rack card that leaves the held keepsake in place. */
const UNCHANGED = '__unchanged';

type EquipDomain = ReturnType<WorkspaceKeepsakeEquipResultInteraction['load']>;

const emptyModel: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

type EquipResultValue = NonNullable<AuthoredKeepsakeEquipResultValue>;

/** The authored value a picker selection names, from the result's current value. */
function equipResultValue(
  interaction: WorkspaceKeepsakeEquipResultInteraction,
  current: AuthoredKeepsakeEquipResultValue,
  selection: string,
): EquipResultValue {
  if (interaction.owner.resultKind === 'experimentalHammer')
    return selection === '__exhausted'
      ? { kind: 'exhausted' }
      : { kind: 'selected', traitKey: selection };
  if (interaction.owner.resultKind === 'jeweledPom')
    return {
      ...((current as JeweledPomInteraction['value']) ?? {}),
      traitKey: selection,
    };
  return (interaction as TranscendentEmbryoInteraction).outcomeFor(selection);
}

/** The picker item a value selects. */
function equipResultSelection(value: EquipResultValue): string {
  if ('blessingKey' in value) return value.blessingKey;
  if ('kind' in value) return value.kind === 'exhausted' ? '__exhausted' : value.traitKey;
  return value.traitKey;
}

function equipResultIntent(
  interaction: WorkspaceKeepsakeEquipResultInteraction,
  value: EquipResultValue,
): WorkspaceCommandIntent {
  if (interaction.owner.resultKind === 'experimentalHammer')
    return (interaction as ExperimentalHammerInteraction).intentFor(
      value as NonNullable<ExperimentalHammerInteraction['value']>,
    );
  if (interaction.owner.resultKind === 'jeweledPom')
    return (interaction as JeweledPomInteraction).intentFor(
      value as NonNullable<JeweledPomInteraction['value']>,
    );
  return (interaction as TranscendentEmbryoInteraction).intentFor(
    value as NonNullable<TranscendentEmbryoInteraction['value']>,
  );
}

/** A rack launcher whose dialog also holds the held keepsake's equip-result controls. */
export function KeepsakeSelectionLauncher({
  disabledHint,
  equipResults,
  held,
  id,
  interaction,
  label,
  unavailableHint,
}: {
  readonly disabledHint?: string;
  readonly equipResults: readonly WorkspaceKeepsakeEquipResultInteraction[];
  /** The keepsake held arriving at a rack; choosing it leaves the rack unchanged. */
  readonly held?: { readonly key: string; readonly label: string };
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly label: string;
  /** Dims keepsakes this slot can't take, with the reason. */
  readonly unavailableHint?: (keepsakeKey: string) => string | undefined;
}) {
  const findingTarget = useFindingTarget();
  const [open, setOpen] = useState(false);
  const shownKey = interaction.selectedKeepsakeKey ?? held?.key;
  const shownLabel =
    interaction.selectedKeepsakeKey === undefined && held !== undefined
      ? `${held.label} (Unchanged)`
      : interaction.selectedLabel;
  const target = equipResults.find((result) => result.value !== undefined)?.selectedLabel;
  return (
    <>
      <KeepsakeLauncher
        findingTarget={findingTarget(
          interaction.owner,
          id,
          interaction.owner,
          undefined,
          equipResults.map((result) => result.owner),
        )}
        {...(disabledHint === undefined ? {} : { disabledHint })}
        id={id}
        keepsakeKey={shownKey}
        label={label}
        onOpen={() => setOpen(true)}
        text={`${shownLabel}${target === undefined ? '' : ` → ${target}`}`}
      />
      {open ? (
        <KeepsakeSelectionDialog
          equipResults={equipResults}
          {...(held === undefined ? {} : { held })}
          id={id}
          interaction={interaction}
          label={label}
          onClose={() => setOpen(false)}
          {...(unavailableHint === undefined ? {} : { unavailableHint })}
        />
      ) : null}
    </>
  );
}

/**
 * The rack as one draft: the chosen keepsake and, while it stays the saved one, its equip
 * results. Save commits every change as one edit.
 */
function KeepsakeSelectionDialog({
  equipResults,
  held,
  id,
  interaction,
  label,
  onClose,
  unavailableHint,
}: {
  readonly equipResults: readonly WorkspaceKeepsakeEquipResultInteraction[];
  readonly held?: { readonly key: string; readonly label: string };
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly label: string;
  readonly onClose: () => void;
  readonly unavailableHint?: (keepsakeKey: string) => string | undefined;
}) {
  const dispatch = useAppDispatch();
  const projection = useWorkspaceInteraction(interaction);
  const { activate } = projection;
  useEffect(() => {
    // A saved selection replaces the interaction; reload the rack.
    activate();
  }, [activate]);
  // Without a known held keepsake, a Postboss rack offers Unchanged as its own card.
  const unchangedCard = held === undefined && interaction.owner.owner !== 'routeStart';
  const savedChoice =
    interaction.selectedKeepsakeKey ?? held?.key ?? (unchangedCard ? UNCHANGED : undefined);
  const [draftChoice, setDraftChoice] = useState(savedChoice);
  const [draftResults, setDraftResults] = useState<
    Readonly<Partial<Record<string, EquipResultValue>>>
  >({});
  const entries = new Map<string, KeepsakeRackEntry>();
  for (const section of projection.result?.sections ?? [])
    for (const item of section.items) {
      if (entries.has(item.value)) continue;
      const refused = unavailableHint?.(item.value);
      // The held keepsake stays choosable: choosing it keeps it.
      const keeps = item.value === held?.key;
      entries.set(item.value, {
        key: item.value,
        label: item.label,
        disabled: !keeps && (item.disabled || refused !== undefined),
        hint: refused ?? item.explanations?.join(' '),
      });
    }
  if (held !== undefined && projection.result !== undefined && !entries.has(held.key))
    entries.set(held.key, { ...held, disabled: false });
  if (unchangedCard && projection.result !== undefined)
    entries.set(UNCHANGED, { key: UNCHANGED, label: 'Unchanged', disabled: false });
  const keepsSaved = draftChoice === savedChoice;
  // Leaving the held keepsake in place opens nothing new.
  const swaps =
    !keepsSaved &&
    draftChoice !== undefined &&
    draftChoice !== held?.key &&
    draftChoice !== UNCHANGED;
  // A drafted keepsake's outcome is judged as if that keepsake were chosen here.
  const draftedOutcome = useMemo(
    () =>
      swaps && draftChoice !== undefined ? interaction.draftOutcomeFor(draftChoice) : undefined,
    [interaction, draftChoice, swaps],
  );
  const outcomes = keepsSaved ? equipResults : draftedOutcome === undefined ? [] : [draftedOutcome];
  const outcome = outcomes[0];
  const outcomeValue =
    outcome === undefined
      ? undefined
      : (draftResults[outcome.owner.resultKind] ?? (keepsSaved ? outcome.value : undefined));
  const outcomeIdentity = draftValueIdentity(outcomeValue);
  const draftAssessmentLoadable = useMemo(
    () =>
      outcome === undefined || outcomeValue === undefined
        ? undefined
        : { load: () => loadOutcome(outcome, outcomeValue) },
    // The assessment follows the drafted outcome's identity, not each render's object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outcome, outcomeIdentity],
  );
  const savedAssessmentLoadable = useMemo(
    () =>
      !keepsSaved || outcome?.value === undefined
        ? undefined
        : { load: () => loadOutcome(outcome, outcome.value) },
    [keepsSaved, outcome],
  );
  const draftAssessment = useOptionalWorkspaceInteraction(draftAssessmentLoadable);
  const savedAssessment = useOptionalWorkspaceInteraction(savedAssessmentLoadable);
  const activateDraftAssessment = draftAssessment.activate;
  const activateSavedAssessment = savedAssessment.activate;
  useEffect(() => {
    activateDraftAssessment();
    // Activation follows the assessed outcome, not each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftAssessmentLoadable]);
  useEffect(() => {
    activateSavedAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAssessmentLoadable]);
  const issuesOf = (domain: EquipDomain | undefined): EditorDialogIssue[] =>
    (domain?.selectedFindings ?? []).map(({ code, message }) => [code, message] as const);
  const draftIssues = issuesOf(draftAssessment.result);
  // A drafted keepsake that opens an outcome is incomplete until the outcome is chosen.
  const incomplete = !keepsSaved && outcome !== undefined && outcomeValue === undefined;
  const issues: EditorDialogIssue[] =
    outcome !== undefined && outcomeValue === undefined
      ? [['outcome', equipResultPlaceholder[outcome.owner.resultKind]], ...draftIssues]
      : draftIssues;
  const intents: WorkspaceCommandIntent[] = [];
  if (!keepsSaved && draftChoice !== undefined) {
    if (swaps) intents.push(interaction.replaceIntent(draftChoice));
    else if (interaction.unchangedIntent !== undefined) intents.push(interaction.unchangedIntent());
  }
  // The outcome follows its keepsake in the same edit.
  for (const result of outcomes) {
    const value = draftResults[result.owner.resultKind];
    if (value !== undefined && draftValueIdentity(value) !== draftValueIdentity(result.value))
      intents.push(equipResultIntent(result, value));
  }
  const chooseKeepsake = (keepsakeKey: string): void => {
    setDraftChoice(keepsakeKey);
    setDraftResults({});
  };
  return (
    <KeepsakeRackDialog
      detail={outcomes.map((result) => (
        <KeepsakeEquipResultPicker
          draft={{
            value: draftResults[result.owner.resultKind],
            onChange: (value) =>
              setDraftResults({ ...draftResults, [result.owner.resultKind]: value }),
            incomplete: incomplete && result === outcome,
          }}
          id={`${id}-${result.owner.resultKind}`}
          interaction={result}
          key={`${draftChoice ?? ''}:${result.owner.resultKind}`}
        />
      ))}
      draftKey={draftChoice}
      entries={[...entries.values()]}
      issues={issues}
      loading={projection.pending}
      onCancel={onClose}
      onChoose={chooseKeepsake}
      onSave={() => {
        const [only] = intents;
        if (intents.length === 1 && only !== undefined) dispatchCommandIntent(dispatch, only);
        else if (intents.length > 1) {
          dispatch(authoredProjectCommandsDispatched(intents.map((intent) => intent.command)));
          const focus = intents.find((intent) => intent.focus !== undefined)?.focus;
          if (focus !== undefined) dispatch(semanticOwnerFocused(focus.owner));
        }
        onClose();
      }}
      returnFocusId={id}
      // An incomplete outcome or a finding this draft introduced blocks Save; inherited ones do not.
      saveDisabled={
        intents.length === 0 ||
        incomplete ||
        introducesIssue(draftIssues, issuesOf(savedAssessment.result))
      }
      title={label}
    />
  );
}

function loadOutcome(
  result: WorkspaceKeepsakeEquipResultInteraction,
  value: AuthoredKeepsakeEquipResultValue,
): EquipDomain {
  return (result.load as (value?: AuthoredKeepsakeEquipResultValue) => EquipDomain)(value);
}

/** What an equip result's picker asks for while it is empty. */
const equipResultPlaceholder = {
  experimentalHammer: 'Choose compatible Hammer',
  jeweledPom: 'Choose Hades trait',
  transcendentEmbryo: 'Choose Chaos blessing',
} as const;

export function KeepsakeEquipResultPicker({
  draft,
  id,
  interaction: requestedInteraction,
  label: labelOverride,
}: {
  /** Inside a draft dialog: the drafted value, undefined while unchanged, and its setter. */
  readonly draft?: {
    readonly value: EquipResultValue | undefined;
    readonly onChange: (value: EquipResultValue) => void;
    /** The outcome is still missing, so the header's finding focuses this picker. */
    readonly incomplete?: boolean;
  };
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeEquipResultInteraction;
  readonly label?: string;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const [interaction, setInteraction] = useState(requestedInteraction);
  const controller =
    useWorkspaceInteractionController<
      ReturnType<WorkspaceKeepsakeEquipResultInteraction['load']>
    >();
  const drafting = draft !== undefined;
  const current: AuthoredKeepsakeEquipResultValue = draft?.value ?? interaction.value;
  const currentIdentity = draftValueIdentity(current);
  // A draft's domain follows the drafted value; the saved interaction stays fixed meanwhile.
  const draftLoadable = useMemo(
    () => (drafting ? { load: () => loadOutcome(interaction, current) } : undefined),
    // The loadable follows the drafted value's identity, not each render's object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafting, interaction, currentIdentity],
  );
  const loadable = draftLoadable ?? interaction;
  const { pending, result: domain } = controller.observe(loadable);
  const draftChanged = draft?.value !== undefined;
  useEffect(() => {
    if (draftLoadable === undefined) return;
    if (
      draftChanged ||
      (interaction.owner.resultKind === 'transcendentEmbryo' && current !== undefined)
    )
      controller.activate(draftLoadable);
    // Activation follows the drafted value, not each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoadable]);
  useLayoutEffect(() => {
    // Publish the binding and its numeric domain together, without unmounting
    // the slider between consecutive updates during a native drag.
    if (
      requestedInteraction.owner.resultKind === 'transcendentEmbryo' &&
      requestedInteraction.value !== undefined
    ) {
      controller.activate(requestedInteraction);
    }
    // The activated capability and its controlled inputs must commit atomically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteraction(requestedInteraction);
  }, [controller, requestedInteraction]);
  const resultKind = interaction.owner.resultKind;
  const embryoValue =
    resultKind === 'transcendentEmbryo'
      ? (current as TranscendentEmbryoInteraction['value'])
      : undefined;
  const select = (value: EquipResultValue): void => {
    if (draft !== undefined) draft.onChange(value);
    else executeIntent(equipResultIntent(interaction, value));
  };
  const draftSelection = draft?.value === undefined ? undefined : equipResultSelection(draft.value);
  const triggerLabel =
    draftSelection === undefined
      ? interaction.selectedLabel
      : (domain?.picker.sections
          .flatMap((section) => section.items)
          .find((item) => item.value === draftSelection)?.label ?? interaction.selectedLabel);
  const label =
    resultKind === 'transcendentEmbryo'
      ? 'Target'
      : (labelOverride ??
        (resultKind === 'experimentalHammer'
          ? 'Experimental Hammer result'
          : 'Jeweled Pom result'));
  const placeholder = equipResultPlaceholder[resultKind];

  return (
    <div
      className={`keepsake-equip-result-control${
        resultKind === 'transcendentEmbryo' ? ' transcendent-embryo-outcome-row' : ''
      }`}
    >
      <ContextualPicker
        findingTarget={findingTarget(interaction.owner, id)}
        id={id}
        {...(draft?.incomplete === true ? { invalid: true } : {})}
        label={label}
        layout="inline"
        loading={pending}
        model={domain?.picker ?? emptyModel}
        onOpenChange={(open) => {
          if (open) controller.activate(loadable);
        }}
        onSelect={(value) => select(equipResultValue(interaction, current, value))}
        placeholder={placeholder}
        {...(triggerLabel === undefined ? {} : { triggerLabel })}
      />
      {domain?.transcendentEmbryoSummary === undefined || embryoValue === undefined ? null : (
        <TranscendentEmbryoOutcomeFields
          onChange={(blessingValues) => select({ ...embryoValue, blessingValues })}
          operands={domain.transcendentEmbryoSummary.operands}
          rarity={domain.transcendentEmbryoSummary.rarity}
          values={embryoValue.blessingValues}
        />
      )}
    </div>
  );
}
