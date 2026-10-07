import { optionIndex, type AuthoredTraitOfferTraits } from '@run-planner/engine/authored-project';
import { useEffect, useMemo } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type {
  WorkspaceCirceResolutionDomain,
  WorkspaceEchoLastRunBoonDomain,
  WorkspaceEchoPomTargetDomain,
  WorkspaceConcaveStoneDomain,
  WorkspaceHexTreeDomain,
  WorkspaceTraitAcquisitionTargetDomain,
  WorkspaceLatestModelTargetsDomain,
  WorkspaceTraitCarrierChildInteraction,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  useFindingTarget,
  type FindingMarkProps,
  type FindingTargetProps,
} from '@planner/ui/feedback/useFindingTarget';
import { TraitOfferCirceResolution } from './TraitOfferCirceResolution';
import {
  ConcaveStoneOutcomeEditor,
  TraitOfferSelectedSpecialOutcomes,
} from './TraitOfferSelectedSpecialOutcomes';
import { HexTreeEditor } from './HexTreeEditor';
import { SelectedOutcomeBlock, SelectedOutcomeRow } from './SelectedOutcomeBlock';
import {
  ignoreOutcomeFeedback,
  useReportedFeedback,
  type OutcomeFeedbackReporter,
} from './TraitOfferForm';
import { circeUnavailableMessage } from './traitOfferOptions';

const emptyTargetPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

export function TraitAcquisitionTargetOutcome({
  controlId,
  findingMark,
  findingTarget,
  ariaLabel,
  loadable,
  onSelect,
  targetTraitKey,
  traitLabel,
}: {
  readonly controlId: string;
  readonly findingMark?: FindingMarkProps;
  readonly findingTarget?: FindingTargetProps;
  readonly ariaLabel: string;
  readonly loadable: { readonly load: () => WorkspaceTraitAcquisitionTargetDomain | undefined };
  readonly onSelect: (targetTraitKey: string) => void;
  readonly targetTraitKey?: string;
  readonly traitLabel: (traitKey: string) => string;
}) {
  const controller = useWorkspaceInteractionController<
    WorkspaceTraitAcquisitionTargetDomain | undefined
  >();
  const domain = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return (
    <ContextualPicker
      {...(findingTarget === undefined ? {} : { findingTarget })}
      {...(findingMark === undefined ? {} : { findingMark })}
      ariaLabel={ariaLabel}
      id={controlId}
      label="Target"
      layout="inline"
      loading={domain.pending}
      model={domain.result?.targetPicker ?? emptyTargetPicker}
      onSelect={onSelect}
      placeholder="Choose an equipped trait"
      {...(targetTraitKey === undefined ? {} : { triggerLabel: traitLabel(targetTraitKey) })}
    />
  );
}

function BoundTraitAcquisitionTargetOutcome({
  child,
  findingTarget,
  interaction,
  onUpdate,
  value,
}: {
  readonly child: Extract<
    WorkspaceTraitCarrierChildInteraction,
    { readonly child: { readonly kind: 'traitAcquisitionTarget' } }
  >;
  readonly findingTarget: FindingTargetProps;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
  readonly value: AuthoredTraitOfferTraits;
}) {
  const loadable = useMemo(() => child.forOffer(value), [child, value]);
  const targetTraitKey = value.options[optionIndex(child.child.optionKey)]?.targetTraitKey;
  return (
    <TraitAcquisitionTargetOutcome
      controlId={semanticOwnerControlElementId(child.child.address)}
      findingTarget={findingTarget}
      ariaLabel={`${child.child.optionKey} acquisition target`}
      loadable={loadable}
      onSelect={(nextTargetTraitKey) => onUpdate(child.update(value, nextTargetTraitKey))}
      {...(targetTraitKey === undefined ? {} : { targetTraitKey })}
      traitLabel={interaction.traitLabel}
    />
  );
}

function LatestModelTargetsOutcome({
  child,
  findingTarget,
  interaction,
  onFeedback,
  onUpdate,
  value,
}: {
  readonly child: Extract<
    WorkspaceTraitCarrierChildInteraction,
    { readonly child: { readonly kind: 'latestModelTargets' } }
  >;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly findingTarget: FindingTargetProps;
  readonly onFeedback: OutcomeFeedbackReporter;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
  readonly value: AuthoredTraitOfferTraits;
}) {
  const loadable = useMemo(() => child.forOffer(value), [child, value]);
  const controller = useWorkspaceInteractionController<
    WorkspaceLatestModelTargetsDomain | undefined
  >();
  const domain = controller.observe(loadable);
  const current = value.options[optionIndex(child.child.optionKey)]?.icarusHammerTargets ?? [];
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  useReportedFeedback(
    onFeedback,
    'latestModelTargets',
    domain.result !== undefined && !domain.result.branchAgreement
      ? 'No target count is supported across every route branch.'
      : undefined,
  );
  if (domain.result === undefined) return null;
  const result = domain.result;
  return (
    <>
      {result.hammers.map((row, index) => (
        <ContextualPicker
          key={index}
          {...(index === 0 ? { findingTarget } : {})}
          ariaLabel={`Latest Model Hammer ${index + 1}`}
          id={`${semanticOwnerControlElementId(child.child.address)}${index === 0 ? '' : `-${index + 1}`}`}
          label={`Hammer ${index + 1}`}
          layout="inline"
          disabled={!result.branchAgreement}
          {...(row.requiresEarlierRow ? { disabledTitle: `Choose Hammer ${index} first` } : {})}
          model={row.picker}
          onSelect={(target: string) => {
            const targets = row.valueByTraitKey[target];
            if (targets !== undefined) onUpdate(child.update(value, targets));
          }}
          placeholder="Choose a Rank I Hammer"
          {...(current[index] === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(current[index]) })}
        />
      ))}
    </>
  );
}

export function TraitOfferSelectedOutcome({
  interaction,
  value,
  onFeedback = ignoreOutcomeFeedback,
  onOpenEchoLastRunBoon,
  onUpdate,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly value: AuthoredTraitOfferTraits;
  readonly onFeedback?: OutcomeFeedbackReporter;
  readonly onOpenEchoLastRunBoon: () => void;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const findingTarget = useFindingTarget();
  const selectedIndex = optionIndex(value.selectedOptionKey);
  const option = value.options[selectedIndex];
  if (option === undefined) throw new Error(`Trait offer is missing ${value.selectedOptionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, value.selectedOptionKey),
    [interaction, value],
  );
  const { primaryChildren, stoneChildren, targetChildren } = useMemo(() => {
    const targets = loadable.children.filter(
      (
        child,
      ): child is Extract<
        typeof child,
        { readonly child: { readonly kind: 'traitAcquisitionTarget' } }
      > => child.child.kind === 'traitAcquisitionTarget',
    );
    const stone = loadable.children.filter(
      ({ child }) => 'optionKey' in child && child.optionKey !== value.selectedOptionKey,
    );
    return Object.freeze({
      primaryChildren: Object.freeze(loadable.children.filter((child) => !stone.includes(child))),
      stoneChildren: Object.freeze(stone),
      targetChildren: Object.freeze(targets),
    });
  }, [loadable, value.selectedOptionKey]);
  const circeChild = loadable.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'circeResolution' } }> =>
      child.child.kind === 'circeResolution',
  );
  const latestModelChild = loadable.children.find(
    (
      child,
    ): child is Extract<
      typeof child,
      { readonly child: { readonly kind: 'latestModelTargets' } }
    > => child.child.kind === 'latestModelTargets',
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
  ]);

  const retainedStoneUnassessed =
    concaveStoneChild !== undefined &&
    concaveStoneDomain.result === undefined &&
    concaveStoneChild.child.value !== undefined;
  useReportedFeedback(
    onFeedback,
    'circeResolution',
    circeChild === undefined ? undefined : circeUnavailableMessage(circeDomain.result),
  );
  useReportedFeedback(
    onFeedback,
    'concaveStone',
    retainedStoneUnassessed
      ? 'This retained Stone outcome cannot be assessed in the current route context.'
      : undefined,
  );
  const selectedTraitLabel = interaction.traitLabel(option.traitKey);
  const feedback = interaction.feedbackFor(value);
  const pickHasOutcome =
    primaryChildren.some((child) => child.child.kind !== 'concaveStone') ||
    feedback.length > 0 ||
    hexTreeDomain.result !== undefined;
  const stoneHasOutcome = concaveStoneDomain.result !== undefined || retainedStoneUnassessed;
  if (!pickHasOutcome && !stoneHasOutcome) return null;
  const pickBlock = (
    <SelectedOutcomeBlock name="Selected trait outcome" traitLabel={selectedTraitLabel}>
      {hexTreeChild === undefined || hexTreeDomain.result === undefined ? null : (
        <HexTreeEditor
          framed={false}
          domain={hexTreeDomain.result}
          address={hexTreeChild.child.address}
          transitionFor={(layoutKey) => hexTreeChild.transitionFor(value, layoutKey)}
          onChange={(hexTree) => onUpdate(hexTreeChild.update(value, hexTree))}
        />
      )}
      {targetChildren
        .filter((child) => primaryChildren.includes(child))
        .map((child) => (
          <BoundTraitAcquisitionTargetOutcome
            child={child}
            findingTarget={findingTarget(child.child.address)}
            key={semanticOwnerControlElementId(child.child.address)}
            interaction={interaction}
            onUpdate={onUpdate}
            value={value}
          />
        ))}
      {latestModelChild === undefined ? null : (
        <LatestModelTargetsOutcome
          key={semanticOwnerControlElementId(latestModelChild.child.address)}
          child={latestModelChild}
          findingTarget={findingTarget(latestModelChild.child.address)}
          interaction={interaction}
          onFeedback={onFeedback}
          onUpdate={onUpdate}
          value={value}
        />
      )}
      {circeChild === undefined ? null : (
        <TraitOfferCirceResolution
          address={circeChild.child.address}
          key={semanticOwnerControlElementId(circeChild.child.address)}
          findingTarget={findingTarget(circeChild.child.address)}
          controlId={semanticOwnerControlElementId(circeChild.child.address)}
          domain={circeDomain.result}
          keyLabel={circeChild.keyLabel}
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
          layout="inline"
          model={echoPomDomain.result.picker}
          onSelect={(echoPomTarget) => onUpdate(echoPomChild.update(value, echoPomTarget))}
          placeholder={
            echoPomDomain.result.emptyNoOpAllowed
              ? 'Choose target or no target'
              : 'Choose a greatest-level trait'
          }
          {...('echoPomTarget' in option && option.echoPomTarget !== undefined
            ? { triggerLabel: echoPomChild.targetLabel(option.echoPomTarget) }
            : {})}
        />
      )}
      {echoLastRunChild === undefined ? null : (
        <SelectedOutcomeRow label="Boon Boon Boon">
          <button
            {...findingTarget(echoLastRunChild.child.address)}
            aria-label="Boon Boon Boon choice"
            className="contextual-picker-trigger"
            onClick={onOpenEchoLastRunBoon}
            type="button"
          >
            <span>
              {option.echoLastRunBoon === undefined
                ? 'Choose a boon'
                : (echoLastRunDomain.result?.summaryFor(option.echoLastRunBoon) ??
                  (echoLastRunDomain.pending ? 'Evaluating…' : '—'))}
            </span>
          </button>
        </SelectedOutcomeRow>
      )}
      <TraitOfferSelectedSpecialOutcomes
        carrierChildren={primaryChildren}
        feedback={feedback}
        interaction={interaction}
        offer={value}
        onFeedback={onFeedback}
        onUpdate={onUpdate}
      />
    </SelectedOutcomeBlock>
  );
  return (
    <>
      {pickHasOutcome ? pickBlock : null}
      {concaveStoneChild === undefined || concaveStoneDomain.result === undefined ? null : (
        <ConcaveStoneOutcomeEditor
          domain={concaveStoneDomain.result}
          interaction={concaveStoneChild}
          offer={value}
          traitLabel={interaction.traitLabel}
          onSelect={(result) => onUpdate(concaveStoneChild.update(value, result))}
        >
          {stoneChildren.length === 0 ? null : (
            <>
              {targetChildren
                .filter((child) => stoneChildren.includes(child))
                .map((child) => (
                  <BoundTraitAcquisitionTargetOutcome
                    child={child}
                    findingTarget={findingTarget(child.child.address)}
                    key={semanticOwnerControlElementId(child.child.address)}
                    interaction={interaction}
                    onUpdate={onUpdate}
                    value={value}
                  />
                ))}
              <TraitOfferSelectedSpecialOutcomes
                carrierChildren={stoneChildren}
                feedback={[]}
                interaction={interaction}
                offer={value}
                onFeedback={onFeedback}
                onUpdate={onUpdate}
              />
            </>
          )}
        </ConcaveStoneOutcomeEditor>
      )}
      {!retainedStoneUnassessed ? null : (
        <section aria-label="Concave Stone outcome" className="trait-selected-outcome" role="group">
          <h3>Concave Stone</h3>
          <button
            className="quiet-action action-compact"
            onClick={() => {
              onUpdate(concaveStoneChild.update(value, null));
            }}
            type="button"
          >
            Clear retained Concave Stone result
          </button>
        </section>
      )}
    </>
  );
}
