import type { ShopOptionEntry } from '@run-planner/engine/reward-kernel';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { hintProps } from '@planner/ui/controls/hint';

type OfferCondition = NonNullable<ShopOptionEntry['unmodeledOfferCondition']>;

/** Shape preview: which offer-condition note shows; none unless the build names one. */
const offerConditionNoteVariant: 'a' | 'b' | 'c' | undefined = (() => {
  const value = import.meta.env.VITE_LAST_STAND_NOTE as string | undefined;
  return value === 'a' || value === 'b' || value === 'c' ? value : undefined;
})();

const conditionSentence: Record<OfferCondition, string> = {
  missingLastStand: "Offered only while you're missing a Death Defiance.",
};

/** A: a marker beside a conditioned option, explained on hover. */
export function OfferConditionMarker({
  condition,
}: {
  readonly condition: OfferCondition | undefined;
}) {
  if (offerConditionNoteVariant !== 'a' || condition === undefined) return null;
  return (
    <span className="offer-condition-marker" {...hintProps(conditionSentence[condition])}>
      ◇
    </span>
  );
}

/** B: one muted line at the foot of an open list holding conditioned options. */
export function OfferConditionFoot<T>({ model }: { readonly model: ContextualPickerModel<T> }) {
  if (offerConditionNoteVariant !== 'b') return null;
  const labels = [
    ...new Set(
      model.sections.flatMap((section) =>
        section.items.flatMap((item) => (item.offerCondition === undefined ? [] : [item.label])),
      ),
    ),
  ];
  if (labels.length === 0) return null;
  return (
    <p className="offer-condition-foot">
      {labels.map((label) => (
        <span key={label}>{label}: offered only while you're missing one.</span>
      ))}
    </p>
  );
}

/** C: the trait-notice line under a chosen conditioned item. */
export function OfferConditionNotice({
  condition,
}: {
  readonly condition: OfferCondition | undefined;
}) {
  if (offerConditionNoteVariant !== 'c' || condition === undefined) return null;
  return (
    <div className="trait-offer-note offer-condition-notice">
      <strong>{conditionSentence[condition]}</strong>
    </div>
  );
}

/** C: one notice per distinct condition among a group's chosen items. */
export function OfferConditionNotices({
  conditions,
}: {
  readonly conditions: readonly (OfferCondition | undefined)[];
}) {
  const distinct = [
    ...new Set(conditions.filter((condition) => condition !== undefined)),
  ] as OfferCondition[];
  return distinct.map((condition) => (
    <OfferConditionNotice condition={condition} key={condition} />
  ));
}
