import type { ShopPurchaseAddress } from '@run-planner/engine/authored-project';
import { useRef, useState } from 'react';
import { candidateSupport } from '../../../projections/candidateProjection';
import type { WorkspaceContextualResolver } from '../../../projections/structuredWorkspace';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: ShopPurchaseAddress;
  readonly checked: boolean;
  readonly contextual: WorkspaceContextualResolver;
  readonly id: string;
  readonly onChange: (purchased: boolean) => void;
}

export function ShopPurchaseControl({
  address,
  checked,
  contextual,
  id,
  onChange,
}: ShopPurchaseControlProps) {
  type Projection = {
    readonly checked: boolean;
    readonly contextual: WorkspaceContextualResolver;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support =
    projection?.contextual === contextual && projection.checked === checked
      ? projection.support
      : 'unavailable';
  const activateProjection = () => {
    if (
      support !== 'unavailable' ||
      (projectionRef.current?.contextual === contextual &&
        projectionRef.current.checked === checked)
    ) {
      return;
    }
    const candidate = contextual
      .resolveShopPurchases(address, [false, true])
      .find((option) => option.value === checked);
    const next = { checked, contextual, support: candidateSupport(candidate) };
    projectionRef.current = next;
    setProjection(next);
  };
  return (
    <label className="purchase-control" data-candidate-support={support} htmlFor={id}>
      <SemanticOwnerMarker address={address} />
      <input
        checked={checked}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        onFocus={activateProjection}
        onPointerDown={activateProjection}
        type="checkbox"
      />
      Purchased
    </label>
  );
}
