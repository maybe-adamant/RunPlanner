import {
  semanticAddressKey,
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredAllTogetherResult,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey, TraitRarity } from '@run-planner/engine/catalog-schema';
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
  type WorkspaceEchoPomTargetDomain,
  type WorkspaceEchoLastRunBoonDomain,
  type WorkspaceEchoLastRunBoonTraitIdentity,
  type WorkspaceAllTogetherSetInteraction,
  type WorkspaceAllTogetherSetDomain,
  type WorkspaceNaturalSelectionDomain,
  type WorkspaceNaturalSelectionInteraction,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { CompoundOutcomeEditor } from './CompoundOutcomeEditor';
import { TraitOfferCirceResolution } from './TraitOfferCirceResolution';
import { LoadedEchoLastRunBoonChoice } from './TraitOfferEchoLastRunBoon';
import { replaceTraitOfferOption, TraitOfferOrdinaryOption } from './TraitOfferOrdinaryOption';
import { TraitOfferSelectedOutcome } from './TraitOfferSelectedOutcome';
const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function traitOfferLoadable(
  interaction: WorkspaceTraitOfferInteraction,
  value: AuthoredTraitOffer,
): { readonly load: () => ReturnType<WorkspaceTraitOfferInteraction['load']> } {
  const loadInteraction = interaction.load;
  return Object.freeze({ load: () => loadInteraction(value) });
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  if (interaction.value === null) return `${interaction.giver.key}|unresolved`;
  if (interaction.value.kind === 'fallbackGold') {
    return `${interaction.giver.key}|fallbackGold`;
  }
  if (interaction.value.kind === 'chaos') {
    return `${interaction.giver.key}|chaos|${interaction.value.curseKey}|${interaction.value.blessingKey}|${interaction.value.rarity}`;
  }
  return [
    interaction.giver.key,
    interaction.choices.map((choice) => choice.value).join(','),
    interaction.value.options
      .map(
        (option) =>
          `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}:${
            'echoPomTarget' in option ? (option.echoPomTarget ?? 'none') : ''
          }:${'echoLastRunBoon' in option ? JSON.stringify(option.echoLastRunBoon) : ''}:${
            'allTogetherResult' in option ? JSON.stringify(option.allTogetherResult) : ''
          }:${'naturalSelectionTargets' in option ? JSON.stringify(option.naturalSelectionTargets) : ''}`,
      )
      .join(','),
    interaction.value.selectedOptionKey,
  ].join('|');
}

interface EchoLastRunBoonDraftRow {
  readonly identity?: WorkspaceEchoLastRunBoonTraitIdentity;
  readonly rarity?: TraitRarity;
  readonly targetTraitKey?: string;
}
export function TraitOfferEditorShell({
  initialValue,
  initialView,
  interaction,
  onChildCommit,
  onCommit,
  onReset,
}: {
  readonly initialValue: AuthoredTraitOffer;
  readonly initialView: 'outer' | 'echoLastRunBoon';
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onChildCommit?: (value: AuthoredTraitOffer) => void;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const [value, setValue] = useState<AuthoredTraitOffer>(initialValue);
  const [view, setView] = useState(initialView);
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [loadable, setLoadable] = useState(() => traitOfferLoadable(interaction, initialValue));
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
  const spellOffer = interaction.giver.providerKind === 'spell';
  const traitsStartingDraft = useMemo(
    () => (value.kind === 'fallbackGold' ? interaction.traitsStartingDraft?.() : undefined),
    [interaction, value],
  );
  const nextTraitOfferDraft = useMemo(
    () => (value.kind === 'traits' ? interaction.nextOptionalHighTierDraft?.(value) : undefined),
    [interaction, value],
  );
  const previousTraitOfferDraft = useMemo(
    () =>
      value.kind === 'traits' ? interaction.previousOptionalHighTierDraft?.(value) : undefined,
    [interaction, value],
  );
  const previousTraitOfferLoadable = useMemo(
    () =>
      previousTraitOfferDraft === undefined
        ? undefined
        : traitOfferLoadable(interaction, previousTraitOfferDraft),
    [interaction, previousTraitOfferDraft],
  );
  const previousTraitOfferController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const previousTraitOfferLoaded = previousTraitOfferController.observe(previousTraitOfferLoadable);
  const previousTraitOfferSupport = candidateSupport(previousTraitOfferLoaded.result?.[0]);
  const canRemoveOption =
    previousTraitOfferDraft !== undefined &&
    (previousTraitOfferSupport === 'possible' || previousTraitOfferSupport === 'forced');
  const fallbackGoldValue = useMemo(
    () =>
      value.kind !== 'traits' ||
      (interaction.giver.providerKind !== 'olympian' && interaction.giver.providerKind !== 'hermes')
        ? undefined
        : (Object.freeze({
            kind: 'fallbackGold' as const,
            giverKey: value.giverKey,
          }) satisfies AuthoredTraitOffer),
    [interaction.giver.providerKind, value],
  );
  const fallbackGoldLoadable = useMemo(
    () =>
      fallbackGoldValue === undefined
        ? undefined
        : traitOfferLoadable(interaction, fallbackGoldValue),
    [fallbackGoldValue, interaction],
  );
  const fallbackGoldController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const fallbackGoldLoaded = fallbackGoldController.observe(fallbackGoldLoadable);
  const fallbackGoldSupport = candidateSupport(fallbackGoldLoaded.result?.[0]);
  useEffect(() => {
    // Rarityless SpellDrop offers have a closed engine-owned shape. Their
    // editor only needs the authored three rows, so opening it must not issue
    // a speculative candidate query.
    if (!spellOffer) controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  useEffect(() => {
    if (fallbackGoldLoadable !== undefined) fallbackGoldController.activate(fallbackGoldLoadable);
  }, [fallbackGoldController, fallbackGoldLoadable]);
  useEffect(() => {
    if (previousTraitOfferLoadable !== undefined)
      previousTraitOfferController.activate(previousTraitOfferLoadable);
  }, [previousTraitOfferController, previousTraitOfferLoadable]);
  const updateValue = (nextValue: AuthoredTraitOffer): void => {
    const nextLoadable = traitOfferLoadable(interaction, nextValue);
    setValue(nextValue);
    setLoadable(nextLoadable);
    if (!spellOffer) controller.activate(nextLoadable);
  };
  if (view === 'echoLastRunBoon' && value.kind === 'traits') {
    const selectedIndex = optionIndex(value.selectedOptionKey);
    const selected = value.options[selectedIndex];
    return (
      <LoadedEchoLastRunBoonChoice
        interaction={interaction}
        offer={value}
        onBack={() => setView('outer')}
        onComplete={(child) => {
          if (selected === undefined) return;
          const completed = replaceTraitOfferOption(value, selectedIndex, {
            ...selected,
            echoLastRunBoon: child,
          });
          updateValue(completed);
          onChildCommit?.(completed);
          setView('outer');
        }}
      />
    );
  }
  return (
    <div className="trait-offer-editor">
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
      ) : value.kind !== 'traits' ? null : (
        <>
          <div className="trait-offer-options">
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  {rowEffectiveRarity === undefined ? (
                    <TraitOfferOrdinaryOption
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      spellOffer={spellOffer}
                      value={value}
                    />
                  ) : (
                    <TraitOfferOrdinaryOption
                      effectiveRarity={rowEffectiveRarity}
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      spellOffer={spellOffer}
                      value={value}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <TraitOfferSelectedOutcome
            interaction={interaction}
            onOpenEchoLastRunBoon={() => setView('echoLastRunBoon')}
            onUpdate={updateValue}
            value={value}
          />
          {nextTraitOfferDraft === undefined &&
          !canRemoveOption &&
          (fallbackGoldValue === undefined ||
            (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced')) ? null : (
            <div
              aria-label="Offer shape actions"
              className="trait-offer-shape-actions"
              role="group"
            >
              {nextTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(nextTraitOfferDraft)}
                  type="button"
                >
                  Add option
                </button>
              )}
              {!canRemoveOption || previousTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(previousTraitOfferDraft)}
                  type="button"
                >
                  Remove last option
                </button>
              )}
              {fallbackGoldValue === undefined ||
              (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced') ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(fallbackGoldValue)}
                  type="button"
                >
                  Select Fallback Gold
                </button>
              )}
            </div>
          )}
        </>
      )}
      {spellOffer ? null : (
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
                  <ul
                    className="trait-option-feedback"
                    aria-label={`${OPTION_KEYS[index]} feedback`}
                  >
                    {option.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                {option.replacement === undefined ? null : (
                  <p className="trait-option-replacement">
                    Replaces {option.replacement.replacedTraitLabel} ·{' '}
                    {option.replacement.oldRarity} to {option.replacement.requiredRarity}
                  </p>
                )}
              </div>
            ),
          )}
          {offerMessage === undefined ? null : <p className="feedback-text">{offerMessage}</p>}
        </section>
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
      {onReset === undefined ? null : (
        <button className="quiet-action" onClick={onReset} type="button">
          Reset to unresolved
        </button>
      )}
    </div>
  );
}
