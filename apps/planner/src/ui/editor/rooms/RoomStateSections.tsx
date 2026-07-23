import type {
  LocalRewardAddress,
  ProjectDocument,
  ShopOfferAddress,
  ShopPurchaseAddress,
} from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type { CandidateProjectionService } from '../../../projections/candidateProjection';
import type { RewardPickerProjectionService } from '../../../projections/rewardPicker';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { CountedRewardEditor, RewardValueEditor } from '../rewards/RewardEditors';
import { ShopPurchaseControl } from './ShopPurchaseControl';

interface FieldsCageRewardProps {
  readonly active: boolean;
  readonly address: LocalRewardAddress;
  readonly binding: CountedRewardBinding;
  readonly idPrefix: string;
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly onReplace: (value: ResolvedRewardOffer) => void;
}

export function FieldsCageReward({
  active,
  address,
  binding,
  candidateProjection,
  idPrefix,
  label,
  offer,
  onReplace,
  project,
  rewardPicker,
}: FieldsCageRewardProps & {
  readonly candidateProjection: CandidateProjectionService;
  readonly project: ProjectDocument;
  readonly rewardPicker: RewardPickerProjectionService;
}) {
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
        binding={binding}
        candidateOwner={{ kind: 'localReward', address }}
        candidateProjection={candidateProjection}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
        project={project}
        rewardPicker={rewardPicker}
      />
    </section>
  );
}

interface ShopOfferEditorProps {
  readonly address: ShopOfferAddress;
  readonly idPrefix: string;
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly onPurchase: (purchased: boolean) => void;
  readonly onReplace: (value: ResolvedRewardOffer) => void;
  readonly purchaseAddress: ShopPurchaseAddress;
  readonly purchased: boolean;
  readonly rewardTypes: readonly string[];
}

export function ShopOfferEditor({
  address,
  candidateProjection,
  idPrefix,
  label,
  offer,
  onPurchase,
  onReplace,
  project,
  purchaseAddress,
  purchased,
  rewardPicker,
  rewardTypes,
}: ShopOfferEditorProps & {
  readonly candidateProjection: CandidateProjectionService;
  readonly project: ProjectDocument;
  readonly rewardPicker: RewardPickerProjectionService;
}) {
  return (
    <section className="shop-offer">
      <div className="shop-offer-heading">
        <div className="owner-markers">
          <h4>{label}</h4>
          <SemanticOwnerMarker address={address} />
        </div>
        <ShopPurchaseControl
          address={purchaseAddress}
          candidateProjection={candidateProjection}
          checked={purchased}
          id={`${idPrefix}-purchased`}
          onChange={onPurchase}
          project={project}
        />
      </div>
      <RewardValueEditor
        candidateOwner={{ kind: 'shopOffer', address }}
        candidateProjection={candidateProjection}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={rewardTypes}
      />
    </section>
  );
}
