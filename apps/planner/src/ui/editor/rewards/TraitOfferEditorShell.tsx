import {
  rerolledChaosScreenSnapshot,
  rerolledTraitScreenSnapshot,
  withFinalTraitScreenRerolled,
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
  type TraitOfferOptionFeedback,
} from '@planner/projections/rewards/traitProjection';
import { type WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useDialogFindingEntries } from '@planner/ui/feedback/useFindingTarget';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { EditorDialog } from '@planner/ui/controls/EditorDialog';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitGiverArtwork } from '@planner/ui/artwork/trait-givers/traitGiverArtwork';
import { LoadedEchoLastRunBoonChoice } from './TraitOfferEchoLastRunBoon';
import { TraitOfferOrdinaryOption } from './TraitOfferOrdinaryOption';
import { TraitOfferSelectedOutcome, type TraitOfferTreeReset } from './TraitOfferSelectedOutcome';
import { TraitOfferForm, TraitOfferShapeActions, useOutcomeFeedback } from './TraitOfferForm';
import { TraitOfferStateInspector } from './TraitOfferStateInspector';
import { selectedTraitOutcomeDraftComplete } from './traitOfferOptions';
import { ChaosTraitOfferEditor } from './ChaosTraitOfferEditor';
import { ScreenRerollTabs, UnsetScreen } from './ScreenRerollTabs';
import { useScreenTab } from './useScreenTab';
const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

/**
 * An earlier screen's rows and Rarify clicks in the final screen's editor
 * shape, for display and row edits only; candidates always judge the whole draft.
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
    rarificationActions: screen.rarificationActions ?? Object.freeze([]),
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

/** The sources a row's Level line shows: Jeweled Pom's levels and a replaced trait's carried level. */
function levelSourceProps(option: TraitOfferOptionFeedback | undefined): {
  readonly jeweledPomLevels?: number;
  readonly replacedTraitKey?: string;
} {
  return {
    ...(option?.jeweledPomLevels === undefined
      ? {}
      : { jeweledPomLevels: option.jeweledPomLevels }),
    ...(option?.replacement === undefined
      ? {}
      : { replacedTraitKey: option.replacement.replacedTraitKey }),
  };
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
  // A stacked view opens after mount so its dialog stacks above the outer one.
  const [view, setView] = useState<'outer' | 'echoLastRunBoon'>('outer');
  useEffect(() => {
    if (initialView === 'outer') return;
    const frame = requestAnimationFrame(() => setView(initialView));
    return () => cancelAnimationFrame(frame);
  }, [initialView]);
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
  const [treeReset, setTreeReset] = useState<TraitOfferTreeReset>();
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
  const callingCard =
    candidate?.evaluation.kind === 'traitOffer'
      ? candidate.evaluation.result.callingCard
      : undefined;
  // Calling Card replay of the final screen, or of one earlier screen.
  const callingCardScreen = (screen: ScreenTab) =>
    screen === 'final' ? callingCard : callingCard?.rerolledScreens?.[screen];
  const rarifySupported = (
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
    screen: ScreenTab = 'final',
  ): boolean => callingCardScreen(screen)?.rarifiableOptionKeys.includes(optionKey) === true;
  // The keepsake Rarify draws on and its uses left after the draft's clicks.
  const rarifySource = callingCard?.rarifySource;
  const effectiveRarity = (
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
    screen: ScreenTab = 'final',
  ): TraitRarity | undefined =>
    callingCardScreen(screen)?.effectiveRarities[OPTION_KEYS.indexOf(optionKey)];
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
  // The Echo choice opens as a dialog stacked over this one.
  const echoChild =
    view === 'echoLastRunBoon' && value.kind === 'traits'
      ? interaction
          .optionDomain(value, value.selectedOptionKey)
          .children.find(
            (
              entry,
            ): entry is Extract<
              typeof entry,
              { readonly child: { readonly kind: 'echoLastRunBoon' } }
            > => entry.child.kind === 'echoLastRunBoon',
          )
      : undefined;
  const echoDialog =
    view !== 'echoLastRunBoon' || value.kind !== 'traits' ? null : (
      <EditorDialog
        icon={
          <ArtworkIcon
            className="artwork-label-icon"
            source={traitGiverArtwork[interaction.giver.key] ?? undefined}
          />
        }
        model={{ kind: 'draft', onCancel: () => setView('outer') }}
        title={`${interaction.giver.label} › Boon Boon Boon`}
      >
        <LoadedEchoLastRunBoonChoice
          interaction={interaction}
          offer={value}
          onBack={() => setView('outer')}
          onComplete={(outcome) => {
            if (echoChild === undefined) return;
            updateValue(echoChild.update(value, outcome));
            setView('outer');
          }}
        />
      </EditorDialog>
    );
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
  // The row itself is marked, so its reason reads alone; one reason naming two rows shows once.
  const optionIssues = [
    ...new Map(
      optionFeedback.flatMap((option, index) =>
        option.reasons.map((reason) => [reason, `${OPTION_KEYS[index]}:${reason}`] as const),
      ),
    ),
  ].map(([reason, key]) => [key, reason] as const);
  const replacements = optionFeedback.flatMap((option, index) =>
    option.replacement === undefined
      ? []
      : [
          <p className="trait-option-replacement" key={OPTION_KEYS[index]}>
            Option {index + 1} replaces {option.replacement.replacedTraitLabel} ·{' '}
            {option.replacement.oldRarity} to {option.replacement.requiredRarity}
          </p>,
        ],
  );
  const offerNotes = interaction.offerNotes(value);
  const notes =
    replacements.length === 0 && offerNotes.length === 0 ? undefined : (
      <div className="trait-offer-feedback-item">
        {replacements}
        {offerNotes.map((note) => (
          <div className="trait-offer-note" key={note.traitKey}>
            <strong>{note.title}</strong>
            <p>{note.description}</p>
          </div>
        ))}
      </div>
    );
  const recoveryAction =
    recoveryDraft === undefined ? undefined : (
      <button
        className="quiet-action action-compact trait-offer-start-over"
        onClick={() => updateValue(recoveryDraft)}
        type="button"
      >
        Start over
      </button>
    );
  const resetAction =
    onReset === undefined ? undefined : (
      <button className="quiet-action action-compact" onClick={onReset} type="button">
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
                value.kind === 'chaos'
                  ? withRerolledScreens(value, [
                      ...earlierScreens,
                      rerolledChaosScreenSnapshot(value),
                    ])
                  : withFinalTraitScreenRerolled(value),
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
  const unsaveable = support === 'impossible' || !selectedOutcomeComplete;
  const save = {
    disabled: unsaveable || draftValueIdentity(value) === draftValueIdentity(interaction.value),
    label: value.kind === 'chaos' ? 'Save Chaos outcome' : 'Save trait offer',
    onClick: () => onCommit?.(value),
  };
  const draftIssues = [
    ...(atRestEntries ??
      (offerMessage === undefined ? outcomeEntries : [['offer', offerMessage], ...outcomeEntries])),
    ...optionIssues,
  ];
  const issues: readonly (readonly [string, string])[] =
    draftIssues.length > 0 || !unsaveable
      ? draftIssues
      : [
          [
            'incomplete',
            selectedOutcomeComplete ? 'Unavailable here' : 'Finish the selected outcome',
          ],
        ];
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
    // Each earlier screen keeps its own Rarify clicks.
    const updateScreen = (next: AuthoredTraitOffer): void =>
      replaceScreen(
        earlierIndex,
        next.kind !== 'traits'
          ? emptyScreen
          : Object.freeze({
              ...rerolledTraitScreenSnapshot(next),
              ...((next.rarificationActions ?? []).length === 0
                ? {}
                : { rarificationActions: next.rarificationActions }),
            }),
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
      <>
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
                  {screenValue.options.map((_, index) => {
                    const rowEffectiveRarity =
                      effectiveRarity(OPTION_KEYS[index]!, earlierIndex) ??
                      screenValue.options[index]?.rarity;
                    return (
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
                          rarifySupported={rarifySupported(OPTION_KEYS[index]!, earlierIndex)}
                          {...(rarifySource === undefined ? {} : { rarifySource })}
                          readOnly={earlierReadOnly}
                          {...(rowEffectiveRarity === undefined
                            ? {}
                            : { effectiveRarity: rowEffectiveRarity })}
                          {...(feedback.options[index]?.effectiveLevel === undefined
                            ? {}
                            : { effectiveLevel: feedback.options[index]!.effectiveLevel! })}
                          {...(feedback.options[index]?.persephoneLevelRolls === undefined
                            ? {}
                            : {
                                persephoneLevelRolls:
                                  feedback.options[index]!.persephoneLevelRolls!,
                              })}
                          {...levelSourceProps(feedback.options[index])}
                          rejected={screenValue.rejectedOptionKey === OPTION_KEYS[index]}
                          spellOffer={spellOffer}
                          value={screenValue}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )
          }
          issues={issues}
          notes={notes}
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
        {echoDialog}
      </>
    );
  }
  if (value.kind === 'traits') {
    return (
      <>
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
                  <div
                    data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0}
                    key={optionKey}
                  >
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
                      {...levelSourceProps(optionFeedback)}
                      rarifySupported={rarifySupported(optionKey)}
                      {...(rarifySource === undefined ? {} : { rarifySource })}
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
              echoLastRunBoonOpen={view === 'echoLastRunBoon'}
              onFeedback={reportOutcomeFeedback}
              onOpenEchoLastRunBoon={() => setView('echoLastRunBoon')}
              onTreeReset={setTreeReset}
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
          issues={issues}
          notes={notes}
          recovery={recoveryAction}
          {...(treeReset === undefined
            ? {}
            : {
                headerReset: {
                  disabled: treeReset.disabled,
                  onReset: () => updateValue(treeReset.value),
                },
              })}
          reset={resetAction}
          save={save}
          {...(screenTabs === undefined ? {} : { screenTabs })}
          {...(onCancel === undefined ? {} : { cancel: onCancel })}
        />
        {echoDialog}
      </>
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
      issues={issues}
      notes={notes}
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
