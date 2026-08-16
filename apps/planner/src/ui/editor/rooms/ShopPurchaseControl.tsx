import type { AcquisitionEntryAddress } from '@run-planner/engine/authored-project';
import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
} from '@planner/projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: AcquisitionEntryAddress;
  readonly label: string;
  readonly purchased: boolean;
  readonly participationLabel?: 'Purchased' | 'Picked up';
  readonly toggleOfferKeys: readonly string[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onChange: (offerKeys: readonly string[]) => void;
}

function sameOfferKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function optionFor(
  options:
    | readonly CandidateOptionProjection<readonly string[], CandidateProjectionEvaluation>[]
    | undefined,
  offerKeys: readonly string[],
): CandidateOptionProjection<readonly string[], CandidateProjectionEvaluation> | undefined {
  return options?.find((option) => sameOfferKeys(option.value, offerKeys));
}

/**
 * One Shop inventory row exposes only optional-entry membership. Chronology
 * belongs to the containing Acquisitions workbench.
 */
export function ShopPurchaseControl({
  address,
  label,
  purchased,
  participationLabel = 'Purchased',
  toggleOfferKeys,
  interactions,
  onChange,
}: ShopPurchaseControlProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.acquisitionOrders,
    workspaceInteractionKey(address.site),
  );
  const projection = useWorkspaceInteraction(interaction);
  const current = projection.result?.find((option) =>
    sameOfferKeys(option.value, interaction.selected ?? []),
  );
  const toggle = optionFor(projection.result, toggleOfferKeys);
  const apply = (offerKeys: readonly string[]) => {
    const options = projection.result ?? projection.activate();
    const proposal = optionFor(options, offerKeys);
    if (candidateMayBeAuthored(proposal)) onChange(offerKeys);
  };
  const checkboxId = `shop-${workspaceInteractionKey(address)}-purchased`;

  return (
    <>
      <td
        aria-busy={projection.pending || undefined}
        className="shop-purchase-membership"
        data-candidate-support={candidateSupport(current)}
      >
        <label className="purchase-control" htmlFor={checkboxId}>
          <SemanticOwnerMarker address={address} />
          <input
            aria-label={`${participationLabel === 'Purchased' ? 'Purchase' : 'Pick up'} ${label}`}
            checked={purchased}
            disabled={projection.result !== undefined && !candidateMayBeAuthored(toggle)}
            id={checkboxId}
            onChange={() => apply(toggleOfferKeys)}
            onFocus={projection.activate}
            onPointerDown={projection.activate}
            type="checkbox"
          />
        </label>
      </td>
    </>
  );
}
