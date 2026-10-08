import {
  semanticAddressKey,
  type AuthoredLevelResolution,
  type LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { LevelResolutionCandidateGroup } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { projectLevelResolutionTargetPicker } from '@planner/projections/contextual/levelResolutionTargetPicker';
import {
  formatFindingExplanation,
  presentLevelResolutionCandidateFinding,
} from '@planner/projections/evaluationProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceLevelResolutionControl,
  type WorkspaceLevelResolutionInteraction,
} from '@planner/projections/structured-workspace';
import {
  levelResolutionDialogClosed,
  levelResolutionDialogOpened,
} from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  useFindingAnchor,
  useFindingTarget,
  type FindingTargetProps,
} from '@planner/ui/feedback/useFindingTarget';
import { LauncherButton } from './LauncherButton';

function launcherId(address: LevelResolutionAddress): string {
  return `pom-launcher-${encodeURIComponent(semanticAddressKey(address))}`;
}

function pomDomKey(address: LevelResolutionAddress): string {
  return encodeURIComponent(semanticAddressKey(address));
}

function levelResolutionLoadable(
  interaction: WorkspaceLevelResolutionInteraction,
  value: AuthoredLevelResolution,
): { readonly load: () => ReturnType<WorkspaceLevelResolutionInteraction['load']> } {
  const load = interaction.load;
  return Object.freeze({ load: () => load(value) });
}

/** Shared single-target presentation leaf for random Pom-like effects. */
export function RandomTraitTargetPicker({
  findingTarget,
  disabled = false,
  disabledHint,
  placeholder = 'Choose a trait',
  ariaLabel,
  id,
  interaction,
  label = 'Recorded target',
  layout,
  model,
  onOpenChange,
  onSelect,
  open,
  selected,
}: {
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly disabledHint?: string;
  readonly placeholder?: string;
  readonly findingTarget?: FindingTargetProps;
  readonly id: string;
  readonly interaction: { readonly traitLabel: (traitKey: string) => string };
  readonly label?: string;
  readonly layout?: 'inline' | 'stacked';
  readonly model: ContextualPickerModel<string>;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSelect: (targetTraitKey: string) => void;
  readonly open?: boolean;
  readonly selected: string | null;
}) {
  return (
    <ContextualPicker
      {...(findingTarget === undefined ? {} : { findingTarget })}
      ariaLabel={ariaLabel}
      id={id}
      label={label}
      {...(layout === undefined ? {} : { layout })}
      model={model}
      onSelect={onSelect}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
      {...(open === undefined ? {} : { open })}
      disabled={disabled}
      {...(disabledHint === undefined ? {} : { disabledHint })}
      placeholder={placeholder}
      {...(selected === null ? {} : { triggerLabel: interaction.traitLabel(selected) })}
    />
  );
}

export function PomResolutionLauncher({
  control,
  interactions,
}: {
  readonly control: WorkspaceLevelResolutionControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.levelResolutions,
    workspaceInteractionKey(control.address),
  );
  return (
    <LauncherButton
      contextReached={interaction.contextReached}
      launcher={interaction.launcher}
      onClick={() => dispatch(levelResolutionDialogOpened(control.address))}
      target={findingTarget(control.address, launcherId(control.address))}
    />
  );
}

export function PomResolutionEditor({
  interaction,
  onCancel,
  onCommit,
}: {
  readonly interaction: WorkspaceLevelResolutionInteraction;
  /** Discards the draft; absent outside a dialog. */
  readonly onCancel?: () => void;
  readonly onCommit: (value: AuthoredLevelResolution) => void;
}) {
  const initialChoice = interaction.value.kind === 'choice' ? interaction.value : undefined;
  const [choiceSlots, setChoiceSlots] = useState<readonly (string | null)[]>(
    initialChoice?.offeredTraitKeys ?? [],
  );
  const [selectedChoice, setSelectedChoice] = useState<string | null>(
    initialChoice?.selectedTraitKey ?? null,
  );
  const [randomTarget, setRandomTarget] = useState<string | null>(
    interaction.value.kind === 'random' ? interaction.value.targetTraitKey : null,
  );
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [seededGroupKey, setSeededGroupKey] = useState<string | null>(null);
  const draft: AuthoredLevelResolution =
    interaction.value.kind === 'choice'
      ? Object.freeze({
          kind: 'choice' as const,
          offeredTraitKeys: Object.freeze(
            choiceSlots.filter((target): target is string => target !== null),
          ),
          selectedTraitKey: selectedChoice,
        })
      : Object.freeze({ kind: 'random' as const, targetTraitKey: randomTarget });
  const controller =
    useWorkspaceInteractionController<ReturnType<WorkspaceLevelResolutionInteraction['load']>>();
  // The evaluated draft rebinds to a changed context; a changed authored value
  // remounts this editor through its draft identity key.
  const [evaluated, setEvaluated] = useState<AuthoredLevelResolution>(interaction.value);
  const loadable = useMemo(
    () => levelResolutionLoadable(interaction, evaluated),
    [interaction, evaluated],
  );
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  const evaluateDraft = (next: AuthoredLevelResolution): void => setEvaluated(next);
  const candidate = loaded.result;
  const groups = candidate?.groups ?? [];
  const activeGroup =
    groups.find((group) => group.key === activeGroupKey) ??
    groups.find((group) => group.evaluations.some((evaluation) => evaluation.supported)) ??
    groups[0];
  const findings = activeGroup?.evaluations.flatMap((entry) => entry.findings) ?? [];
  const supported = activeGroup?.evaluations.some((entry) => entry.supported) ?? false;
  const requiredCount = activeGroup?.surface.requiredOfferCount;
  const emptyNoOp =
    activeGroup?.surface.emptyTargetAllowed === true &&
    activeGroup.surface.eligibleTargetTraitKeys.length === 0 &&
    randomTarget === null &&
    supported;
  const count = interaction.value.kind === 'choice' ? (requiredCount ?? choiceSlots.length) : 1;
  const rows = Array.from({ length: count }, (_, index) => index);
  const domKey = pomDomKey(interaction.owner);
  const authoredChoice = interaction.value.kind === 'choice' ? interaction.value : undefined;
  const authoredRandom = interaction.value.kind === 'random' ? interaction.value : undefined;
  const authoredChoiceUnresolved =
    authoredChoice !== undefined &&
    authoredChoice.offeredTraitKeys.length === 0 &&
    authoredChoice.selectedTraitKey === null;
  const seedChoice = (group: LevelResolutionCandidateGroup): void => {
    const start = group.surface.startingResolution;
    if (start?.kind !== 'choice') return;
    setSeededGroupKey(group.key);
    setActiveGroupKey(group.key);
    setChoiceSlots(start.offeredTraitKeys);
    setSelectedChoice(start.selectedTraitKey);
    setEvaluated(start);
  };
  if (authoredChoiceUnresolved && activeGroup !== undefined && seededGroupKey !== activeGroup.key)
    seedChoice(activeGroup);
  const selectGroup = (key: string): void => {
    const group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) return;
    setActiveGroupKey(group.key);
    if (authoredChoiceUnresolved) seedChoice(group);
    else if (authoredChoice !== undefined) {
      const slots = Array.from(
        { length: group.surface.requiredOfferCount ?? 0 },
        (_, index) => authoredChoice.offeredTraitKeys[index] ?? null,
      );
      setChoiceSlots(slots);
      setSelectedChoice(authoredChoice.selectedTraitKey);
      evaluateDraft(
        Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze(
            slots.filter((target): target is string => target !== null),
          ),
          selectedTraitKey: authoredChoice.selectedTraitKey,
        }),
      );
    } else if (authoredRandom !== undefined) {
      setRandomTarget(authoredRandom.targetTraitKey);
      evaluateDraft(authoredRandom);
    }
  };
  const targetPicker = (current: string | null): ContextualPickerModel<string> =>
    projectLevelResolutionTargetPicker({
      group: activeGroup,
      current,
      traitLabel: interaction.traitLabel,
    });
  const updateChoiceSlot = (index: number, target: string): void => {
    const slots = Array.from({ length: count }, (_, slot) => choiceSlots[slot] ?? null);
    slots[index] = target;
    setChoiceSlots(Object.freeze(slots));
    const next = Object.freeze({
      kind: 'choice' as const,
      offeredTraitKeys: Object.freeze(slots.filter((entry): entry is string => entry !== null)),
      selectedTraitKey: selectedChoice,
    });
    evaluateDraft(next);
  };
  const updateSelectedChoice = (target: string): void => {
    setSelectedChoice(target);
    evaluateDraft(
      Object.freeze({
        kind: 'choice',
        offeredTraitKeys: Object.freeze(
          choiceSlots.filter((entry): entry is string => entry !== null),
        ),
        selectedTraitKey: target,
      }),
    );
  };
  return (
    <div className="trait-offer-editor pom-resolution-editor">
      <ContextualPicker
        label="Route state"
        placeholder={groups.length === 0 ? 'Evaluating route state…' : 'Choose a route state'}
        {...(groups.length <= 1
          ? {
              disabledHint:
                groups.length === 0
                  ? 'Evaluating route state…'
                  : 'One route state applies to this Pom.',
            }
          : {})}
        model={declaredChoicesPicker(
          groups.map((group, index) => ({
            key: group.key,
            value: group.key,
            label: `Route state ${index + 1}${group.branchIndices.length > 1 ? ` (${group.branchIndices.length} branches)` : ''}`,
          })),
          activeGroup?.key ?? '',
        )}
        id={`${domKey}-pom-branch`}
        onSelect={selectGroup}
      />
      {interaction.value.kind === 'choice' ? (
        <div className="trait-offer-options">
          {rows.map((index) => {
            const current = choiceSlots[index] ?? null;
            return (
              <fieldset className="trait-offer-option" key={index}>
                <legend>Target {index + 1}</legend>
                <ContextualPicker
                  ariaLabel={`Pom target ${index + 1}`}
                  id={`${domKey}-pom-target-${index}`}
                  label="Trait"
                  model={targetPicker(current)}
                  onSelect={(target) => updateChoiceSlot(index, target)}
                  placeholder="Choose a trait"
                  {...(current === null ? {} : { triggerLabel: interaction.traitLabel(current) })}
                />
                <label className="trait-option-selected">
                  <input
                    checked={selectedChoice === current && current !== null}
                    name={`${domKey}-pom-selected`}
                    onChange={() => current !== null && updateSelectedChoice(current)}
                    type="radio"
                  />
                  Selected
                </label>
              </fieldset>
            );
          })}
        </div>
      ) : emptyNoOp ? (
        <div className="field-control field-control-inline control-placeholder">
          <span>Recorded target</span>
          <span className="fixed-room-state">No eligible traits; no level is gained.</span>
        </div>
      ) : interaction.value.kind === 'random' &&
        activeGroup?.surface.emptyTargetAllowed === true &&
        activeGroup.surface.eligibleTargetTraitKeys.length === 0 ? (
        <div className="field-control field-control-inline control-placeholder">
          <span>Recorded target</span>
          <span className="fixed-room-state">
            No eligible traits; clear the recorded target.
            <button
              className="quiet-action action-compact"
              onClick={() => {
                setRandomTarget(null);
                evaluateDraft(Object.freeze({ kind: 'random', targetTraitKey: null }));
              }}
              type="button"
            >
              Clear recorded target
            </button>
          </span>
        </div>
      ) : (
        <RandomTraitTargetPicker
          ariaLabel="Recorded random Pom target"
          id={`${domKey}-pom-target`}
          interaction={interaction}
          model={targetPicker(randomTarget)}
          onSelect={(target) => {
            setRandomTarget(target);
            evaluateDraft(Object.freeze({ kind: 'random', targetTraitKey: target }));
          }}
          selected={randomTarget}
        />
      )}
      <EditorDialogFeedback
        name="Pom feedback"
        entries={[
          ...new Set(
            findings.map((finding) =>
              formatFindingExplanation(presentLevelResolutionCandidateFinding(finding)),
            ),
          ),
        ].map((message) => [message, message] as const)}
      />
      <EditorDialogDraftActions
        {...(onCancel === undefined ? {} : { onCancel })}
        onSave={() => onCommit(draft)}
        saveDisabled={!supported}
        saveName="Save Pom"
      />
    </div>
  );
}

export function PomResolutionDialog({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: LevelResolutionAddress;
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  // A stale target from navigation or a finding may name an unprojected Pom.
  const interaction = interactions.levelResolutions.get(workspaceInteractionKey(target));
  const close = useCallback(() => {
    dispatch(levelResolutionDialogClosed());
  }, [dispatch]);
  // The system closes a dialog whose context is lost; a later reach needs an explicit reopen.
  const unavailable = interaction === undefined || !interaction.contextReached;
  useEffect(() => {
    if (unavailable) dispatch(levelResolutionDialogClosed());
  }, [dispatch, unavailable]);
  if (interaction === undefined || unavailable) return null;
  return (
    <EditorDialog
      // The feedback region lists the dialog's findings; its launcher carries the mark.
      anchorProps={{ ...findingAnchor(target), tabIndex: -1 }}
      eyebrow={interaction.value.kind === 'random' ? 'Random Pom' : 'Pom choice'}
      model={{ kind: 'draft', onCancel: close }}
      returnFocusId={launcherId(target)}
      title="Pom target"
    >
      <PomResolutionEditor
        interaction={interaction}
        // A changed authored resolution replaces the draft; a changed context keeps it.
        key={draftValueIdentity(interaction.value)}
        onCancel={close}
        onCommit={(value) => {
          executeIntent(interaction.intentFor(value));
          close();
        }}
      />
    </EditorDialog>
  );
}
