import type {
  AcquisitionSiteAddress,
  SemanticAddress,
  TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRewardState } from '../../../authored-project/model';
import type { ResolvedRewardOffer } from '../../../reward-kernel';
import type { CanonicalResolvedIncomingReward } from '../../materialization';
import type { TraitHistoryState } from '../../traits';
import type { ResolvedAcquisitionSource } from '../model';

export interface AcquisitionSource {
  readonly origin: TraitOfferOwnerAddress;
  readonly offer: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  /** Exact generated-parent provenance; consumers must never recover this from encoded keys. */
  readonly producer?: ResolvedAcquisitionSource['producer'];
  readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
  /** Instance fact supplied by the producer, never inferred from an owner label. */
  readonly instanceProvenance: 'free' | 'paid';
  /** Set only by sources that enter the game's SpawnRoomReward Forfeit lane. */
  readonly roomRewardForfeitEligible?: true;
  readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
  readonly anvilResult?: import('../../../authored-project/model').AuthoredAnvilResult | null;
  /** Optional creation-time Pom frontier for an already-materialized loot object. */
  readonly levelResolutionGenerationHistory?: TraitHistoryState;
  readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
  /** Exact source-produced payload stored at the occurrence acquisition site. */
  readonly artificerReplacementByAcquisitionRole?: Readonly<
    Record<string, AuthoredRewardState | null>
  >;
  readonly artificerReplacementSiteByAcquisitionRole?: Readonly<
    Record<string, AcquisitionSiteAddress>
  >;
  readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
  /** A Sea Star second interaction is never eligible to produce a third. */
  readonly blocksSeaStarDuplication?: true;
  /** Owning Room Action supplied by the reached transition, never reconstructed later. */
  readonly timelineOwner?: SemanticAddress;
}

export function resolvedAcquisitionSource(source: AcquisitionSource): ResolvedAcquisitionSource {
  return Object.freeze({
    offer: source.offer,
    producerLifecycleKey: source.producerLifecycleKey,
    ...(source.resolvedStoreKey === undefined ? {} : { resolvedStoreKey: source.resolvedStoreKey }),
    ...(source.producer === undefined ? {} : { producer: source.producer }),
  });
}
