import {
  rerolledChaosScreenSnapshot,
  rerolledTraitScreenSnapshot,
  type AuthoredRerolledChaosScreen,
  type AuthoredRerolledTraitScreen,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import {
  earlierScreenFixLine,
  findingScreenTab,
  type ScreenTab,
} from '@planner/projections/rewards/screenRerollTabs';
import {
  projectTraitOfferFeedback,
  projectTraitOfferState,
} from '@planner/projections/rewards/traitProjection';
import { type WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { EditorDialogFeedback } from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useDialogFindingEntries } from '@planner/ui/feedback/useFindingTarget';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { LoadedEchoLastRunBoonChoice } from './TraitOfferEchoLastRunBoon';
import { TraitOfferOrdinaryOption } from './TraitOfferOrdinaryOption';
import { TraitOfferSelectedOutcome } from './TraitOfferSelectedOutcome';
import { TraitOfferForm, TraitOfferShapeActions, useOutcomeFeedback } from './TraitOfferForm';
import { TraitOfferStateInspector } from './TraitOfferStateInspector';
import { selectedTraitOutcomeDraftComplete } from './traitOfferOptions';
import { ChaosTraitOfferEditor } from './ChaosTraitOfferEditor';
import { ScreenRerollTabs, UnsetScreen } from './ScreenRerollTabs';
import { useScreenTab } from './useScreenTab';
const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

/**
 * An earlier screen's rows in the final screen's editor shape, for display and
 * row edits only; candidates always judge the whole draft.
 */
function traitScreenValue(
  value: AuthoredTraitOfferTraits,
  screen: AuthoredRerolledTraitScreen,
): AuthoredTraitOfferTraits {
  const { rejectedOptionKey: _rejected, rerolledScreens: _screens, ...rest } = value;
  void _rejected;
  void _screens;
  return Object.freeze({
    ...rest,
    options: screen.options as AuthoredTraitOfferTraits['options'],
    ...(screen.rejectedOptionKey === undefined
      ? {}
      : { rejectedOptionKey: screen.rejectedOptionKey }),
  });
}

function withRerolledScreens<T extends AuthoredTraitOffer>(
  value: T,
  screens: readonly unknown[],
): T {
  return Object.freeze({ ...value, rerolledScreens: Object.freeze([...screens]) }) as unknown as T;
}

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
  onCancel,
  onCommit,
  onReset,
}: {
  readonly initialValue: AuthoredTraitOffer;
  readonly initialView: 'outer' | 'echoLastRunBoon';
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onCancel?: () => void;
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
  // Sub-editors report their draft feedback here; the dialog renders it in one fixed region.
  const [outcomeEntries, reportOutcomeFeedback] = useOutcomeFeedback();
  const earlierScreens: readonly unknown[] = value.rerolledScreens ?? [];
  const earlierCount = earlierScreens.length;
  const screenTab = useScreenTab(interaction.owner, earlierCount);
  const tabbed = interaction.screenRerolls !== undefined;
  // Trait-row screens of this offer; a Gold final shows earlier rows against no rows of its own.
  const rowBase: AuthoredTraitOfferTraits | undefined =
    value.kind === 'traits'
      ? value
      : value.kind === 'fallbackGold'
        ? Object.freeze({
            kind: 'traits' as const,
            giverKey: value.giverKey,
            options: Object.freeze([]) as unknown as AuthoredTraitOfferTraits['options'],
            selectedOptionKey: 'option1' as const,
          })
        : undefined;
  const earlierIndex = tabbed && screenTab.active < earlierCount ? screenTab.active : undefined;
  const activeScreen: ScreenTab = earlierIndex ?? 'final';
  // An earlier screen shows its rows read-only until the author chooses to correct it.
  const [editingScreen, setEditingScreen] = useState<number>();
  const earlierReadOnly = earlierIndex !== undefined && editingScreen !== earlierIndex;
  const routeEntries = useDialogFindingEntries(undefined, tabbed ? activeScreen : undefined);
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const earlierTraitScreen =
    rowBase !== undefined && earlierIndex !== undefined
      ? (earlierScreens[earlierIndex] as AuthoredRerolledTraitScreen | null)
      : undefined;
  const feedback = projectTraitOfferFeedback(
    rowBase !== undefined && earlierIndex !== undefined
      ? earlierTraitScreen === null || earlierTraitScreen === undefined
        ? traitScreenValue(rowBase, { options: [] })
        : traitScreenValue(rowBase, earlierTraitScreen)
      : value,
    candidate,
    interaction.traitLabel,
    activeScreen,
  );
  const candidateFindings =
    candidate?.evaluation.kind === 'traitOffer' ? candidate.evaluation.result.findings : undefined;
  // Each tab carries the draft's own findings; before evaluation, the route's.
  const markedScreens =
    candidateFindings === undefined
      ? screenTab.marked
      : new Set(candidateFindings.map(findingScreenTab));
  const offerState = value.kind === 'traits' ? projectTraitOfferState(candidate) : undefined;
  const selectedOutcomeDomain =
    value.kind === 'traits' ? interaction.optionDomain(value, value.selectedOptionKey) : undefined;
  const selectedOutcomeComplete =
    value.kind !== 'traits' ||
    (selectedOutcomeDomain !== undefined &&
      selectedTraitOutcomeDraftComplete(value, selectedOutcomeDomain));
  const offerMessage =
    feedback.contextMessage ??
    (support !== 'impossible'
      ? undefined
      : (candidateFindings?.length ?? 0) === 0
        ? 'This offer is unavailable in the current route context.'
        : activeScreen === 'final'
          ? earlierScreenFixLine(markedScreens)
          : undefined);
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
  // The row stays mounted whenever its domain exists; evaluation alone enables it.
  const rejectedBlockInactive =
    rejectedBlock !== undefined && !rejectedBlock.required && !rejectedBlock.needsRepair;
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
          updateValue(child.update(value, outcome));
          setView('outer');
        }}
      />
    );
  }
  // At rest the region matches the launcher; an edited draft shows its own assessment.
  const routeFixLine =
    tabbed && activeScreen === 'final' ? earlierScreenFixLine(markedScreens) : undefined;
  const atRestEntries =
    routeEntries !== undefined &&
    draftValueIdentity(value) === draftValueIdentity(interaction.value)
      ? routeEntries.length === 0 && routeFixLine !== undefined
        ? [['offer', routeFixLine] as const]
        : routeEntries
      : undefined;
  // Replacement previews stay; at rest the route findings stand in for candidate reasons.
  const optionFeedback =
    atRestEntries === undefined
      ? feedback.options
      : feedback.options.map((option) => ({ ...option, reasons: [] }));
  const hasOptionFeedback = optionFeedback.some(
    (option) => option.reasons.length > 0 || option.replacement !== undefined,
  );
  const optionFeedbackRows = optionFeedback.map((option, index) =>
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
  );
  const offerNotes = interaction.offerNotes(value);
  const feedbackSection = (
    <EditorDialogFeedback
      name="Offer feedback"
      entries={
        atRestEntries ??
        (offerMessage === undefined ? outcomeEntries : [['offer', offerMessage], ...outcomeEntries])
      }
      notes={offerNotes.map((note) => (
        <div className="trait-offer-note" key={note.traitKey}>
          <strong>{note.title}</strong>
          <p>{note.description}</p>
        </div>
      ))}
    >
      {hasOptionFeedback ? optionFeedbackRows : undefined}
    </EditorDialogFeedback>
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
  const screenRerolls = interaction.screenRerolls;
  const screenTabs =
    screenRerolls === undefined || !tabbed
      ? undefined
      : (panel: ReactNode) => (
          <ScreenRerollTabs
            active={screenTab.active}
            earlierCount={earlierCount}
            idPrefix={encodeURIComponent(semanticAddressKey(interaction.owner))}
            marked={markedScreens}
            onRemove={() => {
              updateValue(withRerolledScreens(value, earlierScreens.slice(0, -1)));
              setEditingScreen(undefined);
            }}
            onReroll={() => {
              updateValue(
                withRerolledScreens(value, [
                  ...earlierScreens,
                  value.kind === 'chaos' ? rerolledChaosScreenSnapshot(value) : finalRowsSnapshot(),
                ]),
              );
              screenTab.select(earlierCount + 1);
            }}
            onSelect={screenTab.select}
            rerolls={screenRerolls}
            {...(earlierIndex === undefined || earlierScreens[earlierIndex] === null
              ? {}
              : {
                  edit: {
                    pressed: !earlierReadOnly,
                    onToggle: () => setEditingScreen(earlierReadOnly ? earlierIndex : undefined),
                  },
                })}
          >
            {panel}
          </ScreenRerollTabs>
        );
  const replaceScreen = (index: number, screen: unknown): void =>
    updateValue(
      withRerolledScreens(
        value,
        earlierScreens.map((current, at) => (at === index ? screen : current)),
      ),
    );
  const save = {
    disabled: support === 'impossible' || !selectedOutcomeComplete,
    label: value.kind === 'chaos' ? 'Save Chaos outcome' : 'Save trait offer',
    onClick: () => onCommit?.(value),
  };
  // Rejected marks one blockable row while the curse acts on this offer.
  const rejectToggle = (
    screen: AuthoredTraitOfferTraits,
    update: (next: AuthoredTraitOfferTraits) => void,
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
    readOnly: boolean,
  ): ReactNode => {
    if (
      rejectedBlock === undefined ||
      rejectedBlockInactive ||
      !rejectedBlock.optionKeys.includes(optionKey)
    )
      return undefined;
    const pressed = screen.rejectedOptionKey === optionKey;
    return (
      <button
        aria-label={`Reject ${optionKey.replace('option', 'Option ')}`}
        aria-pressed={pressed}
        className="trait-option-reject"
        disabled={readOnly || (pressed && !rejectedBlock.canClear)}
        onClick={() => {
          if (!pressed) {
            update(Object.freeze({ ...screen, rejectedOptionKey: optionKey }));
            return;
          }
          const { rejectedOptionKey: _rejectedOptionKey, ...withoutBlock } = screen;
          void _rejectedOptionKey;
          update(Object.freeze(withoutBlock));
        }}
        type="button"
      >
        Reject
      </button>
    );
  };
  const emptyScreen: AuthoredRerolledTraitScreen = Object.freeze({ options: Object.freeze([]) });
  // The rows a reroll leaves behind: a Gold final showed none.
  const finalRowsSnapshot = (): AuthoredRerolledTraitScreen =>
    value.kind === 'traits' ? rerolledTraitScreenSnapshot(value) : emptyScreen;
  const stateInspector =
    offerState === undefined ? undefined : <TraitOfferStateInspector presentation={offerState} />;
  if (rowBase !== undefined && earlierIndex !== undefined) {
    const screen = earlierTraitScreen ?? null;
    const screenValue = screen === null ? undefined : traitScreenValue(rowBase, screen);
    // An earlier screen with no rows showed Fallback Gold.
    const goldScreen =
      screenValue !== undefined && (screenValue.options as readonly unknown[]).length === 0;
    const updateScreen = (next: AuthoredTraitOffer): void =>
      replaceScreen(
        earlierIndex,
        next.kind === 'traits' ? rerolledTraitScreenSnapshot(next) : emptyScreen,
      );
    // Row-count edits on an earlier screen use the same engine drafts as the final one.
    const shapeDraft = (next: AuthoredTraitOffer | undefined): AuthoredTraitOffer | undefined =>
      next?.kind === 'traits' || next?.kind === 'fallbackGold' ? next : undefined;
    const screenAppended =
      ordinary && screenValue !== undefined && !earlierReadOnly
        ? shapeDraft(
            interaction.appendTraitOfferDraft?.(
              goldScreen
                ? Object.freeze({ kind: 'fallbackGold' as const, giverKey: rowBase.giverKey })
                : screenValue,
            ),
          )
        : undefined;
    const screenRemoved =
      ordinary && screenValue !== undefined && !goldScreen && !earlierReadOnly
        ? shapeDraft(interaction.removeTraitOfferDraft?.(screenValue))
        : undefined;
    return (
      <TraitOfferForm
        state={stateInspector}
        content={
          screenValue === undefined ? (
            <UnsetScreen
              onCopy={() => {
                replaceScreen(earlierIndex, finalRowsSnapshot());
                setEditingScreen(earlierIndex);
              }}
            />
          ) : goldScreen ? (
            <section className="trait-offer-fallback">
              <p>Fallback Gold</p>
            </section>
          ) : (
            <>
              <div className="trait-offer-options">
                {screenValue.options.map((_, index) => (
                  <div
                    data-has-findings={(feedback.options[index]?.reasons.length ?? 0) > 0}
                    key={OPTION_KEYS[index]}
                  >
                    <TraitOfferOrdinaryOption
                      domainValue={value.kind === 'traits' ? value : screenValue}
                      headerAction={rejectToggle(
                        screenValue,
                        updateScreen,
                        OPTION_KEYS[index]!,
                        earlierReadOnly,
                      )}
                      index={index}
                      interaction={interaction}
                      onUpdate={updateScreen}
                      optionKey={OPTION_KEYS[index]!}
                      pickless
                      rarifySupported={false}
                      readOnly={earlierReadOnly}
                      {...(screenValue.options[index]?.rarity === undefined
                        ? {}
                        : { effectiveRarity: screenValue.options[index]!.rarity! })}
                      {...(feedback.options[index]?.effectiveLevel === undefined
                        ? {}
                        : { effectiveLevel: feedback.options[index]!.effectiveLevel! })}
                      {...(feedback.options[index]?.persephoneLevelRolls === undefined
                        ? {}
                        : { persephoneLevelRolls: feedback.options[index]!.persephoneLevelRolls! })}
                      showEffectiveValues
                      rejected={screenValue.rejectedOptionKey === OPTION_KEYS[index]}
                      spellOffer={spellOffer}
                      value={screenValue}
                    />
                  </div>
                ))}
              </div>
            </>
          )
        }
        feedback={feedbackSection}
        options={null}
        shapeActions={
          ordinary && screenValue !== undefined ? (
            <TraitOfferShapeActions
              addDisabled={screenAppended === undefined}
              onAdd={() => {
                if (screenAppended !== undefined) updateScreen(screenAppended);
              }}
              onRemove={() => {
                if (screenRemoved !== undefined) updateScreen(screenRemoved);
              }}
              removeDisabled={screenRemoved === undefined}
            />
          ) : undefined
        }
        recovery={recoveryAction}
        reset={resetAction}
        save={save}
        {...(screenTabs === undefined ? {} : { screenTabs })}
        {...(onCancel === undefined ? {} : { cancel: onCancel })}
      />
    );
  }
  if (value.kind === 'traits') {
    return (
      <TraitOfferForm
        state={stateInspector}
        options={
          <>
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              const rowEffectiveLevel = optionFeedback?.effectiveLevel;
              const rowPersephoneLevelRolls = optionFeedback?.persephoneLevelRolls;
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  <TraitOfferOrdinaryOption
                    {...(rowEffectiveRarity === undefined
                      ? {}
                      : { effectiveRarity: rowEffectiveRarity })}
                    {...(rowEffectiveLevel === undefined
                      ? {}
                      : { effectiveLevel: rowEffectiveLevel })}
                    headerAction={rejectToggle(value, updateValue, optionKey, false)}
                    index={index}
                    interaction={interaction}
                    onUpdate={updateValue}
                    optionKey={optionKey}
                    rejected={value.rejectedOptionKey === optionKey}
                    {...(rowPersephoneLevelRolls === undefined
                      ? {}
                      : { persephoneLevelRolls: rowPersephoneLevelRolls })}
                    rarifySupported={rarifySupported(optionKey)}
                    showEffectiveValues
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
            {...(() => {
              const acquiredRarity = effectiveRarity(value.selectedOptionKey);
              return acquiredRarity === undefined ? {} : { acquiredRarity };
            })()}
            interaction={interaction}
            onFeedback={reportOutcomeFeedback}
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
        {...(screenTabs === undefined ? {} : { screenTabs })}
        {...(onCancel === undefined ? {} : { cancel: onCancel })}
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
          earlierIndex === undefined ? (
            <ChaosTraitOfferEditor
              interaction={interaction.chaos}
              onUpdate={updateValue}
              value={value}
            />
          ) : earlierScreens[earlierIndex] === null ? (
            <UnsetScreen
              onCopy={() => {
                replaceScreen(earlierIndex, rerolledChaosScreenSnapshot(value));
                setEditingScreen(earlierIndex);
              }}
            />
          ) : (
            <ChaosTraitOfferEditor
              domainValue={value}
              interaction={interaction.chaos}
              onUpdate={(next) => replaceScreen(earlierIndex, rerolledChaosScreenSnapshot(next))}
              pickless
              readOnly={earlierReadOnly}
              value={Object.freeze({
                ...value,
                ...(earlierScreens[earlierIndex] as AuthoredRerolledChaosScreen),
              })}
            />
          )
        ) : null
      }
      feedback={feedbackSection}
      options={null}
      {...(screenTabs === undefined ? {} : { screenTabs })}
      recovery={recoveryAction}
      reset={resetAction}
      save={save}
      {...(onCancel === undefined ? {} : { cancel: onCancel })}
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
