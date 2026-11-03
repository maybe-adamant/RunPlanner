import {
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type AcquisitionSiteAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRewardState } from '../../../authored-project/model';
import { shopOfferGeneration, type ShopOfferGeneration } from '../../../authored-project/shop';
import type { AcquisitionEntrySourceFamily } from '../../../authored-project/acquisition/entry-source-family';
import type { Catalog } from '../../../catalog-schema';
import type { ConcreteAcquisitionEvent } from '../../../reward-kernel';
import type { FindingEvidence } from '../../model';
import type { HistoryFindingChronology } from '../../finding-regions';
import type { RewardBranchState } from '../branch-primitives';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
} from './conversions';
import type { AcquisitionSource } from './source';
import type { DerivedAcquisitionEntryFrontier, FixedAcquisitionRealization } from './contracts';
import { createAnvilCandidateCapability, type AnvilCandidateCapability } from '../anvil-settlement';
import {
  createHexActivationCandidateCapability,
  type HexActivationCandidateCapability,
  type HexActivationContext,
} from '../../hex-activation';

export interface DerivedAcquisitionEntryCandidateCapability {
  readonly kind: DerivedAcquisitionEntryFrontier['kind'];
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  readonly rewardTypes?: readonly string[];
  readonly fixedReward?: AuthoredRewardState;
  readonly producerLifecycleKey?: string;
  readonly encounterPhaseKey?: string;
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

export interface AcquisitionConversionCandidateCapability {
  readonly timePieceAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: FindingEvidence;
  }[];
  readonly artificerAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: FindingEvidence;
  }[];
  readonly seaStarAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: FindingEvidence;
  }[];
  readonly realizedAcquisition?: ConcreteAcquisitionEvent;
  readonly artificerReplacementAddress?: AcquisitionEntryAddress;
  readonly artificerReplacementRewardTypes?: readonly string[];
  readonly artificerReplacementOptions?: readonly AuthoredRewardState[];
  readonly anvil?: AnvilCandidateCapability;
  readonly hexActivation?: HexActivationCandidateCapability;
}
export interface AcquisitionConversionCandidateArtifacts {
  readonly at: (
    address: AcquisitionRoleAddress,
  ) => AcquisitionConversionCandidateCapability | undefined;
  readonly atReplacement: (address: AcquisitionEntryAddress) =>
    | {
        readonly address: AcquisitionRoleAddress;
        readonly capability: AcquisitionConversionCandidateCapability;
      }
    | undefined;
  /** History position of the contact that produced this role's capability. */
  readonly positionAt: (address: AcquisitionRoleAddress) => HistoryFindingChronology | undefined;
  /** A Forfeit realization fixed ahead of this role's pickup contact, with its position. */
  readonly fixedAt: (address: AcquisitionRoleAddress) =>
    | {
        readonly capability: AcquisitionConversionCandidateCapability;
        readonly position: HistoryFindingChronology;
      }
    | undefined;
}
export function createAcquisitionConversionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    readonly {
      readonly address: AcquisitionRoleAddress;
      readonly beforeRole: RewardBranchState | undefined;
      readonly realizedAcquisition?: ConcreteAcquisitionEvent;
      readonly source: AcquisitionSource;
      readonly lifecyclePoint: import('../../../reward-kernel').ProducerLifecyclePointKey;
      readonly historySequence: number;
      readonly blocksArtificerConversion?: true;
      readonly artificerReplacementAddress: import('../../../authored-project/addresses').AcquisitionEntryAddress;
      readonly artificerReplacementCandidate?: {
        readonly rewardTypes: readonly string[];
      };
      readonly artificerReplacementOptions?: readonly import('../../../authored-project/model').AuthoredRewardState[];
      readonly hexActivationContext?: HexActivationContext;
    }[]
  >,
  fixedRealizations: ReadonlyMap<string, FixedAcquisitionRealization> = new Map(),
): AcquisitionConversionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  const privateFixedRealizations = new Map(fixedRealizations);
  // A forfeit fixed before the pickup contact realizes the role without any
  // settlement-time conversion assessment.
  const fixedCapability = (
    fixed: FixedAcquisitionRealization,
  ): AcquisitionConversionCandidateCapability =>
    Object.freeze({
      timePieceAssessments: Object.freeze([]),
      artificerAssessments: Object.freeze([]),
      seaStarAssessments: Object.freeze([]),
      realizedAcquisition: fixed.realizedAcquisition,
    });
  const at = (address: AcquisitionRoleAddress) => {
    const key = semanticAddressKey(address);
    const entries = privateContexts.get(key);
    if (entries === undefined) {
      const fixed = privateFixedRealizations.get(key);
      return fixed === undefined ? undefined : fixedCapability(fixed);
    }
    const anvil = createAnvilCandidateCapability(catalog, entries);
    const hexActivation = createHexActivationCandidateCapability(
      entries.flatMap((entry) =>
        entry.hexActivationContext === undefined ? [] : [entry.hexActivationContext],
      ),
    );
    return Object.freeze({
      timePieceAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.beforeRole === undefined
            ? []
            : [
                assessTimePieceConversion(
                  catalog,
                  entry.beforeRole,
                  entry.source,
                  entry.address.acquisitionRole,
                  entry.lifecyclePoint,
                  entry.realizedAcquisition,
                ),
              ],
        ),
      ),
      artificerAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.beforeRole === undefined
            ? []
            : [
                assessArtificerConversion(catalog, entry.beforeRole, entry.source, {
                  role: entry.address.acquisitionRole,
                  lifecyclePoint: entry.lifecyclePoint,
                  ...(entry.blocksArtificerConversion === true
                    ? { blocksArtificerConversion: true as const }
                    : {}),
                }),
              ],
        ),
      ),
      seaStarAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.beforeRole === undefined
            ? []
            : [
                assessSeaStarDuplication(
                  catalog,
                  entry.beforeRole,
                  entry.source,
                  {
                    role: entry.address.acquisitionRole,
                    lifecyclePoint: entry.lifecyclePoint,
                  },
                  entry.realizedAcquisition,
                ),
              ],
        ),
      ),
      ...(() => {
        const realized = entries.flatMap((entry) =>
          entry.beforeRole === undefined ? [] : [entry.realizedAcquisition],
        );
        const first = realized[0];
        return first !== undefined &&
          realized.every(
            (candidate) =>
              candidate !== undefined && JSON.stringify(candidate) === JSON.stringify(first),
          )
          ? { realizedAcquisition: first }
          : {};
      })(),
      ...(() => {
        const domains = entries.map((entry) => entry.artificerReplacementOptions);
        const first = domains[0];
        return first !== undefined &&
          domains.every((domain) => JSON.stringify(domain) === JSON.stringify(first))
          ? { artificerReplacementOptions: first }
          : {};
      })(),
      ...(() => {
        const domains = entries.map((entry) => entry.artificerReplacementCandidate?.rewardTypes);
        const first = domains[0];
        return first !== undefined &&
          domains.every((domain) => JSON.stringify(domain) === JSON.stringify(first))
          ? { artificerReplacementRewardTypes: first }
          : {};
      })(),
      ...(() => {
        const addresses = entries.map((entry) => entry.artificerReplacementAddress);
        const first = addresses[0];
        return first !== undefined &&
          addresses.every(
            (candidate) => semanticAddressKey(candidate) === semanticAddressKey(first),
          )
          ? { artificerReplacementAddress: first }
          : {};
      })(),
      ...(anvil === undefined ? {} : { anvil }),
      ...(hexActivation === undefined ? {} : { hexActivation }),
    });
  };
  return Object.freeze({
    at,
    atReplacement: (
      replacement: import('../../../authored-project/addresses').AcquisitionEntryAddress,
    ) => {
      const replacementKey = semanticAddressKey(replacement);
      for (const entries of privateContexts.values()) {
        const source = entries.find(
          (entry) => semanticAddressKey(entry.artificerReplacementAddress) === replacementKey,
        );
        if (source === undefined) continue;
        const capability = at(source.address);
        if (capability !== undefined) return Object.freeze({ address: source.address, capability });
      }
      return undefined;
    },
    positionAt: (address: AcquisitionRoleAddress) => {
      const key = semanticAddressKey(address);
      const sequence =
        privateContexts.get(key)?.[0]?.historySequence ??
        privateFixedRealizations.get(key)?.historySequence;
      return sequence === undefined
        ? undefined
        : Object.freeze({ kind: 'history' as const, sequence, boundary: 'at' as const });
    },
    fixedAt: (address: AcquisitionRoleAddress) => {
      const fixed = privateFixedRealizations.get(semanticAddressKey(address));
      return fixed === undefined
        ? undefined
        : Object.freeze({
            capability: fixedCapability(fixed),
            position: Object.freeze({
              kind: 'history' as const,
              sequence: fixed.historySequence,
              boundary: 'at' as const,
            }),
          });
    },
  });
}
export function createEmptyAcquisitionConversionCandidateArtifacts(): AcquisitionConversionCandidateArtifacts {
  return Object.freeze({
    at: () => undefined,
    atReplacement: () => undefined,
    positionAt: () => undefined,
    fixedAt: () => undefined,
  });
}
