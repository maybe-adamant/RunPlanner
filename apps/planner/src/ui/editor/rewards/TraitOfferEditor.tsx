import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useCallback, useEffect, useRef, useState } from 'react';

import { candidateSupport } from '@planner/projections/candidateProjection';
import { projectTraitOfferFeedback } from '@planner/projections/traitProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

function launcherId(address: TraitOfferAddress): string {
  return `trait-launcher-${semanticAddressKey(address)}`;
}

function traitOfferLoadable(
  interaction: WorkspaceTraitOfferInteraction,
  value: AuthoredTraitOffer,
): { readonly load: () => ReturnType<WorkspaceTraitOfferInteraction['load']> } {
  const loadInteraction = interaction.load;
  return Object.freeze({ load: () => loadInteraction(value) });
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  return [
    interaction.giver.key,
    interaction.choices.map((choice) => choice.value).join(','),
    interaction.value.options
      .map((option) => `${option.traitKey}:${option.rarity ?? ''}`)
      .join(','),
    interaction.value.selectedOptionKey,
  ].join('|');
}

export function TraitOfferLauncher({
  control,
  interactions,
}: {
  readonly control: WorkspaceTraitOfferControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(control.address),
  );
  const selected = control.offer.options[OPTION_KEYS.indexOf(control.offer.selectedOptionKey)];
  const label =
    selected === undefined
      ? 'Choose trait'
      : (interaction.choices.find((choice) => choice.value === selected.traitKey)?.label ??
        selected.traitKey);
  const rarity = selected?.rarity === undefined ? '' : ` · ${selected.rarity}`;
  return (
    <button
      className="trait-offer-launcher quiet-action action-compact"
      id={launcherId(control.address)}
      onClick={() => dispatch(traitOfferDialogOpened(control.address))}
      type="button"
    >
      Edit {control.acquisitionRoleLabel} {control.giver.label} trait offer{' '}
      <span aria-label={`selected ${label}`}>
        {label}
        {rarity}
      </span>
    </button>
  );
}

export function TraitOfferEditor({
  address,
  interactions,
  onCommit,
}: {
  readonly address: TraitOfferAddress;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(address),
  );
  const [value, setValue] = useState<AuthoredTraitOffer>(interaction.value);
  const [draftRarityChoices, setDraftRarityChoices] = useState<
    Readonly<Record<string, readonly TraitRarity[]>>
  >({});
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [loadable, setLoadable] = useState(() =>
    traitOfferLoadable(interaction, interaction.value),
  );
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const feedback = projectTraitOfferFeedback(value, candidate, interaction.traitLabel);
  const authoritativeInteractionRef = useRef(interaction);
  useEffect(() => {
    if (authoritativeInteractionRef.current === interaction) return;
    authoritativeInteractionRef.current = interaction;
    const nextLoadable = traitOfferLoadable(interaction, interaction.value);
    setValue(interaction.value);
    setDraftRarityChoices({});
    setLoadable(nextLoadable);
    controller.activate(nextLoadable);
  }, [controller, interaction]);
  useEffect(() => {
    controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  const updateValue = (nextValue: AuthoredTraitOffer): void => {
    const nextLoadable = traitOfferLoadable(interaction, nextValue);
    setValue(nextValue);
    setLoadable(nextLoadable);
    controller.activate(nextLoadable);
  };
  const setOption = (index: number, patch: { traitKey?: string; rarity?: TraitRarity }): void => {
    const options = [...value.options] as Array<AuthoredTraitOffer['options'][number]>;
    const current = options[index]!;
    const nextTraitKey = patch.traitKey ?? current.traitKey;
    const nextRarities = interaction.rarityChoicesFor(nextTraitKey, index);
    setDraftRarityChoices((previous) =>
      Object.freeze({ ...previous, [nextTraitKey]: nextRarities }),
    );
    const nextRarity =
      patch.rarity ??
      (nextRarities.length === 0
        ? undefined
        : current.rarity !== undefined && nextRarities.includes(current.rarity)
          ? current.rarity
          : nextRarities[0]);
    options[index] = Object.freeze({
      traitKey: nextTraitKey,
      ...(nextRarity === undefined ? {} : { rarity: nextRarity }),
    });
    updateValue(
      Object.freeze({
        ...value,
        options: Object.freeze(options) as AuthoredTraitOffer['options'],
      }),
    );
  };
  return (
    <div className="trait-offer-editor">
      <div className="trait-offer-options">
        {OPTION_KEYS.map((optionKey, index) => {
          const option = value.options[index]!;
          const rarityChoices =
            draftRarityChoices[option.traitKey] ?? interaction.rarityChoicesFor(option.traitKey);
          return (
            <fieldset className="trait-offer-option" key={optionKey}>
              <legend>{optionKey.replace('option', 'Option ')}</legend>
              <label className="field-control">
                <span>Trait</span>
                <select
                  aria-label={`${optionKey} trait`}
                  onChange={(event) => setOption(index, { traitKey: event.target.value })}
                  value={option.traitKey}
                >
                  {interaction.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              {rarityChoices.length === 0 ? null : rarityChoices.length === 1 ? (
                <span className="field-control trait-rarity-fixed">
                  <span>Rarity</span>
                  <strong>{rarityLabel(rarityChoices[0]!)}</strong>
                </span>
              ) : (
                <label className="field-control">
                  <span>Rarity</span>
                  <select
                    aria-label={`${optionKey} rarity`}
                    onChange={(event) =>
                      setOption(index, { rarity: event.target.value as TraitRarity })
                    }
                    value={option.rarity ?? rarityChoices[0]}
                  >
                    {rarityChoices.map((rarity) => (
                      <option key={rarity} value={rarity}>
                        {rarityLabel(rarity)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="trait-option-selected">
                <input
                  checked={value.selectedOptionKey === optionKey}
                  name={`${semanticAddressKey(address)}-selected`}
                  onChange={() =>
                    updateValue(Object.freeze({ ...value, selectedOptionKey: optionKey }))
                  }
                  type="radio"
                />
                Selected
              </label>
              {feedback.options[index]?.reasons.length === 0 ? null : (
                <ul className="trait-option-feedback" aria-label={`${optionKey} feedback`}>
                  {feedback.options[index]?.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {feedback.options[index]?.replacement === undefined ? null : (
                <p className="trait-option-replacement" role="status">
                  Replaces {feedback.options[index]!.replacement!.replacedTraitLabel} ·{' '}
                  {feedback.options[index]!.replacement!.oldRarity} to{' '}
                  {feedback.options[index]!.replacement!.requiredRarity}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>
      {feedback.contextMessage === undefined && support === 'impossible' ? (
        <p className="feedback-text" role="status">
          This offer is unavailable in the current route context.
        </p>
      ) : null}
      {feedback.contextMessage === undefined ? null : (
        <p className="feedback-text" role="status">
          {feedback.contextMessage}
        </p>
      )}
      <button
        className="primary-action"
        disabled={support === 'impossible'}
        onClick={() => {
          onCommit?.(value);
        }}
        type="button"
      >
        Save trait offer
      </button>
    </div>
  );
}

export function TraitOfferDialog({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: TraitOfferAddress;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(target),
  );
  const close = useCallback((): void => {
    dispatch(traitOfferDialogClosed());
    const launcher = document.getElementById(launcherId(target));
    (launcher ?? previousFocusRef.current)?.focus();
  }, [dispatch, target]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inertSiblings: HTMLElement[] = [];
    const parent = dialog.parentElement;
    const supportsModal = typeof dialog.showModal === 'function';
    if (!supportsModal && parent !== null) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === dialog || !(sibling instanceof HTMLElement)) continue;
        inertSiblings.push(sibling);
        (sibling as HTMLElement & { inert: boolean }).inert = true;
      }
    }

    if (supportsModal && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // A test DOM may expose showModal without implementing the top layer.
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }

    const first = dialog.querySelector<HTMLElement>('select, input, button');
    first?.focus();
    const onCancel = (event: Event): void => {
      event.preventDefault();
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      // Native modal dialogs emit `cancel`; this local fallback only covers
      // DOMs that cannot implement the dialog top layer (for example jsdom).
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('keydown', onKeyDown);
      for (const sibling of inertSiblings) {
        (sibling as HTMLElement & { inert: boolean }).inert = false;
      }
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [close, target]);
  return (
    <dialog
      aria-labelledby={`trait-offer-dialog-title-${semanticAddressKey(target)}`}
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      <div className="trait-offer-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Trait offer</p>
            <h2 id={`trait-offer-dialog-title-${semanticAddressKey(target)}`}>
              {interaction.giver.label}
            </h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={target} />
            <button
              aria-label="Close trait offer"
              className="quiet-action"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        <TraitOfferEditor
          address={target}
          interactions={interactions}
          key={`${semanticAddressKey(target)}:${traitOfferRevision(interaction)}`}
          onCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            close();
          }}
        />
      </div>
    </dialog>
  );
}
