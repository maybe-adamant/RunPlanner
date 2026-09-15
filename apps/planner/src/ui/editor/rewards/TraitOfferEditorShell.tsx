import {
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useState } from 'react';

import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import {
  projectTraitOfferFeedback,
  projectTraitOfferState,
} from '@planner/projections/rewards/traitProjection';
import { type WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { LoadedEchoLastRunBoonChoice } from './TraitOfferEchoLastRunBoon';
import { TraitOfferOrdinaryOption } from './TraitOfferOrdinaryOption';
import { TraitOfferSelectedOutcome } from './TraitOfferSelectedOutcome';
import { TraitOfferForm, TraitOfferShapeActions } from './TraitOfferForm';
import { TraitOfferStateInspector } from './TraitOfferStateInspector';
import { selectedTraitOutcomeDraftComplete } from './traitOfferOptions';
import { ChaosTraitOfferEditor } from './ChaosTraitOfferEditor';
const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function traitOfferLoadable(
  interaction: WorkspaceTraitOfferInteraction,
  value: AuthoredTraitOffer,
): { readonly load: () => ReturnType<WorkspaceTraitOfferInteraction['load']> } {
  const loadInteraction = interaction.load;
  return Object.freeze({ load: () => loadInteraction(value) });
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
  const [view, setView] = useState(initialView);
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [draft, setDraft] = useState(() => {
    const loadable = traitOfferLoadable(interaction, initialValue);
    return Object.freeze({ interaction, loadable, value: initialValue });
  });
  const value = draft.value;
  const loadable = useMemo(
    () =>
      draft.interaction === interaction ? draft.loadable : traitOfferLoadable(interaction, value),
    [draft, interaction, value],
  );
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const feedback = projectTraitOfferFeedback(value, candidate, interaction.traitLabel);
  const offerState = value.kind === 'traits' ? projectTraitOfferState(candidate) : undefined;
  const selectedOutcomeDomain =
    value.kind === 'traits' ? interaction.optionDomain(value, value.selectedOptionKey) : undefined;
  const selectedOutcomeComplete =
    value.kind !== 'traits' ||
    (selectedOutcomeDomain !== undefined &&
      selectedTraitOutcomeDraftComplete(value, selectedOutcomeDomain));
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
  const rejectedRules =
    candidate?.evaluation.kind === 'traitOffer'
      ? candidate.evaluation.result.chaosOfferRules
      : undefined;
  const rejectedBlock =
    value.kind === 'traits' && rejectedRules !== undefined
      ? interaction.rejectedBlockDomain?.(rejectedRules)
      : undefined;
  const recoveryDraft =
    support !== 'impossible'
      ? undefined
      : value.kind === 'traits' || value.kind === 'fallbackGold'
        ? interaction.traitOfferStartingOutcome?.()
        : value.kind === 'chaos'
          ? interaction.chaos?.startingDraft()
          : undefined;
  const ordinary =
    interaction.giver.providerKind === 'olympian' || interaction.giver.providerKind === 'hermes';
  const appendedDraft = ordinary ? interaction.appendTraitOfferDraft?.(value) : undefined;
  const removedDraft =
    ordinary && value.kind === 'traits' ? interaction.removeTraitOfferDraft?.(value) : undefined;
  useEffect(() => {
    controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  const updateValue = (nextValue: AuthoredTraitOffer): void => {
    const nextLoadable = traitOfferLoadable(interaction, nextValue);
    setDraft(Object.freeze({ interaction, loadable: nextLoadable, value: nextValue }));
    controller.activate(nextLoadable);
  };
  if (view === 'echoLastRunBoon' && value.kind === 'traits') {
    const child = interaction
      .optionDomain(value, value.selectedOptionKey)
      .children.find(
        (
          entry,
        ): entry is Extract<
          typeof entry,
          { readonly child: { readonly kind: 'echoLastRunBoon' } }
        > => entry.child.kind === 'echoLastRunBoon',
      );
    return (
      <LoadedEchoLastRunBoonChoice
        interaction={interaction}
        offer={value}
        onBack={() => setView('outer')}
        onComplete={(outcome) => {
          if (child === undefined) return;
          const completed = child.update(value, outcome);
          updateValue(completed);
          onChildCommit?.(completed);
          setView('outer');
        }}
      />
    );
  }
  const feedbackSection = spellOffer ? undefined : (
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
                Replaces {option.replacement.replacedTraitLabel} · {option.replacement.oldRarity} to{' '}
                {option.replacement.requiredRarity}
              </p>
            )}
          </div>
        ),
      )}
      {offerMessage === undefined ? null : <p className="feedback-text">{offerMessage}</p>}
    </section>
  );
  const recoveryAction =
    recoveryDraft === undefined ? undefined : (
      <button className="quiet-action" onClick={() => updateValue(recoveryDraft)} type="button">
        Start over
      </button>
    );
  const resetAction =
    onReset === undefined ? undefined : (
      <button className="quiet-action" onClick={onReset} type="button">
        Reset to unresolved
      </button>
    );
  const save = {
    disabled: support === 'impossible' || !selectedOutcomeComplete,
    label: value.kind === 'chaos' ? 'Save Chaos outcome' : 'Save trait offer',
    onClick: () => onCommit?.(value),
  };
  if (value.kind === 'traits') {
    return (
      <TraitOfferForm
        state={
          offerState === undefined ? undefined : (
            <TraitOfferStateInspector presentation={offerState} />
          )
        }
        options={
          <>
            {rejectedBlock === undefined ||
            (!rejectedBlock.required && !rejectedBlock.needsRepair) ? null : (
              <fieldset aria-label="Rejected blocked row" className="trait-offer-rejected-block">
                <legend>Rejected blocked row</legend>
                {rejectedBlock.canClear ? (
                  <label>
                    <input
                      checked={value.rejectedOptionKey === undefined}
                      name={`${interaction.key}-rejected-block`}
                      onChange={() => {
                        const { rejectedOptionKey: _rejectedOptionKey, ...withoutBlock } = value;
                        void _rejectedOptionKey;
                        updateValue(Object.freeze(withoutBlock));
                      }}
                      type="radio"
                    />
                    No blocked row
                  </label>
                ) : null}
                {rejectedBlock.optionKeys.map((optionKey) => (
                  <label key={optionKey}>
                    <input
                      checked={value.rejectedOptionKey === optionKey}
                      name={`${interaction.key}-rejected-block`}
                      onChange={() =>
                        updateValue(Object.freeze({ ...value, rejectedOptionKey: optionKey }))
                      }
                      type="radio"
                    />
                    Block {optionKey.replace('option', 'Option ')}
                  </label>
                ))}
              </fieldset>
            )}
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              const rowEffectiveLevel = optionFeedback?.effectiveLevel;
              const rowPersephoneLevelBonusMaximum = optionFeedback?.persephoneLevelBonusMaximum;
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  <TraitOfferOrdinaryOption
                    {...(rowEffectiveRarity === undefined
                      ? {}
                      : { effectiveRarity: rowEffectiveRarity })}
                    {...(rowEffectiveLevel === undefined
                      ? {}
                      : { effectiveLevel: rowEffectiveLevel })}
                    index={index}
                    interaction={interaction}
                    onUpdate={updateValue}
                    optionKey={optionKey}
                    rejected={value.rejectedOptionKey === optionKey}
                    {...(rowPersephoneLevelBonusMaximum === undefined
                      ? {}
                      : { persephoneLevelBonusMaximum: rowPersephoneLevelBonusMaximum })}
                    rarifySupported={rarifySupported(optionKey)}
                    spellOffer={spellOffer}
                    value={value}
                  />
                </div>
              );
            })}
          </>
        }
        selectedOutcome={
          <TraitOfferSelectedOutcome
            interaction={interaction}
            onOpenEchoLastRunBoon={() => setView('echoLastRunBoon')}
            onUpdate={updateValue}
            value={value}
          />
        }
        shapeActions={
          ordinary ? (
            <TraitOfferShapeActions
              addDisabled={appendedDraft === undefined}
              onAdd={() => {
                if (appendedDraft !== undefined) updateValue(appendedDraft);
              }}
              onRemove={() => {
                if (removedDraft !== undefined) updateValue(removedDraft);
              }}
              removeDisabled={removedDraft === undefined}
            />
          ) : undefined
        }
        feedback={feedbackSection}
        recovery={recoveryAction}
        reset={resetAction}
        save={save}
      />
    );
  }
  return (
    <TraitOfferForm
      content={
        value.kind === 'fallbackGold' ? (
          <section className="trait-offer-fallback">
            <p>Fallback Gold</p>
          </section>
        ) : value.kind === 'chaos' && interaction.chaos !== undefined ? (
          <ChaosTraitOfferEditor
            interaction={interaction.chaos}
            onUpdate={updateValue}
            value={value}
          />
        ) : null
      }
      feedback={feedbackSection}
      options={null}
      recovery={recoveryAction}
      reset={resetAction}
      save={save}
      shapeActions={
        value.kind === 'fallbackGold' && ordinary ? (
          <TraitOfferShapeActions
            addDisabled={appendedDraft === undefined}
            onAdd={() => {
              if (appendedDraft !== undefined) updateValue(appendedDraft);
            }}
            onRemove={() => undefined}
            removeDisabled
          />
        ) : undefined
      }
    />
  );
}
