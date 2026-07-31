import type { ShopPurchaseAddress } from '@run-planner/engine/authored-project';
import { candidateSupport } from '../../../projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
} from '../../../projections/structured-workspace';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: ShopPurchaseAddress;
  readonly checked: boolean;
  readonly id: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onChange: (purchased: boolean) => void;
}

export function ShopPurchaseControl({
  address,
  checked,
  id,
  interactions,
  onChange,
}: ShopPurchaseControlProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.shopPurchases,
    workspaceInteractionKey(address),
  );
  const projection = useWorkspaceInteraction(interaction);
  const candidate = projection.result?.find((option) => option.value === checked);
  const proposed = projection.result?.find((option) => option.value === !checked);
  const support = candidateSupport(candidate);
  return (
    <label className="purchase-control" data-candidate-support={support} htmlFor={id}>
      <SemanticOwnerMarker address={address} />
      <input
        checked={checked}
        disabled={projection.result !== undefined && !candidateMayBeAuthored(proposed)}
        id={id}
        onChange={(event) => {
          const options = projection.result ?? projection.activate();
          const next = options?.find((option) => option.value === event.target.checked);
          if (candidateMayBeAuthored(next)) onChange(event.target.checked);
        }}
        onFocus={projection.activate}
        onPointerDown={projection.activate}
        type="checkbox"
      />
      Purchased
    </label>
  );
}
