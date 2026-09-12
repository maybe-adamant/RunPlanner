import type { ProjectCommand } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { RewardCandidateOwner } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { ProjectedRewardDomain } from '@planner/projections/rewards/rewardDomainProjection';
import type { RewardPickerStep } from '@planner/projections/rewards/rewardPicker';
import type { WorkspaceCommandIntent } from '../contract';

export interface WorkspaceRewardInteraction {
  readonly authoredRewardTypes: readonly string[];
  readonly intentFor: (offer: ResolvedRewardOffer) => WorkspaceRewardCommandIntent;
  readonly key: string;
  readonly owner: RewardCandidateOwner['address'];
  readonly choiceLabel: (step: RewardPickerStep, offer?: ResolvedRewardOffer) => string;
  readonly resolvesAtAcquisition: (offer: ResolvedRewardOffer) => boolean;
  readonly load: () => Promise<ProjectedRewardDomain>;
  readonly model: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected?: ResolvedRewardOffer,
  ) => ContextualPickerModel<ResolvedRewardOffer>;
  readonly selected: ResolvedRewardOffer | null;
  readonly summary: (offer: ResolvedRewardOffer) => string;
}

type WorkspaceRewardCommandIntent = WorkspaceCommandIntent<
  Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'ReplaceIncomingReward'
        | 'ReplaceLocalReward'
        | 'ReplaceRewardWheelOffer'
        | 'ReplaceShopOfferOption'
        | 'ReplaceAcquisitionEntryOffer'
        | 'ReplaceAcquisitionDisposition'
        | 'EditDerivedShopEntry';
    }
  >
>;
