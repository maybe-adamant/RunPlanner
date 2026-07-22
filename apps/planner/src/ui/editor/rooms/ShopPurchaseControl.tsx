import type { ProjectDocument, ShopPurchaseAddress } from '@run-planner/engine/authored-project';
import { useRef, useState } from 'react';
import {
  candidateSupport,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: ShopPurchaseAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly checked: boolean;
  readonly id: string;
  readonly onChange: (purchased: boolean) => void;
  readonly project: ProjectDocument;
}

export function ShopPurchaseControl({
  address,
  candidateProjection,
  checked,
  id,
  onChange,
  project,
}: ShopPurchaseControlProps) {
  type Projection = {
    readonly checked: boolean;
    readonly project: ProjectDocument;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support =
    projection?.project === project && projection.checked === checked
      ? projection.support
      : 'unavailable';
  const activateProjection = () => {
    if (
      support !== 'unavailable' ||
      (projectionRef.current?.project === project && projectionRef.current.checked === checked)
    ) {
      return;
    }
    const candidate = candidateProjection
      .shopPurchases(project, address, [false, true])
      .find((option) => option.value === checked);
    const next = { checked, project, support: candidateSupport(candidate) };
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
