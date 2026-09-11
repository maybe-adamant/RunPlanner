import { optionIndex, type AuthoredTraitOfferTraits } from '@run-planner/engine/authored-project';
import { useEffect, useMemo } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type {
  WorkspaceCirceResolutionDomain,
  WorkspaceEchoLastRunBoonDomain,
  WorkspaceEchoPomTargetDomain,
  WorkspaceConcaveStoneDomain,
  WorkspaceHexTreeDomain,
  WorkspaceTraitAcquisitionTargetDomain,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TraitOfferCirceResolution } from './TraitOfferCirceResolution';
import { TraitOfferSelectedSpecialOutcomes } from './TraitOfferSelectedSpecialOutcomes';
import { HexTreeEditor } from './HexTreeEditor';

const emptyTargetPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

export function TraitOfferSelectedOutcome({
  interaction,
  value,
  onOpenEchoLastRunBoon,
  onUpdate,
  onConcaveStoneResult,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly value: AuthoredTraitOfferTraits;
  readonly onOpenEchoLastRunBoon: () => void;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
  readonly onConcaveStoneResult?: (
    offer: AuthoredTraitOfferTraits,
    result: import('@run-planner/engine/authored-project').AuthoredConcaveStoneResult | null,
  ) => void;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const selectedIndex = optionIndex(value.selectedOptionKey);
  const option = value.options[selectedIndex];
  if (option === undefined) throw new Error(`Trait offer is missing ${value.selectedOptionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, value.selectedOptionKey),
    [interaction, value],
  );
  const targetChild = loadable.children.find(
    (
      child,
    ): child is Extract<
      typeof child,
      { readonly child: { readonly kind: 'traitAcquisitionTarget' } }
    > => child.child.kind === 'traitAcquisitionTarget',
  );
  const circeChild = loadable.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'circeResolution' } }> =>
      child.child.kind === 'circeResolution',
  );
  const echoPomChild = loadable.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'echoPomTarget' } }> =>
      child.child.kind === 'echoPomTarget',
  );
  const echoLastRunChild = loadable.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'echoLastRunBoon' } }> =>
      child.child.kind === 'echoLastRunBoon',
  );
  const concaveStoneChild = loadable.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'concaveStone' } }> =>
      child.child.kind === 'concaveStone',
  );
  const hexTreeChild = loadable.children.find(
    (child): child is Extract<typeof child, { readonly child: { readonly kind: 'hexTree' } }> =>
      child.child.kind === 'hexTree',
  );
  const targetLoadable = useMemo(() => targetChild?.forOffer(value), [targetChild, value]);
  const targetController = useWorkspaceInteractionController<
    WorkspaceTraitAcquisitionTargetDomain | undefined
  >();
  const targetDomain = targetController.observe(targetLoadable);
  const circeLoadable = useMemo(() => circeChild?.forOffer(value), [circeChild, value]);
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeDomain = circeController.observe(circeLoadable);
  const echoPomLoadable = useMemo(() => echoPomChild?.forOffer(value), [echoPomChild, value]);
  const echoPomController = useWorkspaceInteractionController<
    WorkspaceEchoPomTargetDomain | undefined
  >();
  const echoPomDomain = echoPomController.observe(echoPomLoadable);
  const echoLastRunLoadable = useMemo(
    () =>
      echoLastRunChild === undefined || option.echoLastRunBoon === undefined
        ? undefined
        : echoLastRunChild.forOffer(value),
    [echoLastRunChild, option.echoLastRunBoon, value],
  );
  const echoLastRunController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const echoLastRunDomain = echoLastRunController.observe(echoLastRunLoadable);
  const concaveStoneLoadable = useMemo(
    () => concaveStoneChild?.forOffer(value),
    [concaveStoneChild, value],
  );
  const concaveStoneController = useWorkspaceInteractionController<
    WorkspaceConcaveStoneDomain | undefined
  >();
  const concaveStoneDomain = concaveStoneController.observe(concaveStoneLoadable);
  const hexTreeLoadable = useMemo(() => hexTreeChild?.forOffer(value), [hexTreeChild, value]);
  const hexTreeController = useWorkspaceInteractionController<WorkspaceHexTreeDomain | undefined>();
  const hexTreeDomain = hexTreeController.observe(hexTreeLoadable);
  useEffect(() => {
    if (targetLoadable !== undefined) targetController.activate(targetLoadable);
    if (circeLoadable !== undefined) circeController.activate(circeLoadable);
    if (echoPomLoadable !== undefined) echoPomController.activate(echoPomLoadable);
    if (echoLastRunLoadable !== undefined) echoLastRunController.activate(echoLastRunLoadable);
    if (concaveStoneLoadable !== undefined) concaveStoneController.activate(concaveStoneLoadable);
    if (hexTreeLoadable !== undefined) hexTreeController.activate(hexTreeLoadable);
  }, [
    concaveStoneController,
    concaveStoneLoadable,
    circeController,
    circeLoadable,
    echoLastRunController,
    echoLastRunLoadable,
    echoPomController,
    echoPomLoadable,
    hexTreeController,
    hexTreeLoadable,
    loadable,
    targetController,
    targetLoadable,
  ]);

  const selectedTraitLabel = interaction.traitLabel(option.traitKey);
  const isHexOutcome = hexTreeChild !== undefined;
  const feedback = interaction.feedbackFor(value);
  const hasOutcome =
    targetChild !== undefined ||
    circeChild !== undefined ||
    echoPomChild !== undefined ||
    echoLastRunChild !== undefined ||
    feedback.length > 0 ||
    loadable.children.some(
      (child) => child.child.kind !== 'concaveStone' || child.child.value !== undefined,
    ) ||
    concaveStoneDomain.result !== undefined ||
    hexTreeDomain.result !== undefined;
  if (!hasOutcome) return null;
  return (
    <section aria-label="Selected trait outcome" className="trait-selected-outcome">
      <h3>{isHexOutcome ? `Customize Hex · ${selectedTraitLabel}` : 'Selected trait outcome'}</h3>
      {isHexOutcome ? null : <p className="trait-selected-outcome-name">{selectedTraitLabel}</p>}
      {hexTreeChild === undefined || hexTreeDomain.result === undefined ? null : (
        <HexTreeEditor
          domain={hexTreeDomain.result}
          address={hexTreeChild.child.address}
          transitionFor={(layoutKey) => hexTreeChild.transitionFor(value, layoutKey)}
          onChange={(hexTree) => onUpdate(hexTreeChild.update(value, hexTree))}
        />
      )}
      {targetChild === undefined ? null : (
        <ContextualPicker
          findingTarget={findingTarget(targetChild.child.address)}
          ariaLabel={`${value.selectedOptionKey} acquisition target`}
          id={semanticOwnerControlElementId(targetChild.child.address)}
          label="Target"
          loading={targetDomain.pending}
          model={targetDomain.result?.targetPicker ?? emptyTargetPicker}
          onSelect={(targetTraitKey) => onUpdate(targetChild.update(value, targetTraitKey))}
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {circeChild === undefined || circeDomain.result === undefined ? null : (
        <TraitOfferCirceResolution
          findingTarget={findingTarget(circeChild.child.address)}
          controlId={semanticOwnerControlElementId(circeChild.child.address)}
          domain={circeDomain.result}
          option={option}
          onSelect={(resolution) => onUpdate(circeChild.update(value, resolution))}
        />
      )}
      {echoPomChild === undefined || echoPomDomain.result === undefined ? null : (
        <ContextualPicker
          findingTarget={findingTarget(echoPomChild.child.address)}
          ariaLabel="Pom Pom Pom target"
          id={semanticOwnerControlElementId(echoPomChild.child.address)}
          label="Greatest-level target"
          model={echoPomDomain.result.picker}
          onSelect={(echoPomTarget) => onUpdate(echoPomChild.update(value, echoPomTarget))}
          placeholder={
            echoPomDomain.result.emptyNoOpAllowed
              ? 'Choose target or no target'
              : 'Choose a greatest-level trait'
          }
          {...('echoPomTarget' in option && option.echoPomTarget !== undefined
            ? {
                triggerLabel:
                  pickerValueLabel(echoPomDomain.result.picker, option.echoPomTarget) ??
                  String(option.echoPomTarget),
              }
            : {})}
        />
      )}
      {echoLastRunChild === undefined ? null : (
        <div className="trait-dependent-choice-row">
          <div>
            <h4>Boon Boon Boon choice</h4>
            <p>
              {option.echoLastRunBoon === undefined
                ? 'Choose the boon Echo grants before room chronology continues.'
                : (echoLastRunDomain.result?.summaryFor(option.echoLastRunBoon) ??
                  (echoLastRunDomain.pending
                    ? 'Evaluating Boon Boon Boon choice…'
                    : 'Boon Boon Boon summary unavailable'))}
            </p>
          </div>
          <button
            {...findingTarget(echoLastRunChild.child.address)}
            className="quiet-action action-compact"
            onClick={onOpenEchoLastRunBoon}
            type="button"
          >
            {option.echoLastRunBoon === undefined ? 'Choose' : 'Edit choice'}
          </button>
        </div>
      )}
      {feedback
        .filter((entry) => entry.kind === 'echoLastReward')
        .map(({ control }) => (
          <fieldset
            key={semanticOwnerControlElementId(control.address)}
            className="trait-circe-resolution"
          >
            <legend>Reward Reward Reward replay</legend>
            <p>Spawns: {control.spawnLabel ?? 'Replay source unavailable'}</p>
            <button
              className="quiet-action"
              onClick={() => {
                const acquisitionEntry = control.acquisitionEntry;
                dispatch(traitOfferDialogClosed());
                window.setTimeout(() => {
                  document.getElementById(semanticOwnerControlElementId(acquisitionEntry))?.focus();
                }, 0);
              }}
              type="button"
            >
              Configure in Room Timeline
            </button>
          </fieldset>
        ))}
      <TraitOfferSelectedSpecialOutcomes
        carrierChildren={loadable.children}
        feedback={feedback}
        interaction={interaction}
        offer={value}
        optionIndex={selectedIndex}
        onUpdate={onUpdate}
        concaveStone={
          concaveStoneChild === undefined || concaveStoneDomain.result === undefined
            ? undefined
            : { interaction: concaveStoneChild, domain: concaveStoneDomain.result }
        }
        {...(onConcaveStoneResult === undefined ? {} : { onConcaveStoneResult })}
      />
      {concaveStoneChild === undefined ||
      concaveStoneDomain.result !== undefined ||
      concaveStoneChild.child.value === undefined ? null : (
        <fieldset className="trait-selected-outcome-detail" aria-label="Concave Stone outcome">
          <legend>Concave Stone</legend>
          <p>This retained Stone outcome cannot be assessed in the current route context.</p>
          <button
            className="quiet-action action-compact"
            onClick={() => {
              onUpdate(concaveStoneChild.update(value, null));
              onConcaveStoneResult?.(value, null);
            }}
            type="button"
          >
            Clear retained Concave Stone result
          </button>
        </fieldset>
      )}
    </section>
  );
}
