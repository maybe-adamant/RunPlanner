import { optionIndex, type AuthoredTraitOfferTraits } from '@run-planner/engine/authored-project';
import { useEffect, useMemo } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/traitDomainProjection';
import type {
  WorkspaceCirceResolutionDomain,
  WorkspaceEchoLastRunBoonDomain,
  WorkspaceEchoPomTargetDomain,
  WorkspaceConcaveStoneDomain,
  WorkspaceHexTreeDomain,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { TraitOfferCirceResolution } from './TraitOfferCirceResolution';
import { replaceTraitOfferOption } from './traitOfferOptions';
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
  const dispatch = useAppDispatch();
  const selectedIndex = optionIndex(value.selectedOptionKey);
  const option = value.options[selectedIndex];
  if (option === undefined) throw new Error(`Trait offer is missing ${value.selectedOptionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, value.selectedOptionKey),
    [interaction, value],
  );
  const optionController = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const optionDomain = optionController.observe(loadable);
  const circeLoadable = useMemo(
    () => loadable.circeResolution?.forOffer(value),
    [loadable.circeResolution, value],
  );
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeDomain = circeController.observe(circeLoadable);
  const echoPomLoadable = useMemo(
    () => loadable.echoPomTarget?.forOffer(value),
    [loadable.echoPomTarget, value],
  );
  const echoPomController = useWorkspaceInteractionController<
    WorkspaceEchoPomTargetDomain | undefined
  >();
  const echoPomDomain = echoPomController.observe(echoPomLoadable);
  const echoLastRunLoadable = useMemo(
    () =>
      loadable.echoLastRunBoon === undefined || option.echoLastRunBoon === undefined
        ? undefined
        : loadable.echoLastRunBoon.forOffer(value),
    [loadable.echoLastRunBoon, option.echoLastRunBoon, value],
  );
  const echoLastRunController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const echoLastRunDomain = echoLastRunController.observe(echoLastRunLoadable);
  const concaveStoneLoadable = useMemo(
    () => loadable.concaveStone?.forOffer(value),
    [loadable.concaveStone, value],
  );
  const concaveStoneController = useWorkspaceInteractionController<
    WorkspaceConcaveStoneDomain | undefined
  >();
  const concaveStoneDomain = concaveStoneController.observe(concaveStoneLoadable);
  const hexTreeLoadable = useMemo(
    () => loadable.hexTree?.forOffer(value),
    [loadable.hexTree, value],
  );
  const hexTreeController = useWorkspaceInteractionController<WorkspaceHexTreeDomain | undefined>();
  const hexTreeDomain = hexTreeController.observe(hexTreeLoadable);
  useEffect(() => {
    if (loadable.hasTargetPicker) optionController.activate(loadable);
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
    optionController,
  ]);

  const targetDomain = optionDomain.result;
  const selectedTraitLabel = interaction.traitLabel(option.traitKey);
  const isHexOutcome = loadable.hexTree !== undefined;
  const hasOutcome =
    loadable.hasTargetPicker ||
    loadable.circeResolution !== undefined ||
    loadable.echoPomTarget !== undefined ||
    loadable.echoLastRunBoon !== undefined ||
    interaction.echoLastReward !== undefined ||
    loadable.allTogetherSets !== undefined ||
    loadable.naturalSelection !== undefined ||
    concaveStoneDomain.result !== undefined ||
    hexTreeDomain.result !== undefined ||
    interaction.ransomAssessment(value) !== undefined;
  if (!hasOutcome) return null;
  return (
    <section aria-label="Selected trait outcome" className="trait-selected-outcome">
      <h3>{isHexOutcome ? `Customize Hex · ${selectedTraitLabel}` : 'Selected trait outcome'}</h3>
      {isHexOutcome ? null : <p className="trait-selected-outcome-name">{selectedTraitLabel}</p>}
      {loadable.hexTree === undefined || hexTreeDomain.result === undefined ? null : (
        <HexTreeEditor
          domain={hexTreeDomain.result}
          address={loadable.hexTree.control.address}
          transitionFor={(layoutKey) => loadable.hexTree!.transitionFor(value, layoutKey)}
          onChange={(hexTree) => onUpdate({ ...value, hexTree })}
        />
      )}
      {loadable.traitAcquisitionTarget === undefined ? null : (
        <ContextualPicker
          ariaLabel={`${value.selectedOptionKey} acquisition target`}
          id={semanticOwnerControlElementId(loadable.traitAcquisitionTarget.address)}
          label="Target"
          loading={optionDomain.pending}
          model={targetDomain?.targetPicker ?? emptyTargetPicker}
          onSelect={(targetTraitKey) =>
            onUpdate(replaceTraitOfferOption(value, selectedIndex, { ...option, targetTraitKey }))
          }
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {loadable.circeResolution === undefined || circeDomain.result === undefined ? null : (
        <TraitOfferCirceResolution
          controlId={semanticOwnerControlElementId(loadable.circeResolution.control.address)}
          domain={circeDomain.result}
          option={option}
          onSelect={(resolution) =>
            onUpdate(
              replaceTraitOfferOption(value, selectedIndex, {
                ...option,
                circeResolution: resolution,
              }),
            )
          }
        />
      )}
      {loadable.echoPomTarget === undefined || echoPomDomain.result === undefined ? null : (
        <ContextualPicker
          ariaLabel="Pom Pom Pom target"
          id={semanticOwnerControlElementId(loadable.echoPomTarget.control.address)}
          label="Greatest-level target"
          model={echoPomDomain.result.picker}
          onSelect={(echoPomTarget) =>
            onUpdate(replaceTraitOfferOption(value, selectedIndex, { ...option, echoPomTarget }))
          }
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
      {loadable.echoLastRunBoon === undefined ? null : (
        <div
          className="trait-dependent-choice-row"
          id={semanticOwnerControlElementId(loadable.echoLastRunBoon.control.address)}
        >
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
            className="quiet-action action-compact"
            onClick={onOpenEchoLastRunBoon}
            type="button"
          >
            {option.echoLastRunBoon === undefined ? 'Choose' : 'Edit choice'}
          </button>
        </div>
      )}
      {interaction.echoLastReward === undefined ? null : (
        <fieldset className="trait-circe-resolution">
          <legend>Reward Reward Reward replay</legend>
          <p>Spawns: {interaction.echoLastReward.spawnLabel ?? 'Replay source unavailable'}</p>
          <button
            className="quiet-action"
            onClick={() => {
              const acquisitionEntry = interaction.echoLastReward!.acquisitionEntry;
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
      )}
      <TraitOfferSelectedSpecialOutcomes
        allTogetherSets={loadable.allTogetherSets}
        interaction={interaction}
        naturalSelection={loadable.naturalSelection}
        offer={value}
        option={option}
        optionIndex={selectedIndex}
        onUpdate={onUpdate}
        concaveStone={
          loadable.concaveStone === undefined || concaveStoneDomain.result === undefined
            ? undefined
            : { interaction: loadable.concaveStone, domain: concaveStoneDomain.result }
        }
        {...(onConcaveStoneResult === undefined ? {} : { onConcaveStoneResult })}
      />
    </section>
  );
}
