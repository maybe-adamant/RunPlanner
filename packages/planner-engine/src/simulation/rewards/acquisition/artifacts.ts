import {
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type AcquisitionSiteAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRewardState, RoomActionReference } from '../../../authored-project/model';
import { shopOfferGeneration, type ShopOfferGeneration } from '../../../authored-project/shop';
import type { AcquisitionEntrySourceFamily } from '../../../authored-project/acquisition/entry-source-family';
import type { Catalog } from '../../../catalog-schema';
import type { ConcreteAcquisitionEvent } from '../../../reward-kernel';
import type { FindingEvidence } from '../../model';
import type { RewardBranchState } from '../branch-primitives';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
} from './conversions';
import type { AcquisitionSource } from './source';
import type { DerivedAcquisitionEntryFrontier } from './contracts';
import type { SimulationState } from '../../state/model';
import { forfeitedPickupOf } from '../../state/pending-resource-pickups';
import {
  forfeitRealization,
  forfeitWouldTake,
  type ForfeitPeek,
} from '../biome/offer-lifecycle/spawned-trait-offers';
import { createAnvilCandidateCapability, type AnvilCandidateCapability } from '../anvil-settlement';
import {
  createHexActivationCandidateCapability,
  type HexActivationCandidateCapability,
  type HexActivationContext,
} from '../../hex-activation';

/** The row that places a delivery or clocked drop. */
export function timedPickupReference(entry: AcquisitionEntryAddress): RoomActionReference {
  return Object.freeze({
    kind: 'interactAcquisitionEntry' as const,
    siteKey: entry.site.pointKey,
    entryKey: entry.entryKey,
  });
}

export interface DerivedAcquisitionEntryCandidateCapability {
  readonly kind: DerivedAcquisitionEntryFrontier['kind'];
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  readonly rewardTypes?: readonly string[];
  readonly fixedReward?: AuthoredRewardState;
  readonly producerLifecycleKey?: string;
  readonly encounterPhaseKey?: string;
  /**
   * A due delivery's or clocked drop's phase on the Timeline: its due spawn's,
   * or the next wheel phase when that wheel's choice waits on it.
   */
  readonly phaseKey?: string;
  /** Where a due delivery or clocked drop meets its room, and how the editor names it. */
  readonly contact?: import('../../room-actions').RoomActionContact;
  readonly label?: import('../../room-actions').RoomActionRowLabel;
  /** The row that places a due delivery or clocked drop, which a placed row matches. */
  readonly reference?: RoomActionReference;
  readonly participation?: 'required' | 'optional';
  readonly retainedSourceMismatch?: boolean;
  readonly eligibleSourceOfferKeys?: readonly string[];
  /**
   * Which World Shop stock the duplicated purchase came from: the entry
   * inventory or the Travel Deal refill. Present with an Echo Gold duplicate's source.
   */
  readonly sourceOfferGeneration?: ShopOfferGeneration;
  /** What creates a derived pickup; absent for Shop inventory placeholders and resolved items. */
  readonly sourceFamily?: AcquisitionEntrySourceFamily;
}

function derivedPickupSourceFamily(
  frontier: DerivedAcquisitionEntryFrontier,
): AcquisitionEntrySourceFamily | undefined {
  switch (frontier.kind) {
    case 'clockedTraitPickup':
      return frontier.traitKey === undefined
        ? undefined
        : Object.freeze({ kind: 'trait', traitKey: frontier.traitKey });
    case 'echoDoubleShopReward':
      return Object.freeze({ kind: 'echo', effect: 'doubleShop' });
    case 'echoLastReward':
      return Object.freeze({ kind: 'echo', effect: 'lastReward' });
    case 'hermesShrineDelivery':
      return Object.freeze({ kind: 'hermesShrineDelivery' });
    case 'travelDealRefill':
      return Object.freeze({ kind: 'shopTravelDealRefill' });
    case 'echoDoubleShopPlaceholder':
    case 'travelDealPlaceholder':
    case 'acquisitionResolvedReward':
      return undefined;
  }
}
export interface DerivedAcquisitionEntryCandidateArtifacts {
  readonly at: (
    address: AcquisitionEntryAddress,
  ) => DerivedAcquisitionEntryCandidateCapability | undefined;
  readonly entriesAt: (site: AcquisitionSiteAddress) => readonly {
    readonly address: AcquisitionEntryAddress;
    readonly capability: DerivedAcquisitionEntryCandidateCapability;
  }[];
}
export function attestDerivedAcquisitionEntryCandidateCapability(
  first: DerivedAcquisitionEntryFrontier | undefined,
): DerivedAcquisitionEntryCandidateCapability | undefined {
  if (first === undefined) return undefined;
  const sourceFamily = derivedPickupSourceFamily(first);
  return Object.freeze({
    kind: first.kind,
    ...(first.sourceOfferKey === undefined ? {} : { sourceOfferKey: first.sourceOfferKey }),
    ...(first.slotIndex === undefined ? {} : { slotIndex: first.slotIndex }),
    ...(first.rewardTypes === undefined ? {} : { rewardTypes: first.rewardTypes }),
    ...(first.fixedReward === undefined ? {} : { fixedReward: first.fixedReward }),
    ...(first.producerLifecycleKey === undefined
      ? {}
      : { producerLifecycleKey: first.producerLifecycleKey }),
    ...(first.encounterPhaseKey === undefined
      ? {}
      : { encounterPhaseKey: first.encounterPhaseKey }),
    ...(first.dueContact === undefined
      ? {}
      : {
          ...(first.dueContact.phaseKey === undefined
            ? {}
            : { phaseKey: first.dueContact.phaseKey }),
          contact: first.dueContact.contact,
          label: first.dueContact.label,
        }),
    ...(first.kind === 'hermesShrineDelivery' || first.kind === 'clockedTraitPickup'
      ? { reference: timedPickupReference(first.address) }
      : {}),
    ...(first.participation === undefined ? {} : { participation: first.participation }),
    ...(first.retainedSourceMismatch === undefined
      ? {}
      : { retainedSourceMismatch: first.retainedSourceMismatch }),
    ...(first.eligibleSourceOfferKeys === undefined
      ? {}
      : { eligibleSourceOfferKeys: first.eligibleSourceOfferKeys }),
    ...(first.kind === 'echoDoubleShopReward' && first.sourceOfferKey !== undefined
      ? { sourceOfferGeneration: shopOfferGeneration(first.sourceOfferKey) }
      : {}),
    ...(sourceFamily === undefined ? {} : { sourceFamily }),
  });
}
export function createDerivedAcquisitionEntryCandidateArtifacts(
  contexts: ReadonlyMap<string, DerivedAcquisitionEntryFrontier>,
): DerivedAcquisitionEntryCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: AcquisitionEntryAddress) =>
      attestDerivedAcquisitionEntryCandidateCapability(
        privateContexts.get(semanticAddressKey(address)),
      ),
    entriesAt: (site: AcquisitionSiteAddress) =>
      Object.freeze(
        [...privateContexts.values()].flatMap((frontier) => {
          const capability = attestDerivedAcquisitionEntryCandidateCapability(frontier);
          return capability === undefined ||
            semanticAddressKey(frontier.address.site) !== semanticAddressKey(site)
            ? []
            : [Object.freeze({ address: frontier.address, capability })];
        }),
      ),
  });
}
export function createEmptyDerivedAcquisitionEntryCandidateArtifacts(): DerivedAcquisitionEntryCandidateArtifacts {
  return Object.freeze({ at: () => undefined, entriesAt: () => Object.freeze([]) });
}

interface AcquisitionConversionAssessment {
  readonly supported: boolean;
  readonly evidence: FindingEvidence;
}
export interface AcquisitionConversionCandidateCapability {
  /** Absent when the role has no reached pickup to convert. */
  readonly timePieceAssessment?: AcquisitionConversionAssessment;
  readonly artificerAssessment?: AcquisitionConversionAssessment;
  readonly seaStarAssessment?: AcquisitionConversionAssessment;
  readonly realizedAcquisition?: ConcreteAcquisitionEvent;
  readonly artificerReplacementAddress?: AcquisitionEntryAddress;
  readonly artificerReplacementRewardTypes?: readonly string[];
  readonly artificerReplacementOptions?: readonly AuthoredRewardState[];
  readonly anvil?: AnvilCandidateCapability;
  readonly hexActivation?: HexActivationCandidateCapability;
}
/** What a loose pickup's source is, read from the room that spawned it. */
export interface UnsettledPickupSource {
  readonly offer: import('../../../reward-kernel').ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
  readonly instanceProvenance: 'free' | 'paid';
  readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
}

/** The conversions a role not yet taken could make where its room's actions end. */
export type FrontierConversionCapability = Required<
  Pick<
    AcquisitionConversionCandidateCapability,
    'timePieceAssessment' | 'artificerAssessment' | 'seaStarAssessment'
  >
>;

export interface AcquisitionConversionCandidateArtifacts {
  readonly at: (
    address: AcquisitionRoleAddress,
  ) => AcquisitionConversionCandidateCapability | undefined;
  /**
   * For a role whose pickup the walk spawned and did not take: the same
   * conversion questions its contact would ask, at the state where the
   * room's reached actions end, where its row would append. Undefined once
   * the role settled, or where the room's actions were not reached.
   */
  readonly atFrontier: (
    room: SemanticAddress,
    address: AcquisitionRoleAddress,
    source: UnsettledPickupSource,
  ) => FrontierConversionCapability | undefined;
  readonly atReplacement: (address: AcquisitionEntryAddress) =>
    | {
        readonly address: AcquisitionRoleAddress;
        readonly capability: AcquisitionConversionCandidateCapability;
      }
    | undefined;
}
export function createAcquisitionConversionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    {
      readonly address: AcquisitionRoleAddress;
      readonly beforeRole: RewardBranchState | undefined;
      readonly realizedAcquisition?: ConcreteAcquisitionEvent;
      readonly source: AcquisitionSource;
      readonly lifecyclePoint: import('../../../reward-kernel').ProducerLifecyclePointKey;
      readonly historySequence: number;
      readonly blocksArtificerConversion?: true;
      readonly artificerReplacementAddress: AcquisitionEntryAddress;
      readonly artificerReplacementCandidate?: {
        readonly rewardTypes: readonly string[];
      };
      readonly artificerReplacementOptions?: readonly AuthoredRewardState[];
      readonly hexActivationContext?: HexActivationContext;
    }
  >,
  spawned: {
    /** The reached state the walk published, holding each uncollected spawned object. */
    readonly frontier: SimulationState | undefined;
    readonly peeks: ReadonlyMap<string, ForfeitPeek>;
    /** The state where each entered room's reached actions end, by room. */
    readonly roomFrontiers?: ReadonlyMap<string, RewardBranchState>;
  } = { frontier: undefined, peeks: new Map() },
): AcquisitionConversionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  const roomFrontiers = new Map(spawned.roomFrontiers ?? []);
  const privatePeeks = new Map(spawned.peeks);
  // Before its pickup, a role reads what Forfeit made of its spawned object
  // or, while it has not spawned, the game's Onion preview of it.
  const forfeited = (address: AcquisitionRoleAddress): ConcreteAcquisitionEvent | undefined => {
    const frontier = spawned.frontier;
    if (frontier === undefined) return undefined;
    const recorded = forfeitedPickupOf(frontier, address.owner, address.acquisitionRole);
    if (recorded !== undefined) return recorded;
    const peek = privatePeeks.get(semanticAddressKey(address.owner));
    if (peek?.takes !== true) return undefined;
    const binding = catalog.rewards.producerLifecycles.byKey[
      peek.producerLifecycleKey
    ]?.rewardTypes.byKey[peek.offer.rewardType]?.acquisitionLifecycle.find(
      (candidate) => candidate.role === address.acquisitionRole,
    );
    return binding === undefined ||
      !forfeitWouldTake(catalog, frontier, peek, Number.MAX_SAFE_INTEGER)
      ? undefined
      : forfeitRealization(catalog, peek.offer, binding, 'RoomRewardConsolationPrize');
  };
  const at = (address: AcquisitionRoleAddress) => {
    const key = semanticAddressKey(address);
    const entry = privateContexts.get(key);
    if (entry === undefined) {
      const realizedAcquisition = forfeited(address);
      return realizedAcquisition === undefined ? undefined : Object.freeze({ realizedAcquisition });
    }
    const anvil = createAnvilCandidateCapability(catalog, entry);
    const hexActivation =
      entry.hexActivationContext === undefined
        ? undefined
        : createHexActivationCandidateCapability(entry.hexActivationContext);
    const before = entry.beforeRole;
    return Object.freeze({
      ...(before === undefined
        ? {}
        : {
            timePieceAssessment: assessTimePieceConversion(
              catalog,
              before,
              entry.source,
              entry.address.acquisitionRole,
              entry.lifecyclePoint,
              entry.realizedAcquisition,
            ),
            artificerAssessment: assessArtificerConversion(catalog, before, entry.source, {
              role: entry.address.acquisitionRole,
              lifecyclePoint: entry.lifecyclePoint,
              ...(entry.blocksArtificerConversion === true
                ? { blocksArtificerConversion: true as const }
                : {}),
            }),
            seaStarAssessment: assessSeaStarDuplication(
              catalog,
              before,
              entry.source,
              {
                role: entry.address.acquisitionRole,
                lifecyclePoint: entry.lifecyclePoint,
              },
              entry.realizedAcquisition,
            ),
            ...(entry.realizedAcquisition === undefined
              ? {}
              : { realizedAcquisition: entry.realizedAcquisition }),
          }),
      ...(entry.artificerReplacementOptions === undefined
        ? {}
        : { artificerReplacementOptions: entry.artificerReplacementOptions }),
      ...(entry.artificerReplacementCandidate === undefined
        ? {}
        : { artificerReplacementRewardTypes: entry.artificerReplacementCandidate.rewardTypes }),
      artificerReplacementAddress: entry.artificerReplacementAddress,
      ...(anvil === undefined ? {} : { anvil }),
      ...(hexActivation === undefined ? {} : { hexActivation }),
    });
  };
  const atFrontier = (
    room: SemanticAddress,
    address: AcquisitionRoleAddress,
    pickup: UnsettledPickupSource,
  ): FrontierConversionCapability | undefined => {
    if (privateContexts.has(semanticAddressKey(address))) return undefined;
    const branch = roomFrontiers.get(semanticAddressKey(room));
    const binding = catalog.rewards.producerLifecycles.byKey[
      pickup.producerLifecycleKey
    ]?.rewardTypes.byKey[pickup.offer.rewardType]?.acquisitionLifecycle.find(
      (candidate) => candidate.role === address.acquisitionRole,
    );
    if (branch === undefined || binding === undefined) return undefined;
    const source: AcquisitionSource = Object.freeze({
      origin: address.owner,
      offer: pickup.offer,
      producerLifecycleKey: pickup.producerLifecycleKey,
      instanceProvenance: pickup.instanceProvenance,
      // Eligibility only; it publishes no replacement screen.
      presentsMaterializedScreen: false,
      ...(pickup.dispositionByAcquisitionRole === undefined
        ? {}
        : { dispositionByAcquisitionRole: pickup.dispositionByAcquisitionRole }),
    });
    const role = {
      role: address.acquisitionRole,
      lifecyclePoint: binding.lifecyclePoint,
      ...(binding.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    };
    const realized = forfeited(address);
    return Object.freeze({
      timePieceAssessment: assessTimePieceConversion(
        catalog,
        branch,
        source,
        role.role,
        role.lifecyclePoint,
        realized,
      ),
      artificerAssessment: assessArtificerConversion(catalog, branch, source, role),
      seaStarAssessment: assessSeaStarDuplication(catalog, branch, source, role, realized),
    });
  };
  return Object.freeze({
    at,
    atFrontier,
    atReplacement: (replacement: AcquisitionEntryAddress) => {
      const replacementKey = semanticAddressKey(replacement);
      for (const entry of privateContexts.values()) {
        if (semanticAddressKey(entry.artificerReplacementAddress) !== replacementKey) continue;
        const capability = at(entry.address);
        if (capability !== undefined) return Object.freeze({ address: entry.address, capability });
      }
      return undefined;
    },
  });
}
export function createEmptyAcquisitionConversionCandidateArtifacts(): AcquisitionConversionCandidateArtifacts {
  return Object.freeze({
    at: () => undefined,
    atFrontier: () => undefined,
    atReplacement: () => undefined,
  });
}
