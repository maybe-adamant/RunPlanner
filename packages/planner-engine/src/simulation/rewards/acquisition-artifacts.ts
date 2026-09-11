import {
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type AcquisitionSiteAddress,
} from '../../authored-project/addresses';
import type { AuthoredRewardState } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ConcreteAcquisitionEvent } from '../../reward-kernel';
import type { FindingEvidence } from '../model';
import type { RewardBranchState } from './branch-primitives';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
  type AcquisitionSource,
  type DerivedAcquisitionEntryFrontier,
} from './acquisition-settlement';
import { createAnvilCandidateCapability, type AnvilCandidateCapability } from './anvil-settlement';

export interface DerivedAcquisitionEntryCandidateCapability {
  readonly kind: DerivedAcquisitionEntryFrontier['kind'];
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  readonly rewardTypes?: readonly string[];
  readonly fixedReward?: AuthoredRewardState;
  readonly producerLifecycleKey?: string;
  readonly encounterPhaseKey?: string;
  readonly participation?: 'optional';
  readonly retainedSourceMismatch?: boolean;
  readonly eligibleSourceOfferKeys?: readonly string[];
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
  frontiers: readonly DerivedAcquisitionEntryFrontier[],
): DerivedAcquisitionEntryCandidateCapability | undefined {
  const first = frontiers[0];
  if (first === undefined) return undefined;
  if (
    frontiers.length !== first.branchCohortSize ||
    frontiers.some(
      (frontier) =>
        frontier.kind !== first.kind ||
        frontier.branchCohortSize !== first.branchCohortSize ||
        frontier.sourceOfferKey !== first.sourceOfferKey ||
        frontier.slotIndex !== first.slotIndex ||
        JSON.stringify(frontier.rewardTypes) !== JSON.stringify(first.rewardTypes) ||
        JSON.stringify(frontier.fixedReward) !== JSON.stringify(first.fixedReward) ||
        frontier.producerLifecycleKey !== first.producerLifecycleKey ||
        frontier.encounterPhaseKey !== first.encounterPhaseKey ||
        frontier.participation !== first.participation ||
        frontier.retainedSourceMismatch !== first.retainedSourceMismatch ||
        JSON.stringify(frontier.eligibleSourceOfferKeys) !==
          JSON.stringify(first.eligibleSourceOfferKeys),
    )
  )
    return undefined;
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
  });
}
export function createDerivedAcquisitionEntryCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly DerivedAcquisitionEntryFrontier[]>,
): DerivedAcquisitionEntryCandidateArtifacts {
  const privateContexts = new Map(
    [...contexts].map(([key, frontiers]) => [key, Object.freeze([...frontiers])] as const),
  );
  return Object.freeze({
    at: (address: AcquisitionEntryAddress) => {
      const frontiers = privateContexts.get(semanticAddressKey(address));
      return frontiers === undefined
        ? undefined
        : attestDerivedAcquisitionEntryCandidateCapability(frontiers);
    },
    entriesAt: (site: AcquisitionSiteAddress) =>
      Object.freeze(
        [...privateContexts.values()].flatMap((frontiers) => {
          const first = frontiers[0];
          const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
          return first === undefined ||
            capability === undefined ||
            semanticAddressKey(first.address.site) !== semanticAddressKey(site)
            ? []
            : [Object.freeze({ address: first.address, capability })];
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
}
export function createAcquisitionConversionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    readonly {
      readonly address: AcquisitionRoleAddress;
      readonly branchesBeforeRole: readonly RewardBranchState[];
      readonly realizedAcquisitionByBranch?: readonly (ConcreteAcquisitionEvent | undefined)[];
      readonly source: AcquisitionSource;
      readonly lifecyclePoint: import('../../reward-kernel').ProducerLifecyclePointKey;
      readonly blocksArtificerConversion?: true;
      readonly artificerReplacementAddress: import('../../authored-project/addresses').AcquisitionEntryAddress;
      readonly artificerReplacementCandidate?: {
        readonly rewardTypes: readonly string[];
      };
      readonly artificerReplacementOptions?: readonly import('../../authored-project/model').AuthoredRewardState[];
    }[]
  >,
): AcquisitionConversionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  const at = (address: AcquisitionRoleAddress) => {
    const entries = privateContexts.get(semanticAddressKey(address));
    if (entries === undefined) return undefined;
    const anvil = createAnvilCandidateCapability(catalog, entries);
    return Object.freeze({
      timePieceAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch, branchIndex) =>
            assessTimePieceConversion(
              catalog,
              branch,
              entry.source,
              entry.address.acquisitionRole,
              entry.lifecyclePoint,
              entry.realizedAcquisitionByBranch?.[branchIndex],
            ),
          ),
        ),
      ),
      artificerAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch) =>
            assessArtificerConversion(catalog, branch, entry.source, {
              role: entry.address.acquisitionRole,
              lifecyclePoint: entry.lifecyclePoint,
              ...(entry.blocksArtificerConversion === true
                ? { blocksArtificerConversion: true as const }
                : {}),
            }),
          ),
        ),
      ),
      seaStarAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch, branchIndex) =>
            assessSeaStarDuplication(
              catalog,
              branch,
              entry.source,
              {
                role: entry.address.acquisitionRole,
                lifecyclePoint: entry.lifecyclePoint,
              },
              entry.realizedAcquisitionByBranch?.[branchIndex],
            ),
          ),
        ),
      ),
      ...(() => {
        const realized = entries.flatMap((entry) =>
          entry.branchesBeforeRole.map(
            (_, branchIndex) => entry.realizedAcquisitionByBranch?.[branchIndex],
          ),
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
    });
  };
  return Object.freeze({
    at,
    atReplacement: (
      replacement: import('../../authored-project/addresses').AcquisitionEntryAddress,
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
  });
}
export function createEmptyAcquisitionConversionCandidateArtifacts(): AcquisitionConversionCandidateArtifacts {
  return Object.freeze({ at: () => undefined, atReplacement: () => undefined });
}
