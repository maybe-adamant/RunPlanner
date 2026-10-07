import {
  semanticAddressKey,
  type AuthoredLevelResolution,
  type LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useState } from 'react';

import type { LevelResolutionCandidateGroup } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
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
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  useFindingAnchor,
  useFindingTarget,
  type FindingTargetProps,
} from '@planner/ui/feedback/useFindingTarget';

function launcherId(address: LevelResolutionAddress): string {
  return `pom-launcher-${encodeURIComponent(semanticAddressKey(address))}`;
}

function pomDomKey(address: LevelResolutionAddress): string {
  return encodeURIComponent(semanticAddressKey(address));
}

function selectedTarget(value: AuthoredLevelResolution): string | null {
  return value.kind === 'choice' ? value.selectedTraitKey : value.targetTraitKey;
}

function levelCountLabel(interaction: WorkspaceLevelResolutionInteraction): string {
  return interaction.levelCount === undefined ? '' : ` +${interaction.levelCount}`;
}

function findingMessage(code: string): string {
  switch (code) {
    case 'missingTarget':
      return 'Choose a trait to receive this Pom.';
    case 'wrongOfferCount':
      return 'Record the complete target list available here.';
    case 'duplicateTargets':
      return 'Each Pom target must be different.';
    case 'selectedTargetNotOffered':
      return 'Choose one of this Pom’s recorded targets.';
    case 'targetUnavailable':
      return 'This trait cannot receive the Pom at this point in the route.';
    case 'kindMismatch':
      return 'This recorded Pom outcome does not match the reward.';
    default:
      return code;
  }
}

function levelResolutionLoadable(
  interaction: WorkspaceLevelResolutionInteraction,
  value: AuthoredLevelResolution,
): { readonly load: () => ReturnType<WorkspaceLevelResolutionInteraction['load']> } {
  const load = interaction.load;
  return Object.freeze({ load: () => load(value) });
}

function candidatePicker(
  interaction: WorkspaceLevelResolutionInteraction,
  group: LevelResolutionCandidateGroup | undefined,
  selected: string | null,
  siblingSelections: readonly (string | null)[],
): ContextualPickerModel<string> {
  const targets = new Set(group?.surface.eligibleTargetTraitKeys ?? []);
  if (selected !== null) targets.add(selected);
  const items = [...targets].map((target) => {
    const supported = group?.surface.eligibleTargetTraitKeys.includes(target) ?? false;
    const isSelected = target === selected;
    const usedBySibling = siblingSelections.includes(target);
    return Object.freeze({
      disabled: usedBySibling || (!supported && !isSelected),
      key: target,
      label: interaction.traitLabel(target),
      selected: isSelected,
      state: supported ? ('possible' as const) : ('impossible' as const),
      ...(isSelected && !supported ? { status: 'Current · unavailable' } : {}),
      ...(isSelected && !supported
        ? {
            explanation: findingMessage(group?.evaluations[0]?.findings[0] ?? 'targetUnavailable'),
          }
        : {}),
      value: target,
    });
  });
  const possible = items.filter((item) => item.state === 'possible');
  const invalid = items.filter((item) => item.selected && item.state === 'impossible');
  return Object.freeze({
    ...(items.find((item) => item.selected) === undefined
      ? {}
      : { selected: items.find((item) => item.selected)! }),
    sections: Object.freeze([
      ...(invalid.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              items: Object.freeze(invalid),
              key: 'selected-invalid',
              kind: 'selectedInvalid' as const,
              label: 'Current target',
            }),
          ]),
      Object.freeze({
        collapsible: false,
        items: Object.freeze(possible),
        key: 'eligible',
        kind: 'category' as const,
        label: 'Eligible traits',
      }),
    ]),
  });
}

/** Shared single-target presentation leaf for random Pom-like effects. */
export function RandomTraitTargetPicker({
  findingTarget,
  disabled = false,
  disabledTitle,
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
  readonly disabledTitle?: string;
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
      {...(disabledTitle === undefined ? {} : { disabledTitle })}
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
  const target = selectedTarget(control.value);
  const emptyNoOp = control.settledEmptyNoOp;
  const label = `Edit Pom: ${
    emptyNoOp
      ? 'No eligible traits'
      : target === null
        ? 'Choose target'
        : interaction.traitLabel(target)
  }${emptyNoOp ? '' : levelCountLabel(interaction)}`;
  const statusLabel =
    control.status === 'unspecified'
      ? 'Pom target is not selected'
      : control.status === 'invalid'
        ? 'Pom resolution needs attention'
        : 'Pom configuration has no findings';
  return (
    <button
      {...findingTarget(control.address, launcherId(control.address))}
      aria-label={`${label}; ${statusLabel}`}
      className="trait-offer-launcher quiet-action action-compact"
      data-trait-status={control.status}
      disabled={!interaction.contextReached || undefined}
      id={launcherId(control.address)}
      onClick={() => dispatch(levelResolutionDialogOpened(control.address))}
      title={interaction.contextReached ? undefined : 'Waits on an earlier choice'}
      type="button"
    >
      {label}
    </button>
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
  const [autoFilledGroupKey, setAutoFilledGroupKey] = useState<string | null>(null);
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
  const [loadable, setLoadable] = useState(() =>
    levelResolutionLoadable(interaction, interaction.value),
  );
  const loaded = controller.observe(loadable);
  const [authoritativeInteraction, setAuthoritativeInteraction] = useState(interaction);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  if (authoritativeInteraction !== interaction) {
    setAuthoritativeInteraction(interaction);
    if (interaction.value.kind === 'choice') {
      setChoiceSlots(interaction.value.offeredTraitKeys);
      setSelectedChoice(interaction.value.selectedTraitKey);
      setRandomTarget(null);
    } else {
      setChoiceSlots([]);
      setSelectedChoice(null);
      setRandomTarget(interaction.value.targetTraitKey);
    }
    setActiveGroupKey(null);
    setAutoFilledGroupKey(null);
    setLoadable(levelResolutionLoadable(interaction, interaction.value));
  }
  const evaluateDraft = (next: AuthoredLevelResolution): void => {
    const nextLoadable = levelResolutionLoadable(interaction, next);
    setLoadable(nextLoadable);
    controller.activate(nextLoadable);
  };
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
  const authoredChoiceIsPristine =
    authoredChoice !== undefined &&
    authoredChoice.offeredTraitKeys.length === 0 &&
    authoredChoice.selectedTraitKey === null;
  if (
    authoredChoiceIsPristine &&
    activeGroup !== undefined &&
    autoFilledGroupKey !== activeGroup.key
  ) {
    const targets = Object.freeze(
      activeGroup.surface.eligibleTargetTraitKeys.slice(
        0,
        activeGroup.surface.requiredOfferCount ?? 0,
      ),
    );
    const selected = targets[0] ?? null;
    const next = Object.freeze({
      kind: 'choice' as const,
      offeredTraitKeys: targets,
      selectedTraitKey: selected,
    });
    setAutoFilledGroupKey(activeGroup.key);
    setChoiceSlots(targets);
    setSelectedChoice(selected);
    setLoadable(levelResolutionLoadable(interaction, next));
  }
  const selectGroup = (key: string): void => {
    const group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) return;
    setActiveGroupKey(group.key);
    if (authoredChoice !== undefined) {
      const slots = authoredChoiceIsPristine
        ? group.surface.eligibleTargetTraitKeys.slice(0, group.surface.requiredOfferCount ?? 0)
        : Array.from(
            { length: group.surface.requiredOfferCount ?? 0 },
            (_, index) => authoredChoice.offeredTraitKeys[index] ?? null,
          );
      const selected = authoredChoiceIsPristine
        ? (slots[0] ?? null)
        : authoredChoice.selectedTraitKey;
      setAutoFilledGroupKey(authoredChoiceIsPristine ? group.key : null);
      setChoiceSlots(slots);
      setSelectedChoice(selected);
      evaluateDraft(
        Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze(
            slots.filter((target): target is string => target !== null),
          ),
          selectedTraitKey: selected,
        }),
      );
    } else if (authoredRandom !== undefined) {
      setRandomTarget(authoredRandom.targetTraitKey);
      evaluateDraft(authoredRandom);
    }
  };
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
              disabledTitle:
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
            const siblings = choiceSlots.filter((_, slot) => slot !== index);
            return (
              <fieldset className="trait-offer-option" key={index}>
                <legend>Target {index + 1}</legend>
                <ContextualPicker
                  ariaLabel={`Pom target ${index + 1}`}
                  id={`${domKey}-pom-target-${index}`}
                  label="Trait"
                  model={candidatePicker(interaction, activeGroup, current, siblings)}
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
          model={candidatePicker(interaction, activeGroup, randomTarget, [])}
          onSelect={(target) => {
            setRandomTarget(target);
            evaluateDraft(Object.freeze({ kind: 'random', targetTraitKey: target }));
          }}
          selected={randomTarget}
        />
      )}
      <EditorDialogFeedback name="Pom feedback">
        {findings.length === 0 ? undefined : (
          <ul className="trait-option-feedback">
            {[...new Set(findings)].map((finding) => (
              <li key={finding}>{findingMessage(finding)}</li>
            ))}
          </ul>
        )}
      </EditorDialogFeedback>
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
        onCancel={close}
        onCommit={(value) => {
          executeIntent(interaction.intentFor(value));
          close();
        }}
      />
    </EditorDialog>
  );
}
