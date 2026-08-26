import {
  optionIndex,
  type AuthoredAllTogetherResult,
  type AuthoredConcaveStoneResult,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import {
  type WorkspaceAllTogetherSetDomain,
  type WorkspaceAllTogetherSetInteraction,
  type WorkspaceConcaveStoneDomain,
  type WorkspaceConcaveStoneInteraction,
  type WorkspaceNaturalSelectionDomain,
  type WorkspaceNaturalSelectionInteraction,
  type WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { CompoundOutcomeEditor } from './CompoundOutcomeEditor';
import { naturalSelectionOptionWithTargets, replaceTraitOfferOption } from './traitOfferOptions';

const emptyPicker: ContextualPickerModel<string> = Object.freeze({ sections: Object.freeze([]) });

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

function ConcaveStoneOutcomeEditor({
  interaction,
  domain,
  offer,
  traitLabel,
  onSelect,
}: {
  readonly interaction: WorkspaceConcaveStoneInteraction;
  readonly domain: WorkspaceConcaveStoneDomain;
  readonly offer: AuthoredTraitOfferTraits;
  readonly traitLabel: (traitKey: string) => string;
  readonly onSelect: (result: AuthoredConcaveStoneResult | null) => void;
}) {
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
        label: 'Original unpicked rows',
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
    <fieldset className="trait-selected-outcome-detail" aria-label="Concave Stone outcome">
      <legend>Concave Stone</legend>
      <label>
        <input
          checked={procced || domain.required}
          disabled={domain.required}
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />{' '}
        Concave Stone procced
      </label>
      <p className="trait-selected-outcome-detail">
        {domain.required
          ? 'Heroic Stone must acquire one original unpicked row.'
          : `Stone proc support: ${domain.procSupport}%.`}
      </p>
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
        <ContextualPicker
          ariaLabel="Concave Stone residual trait"
          id={`${semanticOwnerControlElementId(interaction.control.address)}-picker`}
          label="Frozen residual row"
          model={picker}
          onSelect={(optionKey) => onSelect({ kind: 'proc', optionKey })}
          placeholder="Choose an original unpicked row"
          {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
        />
      )}
    </fieldset>
  );
}

function AllTogetherSetPicker({
  interaction,
  offer,
  onCancel,
  onSelect,
}: {
  readonly interaction: WorkspaceAllTogetherSetInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly onCancel: () => void;
  readonly onSelect: (value: string | null, label: string) => void;
}) {
  const loadable = useMemo(() => interaction.forOffer(offer), [interaction, offer]);
  const controller = useWorkspaceInteractionController<WorkspaceAllTogetherSetDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel={`${interaction.control.setKey[0]!.toUpperCase()}${interaction.control.setKey.slice(1)} grant`}
      closeOnSelect={false}
      id={`${semanticOwnerControlElementId(interaction.control.address)}-picker`}
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

function AllTogetherOutcomeEditor({
  interactions,
  offer,
  optionIndex,
  onSelect,
}: {
  readonly interactions: readonly WorkspaceAllTogetherSetInteraction[];
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly onSelect: (result: AuthoredAllTogetherResult) => void;
}) {
  const option = offer.options[optionIndex];
  const labelsForControls = () =>
    Object.freeze(
      Object.fromEntries(
        interactions.flatMap((interaction) =>
          interaction.control.valueLabel === undefined
            ? []
            : [[interaction.control.setKey, interaction.control.valueLabel]],
        ),
      ),
    ) as Partial<Record<DirectTraitSetKey, string>>;
  const [draft, setDraft] = useState<Partial<AuthoredAllTogetherResult>>(
    option?.allTogetherResult ?? Object.freeze({}),
  );
  const [draftLabels, setDraftLabels] = useState(labelsForControls);
  const [activeIndex, setActiveIndex] = useState<number>();
  const activeInteraction = activeIndex === undefined ? undefined : interactions[activeIndex];
  const activeSetKey = activeInteraction?.control.setKey;
  const complete =
    interactions.length > 0 &&
    interactions.every((interaction) =>
      Object.prototype.hasOwnProperty.call(draft, interaction.control.setKey),
    );
  const begin = (setIndex = 0) => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(setIndex);
  };
  const cancel = () => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(undefined);
  };
  const choose = (value: string | null, label: string) => {
    if (activeSetKey === undefined) return;
    const next = Object.freeze({ ...draft, [activeSetKey]: value });
    setDraft(next);
    setDraftLabels((current) => Object.freeze({ ...current, [activeSetKey]: label }));
    const nextMissing = interactions.findIndex(
      (interaction) => !Object.prototype.hasOwnProperty.call(next, interaction.control.setKey),
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
      rows={interactions.map((interaction) => {
        const key = interaction.control.setKey;
        const value = draft[key];
        const label = Object.prototype.hasOwnProperty.call(draft, key)
          ? (draftLabels[key] ?? (value === null ? 'No grant' : 'Configured'))
          : 'Unspecified';
        return {
          key,
          label: `${key[0]!.toUpperCase() + key.slice(1)}: ${label}`,
          controlId: semanticOwnerControlElementId(interaction.control.address),
        };
      })}
      startLabel="Choose all grants"
    >
      {activeInteraction === undefined ? null : (
        <AllTogetherSetPicker
          interaction={activeInteraction}
          offer={offer}
          onCancel={cancel}
          onSelect={choose}
        />
      )}
    </CompoundOutcomeEditor>
  );
}

function NaturalSelectionOutcomeEditor({
  interaction,
  offer,
  optionIndex,
  onSelect,
}: {
  readonly interaction: WorkspaceNaturalSelectionInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly onSelect: (targets: readonly string[]) => void;
}) {
  const option = offer.options[optionIndex];
  const initial = option?.naturalSelectionTargets ?? Object.freeze([]);
  const [draft, setDraft] = useState<readonly string[]>(initial);
  const [retainedTarget, setRetainedTarget] = useState<string>();
  const [activeIndex, setActiveIndex] = useState<number>();
  const draftOffer = useMemo(
    () =>
      option === undefined
        ? offer
        : replaceTraitOfferOption(
            offer,
            optionIndex,
            naturalSelectionOptionWithTargets(option, draft),
          ),
    [draft, optionIndex, offer, option],
  );
  const loadable = useMemo(
    () => interaction.forOffer(draftOffer, retainedTarget),
    [draftOffer, interaction, retainedTarget],
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
  const slotCount = interaction.control.slotCount;
  const complete = domain?.complete === true;
  const begin = (slotIndex = draft.length) => {
    const authored = option?.naturalSelectionTargets ?? Object.freeze([]);
    const prefix = [...authored].slice(0, Math.min(slotIndex, slotCount - 1));
    setDraft(Object.freeze(prefix));
    setRetainedTarget(authored[slotIndex]);
    setActiveIndex(prefix.length);
  };
  const cancel = () => {
    setDraft(option?.naturalSelectionTargets ?? Object.freeze([]));
    setRetainedTarget(undefined);
    setActiveIndex(undefined);
  };
  const choose = (traitKey: string) => {
    if (activeIndex === undefined || option === undefined) return;
    setRetainedTarget(undefined);
    const next = Object.freeze([
      ...draft.slice(0, activeIndex),
      traitKey,
      ...draft.slice(activeIndex + 1),
    ]);
    setDraft(next);
    const nextDomain = nextDomainController.activate(
      interaction.forOffer(
        replaceTraitOfferOption(
          draftOffer,
          optionIndex,
          naturalSelectionOptionWithTargets(option, next),
        ),
      ),
    );
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
      label: `Position ${rowIndex + 1}: ${target === undefined ? 'Unspecified' : interaction.traitLabel(target)}${retained ? ' (retained)' : ''}`,
      ...(rowIndex === 0
        ? { controlId: semanticOwnerControlElementId(interaction.control.address) }
        : {}),
    };
  });
  const repeated = [...new Set(draft)].flatMap((traitKey) => {
    const count = draft.filter((candidate) => candidate === traitKey).length;
    return count > 1 ? [`${interaction.traitLabel(traitKey)} ×${count}`] : [];
  });
  return (
    <>
      {repeated.length === 0 ? null : (
        <p className="trait-selected-outcome-detail">Repeated targets: {repeated.join(', ')}</p>
      )}
      <CompoundOutcomeEditor
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
            id={`${semanticOwnerControlElementId(interaction.control.address)}-picker`}
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
  optionIndex,
  option,
  allTogetherSets,
  concaveStone,
  naturalSelection,
  onUpdate,
  onConcaveStoneResult,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly allTogetherSets: readonly WorkspaceAllTogetherSetInteraction[] | undefined;
  readonly concaveStone:
    | {
        readonly interaction: WorkspaceConcaveStoneInteraction;
        readonly domain: WorkspaceConcaveStoneDomain;
      }
    | undefined;
  readonly naturalSelection: WorkspaceNaturalSelectionInteraction | undefined;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
  readonly onConcaveStoneResult?: (
    offer: AuthoredTraitOfferTraits,
    result: AuthoredConcaveStoneResult | null,
  ) => void;
}) {
  const ransomAssessment = interaction.ransomAssessment(offer);
  return (
    <>
      {allTogetherSets === undefined ? null : (
        <AllTogetherOutcomeEditor
          interactions={allTogetherSets}
          offer={offer}
          optionIndex={optionIndex}
          onSelect={(allTogetherResult) =>
            onUpdate(replaceTraitOfferOption(offer, optionIndex, { ...option, allTogetherResult }))
          }
        />
      )}
      {naturalSelection === undefined ? null : (
        <NaturalSelectionOutcomeEditor
          interaction={naturalSelection}
          offer={offer}
          optionIndex={optionIndex}
          onSelect={(targets) =>
            onUpdate(
              replaceTraitOfferOption(
                offer,
                optionIndex,
                naturalSelectionOptionWithTargets(option, targets),
              ),
            )
          }
        />
      )}
      {concaveStone === undefined ? null : (
        <ConcaveStoneOutcomeEditor
          domain={concaveStone.domain}
          interaction={concaveStone.interaction}
          offer={offer}
          traitLabel={interaction.traitLabel}
          onSelect={(result) => {
            if (result === null) {
              const { concaveStoneResult: _result, ...withoutResult } = offer;
              void _result;
              onUpdate(Object.freeze(withoutResult));
            } else onUpdate({ ...offer, concaveStoneResult: result });
            onConcaveStoneResult?.(offer, result);
          }}
        />
      )}
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
