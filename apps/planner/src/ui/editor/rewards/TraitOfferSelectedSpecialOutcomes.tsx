import {
  optionIndex,
  type AuthoredAllTogetherResult,
  type AuthoredConcaveStoneResult,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import {
  type WorkspaceAllTogetherSetDomain,
  type WorkspaceConcaveStoneDomain,
  type WorkspaceConcaveStoneInteraction,
  type WorkspaceNaturalSelectionDomain,
  type WorkspaceTraitCarrierChildInteraction,
  type WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { CompoundOutcomeEditor } from './CompoundOutcomeEditor';
import { naturalSelectionOptionWithTargets, replaceTraitOfferOption } from './traitOfferOptions';

const emptyPicker: ContextualPickerModel<string> = Object.freeze({ sections: Object.freeze([]) });

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

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
  const findingTarget = useFindingTarget();
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
    <fieldset
      {...findingTarget(interaction.child.address)}
      tabIndex={-1}
      className="trait-stone-outcome"
      aria-label="Concave Stone outcome"
    >
      <legend>Concave Stone · Chance: {domain.procSupport}%</legend>
      <label className="trait-stone-activation">
        <input
          checked={procced || domain.required}
          disabled={domain.required}
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />{' '}
        Concave Stone Activated
      </label>
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
        <>
          <ContextualPicker
            ariaLabel="Concave Stone target"
            id={`${semanticOwnerControlElementId(interaction.child.address)}-picker`}
            label="Target"
            model={picker}
            onSelect={(optionKey) => onSelect({ kind: 'proc', optionKey })}
            placeholder="Choose an unpicked boon"
            {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
          />
          {children}
        </>
      )}
    </fieldset>
  );
}

function AllTogetherSetPicker({
  controlId,
  loadable,
  onCancel,
  onSelect,
  setKey,
}: {
  readonly controlId: string;
  readonly loadable: { readonly load: () => WorkspaceAllTogetherSetDomain | undefined };
  readonly onCancel: () => void;
  readonly onSelect: (value: string | null, label: string) => void;
  readonly setKey: DirectTraitSetKey;
}) {
  const controller = useWorkspaceInteractionController<WorkspaceAllTogetherSetDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel={`${setKey[0]!.toUpperCase()}${setKey.slice(1)} grant`}
      closeOnSelect={false}
      id={`${controlId}-picker`}
      label="Grant"
      loading={loaded.pending}
      model={loaded.result?.picker ?? emptyPicker}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      onSelect={(value) =>
        onSelect(
          value,
          loaded.result === undefined
            ? value === null
              ? 'No grant'
              : value
            : (pickerValueLabel(loaded.result.picker, value) ?? String(value)),
        )
      }
      open={true}
      placeholder="Choose a grant"
    />
  );
}

export function AllTogetherOutcomeEditor({
  sets,
  onSelect,
}: {
  readonly sets: readonly {
    readonly controlId: string;
    readonly findingTarget?: FindingTargetProps;
    readonly loadable: { readonly load: () => WorkspaceAllTogetherSetDomain | undefined };
    readonly setKey: DirectTraitSetKey;
    readonly value?: string | null;
  }[];
  readonly onSelect: (result: AuthoredAllTogetherResult) => void;
}) {
  const labelsForControls = () =>
    Object.freeze(
      Object.fromEntries(
        sets.flatMap((set) =>
          set.value === undefined
            ? []
            : [[set.setKey, set.value === null ? 'No grant (set exhausted)' : set.value]],
        ),
      ),
    ) as Partial<Record<DirectTraitSetKey, string>>;
  const draftFromSets = (): Partial<AuthoredAllTogetherResult> =>
    Object.freeze(
      Object.fromEntries(
        sets.flatMap((set) => (set.value === undefined ? [] : [[set.setKey, set.value]])),
      ),
    );
  const [draft, setDraft] = useState<Partial<AuthoredAllTogetherResult>>(draftFromSets);
  const [draftLabels, setDraftLabels] = useState(labelsForControls);
  const [activeIndex, setActiveIndex] = useState<number>();
  const activeSet = activeIndex === undefined ? undefined : sets[activeIndex];
  const activeSetKey = activeSet?.setKey;
  const complete =
    sets.length > 0 && sets.every((set) => Object.prototype.hasOwnProperty.call(draft, set.setKey));
  const begin = (setIndex = 0) => {
    setDraft(draftFromSets());
    setDraftLabels(labelsForControls());
    setActiveIndex(setIndex);
  };
  const cancel = () => {
    setDraft(draftFromSets());
    setDraftLabels(labelsForControls());
    setActiveIndex(undefined);
  };
  const choose = (value: string | null, label: string) => {
    if (activeSetKey === undefined) return;
    const next = Object.freeze({ ...draft, [activeSetKey]: value });
    setDraft(next);
    setDraftLabels((current) => Object.freeze({ ...current, [activeSetKey]: label }));
    const nextMissing = sets.findIndex(
      (set) => !Object.prototype.hasOwnProperty.call(next, set.setKey),
    );
    if (nextMissing < 0) {
      setActiveIndex(undefined);
      onSelect(next as AuthoredAllTogetherResult);
      return;
    }
    setActiveIndex(nextMissing);
  };
  return (
    <CompoundOutcomeEditor
      activeIndex={activeIndex}
      complete={complete}
      legend="Elemental grants"
      onBegin={begin}
      rows={sets.map((set) => {
        const key = set.setKey;
        const value = draft[key];
        const label = Object.prototype.hasOwnProperty.call(draft, key)
          ? (draftLabels[key] ?? (value === null ? 'No grant' : 'Configured'))
          : 'Unspecified';
        return {
          key,
          label: `${key[0]!.toUpperCase() + key.slice(1)}: ${label}`,
          controlId: set.controlId,
          ...(set.findingTarget === undefined ? {} : { findingTarget: set.findingTarget }),
        };
      })}
      startLabel="Choose all grants"
    >
      {activeSet === undefined ? null : (
        <AllTogetherSetPicker
          controlId={activeSet.controlId}
          loadable={activeSet.loadable}
          onCancel={cancel}
          onSelect={choose}
          setKey={activeSet.setKey}
        />
      )}
    </CompoundOutcomeEditor>
  );
}

export function NaturalSelectionOutcomeEditor({
  controlId,
  findingTarget,
  initial,
  loadableFor,
  onSelect,
  slotCount,
  traitLabel,
}: {
  readonly controlId: string;
  readonly findingTarget?: FindingTargetProps;
  readonly initial: readonly string[];
  readonly loadableFor: (
    targets: readonly string[],
    retainedTarget?: string,
  ) => { readonly load: () => WorkspaceNaturalSelectionDomain | undefined };
  readonly onSelect: (targets: readonly string[]) => void;
  readonly slotCount: number;
  readonly traitLabel: (traitKey: string) => string;
}) {
  const [draft, setDraft] = useState<readonly string[]>(initial);
  const [retainedTarget, setRetainedTarget] = useState<string>();
  const [activeIndex, setActiveIndex] = useState<number>();
  const loadable = useMemo(
    () => loadableFor(draft, retainedTarget),
    [draft, loadableFor, retainedTarget],
  );
  const controller = useWorkspaceInteractionController<
    WorkspaceNaturalSelectionDomain | undefined
  >();
  const nextDomainController = useWorkspaceInteractionController<
    WorkspaceNaturalSelectionDomain | undefined
  >();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  const domain = loaded.result;
  const complete = domain?.complete === true;
  const begin = (slotIndex = draft.length) => {
    const prefix = [...initial].slice(0, Math.min(slotIndex, slotCount - 1));
    setDraft(Object.freeze(prefix));
    setRetainedTarget(initial[slotIndex]);
    setActiveIndex(prefix.length);
  };
  const cancel = () => {
    setDraft(initial);
    setRetainedTarget(undefined);
    setActiveIndex(undefined);
  };
  const choose = (traitKey: string) => {
    if (activeIndex === undefined) return;
    setRetainedTarget(undefined);
    const next = Object.freeze([
      ...draft.slice(0, activeIndex),
      traitKey,
      ...draft.slice(activeIndex + 1),
    ]);
    setDraft(next);
    const nextDomain = nextDomainController.activate(loadableFor(next));
    if (nextDomain?.complete === true || next.length >= slotCount) {
      setActiveIndex(undefined);
      onSelect(next);
    } else setActiveIndex(next.length);
  };
  const visibleCount = complete
    ? draft.length
    : Math.min(slotCount, Math.max(1, draft.length + (activeIndex === undefined ? 0 : 1)));
  const rows = Array.from({ length: visibleCount }, (_, rowIndex) => {
    const target = draft[rowIndex] ?? (rowIndex === activeIndex ? retainedTarget : undefined);
    const retained = rowIndex === activeIndex && retainedTarget !== undefined;
    return {
      key: `position-${rowIndex + 1}`,
      label: `Position ${rowIndex + 1}: ${target === undefined ? 'Unspecified' : traitLabel(target)}${retained ? ' (retained)' : ''}`,
    };
  });
  const repeated = [...new Set(draft)].flatMap((traitKey) => {
    const count = draft.filter((candidate) => candidate === traitKey).length;
    return count > 1 ? [`${traitLabel(traitKey)} ×${count}`] : [];
  });
  return (
    <>
      {repeated.length === 0 ? null : (
        <p className="trait-selected-outcome-detail">Repeated targets: {repeated.join(', ')}</p>
      )}
      <CompoundOutcomeEditor
        {...(findingTarget === undefined ? {} : { findingTarget })}
        activeIndex={activeIndex}
        complete={complete}
        legend="Natural Selection targets"
        onBegin={begin}
        rows={rows}
        startLabel="Choose all targets"
      >
        {domain === undefined ? (
          <p className="feedback-text">
            {loaded.pending ? 'Evaluating targets…' : 'Targets unavailable.'}
          </p>
        ) : (
          <ContextualPicker
            cancelLabel="Cancel"
            choiceLabel={`Target ${Math.min((activeIndex ?? 0) + 1, slotCount)} of ${slotCount}`}
            closeOnSelect={false}
            id={`${controlId}-picker`}
            label="Trait"
            model={domain.picker}
            onOpenChange={(open) => {
              if (!open) cancel();
            }}
            onSelect={choose}
            open={true}
            placeholder="Choose an eligible core trait"
          />
        )}
      </CompoundOutcomeEditor>
    </>
  );
}

export function TraitOfferSelectedSpecialOutcomes({
  interaction,
  offer,
  carrierChildren,
  feedback,
  onUpdate,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly carrierChildren: readonly WorkspaceTraitCarrierChildInteraction[];
  readonly feedback: readonly import('@planner/projections/structured-workspace').WorkspaceTraitOfferFeedback[];
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const findingTarget = useFindingTarget();
  const ransomAssessment = feedback.find((entry) => entry.kind === 'ransom')?.assessment;
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
                setKey: interaction.child.setKey,
                ...(interaction.child.value === undefined
                  ? {}
                  : { value: interaction.child.value }),
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
          initial: option?.naturalSelectionTargets ?? Object.freeze([]),
          key: naturalSelection.child.optionKey,
          loadableFor: (targets: readonly string[], retainedTarget?: string) => {
            const draftOffer =
              option === undefined
                ? offer
                : replaceTraitOfferOption(
                    offer,
                    position,
                    naturalSelectionOptionWithTargets(option, targets),
                  );
            return naturalSelection.forOffer(draftOffer, retainedTarget);
          },
          naturalSelection,
          slotCount: naturalSelection.child.slotCount,
          traitLabel: naturalSelection.traitLabel,
        });
      }),
    [naturalSelections, offer],
  );
  return (
    <>
      {allTogetherBindings.map((binding) => (
        <AllTogetherOutcomeEditor
          key={binding.key}
          sets={binding.loaders.map((loader, index) => ({
            ...loader,
            findingTarget: findingTarget(binding.interactions[index]!.child.address),
          }))}
          onSelect={(allTogetherResult) =>
            onUpdate(binding.interactions[0]!.update(offer, allTogetherResult))
          }
        />
      ))}
      {naturalSelectionBindings.map((binding) => (
        <NaturalSelectionOutcomeEditor
          controlId={binding.controlId}
          findingTarget={findingTarget(binding.naturalSelection.child.address)}
          initial={binding.initial}
          key={binding.key}
          loadableFor={binding.loadableFor}
          onSelect={(targets) =>
            onUpdate(
              binding.naturalSelection.update(
                offer,
                targets as import('@run-planner/engine/authored-project').OneToEight<string>,
              ),
            )
          }
          slotCount={binding.slotCount}
          traitLabel={binding.traitLabel}
        />
      ))}
      {ransomAssessment === undefined ? null : (
        <fieldset className="trait-selected-outcome-detail" aria-label="Ransom preview">
          <legend>Ransom preview</legend>
          {!ransomAssessment.branchAgreement ? (
            <p className="feedback-text">Ransom result differs across current route branches.</p>
          ) : (
            <>
              <p>
                Removes {ransomAssessment.removedCount} opposing traits and grants +
                {ransomAssessment.levelBonus} levels to{' '}
                {ransomAssessment.buffedTraitKeys.length === 0
                  ? 'no retained traits'
                  : ransomAssessment.buffedTraitKeys.map(interaction.traitLabel).join(', ')}
              </p>
              {ransomAssessment.removedTraitKeys.length === 0 ? null : (
                <p className="trait-selected-outcome-detail">
                  Removed:{' '}
                  {ransomAssessment.removedTraitKeys.map(interaction.traitLabel).join(', ')}
                </p>
              )}
            </>
          )}
        </fieldset>
      )}
    </>
  );
}
