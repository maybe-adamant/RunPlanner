import {
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { HubBiomePlan } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import { evaluateHubRoomGeneration, type HubRoomGenerationValidation } from '../generation';
import { composeHubHistoryPrefix, type HubBiomeHistoryPrefix } from '../history';
import {
  materializeHubBiomePrefix,
  type CanonicalAuthoredRoom,
  type CanonicalHubBoard,
  type CanonicalHubTarget,
  type CanonicalHubVisit,
  type CanonicalLocalChildRoom,
  type MaterializedHubBiomePrefix,
  type MaterializedHubVisitFrontier,
} from '../materialization';
import type { RewardGenerationFindingCode, SemanticFinding } from '../model';
import { evaluateHubRewards, type HubRewardSimulation } from '../rewards';

interface HubPrefixProducts {
  readonly history: HubBiomeHistoryPrefix;
  readonly rewards: HubRewardSimulation;
  readonly roomGeneration: HubRoomGenerationValidation;
}

class HubProgressiveEvaluationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubProgressiveEvaluationContractError';
  }
}

function fail(detail: string): never {
  throw new HubProgressiveEvaluationContractError(detail);
}

export interface ProgressiveHubEvaluation extends HubPrefixProducts {
  readonly materializedPrefix: MaterializedHubBiomePrefix;
  readonly blockedAt?: SemanticAddress;
}

type HubFindingLocation =
  | { readonly kind: 'entryLifecycle'; readonly entryIndex: number; readonly order: number }
  | { readonly kind: 'hubBoardGeneration'; readonly order: number }
  | {
      readonly kind: 'visitTargetLifecycle' | 'visitSideGeneration';
      readonly visitIndex: number;
      readonly order: number;
    }
  | {
      readonly kind: 'visitLocalLifecycle';
      readonly visitIndex: number;
      readonly localRoomIndex: number;
      readonly order: number;
    };

interface LocatedHubFinding {
  readonly finding: SemanticFinding;
  readonly location: HubFindingLocation;
}

function evaluateProducts(catalog: Catalog, prefix: MaterializedHubBiomePrefix): HubPrefixProducts {
  const history = composeHubHistoryPrefix(catalog, prefix);
  const rewards = evaluateHubRewards(catalog, prefix, history);
  return Object.freeze({
    history,
    rewards,
    roomGeneration: evaluateHubRoomGeneration(catalog, prefix, history),
  });
}

function addressOccurrenceId(origin: SemanticAddress): string | undefined {
  return 'occurrenceId' in origin ? origin.occurrenceId : undefined;
}

function isLocalOwner(origin: SemanticAddress, room: CanonicalLocalChildRoom): boolean {
  return (
    semanticAddressKey(origin) === semanticAddressKey(room.origin) ||
    ('occurrenceId' in origin &&
      'groupKey' in origin &&
      'slotKey' in origin &&
      origin.occurrenceId === room.origin.occurrenceId &&
      origin.groupKey === room.groupKey &&
      origin.slotKey === room.slotKey)
  );
}

function rewardFindingIsLifecycle(code: RewardGenerationFindingCode): boolean {
  return (
    code === 'rewardAcquisitionUnavailable' ||
    code === 'shopOfferUnavailable' ||
    code === 'shopPurchaseUnavailable'
  );
}

function locateFinding(
  prefix: MaterializedHubBiomePrefix,
  finding: SemanticFinding,
): HubFindingLocation | undefined {
  const occurrenceId = addressOccurrenceId(finding.origin);
  const entryIndex = prefix.entryRooms.findIndex(
    (room) => occurrenceId !== undefined && room.occurrenceId === occurrenceId,
  );
  if (entryIndex >= 0) {
    return Object.freeze({ kind: 'entryLifecycle', entryIndex, order: entryIndex * 10 + 5 });
  }

  for (const visit of prefix.visits) {
    const localIndex = visit.localSlots.findIndex((room) => isLocalOwner(finding.origin, room));
    if (localIndex >= 0) {
      const enteredIndex = visit.enteredLocalRooms.findIndex((room) =>
        isLocalOwner(finding.origin, room),
      );
      if (
        finding.phase === 'rewardGeneration' &&
        rewardFindingIsLifecycle(finding.code as RewardGenerationFindingCode) &&
        enteredIndex >= 0
      ) {
        return Object.freeze({
          kind: 'visitLocalLifecycle',
          visitIndex: visit.visitIndex,
          localRoomIndex: enteredIndex,
          order: 200 + visit.visitIndex * 100 + 20 + enteredIndex,
        });
      }
      return Object.freeze({
        kind: 'visitSideGeneration',
        visitIndex: visit.visitIndex,
        order: 200 + visit.visitIndex * 100 + 10,
      });
    }
  }

  const board = prefix.hubBoard;
  if (board === undefined) {
    return undefined;
  }
  const target = board.targets.find(
    (candidate) =>
      semanticAddressKey(candidate.origin) === semanticAddressKey(finding.origin) ||
      (occurrenceId !== undefined && candidate.room.occurrenceId === occurrenceId),
  );
  if (target !== undefined) {
    if (
      finding.phase === 'rewardGeneration' &&
      rewardFindingIsLifecycle(finding.code as RewardGenerationFindingCode)
    ) {
      const visit = prefix.visits.find((candidate) => candidate.target === target);
      if (visit !== undefined) {
        return Object.freeze({
          kind: 'visitTargetLifecycle',
          visitIndex: visit.visitIndex,
          order: 200 + visit.visitIndex * 100,
        });
      }
    }
    return Object.freeze({ kind: 'hubBoardGeneration', order: 100 });
  }
  if (
    semanticAddressKey(finding.origin) === semanticAddressKey(board.origin) ||
    finding.origin.kind === 'hubSlot'
  ) {
    return Object.freeze({ kind: 'hubBoardGeneration', order: 100 });
  }
  return undefined;
}

function firstUnsupportedFinding(
  prefix: MaterializedHubBiomePrefix,
  products: HubPrefixProducts,
): LocatedHubFinding | undefined {
  return [...products.roomGeneration.findings, ...products.rewards.findings]
    .flatMap((finding) => {
      const location = locateFinding(prefix, finding);
      return location === undefined ? [] : [Object.freeze({ finding, location })];
    })
    .sort((left, right) => left.location.order - right.location.order)[0];
}

function withEntered(room: CanonicalAuthoredRoom, entered: boolean): CanonicalAuthoredRoom {
  if (room.entered === entered) {
    return room;
  }
  const clone = { ...room, entered };
  if (!entered) {
    delete clone.entryState;
  }
  return Object.freeze(clone);
}

function withLocalEntered(
  room: CanonicalLocalChildRoom,
  entered: boolean,
): CanonicalLocalChildRoom {
  return room.entered === entered ? room : Object.freeze({ ...room, entered });
}

function boardWithEnteredSlots(
  board: CanonicalHubBoard,
  enteredSlots: ReadonlySet<string>,
): CanonicalHubBoard {
  return Object.freeze({
    ...board,
    targets: Object.freeze(
      board.targets.map((target): CanonicalHubTarget =>
        Object.freeze({
          ...target,
          room: withEntered(target.room, enteredSlots.has(target.hubSlotKey)),
        }),
      ),
    ),
  });
}

function rebindVisit(visit: CanonicalHubVisit, board: CanonicalHubBoard): CanonicalHubVisit {
  const target = board.targets.find(
    (candidate) => candidate.hubSlotKey === visit.target.hubSlotKey,
  );
  if (target === undefined) {
    fail(`clamped Hub board lost visit target ${visit.target.hubSlotKey}`);
  }
  return Object.freeze({ ...visit, target });
}

function frontierVisit(
  visit: CanonicalHubVisit,
  board: CanonicalHubBoard,
  location: Exclude<HubFindingLocation, { readonly kind: 'entryLifecycle' | 'hubBoardGeneration' }>,
): MaterializedHubVisitFrontier {
  const target = board.targets.find(
    (candidate) => candidate.hubSlotKey === visit.target.hubSlotKey,
  );
  if (target === undefined) {
    fail(`clamped Hub board lost frontier target ${visit.target.hubSlotKey}`);
  }
  if (location.kind === 'visitTargetLifecycle') {
    return Object.freeze({
      kind: 'targetLifecycle',
      origin: visit.origin,
      visitIndex: visit.visitIndex,
      target,
      localSlots: Object.freeze([]),
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  const retainedLocalCount =
    location.kind === 'visitLocalLifecycle' ? location.localRoomIndex + 1 : 0;
  const retainedEntered = visit.enteredLocalRooms.slice(0, retainedLocalCount);
  const enteredOrigins = new Set(retainedEntered.map((room) => semanticAddressKey(room.origin)));
  const localSlots = Object.freeze(
    visit.localSlots.map((room) =>
      withLocalEntered(room, enteredOrigins.has(semanticAddressKey(room.origin))),
    ),
  );
  const localByOrigin = new Map(localSlots.map((room) => [semanticAddressKey(room.origin), room]));
  return Object.freeze({
    kind: location.kind === 'visitSideGeneration' ? 'sideGeneration' : 'localRoomLifecycle',
    origin: visit.origin,
    visitIndex: visit.visitIndex,
    target,
    localSlots,
    enteredLocalRooms: Object.freeze(
      retainedEntered.map((room) => {
        const retained = localByOrigin.get(semanticAddressKey(room.origin));
        return retained ?? fail(`clamped Hub visit lost local room ${room.slotKey}`);
      }),
    ),
    parentRestores: Object.freeze(
      visit.parentRestores.slice(0, Math.max(0, retainedLocalCount - 1)),
    ),
  });
}

function clampPrefix(
  prefix: MaterializedHubBiomePrefix,
  location: HubFindingLocation,
): MaterializedHubBiomePrefix {
  if (location.kind === 'entryLifecycle') {
    return Object.freeze({
      kind: prefix.kind,
      routeKey: prefix.routeKey,
      biomeKey: prefix.biomeKey,
      entryRooms: Object.freeze(prefix.entryRooms.slice(0, location.entryIndex + 1)),
      visits: Object.freeze([]),
      frontierEntry: Object.freeze({ kind: 'lifecycle', entryIndex: location.entryIndex }),
      biomeState: prefix.biomeState,
    });
  }
  const sourceBoard = prefix.hubBoard;
  if (sourceBoard === undefined || prefix.hubRoom === undefined) {
    return prefix;
  }
  if (location.kind === 'hubBoardGeneration') {
    return Object.freeze({
      ...prefix,
      hubBoard: boardWithEnteredSlots(sourceBoard, new Set()),
      visits: Object.freeze([]),
    });
  }
  const visitOffset = location.visitIndex - 1;
  const sourceVisit = prefix.visits[visitOffset];
  if (sourceVisit === undefined) {
    return prefix;
  }
  const completedSourceVisits = prefix.visits.slice(0, visitOffset);
  const enteredSlots = new Set([
    ...completedSourceVisits.map((visit) => visit.target.hubSlotKey),
    sourceVisit.target.hubSlotKey,
  ]);
  const board = boardWithEnteredSlots(sourceBoard, enteredSlots);
  const visits = Object.freeze(completedSourceVisits.map((visit) => rebindVisit(visit, board)));
  return Object.freeze({
    ...prefix,
    hubBoard: board,
    visits,
    frontierVisit: frontierVisit(sourceVisit, board, location),
  });
}

export function evaluateProgressiveHubBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: HubBiomePlan,
): ProgressiveHubEvaluation | null {
  let materializedPrefix = materializeHubBiomePrefix(catalog, biome, plan);
  if (materializedPrefix === null) {
    return null;
  }
  let products = evaluateProducts(catalog, materializedPrefix);
  const unsupported = firstUnsupportedFinding(materializedPrefix, products);
  if (unsupported !== undefined) {
    materializedPrefix = clampPrefix(materializedPrefix, unsupported.location);
    products = evaluateProducts(catalog, materializedPrefix);
  }
  return Object.freeze({
    materializedPrefix,
    ...products,
    ...(unsupported === undefined ? {} : { blockedAt: unsupported.finding.origin }),
  });
}
