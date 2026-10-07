import {
  optionIndex,
  type AuthoredConcaveStoneResult,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import { useMemo, type ReactNode } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  type WorkspaceConcaveStoneDomain,
  type WorkspaceConcaveStoneInteraction,
  type WorkspaceTraitCarrierChildInteraction,
  type WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingMark, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { SelectedOutcomeRow } from './SelectedOutcomeBlock';
import { AllTogetherOutcomeRows, NaturalSelectionOutcomeRows } from './TraitOfferOutcomeRows';
import {
  ignoreOutcomeFeedback,
  useReportedFeedback,
  type OutcomeFeedbackReporter,
} from './TraitOfferForm';
import { naturalSelectionOptionWithTargets, replaceTraitOfferOption } from './traitOfferOptions';

export function ConcaveStoneOutcomeEditor({
  interaction,
  domain,
  offer,
  traitLabel,
  onSelect,
  children,
}: {
  readonly interaction: WorkspaceConcaveStoneInteraction;
  readonly domain: WorkspaceConcaveStoneDomain;
  readonly offer: AuthoredTraitOfferTraits;
  readonly traitLabel: (traitKey: string) => string;
  readonly onSelect: (result: AuthoredConcaveStoneResult | null) => void;
  readonly children: ReactNode;
}) {
  const findingMark = useFindingMark();
  const authoredResult = offer.concaveStoneResult;
  const authoredOptionKey = authoredResult?.kind === 'proc' ? authoredResult.optionKey : undefined;
  const authoredOption =
    authoredOptionKey === undefined ? undefined : offer.options[optionIndex(authoredOptionKey)];
  const authoredOptionIsResidual =
    authoredOptionKey !== undefined && domain.residualOptionKeys.includes(authoredOptionKey);
  const procced = authoredResult?.kind === 'proc';
  const pickerItems = domain.residualOptionKeys.map((optionKey) => {
    const option = offer.options[optionIndex(optionKey)];
    return Object.freeze({
      key: optionKey,
      value: optionKey,
      label: option === undefined ? optionKey : traitLabel(option.traitKey),
      state: domain.required ? ('forced' as const) : ('possible' as const),
      selected: authoredOptionIsResidual && authoredOptionKey === optionKey,
      disabled: false,
    });
  });
  const selectedInvalid =
    procced && !authoredOptionIsResidual && authoredOptionKey !== undefined
      ? Object.freeze({
          key: authoredOptionKey,
          value: authoredOptionKey,
          label:
            authoredOption === undefined ? authoredOptionKey : traitLabel(authoredOption.traitKey),
          state: 'impossible' as const,
          selected: true,
          disabled: true,
          status: 'Current · unavailable',
        })
      : undefined;
  const picker: ContextualPickerModel<TraitOptionKey> = Object.freeze({
    ...(selectedInvalid === undefined ? {} : { selected: selectedInvalid }),
    sections: Object.freeze([
      ...(selectedInvalid === undefined
        ? []
        : [
            Object.freeze({
              key: 'selected-invalid',
              kind: 'selectedInvalid' as const,
              label: 'Current selection',
              collapsible: false,
              items: Object.freeze([selectedInvalid]),
            }),
          ]),
      Object.freeze({
        key: 'residual',
        kind: 'category' as const,
        label: 'Unpicked boons',
        collapsible: false,
        items: Object.freeze(pickerItems),
      }),
    ]),
  });
  const selectedLabel =
    authoredOptionIsResidual && authoredOption !== undefined
      ? traitLabel(authoredOption.traitKey)
      : undefined;
  const onToggle = (checked: boolean): void => {
    if (checked) {
      const optionKey = authoredOptionIsResidual ? authoredOptionKey : domain.residualOptionKeys[0];
      if (optionKey !== undefined) onSelect({ kind: 'proc', optionKey });
      return;
    }
    onSelect({ kind: 'noProc' });
  };
  return (
    <section className="trait-selected-outcome" role="group" aria-label="Concave Stone outcome">
      <h3>Concave Stone · {domain.procSupport}%</h3>
      <SelectedOutcomeRow label="Activated">
        <input
          aria-label="Concave Stone Activated"
          checked={procced || domain.required}
          disabled={domain.required}
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />
      </SelectedOutcomeRow>
      <ContextualPicker
        ariaLabel="Concave Stone target"
        findingMark={findingMark(interaction.child.address, 'concaveStoneTarget')}
        id={`${semanticOwnerControlElementId(interaction.child.address)}-picker`}
        label="Grants"
        layout="inline"
        {...(procced || domain.required
          ? {}
          : { disabledTitle: 'Activate the Concave Stone first' })}
        model={picker}
        onSelect={(optionKey) => onSelect({ kind: 'proc', optionKey })}
        placeholder="Choose an unpicked boon"
        {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
      />
      {authoredResult === undefined || domain.resultSupport !== 'impossible' ? null : (
        <button
          className="quiet-action action-compact"
          onClick={() => onSelect(null)}
          type="button"
        >
          Clear unavailable Concave Stone result
        </button>
      )}
      {!procced && !domain.required ? null : (
        // The granted trait's own follow-ups belong under its Grants row.
        <div className="trait-outcome-nested">{children}</div>
      )}
    </section>
  );
}

export function TraitOfferSelectedSpecialOutcomes({
  interaction,
  offer,
  carrierChildren,
  feedback,
  onFeedback = ignoreOutcomeFeedback,
  onUpdate,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly carrierChildren: readonly WorkspaceTraitCarrierChildInteraction[];
  readonly feedback: readonly import('@planner/projections/structured-workspace').WorkspaceTraitOfferFeedback[];
  readonly onFeedback?: OutcomeFeedbackReporter;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const findingTarget = useFindingTarget();
  const ransomAssessment = feedback.find((entry) => entry.kind === 'ransom')?.assessment;
  useReportedFeedback(
    onFeedback,
    'ransom',
    ransomAssessment !== undefined && !ransomAssessment.branchAgreement
      ? 'Ransom result differs across current route branches.'
      : undefined,
  );
  const allTogetherGroups = useMemo(() => {
    const allTogetherSets = carrierChildren.filter(
      (
        child,
      ): child is Extract<
        WorkspaceTraitCarrierChildInteraction,
        { readonly child: { readonly kind: 'allTogetherSet' } }
      > => child.child.kind === 'allTogetherSet',
    );
    return [
      ...new Map(
        allTogetherSets.map((child) => [
          child.child.optionKey,
          allTogetherSets.filter(
            (candidate) => candidate.child.optionKey === child.child.optionKey,
          ),
        ]),
      ).values(),
    ];
  }, [carrierChildren]);
  const allTogetherBindings = useMemo(
    () =>
      allTogetherGroups.map((interactions) =>
        Object.freeze({
          key: interactions[0]!.child.optionKey,
          interactions,
          loaders: Object.freeze(
            interactions.map((interaction) =>
              Object.freeze({
                controlId: semanticOwnerControlElementId(interaction.child.address),
                loadable: interaction.forOffer(offer),
                resultLabel: interaction.resultLabel,
                setKey: interaction.child.setKey,
              }),
            ),
          ),
        }),
      ),
    [allTogetherGroups, offer],
  );
  const naturalSelections = useMemo(
    () =>
      carrierChildren.filter(
        (
          child,
        ): child is Extract<
          WorkspaceTraitCarrierChildInteraction,
          { readonly child: { readonly kind: 'naturalSelectionResult' } }
        > => child.child.kind === 'naturalSelectionResult',
      ),
    [carrierChildren],
  );
  const naturalSelectionBindings = useMemo(
    () =>
      naturalSelections.map((naturalSelection) => {
        const position = optionIndex(naturalSelection.child.optionKey);
        const option = offer.options[position];
        return Object.freeze({
          controlId: semanticOwnerControlElementId(naturalSelection.child.address),
          authored: option?.naturalSelectionTargets,
          clear: () =>
            option === undefined
              ? offer
              : replaceTraitOfferOption(
                  offer,
                  position,
                  naturalSelectionOptionWithTargets(option, []),
                ),
          key: naturalSelection.child.optionKey,
          loadableFor: (targets: readonly string[]) => {
            const draftOffer =
              option === undefined
                ? offer
                : replaceTraitOfferOption(
                    offer,
                    position,
                    naturalSelectionOptionWithTargets(option, targets),
                  );
            return naturalSelection.forOffer(draftOffer);
          },
          naturalSelection,
          traitLabel: naturalSelection.traitLabel,
        });
      }),
    [naturalSelections, offer],
  );
  return (
    <>
      {allTogetherBindings.map((binding) => (
        <AllTogetherOutcomeRows
          authored={offer.options[optionIndex(binding.key)]?.allTogetherResult}
          key={binding.key}
          rows={binding.loaders.map((loader, index) => ({
            ...loader,
            findingTarget: findingTarget(binding.interactions[index]!.child.address),
          }))}
          onSelect={(allTogetherResult) =>
            onUpdate(binding.interactions[0]!.update(offer, allTogetherResult))
          }
        />
      ))}
      {naturalSelectionBindings.map((binding) => (
        <NaturalSelectionOutcomeRows
          authored={binding.authored}
          controlId={binding.controlId}
          findingTarget={findingTarget(binding.naturalSelection.child.address)}
          key={binding.key}
          loadableFor={binding.loadableFor}
          onClear={() => onUpdate(binding.clear())}
          onSelect={(targets) =>
            onUpdate(
              binding.naturalSelection.update(
                offer,
                targets as import('@run-planner/engine/authored-project').OneToEight<string>,
              ),
            )
          }
          traitLabel={binding.traitLabel}
        />
      ))}
      {ransomAssessment === undefined ? null : (
        <div role="group" aria-label="Ransom preview">
          <SelectedOutcomeRow label="Effect">
            {!ransomAssessment.branchAgreement ? (
              <span aria-label="Not applicable">—</span>
            ) : (
              <span>
                Removes{' '}
                {ransomAssessment.removedTraitKeys.length === 0
                  ? `${ransomAssessment.removedCount} opposing traits`
                  : ransomAssessment.removedTraitKeys.map(interaction.traitLabel).join(', ')}{' '}
                · +{ransomAssessment.levelBonus} levels to{' '}
                {ransomAssessment.buffedTraitKeys.length === 0
                  ? 'no retained traits'
                  : ransomAssessment.buffedTraitKeys.map(interaction.traitLabel).join(', ')}
              </span>
            )}
          </SelectedOutcomeRow>
        </div>
      )}
    </>
  );
}
