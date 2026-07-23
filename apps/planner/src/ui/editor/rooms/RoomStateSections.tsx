import type {
  LocalRewardAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type { WorkspaceContextualResolver } from '../../../projections/structuredWorkspace';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { CountedRewardEditor, RewardValueEditor } from '../rewards/RewardEditors';
import { ShopPurchaseControl } from './ShopPurchaseControl';

interface FieldsCageRewardProps {
  readonly active: boolean;
  readonly address: LocalRewardAddress;
  readonly contextual: WorkspaceContextualResolver;
  readonly idPrefix: string;
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly onReplace: (value: ResolvedRewardOffer) => void;
}

export function FieldsCageReward({
  active,
  address,
  contextual,
  idPrefix,
  label,
  offer,
  onReplace,
}: FieldsCageRewardProps) {
  return (
    <section aria-label={label} className="local-reward-slot" data-active={active}>
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>{label}</h4>
          <SemanticOwnerMarker address={address} />
        </div>
        <span className="neutral-status">{active ? 'Active' : 'Dormant'}</span>
      </div>
      <CountedRewardEditor
        candidateOwner={{ kind: 'localReward', address }}
        contextual={contextual}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
      />
    </section>
  );
}

interface ShopOfferEditorProps {
  readonly address: ShopOfferAddress;
  readonly contextual: WorkspaceContextualResolver;
  readonly idPrefix: string;
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly onPurchase: (purchased: boolean) => void;
  readonly onReplace: (value: ResolvedRewardOffer) => void;
  readonly purchaseAddress: ShopPurchaseAddress;
  readonly purchased: boolean;
}

export function ShopOfferEditor({
  address,
  contextual,
  idPrefix,
  label,
  offer,
  onPurchase,
  onReplace,
  purchaseAddress,
  purchased,
}: ShopOfferEditorProps) {
  return (
    <section className="shop-offer">
      <div className="shop-offer-heading">
        <div className="owner-markers">
          <h4>{label}</h4>
          <SemanticOwnerMarker address={address} />
        </div>
        <ShopPurchaseControl
          address={purchaseAddress}
          checked={purchased}
          contextual={contextual}
          id={`${idPrefix}-purchased`}
          onChange={onPurchase}
        />
      </div>
      <RewardValueEditor
        candidateOwner={{ kind: 'shopOffer', address }}
        contextual={contextual}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
      />
    </section>
  );
}
