import type { AcquisitionSiteAddress, ProjectCommand } from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '@planner/projections/candidates/candidateProjection';
import type { RewardPickerStep } from '@planner/projections/rewards/rewardPicker';
import type { ProjectedRewardDomain } from '@planner/projections/rewards/rewardDomainProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceMarker } from './navigation';
import type {
  WorkspaceAcquisitionConversionControl,
  WorkspaceLevelResolutionControl,
  WorkspaceTraitOfferControl,
} from './traits';
import type { WorkspaceCommandIntent } from '../contract';

interface WorkspaceRewardControlBase {
  /** Evaluated concrete acquisition replacing the authored RoomReward offer. */
  readonly realizedAcquisition?: {
    readonly rewardType: string;
    readonly label: string;
  };
  /** Direct payload authoring for a declaration-fixed type whose payload remains unresolved. */
  readonly authoringStartStep?: Exclude<RewardPickerStep, 'type' | 'spurned'>;
  /** Transient factual type seed for that unresolved payload; never persisted independently. */
  readonly authoringSeed?: ResolvedRewardOffer;
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer | null;
  /** Application-owned picker entry point for this exact visible edit surface. */
  readonly offerEditStartStep?: RewardPickerStep;
  /** Application-owned presentation fact; React does not infer identity authoring from offer shape. */
  readonly offerEditVisibility: 'hidden' | 'visible';
  /** One exact engine-derived offer repair that replaces a misleading open-ended picker. */
  readonly fixedOfferEdit?: {
    readonly actionLabel: string;
    readonly offer: ResolvedRewardOffer;
  };
  /** Engine-attested retained identity disagreement requiring a visible repair path. */
  readonly retainedSourceMismatch: boolean;
  /** Exact declaration-owned item identity for a materialized World Shop slot. */
  readonly shopOption?: {
    readonly selectedOptionKey: string | null;
    readonly options: readonly {
      readonly key: string;
      readonly label: string;
      readonly rewardType: string;
    }[];
  };
  readonly owner: RewardCandidateOwner;
  readonly traitOffers?: readonly WorkspaceTraitOfferControl[];
  readonly levelResolutions?: readonly WorkspaceLevelResolutionControl[];
  readonly conversions?: readonly WorkspaceAcquisitionConversionControl[];
  readonly derivedShopEntryEdit?: {
    readonly site: AcquisitionSiteAddress;
    readonly entryKey: 'echoDoubleShopReward';
    readonly sourceOfferKey: string;
  };
}

export interface WorkspaceCountedRewardControl extends WorkspaceRewardControlBase {
  readonly binding: CountedRewardBinding;
  readonly kind: 'countedReward';
  readonly owner: CountedRewardCandidateOwner;
}

export interface WorkspaceExplicitRewardControl extends WorkspaceRewardControlBase {
  readonly kind: 'explicitReward';
  readonly rewardTypes: readonly string[];
}

export type WorkspaceRewardControl = WorkspaceCountedRewardControl | WorkspaceExplicitRewardControl;

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
