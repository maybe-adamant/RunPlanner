import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { candidateSupport } from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/traitDomainProjection';
import type { AuthoredCirceResolution } from '@run-planner/engine/authored-project';
import { projectTraitOfferFeedback } from '@planner/projections/traitProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceCirceResolutionDomain,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyTargetPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

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
  if (interaction.value.kind === 'fallbackGold') {
    return `${interaction.giver.key}|fallbackGold`;
  }
  return [
    interaction.giver.key,
    interaction.choices.map((choice) => choice.value).join(','),
    interaction.value.options
      .map((option) => `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}`)
      .join(','),
    interaction.value.selectedOptionKey,
    interaction.value.deathDefianceConditionMet === true ? 'dd' : 'no-dd',
  ].join('|');
}

function replaceOption(
  value: AuthoredTraitOfferTraits,
  index: number,
  next: AuthoredTraitOfferTraits['options'][number],
): AuthoredTraitOfferTraits {
  const options = [...value.options] as AuthoredTraitOfferTraits['options'][number][];
  options[index] = Object.freeze({ ...next });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

function CirceResolutionEditor({
  domain,
  option,
  onSelect,
}: {
  readonly domain: WorkspaceCirceResolutionDomain;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const current = option.circeResolution;
  if (!domain.outerAvailable) {
    return <p className="feedback-text">This Circe trait has no available outcome here.</p>;
  }
  if (domain.effect === 'disableFear') {
    return (
      <label className="trait-circe-resolution">
        Black Night Vow
        <select
          aria-label="Black Night Vow"
          onChange={(event) =>
            onSelect(
              Object.freeze({
                kind: 'disableFear',
                vowKey: event.target.value === '' ? null : event.target.value,
              }),
            )
          }
          value={current?.kind === 'disableFear' ? (current.vowKey ?? '') : ''}
        >
          <option value="">Choose a Vow</option>
          {domain.vowChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const selected =
    current?.kind === domain.effect ? current.arcanaKeys : (Object.freeze([]) as readonly string[]);
  if (domain.effect === 'activateArcana') {
    return (
      <label className="trait-circe-resolution">
        Red Citrine Arcana
        <select
          aria-label="Red Citrine Arcana"
          onChange={(event) =>
            onSelect(
              Object.freeze({
                kind: 'activateArcana',
                arcanaKeys:
                  event.target.value === ''
                    ? Object.freeze([])
                    : Object.freeze([event.target.value]),
              }),
            )
          }
          value={selected[0] ?? ''}
        >
          <option value="">
            {domain.requiredCount === 0 ? 'No activation available' : 'Choose Arcana'}
          </option>
          {domain.arcanaChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Lapis Arcana ({domain.requiredCount})</legend>
      {domain.arcanaChoices.map((choice) => {
        const checked = selected.includes(choice.value);
        return (
          <label key={choice.value}>
            <input
              checked={checked}
              disabled={!checked && selected.length >= domain.requiredCount}
              onChange={() => {
                const next = checked
                  ? selected.filter((key) => key !== choice.value)
                  : [...selected, choice.value];
                onSelect(Object.freeze({ kind: 'promoteArcana', arcanaKeys: Object.freeze(next) }));
              }}
              type="checkbox"
            />
            {choice.label}
          </label>
        );
      })}
    </fieldset>
  );
}

function TraitOfferOptionEditor({
  index,
  interaction,
  optionKey,
  effectiveRarity,
  rarifySupported,
  value,
  onUpdate,
}: {
  readonly index: number;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly optionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
  readonly effectiveRarity?: TraitRarity;
  readonly rarifySupported: boolean;
  readonly value: AuthoredTraitOfferTraits;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const option = value.options[index];
  if (option === undefined) throw new Error(`Trait offer is missing ${optionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, optionKey),
    [interaction, optionKey, value],
  );
  const controller = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const loaded = controller.observe(loadable);
  const domain = loaded.result;
  const traitPicker = domain?.traitPicker ?? emptyTraitPicker;
  const rarityPicker = domain?.rarityPickerFor(option.traitKey) ?? emptyRarityPicker;
  const targetPicker = domain?.targetPicker ?? emptyTargetPicker;
  const hasRarity = interaction.giver.rarityPolicy.kind === 'selectable';
  const idPrefix = `${semanticAddressKey(interaction.owner)}-${optionKey}`;
  const selectTrait = (traitKey: string): void => {
    const preferred = domain?.preferredOptionFor(traitKey);
    if (preferred === undefined) return;
    onUpdate(replaceOption(value, index, preferred));
  };
  const selectRarity = (rarity: TraitRarity): void => {
    onUpdate(replaceOption(value, index, { ...option, rarity }));
  };
  const selectTarget = (targetTraitKey: string): void => {
    onUpdate(replaceOption(value, index, { ...option, targetTraitKey }));
  };
  const circe = loadable.circeResolution;
  const circeLoadable = useMemo(() => circe?.forOffer(value), [circe, value]);
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeLoaded = circeController.observe(circeLoadable);
  useEffect(() => {
    if (circeLoadable !== undefined) circeController.activate(circeLoadable);
  }, [circeController, circeLoadable]);
  const circeDomain = circeLoaded.result;
  return (
    <fieldset className="trait-offer-option" key={optionKey}>
      <legend>{optionKey.replace('option', 'Option ')}</legend>
      <ContextualPicker
        ariaLabel={`${optionKey} trait`}
        id={`${idPrefix}-trait`}
        label="Trait"
        loading={loaded.pending}
        model={traitPicker}
        onOpenChange={(open) => {
          if (open) controller.activate(loadable);
        }}
        onSelect={selectTrait}
        placeholder="Choose a trait"
        triggerLabel={interaction.traitLabel(option.traitKey)}
      />
      {!hasRarity ? null : (
        <ContextualPicker
          ariaLabel={`${optionKey} rarity`}
          id={`${idPrefix}-rarity`}
          label="Rarity"
          loading={loaded.pending}
          model={rarityPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectRarity}
          placeholder="Choose a rarity"
          {...(option.rarity === undefined ? {} : { triggerLabel: rarityLabel(option.rarity) })}
        />
      )}
      {!loadable.hasTargetPicker ? null : (
        <ContextualPicker
          ariaLabel={`${optionKey} acquisition target`}
          id={`${idPrefix}-target`}
          label="Target"
          loading={loaded.pending}
          model={targetPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectTarget}
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {circe === undefined || circeDomain === undefined ? null : (
        <CirceResolutionEditor
          domain={circeDomain}
          option={option}
          onSelect={(resolution) =>
            onUpdate(replaceOption(value, index, { ...option, circeResolution: resolution }))
          }
        />
      )}
      <button
        disabled={!rarifySupported}
        onClick={() =>
          onUpdate(
            Object.freeze({
              ...value,
              rarificationActions: Object.freeze([...(value.rarificationActions ?? []), optionKey]),
            }),
          )
        }
        type="button"
      >
        Rarify
      </button>
      {effectiveRarity === undefined ? null : <p>Effective rarity: {effectiveRarity}</p>}
      <label className="trait-option-selected">
        <input
          checked={value.selectedOptionKey === optionKey}
          name={`${semanticAddressKey(interaction.owner)}-selected`}
          onChange={() => onUpdate(Object.freeze({ ...value, selectedOptionKey: optionKey }))}
          type="radio"
        />
        Selected
      </label>
    </fieldset>
  );
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
  const selected =
    control.offer.kind === 'traits'
      ? control.offer.options[OPTION_KEYS.indexOf(control.offer.selectedOptionKey)]
      : undefined;
  const label =
    control.offer.kind === 'fallbackGold'
      ? 'Fallback Gold'
      : selected === undefined
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
      Edit Trait: {label}
      {rarity}
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
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [loadable, setLoadable] = useState(() =>
    traitOfferLoadable(interaction, interaction.value),
  );
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const feedback = projectTraitOfferFeedback(value, candidate, interaction.traitLabel);
  const offerMessage =
    feedback.contextMessage ??
    (support === 'impossible'
      ? 'This offer is unavailable in the current route context.'
      : undefined);
  const hasOptionFeedback = feedback.options.some(
    (option) => option.reasons.length > 0 || option.replacement !== undefined,
  );
  const rarifySupported = (optionKey: AuthoredTraitOfferTraits['selectedOptionKey']): boolean => {
    if (candidate?.evaluation.kind !== 'traitOffer') return false;
    const branches = candidate.evaluation.result.callingCard ?? [];
    return (
      branches.length > 0 &&
      branches.every((branch) => branch.rarifiableOptionKeys.includes(optionKey))
    );
  };
  const effectiveRarity = (
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  ): TraitRarity | undefined => {
    if (candidate?.evaluation.kind !== 'traitOffer') return undefined;
    const values = (candidate.evaluation.result.callingCard ?? [])
      .map((branch) => branch.effectiveRarities[OPTION_KEYS.indexOf(optionKey)])
      .filter((value): value is TraitRarity => value !== undefined);
    return values.length > 0 && values.every((value) => value === values[0])
      ? values[0]
      : undefined;
  };
  const deathDefianceCondition =
    value.kind === 'traits' ? interaction.deathDefianceCondition : undefined;
  const traitsStartingDraft = useMemo(
    () => (value.kind === 'fallbackGold' ? interaction.traitsStartingDraft?.() : undefined),
    [interaction, value],
  );
  const nextTraitOfferDraft = useMemo(
    () => (value.kind === 'traits' ? interaction.nextTraitOfferDraft?.(value) : undefined),
    [interaction, value],
  );
  const authoritativeInteractionRef = useRef(interaction);
  useEffect(() => {
    if (authoritativeInteractionRef.current === interaction) return;
    authoritativeInteractionRef.current = interaction;
    const nextLoadable = traitOfferLoadable(interaction, interaction.value);
    setValue(interaction.value);
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
  return (
    <div className="trait-offer-editor">
      {value.kind === 'traits' && deathDefianceCondition !== undefined ? (
        <label className="trait-offer-condition">
          <input
            checked={value.deathDefianceConditionMet === true}
            onChange={(event) =>
              updateValue(
                Object.freeze({
                  ...value,
                  deathDefianceConditionMet: event.target.checked,
                }),
              )
            }
            type="checkbox"
          />
          Death Defiance condition met
        </label>
      ) : null}
      {value.kind === 'fallbackGold' ? (
        <section className="trait-offer-fallback">
          <p>Fallback Gold</p>
          <button
            disabled={traitsStartingDraft === undefined}
            onClick={() => {
              if (traitsStartingDraft !== undefined) updateValue(traitsStartingDraft);
            }}
            type="button"
          >
            Return to traits
          </button>
        </section>
      ) : (
        <>
          {interaction.giver.providerKind !== 'olympian' &&
          interaction.giver.providerKind !== 'hermes' ? null : (
            <button
              onClick={() =>
                updateValue(Object.freeze({ kind: 'fallbackGold', giverKey: value.giverKey }))
              }
              type="button"
            >
              Select Fallback Gold
            </button>
          )}
          <div className="trait-offer-options">
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  {rowEffectiveRarity === undefined ? (
                    <TraitOfferOptionEditor
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  ) : (
                    <TraitOfferOptionEditor
                      effectiveRarity={rowEffectiveRarity}
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  )}
                </div>
              );
            })}
            {value.options.length <= 1 ||
            (interaction.giver.providerKind !== 'olympian' &&
              interaction.giver.providerKind !== 'hermes') ? null : (
              <button
                onClick={() => {
                  const options = value.options.slice(
                    0,
                    -1,
                  ) as unknown as AuthoredTraitOfferTraits['options'];
                  const selectedIndex = OPTION_KEYS.indexOf(value.selectedOptionKey);
                  updateValue(
                    Object.freeze({
                      ...value,
                      options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      selectedOptionKey: OPTION_KEYS[Math.min(selectedIndex, options.length - 1)]!,
                    }),
                  );
                }}
                type="button"
              >
                Remove last option
              </button>
            )}
            {value.options.length >= OPTION_KEYS.length ? null : (
              <button
                disabled={nextTraitOfferDraft === undefined}
                onClick={() => {
                  if (nextTraitOfferDraft !== undefined) updateValue(nextTraitOfferDraft);
                }}
                type="button"
              >
                Add option
              </button>
            )}
          </div>
        </>
      )}
      <section aria-label="Offer feedback" className="trait-offer-feedback" role="status">
        <h3>Offer feedback</h3>
        {!hasOptionFeedback && offerMessage === undefined ? (
          <p className="trait-offer-feedback-empty">No current findings.</p>
        ) : null}
        {feedback.options.map((option, index) =>
          option.reasons.length === 0 && option.replacement === undefined ? null : (
            <div className="trait-offer-feedback-item" key={OPTION_KEYS[index]}>
              <strong>Option {index + 1}</strong>
              {option.reasons.length === 0 ? null : (
                <ul className="trait-option-feedback" aria-label={`${OPTION_KEYS[index]} feedback`}>
                  {option.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {option.replacement === undefined ? null : (
                <p className="trait-option-replacement">
                  Replaces {option.replacement.replacedTraitLabel} · {option.replacement.oldRarity}{' '}
                  to {option.replacement.requiredRarity}
                </p>
              )}
            </div>
          ),
        )}
        {offerMessage === undefined ? null : <p className="feedback-text">{offerMessage}</p>}
      </section>
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
      // A nested picker handles its own Escape first and prevents the default;
      // preserve the in-progress local draft until a later Escape reaches us.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
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
