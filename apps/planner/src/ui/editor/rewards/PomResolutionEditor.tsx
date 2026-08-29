import {
  semanticAddressKey,
  type AuthoredLevelResolution,
  type LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LevelResolutionCandidateGroup } from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
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
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

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
      ariaLabel={ariaLabel}
      id={id}
      label={label}
      {...(layout === undefined ? {} : { layout })}
      model={model}
      onSelect={onSelect}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
      {...(open === undefined ? {} : { open })}
      placeholder="Choose a trait"
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
        ? 'Pom configuration needs attention'
        : 'Pom configuration has no findings';
  return (
    <button
      aria-label={`${label}; ${statusLabel}`}
      className="trait-offer-launcher quiet-action action-compact"
      data-trait-status={control.status}
      id={launcherId(control.address)}
      onClick={() => dispatch(levelResolutionDialogOpened(control.address))}
      type="button"
    >
      {label}
    </button>
  );
}

export function PomResolutionEditor({
  interaction,
  onCommit,
}: {
  readonly interaction: WorkspaceLevelResolutionInteraction;
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
      {groups.length <= 1 ? null : (
        <label className="field-control" htmlFor={`${domKey}-pom-branch`}>
          <span>Route state</span>
          <select
            id={`${domKey}-pom-branch`}
            onChange={(event) => selectGroup(event.target.value)}
            value={activeGroup?.key ?? ''}
          >
            {groups.map((group, index) => (
              <option key={group.key} value={group.key}>
                Route state {index + 1}
                {group.branchIndices.length > 1 ? ` (${group.branchIndices.length} branches)` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
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
        <p className="trait-offer-feedback-empty">No eligible traits; no level is gained.</p>
      ) : interaction.value.kind === 'random' &&
        activeGroup?.surface.emptyTargetAllowed === true &&
        activeGroup.surface.eligibleTargetTraitKeys.length === 0 ? (
        <div className="trait-offer-feedback">
          <p className="trait-offer-feedback-empty">
            No eligible traits; clear the recorded target.
          </p>
          <button
            className="quiet-action"
            onClick={() => {
              setRandomTarget(null);
              evaluateDraft(Object.freeze({ kind: 'random', targetTraitKey: null }));
            }}
            type="button"
          >
            Clear recorded target
          </button>
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
      <section aria-label="Pom feedback" className="trait-offer-feedback" role="status">
        <h3>Pom feedback</h3>
        {findings.length === 0 ? (
          <p className="trait-offer-feedback-empty">No current findings.</p>
        ) : (
          <ul className="trait-option-feedback">
            {[...new Set(findings)].map((finding) => (
              <li key={finding}>{findingMessage(finding)}</li>
            ))}
          </ul>
        )}
      </section>
      <button
        className="primary-action"
        disabled={!supported}
        onClick={() => onCommit(draft)}
        type="button"
      >
        Save Pom
      </button>
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
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const interaction = requireWorkspaceInteraction(
    interactions.levelResolutions,
    workspaceInteractionKey(target),
  );
  const close = useCallback(() => {
    dispatch(levelResolutionDialogClosed());
    (document.getElementById(launcherId(target)) ?? previousFocusRef.current)?.focus();
  }, [dispatch, target]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) dialog.setAttribute('open', '');
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [close]);
  const eyebrow = interaction.value.kind === 'random' ? 'Random Pom' : 'Pom choice';
  const dialogTitleId = `pom-dialog-title-${pomDomKey(target)}`;
  return (
    <dialog
      aria-labelledby={dialogTitleId}
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      <div className="trait-offer-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={dialogTitleId}>Pom target</h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={target} />
            <button aria-label="Close Pom" className="quiet-action" onClick={close} type="button">
              Close
            </button>
          </div>
        </header>
        <PomResolutionEditor
          interaction={interaction}
          onCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            close();
          }}
        />
      </div>
    </dialog>
  );
}
