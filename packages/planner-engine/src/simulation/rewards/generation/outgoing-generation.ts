import type { BiomeLayout, Catalog, RoomDeclaration } from '../../../catalog-schema';
import { semanticAddressKey } from '../../../authored-project/addresses';
import type { RouteLoadout } from '../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubRoom,
  CanonicalTarget,
} from '../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import type { RewardStoreSupportEntry } from '../model';
import type { RewardBranchState } from '../branch-primitives';
import { advanceRewardBranches, type OfferProcessingPeer } from '../processing';
import { assessAuthoredBatchRewardStore } from '../reward-store-support';
import { addRewardFinding, rewardFinding } from '../findings';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import type { RunStateOwner } from '../run-state';
import {
  settleAuthoredAcquisitionSite,
  type AuthoredSiteSettlementResult,
} from './authored-site-settlement';
import type { RunStateCheckpointEmission, TargetHistoryCheckpointEmission } from './emissions';
import type { TargetGenerationFrontier } from './target-generation-completed';

type CanonicalRewardSource = CanonicalAuthoredRoom | CanonicalHubRoom;

export interface OutgoingGenerationTransition {
  readonly branches: readonly RewardBranchState[];
  readonly peers: readonly OfferProcessingPeer[];
  readonly siteSettlements: readonly AuthoredSiteSettlementResult[];
  readonly findings: readonly FindingRegionEntry[];
  readonly storeSupportEntries: readonly RewardStoreSupportEntry[];
  readonly expectedStores: readonly {
    readonly targetKey: string;
    readonly storeKey: string | undefined;
  }[];
  readonly targetGeneration?: {
    readonly parentKey: string;
    readonly frontier: TargetGenerationFrontier;
  };
  readonly runStateCheckpoint?: RunStateCheckpointEmission;
  readonly targetHistoryCheckpoint?: TargetHistoryCheckpointEmission;
}

export interface OutgoingGenerationInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'outgoingGenerationCheckpoint' }>;
  readonly layout: BiomeLayout;
  readonly source: CanonicalRewardSource | undefined;
  readonly sourceViews: ProgressiveRoomHistoryViews | undefined;
  readonly declaration: RoomDeclaration | undefined;
  readonly batch: CanonicalBatch | undefined;
  readonly hubDecisionOwner: RunStateOwner | undefined;
  readonly frontierOwner: RunStateOwner | undefined;
  readonly emptyOutgoing: boolean;
  readonly hubTakeover: boolean;
  readonly hubRestoring: boolean;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly rewardLookups: Readonly<Record<string, ReadonlySet<string>>>;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

function expectedTargetStores(
  catalog: Catalog,
  targets: readonly CanonicalTarget[],
  initialSharedStoreKey: string | undefined,
): readonly { readonly targetKey: string; readonly storeKey: string | undefined }[] {
  let finalSharedStoreKey = initialSharedStoreKey;
  for (const target of targets) {
    const declaration = catalog.rooms.byKey[target.room.gameName];
    if (declaration === undefined)
      throw new BiomeRewardSimulationContractError(`unknown target room ${target.room.gameName}`);
    if (declaration.forcedRewardStoreKey !== undefined)
      finalSharedStoreKey = declaration.forcedRewardStoreKey;
  }
  return Object.freeze(
    targets.map((target) => {
      const declaration = catalog.rooms.byKey[target.room.gameName]!;
      return Object.freeze({
        targetKey: semanticAddressKey(target.origin),
        storeKey:
          declaration.forcedRewardStoreKey ??
          declaration.individualRewardStoreKey ??
          finalSharedStoreKey,
      });
    }),
  );
}

export function applyOutgoingGenerationTransition(
  inputs: OutgoingGenerationInputs,
): OutgoingGenerationTransition {
  const {
    catalog,
    snapshot,
    event,
    layout,
    source,
    sourceViews,
    declaration,
    batch,
    hubDecisionOwner,
    frontierOwner,
    emptyOutgoing,
    hubTakeover,
    hubRestoring,
    enteredBiomeCount,
    routeLoadout,
    rewardLookups,
    authoredSeaStarDuplicateSiteKeys,
  } = inputs;
  let branches = inputs.branches;
  const findings = new Map<string, FindingRegionEntry>();
  const siteSettlements: AuthoredSiteSettlementResult[] = [];
  const storeSupportEntries: RewardStoreSupportEntry[] = [];

  if (event.origin.kind === 'hubRoom')
    return Object.freeze({
      branches: advanceRewardBranches(branches, event.sequence),
      peers: Object.freeze([]),
      siteSettlements: Object.freeze([]),
      findings: Object.freeze([]),
      storeSupportEntries: Object.freeze([]),
      expectedStores: Object.freeze([]),
    });
  if (source === undefined || sourceViews === undefined || declaration === undefined)
    throw new BiomeRewardSimulationContractError(
      'outgoing reward checkpoint has no authored source',
    );

  if (
    source.kind === 'authored' &&
    (Object.keys(source.acquisitionSites).length > 0 || source.entryState?.kind === 'shop')
  ) {
    const settleSite = (options: {
      readonly onlyEntry?: { readonly siteKey: string; readonly entryKey: string };
      readonly completeShopAfterOrder?: boolean;
    }) => {
      const settlement = settleAuthoredAcquisitionSite({
        catalog,
        snapshot,
        room: source,
        declaration,
        roomView: sourceViews,
        sourceBranches: branches,
        historySequence: event.sequence,
        enteredBiomeCount,
        routeLoadout,
        rewardLookups,
        authoredSeaStarDuplicateSiteKeys,
        ...(options.onlyEntry === undefined ? {} : { onlyEntry: options.onlyEntry }),
        ...(options.completeShopAfterOrder === undefined
          ? {}
          : { completeShopAfterOrder: options.completeShopAfterOrder }),
        activationOnly: true,
      });
      siteSettlements.push(settlement);
      branches = settlement.branches;
    };
    if (source.entryState?.kind === 'shop') settleSite({ completeShopAfterOrder: false });
    else
      for (const siteKey of Object.keys(source.acquisitionSites))
        settleSite({ onlyEntry: { siteKey, entryKey: '' } });
  }

  const checkpointOwner = hubDecisionOwner ?? batch?.origin ?? frontierOwner;
  const checkpointView = sourceViews.preOutgoing;
  const runStateCheckpoint =
    checkpointOwner === undefined || checkpointView === undefined
      ? undefined
      : Object.freeze({
          owner: checkpointOwner,
          source,
          view: checkpointView,
          branches: Object.freeze(branches),
        });
  const targetSet = batch?.targets;
  if (targetSet === undefined) {
    if (emptyOutgoing || hubTakeover || hubRestoring || frontierOwner !== undefined)
      return Object.freeze({
        branches: advanceRewardBranches(branches, event.sequence),
        peers: Object.freeze([]),
        siteSettlements: Object.freeze(siteSettlements),
        findings: Object.freeze([...findings.values()]),
        storeSupportEntries: Object.freeze(storeSupportEntries),
        expectedStores: Object.freeze([]),
        ...(runStateCheckpoint === undefined ? {} : { runStateCheckpoint }),
      });
    throw new BiomeRewardSimulationContractError(`${source.gameName} has no outgoing reward batch`);
  }
  if (batch === undefined)
    throw new BiomeRewardSimulationContractError(
      `${source.gameName} has no outgoing generation owner`,
    );
  const generationOrigin = batch.origin;
  const exitKeys = Object.freeze(targetSet.map((target) => target.exit.exitKey));
  const targetGeneration = Object.freeze({
    parentKey: semanticAddressKey(event.origin),
    frontier: Object.freeze({ origin: generationOrigin, exitKeys }),
  });
  const firstTarget = targetSet[0];
  const targetHistoryCheckpoint =
    firstTarget === undefined
      ? undefined
      : Object.freeze({
          origin: firstTarget.origin,
          historySequence: event.sequence,
          branches: Object.freeze(branches),
        });

  let sharedStore: string | undefined;
  const rewardStore = batch.rewardStore;
  if (rewardStore.kind === 'authoredBaseStore') {
    if (source.kind !== 'authored')
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} cannot own an authored base reward store`,
      );
    const support = assessAuthoredBatchRewardStore(
      layout,
      { rewardStore },
      source,
      declaration,
      sourceViews.preOutgoing ?? sourceViews.preparation,
      event.sequence,
    );
    storeSupportEntries.push(support);
    sharedStore = support.authoredStoreKey;
    if (!support.selectedPossible)
      addRewardFinding(
        findings,
        rewardFinding('baseRewardStoreUnavailable', support.origin, {
          authoredStoreKey: support.authoredStoreKey,
          enteredStoreCount: support.enteredStoreCount,
          enteredMetaStoreCount: support.enteredMetaStoreCount,
          currentMetaRatio: support.currentMetaRatio,
          metaSelectionValue: support.metaSelectionValue,
          supportStoreKeys: support.supportStoreKeys,
        }),
        ownerRegion(support.origin),
        { kind: 'history', sequence: event.sequence, boundary: 'at' },
      );
  } else if (rewardStore.kind === 'sourceOfferPoint') {
    if (source.kind !== 'authored')
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} cannot own a source reward wheel`,
      );
    const wheel = source.rewardWheels?.at(-1);
    if (wheel === undefined)
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} lost its active source reward wheel`,
      );
    sharedStore = wheel.storeKey;
  } else if (rewardStore.kind !== 'none') {
    throw new BiomeRewardSimulationContractError(
      `${source.gameName} exposes an unsupported generated reward store`,
    );
  }

  return Object.freeze({
    branches: advanceRewardBranches(branches, event.sequence),
    peers: Object.freeze([]),
    siteSettlements: Object.freeze(siteSettlements),
    findings: Object.freeze([...findings.values()]),
    storeSupportEntries: Object.freeze(storeSupportEntries),
    expectedStores: expectedTargetStores(catalog, targetSet, sharedStore),
    targetGeneration,
    ...(runStateCheckpoint === undefined ? {} : { runStateCheckpoint }),
    ...(targetHistoryCheckpoint === undefined ? {} : { targetHistoryCheckpoint }),
  });
}
