import type { ShopOptionEntry } from '@run-planner/engine/reward-kernel';
import { hintProps } from '@planner/ui/controls/hint';

type OfferCondition = NonNullable<ShopOptionEntry['unmodeledOfferCondition']>;

const conditionSentence: Record<OfferCondition, string> = {
  missingLastStand: "Offered only while you're missing a Death Defiance.",
};

/** One warning mark at the end of a line holding chosen items the game offers only conditionally. */
export function OfferConditionMark({
  conditions,
}: {
  readonly conditions: readonly (OfferCondition | undefined)[];
}) {
  const condition = conditions.find((candidate) => candidate !== undefined);
  if (condition === undefined) return null;
  const sentence = conditionSentence[condition];
  return (
    <span
      {...hintProps(sentence, undefined, sentence)}
      aria-label={sentence}
      className="navigation-status-marker offer-condition-mark"
      data-tone="incomplete"
      role="img"
    >
      !
    </span>
  );
}
