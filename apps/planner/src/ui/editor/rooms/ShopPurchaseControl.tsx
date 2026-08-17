import type { AcquisitionEntryAddress } from '@run-planner/engine/authored-project';
import { workspaceInteractionKey } from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: AcquisitionEntryAddress;
  readonly label: string;
  readonly purchased: boolean;
  readonly participationLabel?: 'Purchased' | 'Picked up';
  readonly toggleOfferKeys: readonly string[];
  readonly onChange: (offerKeys: readonly string[]) => void;
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
  onChange,
}: ShopPurchaseControlProps) {
  const checkboxId = `shop-${workspaceInteractionKey(address)}-purchased`;

  return (
    <>
      <td className="shop-purchase-membership">
        <label className="purchase-control" htmlFor={checkboxId}>
          <SemanticOwnerMarker address={address} />
          <input
            aria-label={`${participationLabel === 'Purchased' ? 'Purchase' : 'Pick up'} ${label}`}
            checked={purchased}
            id={checkboxId}
            onChange={() => onChange(toggleOfferKeys)}
            type="checkbox"
          />
        </label>
      </td>
    </>
  );
}
