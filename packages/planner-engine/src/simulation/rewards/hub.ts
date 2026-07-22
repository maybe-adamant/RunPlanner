import type { Catalog, HubBiomeLayout, RoomDeclaration } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { RewardHistoryState, RewardKernelFacts } from '../../reward-kernel';
import type {
  CanonicalHubHistory,
  HubSimulationHistory,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
  RoomCreatedHistoryEvent,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBiome,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalLocalChildRoom,
  HubSimulationMaterialization,
} from '../materialization';
import type { SemanticFinding } from '../model';
import { createRewardFacts, createdPeerGameNames } from './facts';
import type { HubRewardSimulation } from './model';
import {
  advanceRewardBranches,
  beginRewardRoom,
  countedBinding,
  freezeRecord,
  initializeRewardBranches,
  processJointUnorderedOffers,
  processProducerRole,
  processRewardOffer,
  processShopInventory,
  processShopPurchases,
  publicRewardBranch,
  type OfferProcessingContext,
  type OfferProcessingPeer,
  type RewardBranchState,
} from './processing';

type CanonicalHubRewardRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;
type CanonicalHubRewardSource = CanonicalAuthoredRoom | CanonicalHubRoom;
type CanonicalHubDomainRoom = CanonicalHubRewardRoom | CanonicalHubRoom;
type GeneratedOfferEvent = Extract<
  RoomCreatedHistoryEvent,
  { readonly source: 'hubTarget' | 'layoutEntry' | 'localChild' }
>;

export class HubRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubRewardSimulationContractError';
  }
}

function fail(detail: string): never {
  throw new HubRewardSimulationContractError(detail);
}

function requireHubLayout(
  catalog: Catalog,
  snapshot: HubSimulationMaterialization,
): HubBiomeLayout {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    route === undefined ||
    route.biomeKeys[0] !== snapshot.biomeKey ||
    layout?.kind !== 'HubBiome' ||
    layout.hub.rewardStorePolicy.kind !== 'none' ||
    layout.hub.rewardLookup.source !== 'allOpenTargetOffers' ||
    layout.terminal.kind !== 'fixedAuthoredSlot'
  ) {
    fail(`catalog cannot simulate canonical ${snapshot.biomeKey} Hub rewards`);
  }
  return layout;
}

function rewardRooms(
  snapshot: HubSimulationMaterialization,
): ReadonlyMap<string, CanonicalHubDomainRoom> {
  const board = snapshot.hubBoard;
  const rooms = [
    ...snapshot.entryRooms,
    ...(snapshot.kind === 'HubBiome'
      ? [snapshot.hubBoard.room]
      : snapshot.hubRoom === undefined
        ? []
        : [snapshot.hubRoom]),
    ...(board?.targets.map((target) => target.room) ?? []),
    ...snapshot.visits.flatMap((visit) => visit.localSlots),
    ...(snapshot.kind === 'HubBiomePrefix' ? (snapshot.frontierVisit?.localSlots ?? []) : []),
    ...(snapshot.kind === 'HubBiome' ? [snapshot.terminalEntry] : []),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function roomViews(
  history: HubSimulationHistory,
): ReadonlyMap<string, ProgressiveRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function hubTargets(
  snapshot: HubSimulationMaterialization,
): ReadonlyMap<string, CanonicalHubTarget> {
  const targets =
    snapshot.kind === 'HubBiome' ? snapshot.hubBoard.targets : snapshot.hubBoard?.targets;
  return new Map((targets ?? []).map((target) => [semanticAddressKey(target.origin), target]));
}

function rewardFacts(
  catalog: Catalog,
  source: CanonicalHubRewardSource,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  history: RewardHistoryState,
  sourceKind: GeneratedOfferEvent['source'] | 'self',
  rewardLookups: Readonly<Record<string, ReadonlySet<string>>>,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
): RewardKernelFacts {
  return createRewardFacts({
    catalog,
    source,
    sourceDeclaration,
    view,
    history,
    enteredBiomeCount: 1,
    currentBatchRoomGameNames:
      sourceKind === 'self'
        ? Object.freeze([])
        : createdPeerGameNames(catalog, view, source.origin, sourceKind),
    currentRoomShopOptionNames,
    rewardLookups,
    fail,
  });
}

function requireDeclaration(catalog: Catalog, gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) {
    fail(`${gameName} has no declaration`);
  }
  return declaration;
}

function requireCountedStore(room: CanonicalHubRewardRoom, declaration: RoomDeclaration): void {
  const incoming = room.incomingReward;
  if (incoming === undefined || countedBinding(declaration, incoming) === undefined) {
    return;
  }
  const expectedStore = declaration.individualRewardStoreKey ?? declaration.forcedRewardStoreKey;
  if (expectedStore === undefined || incoming.resolvedStoreKey !== expectedStore) {
    fail(`${room.gameName} resolved a reward store other than ${String(expectedStore)}`);
  }
}

function generationView(
  views: ReadonlyMap<string, ProgressiveRoomHistoryViews>,
  event: GeneratedOfferEvent,
): HistoryStateView {
  const parentViews = views.get(semanticAddressKey(event.parentOrigin));
  const view = parentViews?.targetGenerations.find(
    (candidate) =>
      semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
  )?.before;
  if (view === undefined) {
    fail(`${event.gameName} has no offer-time generation view`);
  }
  return view;
}

function offerContext(
  catalog: Catalog,
  room: CanonicalHubRewardRoom,
  source: CanonicalHubRewardSource,
  sourceKind: GeneratedOfferEvent['source'] | 'self',
  view: HistoryStateView,
  historySequence: number,
  rewardLookups: Readonly<Record<string, ReadonlySet<string>>>,
  peers: readonly OfferProcessingPeer[] = Object.freeze([]),
): OfferProcessingContext | undefined {
  const incoming = room.incomingReward;
  if (incoming === undefined) {
    return undefined;
  }
  const declaration = requireDeclaration(catalog, room.gameName);
  requireCountedStore(room, declaration);
  const binding = countedBinding(declaration, incoming);
  const sourceDeclaration = requireDeclaration(catalog, source.gameName);
  return {
    catalog,
    reward: incoming,
    ...(binding === undefined ? {} : { binding }),
    historySequence,
    peers,
    facts: (branchHistory) =>
      rewardFacts(
        catalog,
        source,
        sourceDeclaration,
        view,
        branchHistory,
        sourceKind,
        rewardLookups,
      ),
  };
}

function deriveRewardLookup(
  catalog: Catalog,
  layout: HubBiomeLayout,
  snapshot: HubSimulationMaterialization,
): {
  readonly internal: Readonly<Record<string, ReadonlySet<string>>>;
  readonly public: Readonly<Record<string, readonly string[]>>;
} {
  const orderedTypes: string[] = [];
  const uniqueTypes = new Set<string>();
  const board = snapshot.hubBoard;
  if (board === undefined) {
    return Object.freeze({ internal: Object.freeze({}), public: Object.freeze({}) });
  }
  for (const target of board.targets) {
    const incoming = target.room.incomingReward;
    if (incoming === undefined) {
      fail(`${target.room.gameName} has no Hub-board reward`);
    }
    const declaration = requireDeclaration(catalog, target.room.gameName);
    requireCountedStore(target.room, declaration);
    if (incoming.producerKind !== 'countedChoice' && incoming.producerKind !== 'fixed') {
      fail(`${target.room.gameName} is not a supported Hub-board reward room`);
    }
    if (!uniqueTypes.has(incoming.offer.rewardType)) {
      uniqueTypes.add(incoming.offer.rewardType);
      orderedTypes.push(incoming.offer.rewardType);
    }
  }
  return Object.freeze({
    internal: freezeRecord({ [layout.hub.rewardLookup.key]: uniqueTypes }),
    public: freezeRecord({ [layout.hub.rewardLookup.key]: Object.freeze(orderedTypes) }),
  });
}

function localOfferGroups(
  history: HubSimulationHistory,
): ReadonlyMap<
  string,
  readonly Extract<RoomCreatedHistoryEvent, { readonly source: 'localChild' }>[]
> {
  const groups = new Map<
    string,
    Extract<RoomCreatedHistoryEvent, { readonly source: 'localChild' }>[]
  >();
  for (const event of history.events) {
    if (event.kind !== 'roomCreated' || event.source !== 'localChild') {
      continue;
    }
    const key = semanticAddressKey(event.parentOrigin);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return new Map(
    [...groups].map(([key, events]) => [
      key,
      Object.freeze(
        [...events].sort((left, right) => left.generationIndex - right.generationIndex),
      ),
    ]),
  );
}

export function evaluateHubRewards(
  catalog: Catalog,
  snapshot: HubSimulationMaterialization,
  history: HubSimulationHistory,
): HubRewardSimulation {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    fail('Hub reward inputs do not share one biome owner');
  }
  const layout = requireHubLayout(catalog, snapshot);
  const rooms = rewardRooms(snapshot);
  const views = roomViews(history);
  const targets = hubTargets(snapshot);
  const localGroups = localOfferGroups(history);
  const processedLocalParents = new Set<string>();
  const emptyLookups = Object.freeze({});
  const rewardLookup = deriveRewardLookup(catalog, layout, snapshot);
  const findings = new Map<string, SemanticFinding>();
  let hubBoardPeers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches();

  for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'roomPrepared':
        branches = beginRewardRoom(branches, event.sequence);
        break;
      case 'roomCreated': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.gameName !== event.gameName) {
          fail(`${semanticAddressKey(event.origin)} changed room identity in Hub history`);
        }
        if (room.kind === 'hub') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (event.source === 'localChild') {
          const parentKey = semanticAddressKey(event.parentOrigin);
          if (processedLocalParents.has(parentKey)) {
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          const source = rooms.get(parentKey);
          const group = localGroups.get(parentKey);
          if (source?.kind !== 'authored' || group === undefined) {
            fail(`${event.gameName} lost its parent-local reward group`);
          }
          const contexts = group.flatMap((childEvent) => {
            const child = rooms.get(semanticAddressKey(childEvent.origin));
            if (child?.kind !== 'localChild') {
              fail(`${childEvent.gameName} lost its canonical local room`);
            }
            const context = offerContext(
              catalog,
              child,
              source,
              'localChild',
              generationView(views, childEvent),
              childEvent.sequence,
              emptyLookups,
            );
            return context === undefined ? [] : [context];
          });
          if (contexts.length !== group.length) {
            fail(`${source.gameName} generated a side room without a reward`);
          }
          branches = processJointUnorderedOffers(branches, contexts, findings);
          processedLocalParents.add(parentKey);
          break;
        }

        if (room.kind === 'localChild') {
          fail(`${room.gameName} has a non-local creation source`);
        }
        let source: CanonicalHubRewardSource = room;
        let sourceKind: GeneratedOfferEvent['source'] | 'self' = 'self';
        let view = views.get(semanticAddressKey(room.origin))?.preparation;
        if (event.source === 'hubTarget' || event.source === 'layoutEntry') {
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          if (event.source === 'hubTarget') {
            if (parent?.kind !== 'hub') {
              fail(`${event.gameName} lost its canonical Hub reward source`);
            }
            const target = targets.get(semanticAddressKey(event.targetOrigin));
            if (
              target === undefined ||
              semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin)
            ) {
              fail(`${event.gameName} does not match its Hub slot`);
            }
            source = parent;
          } else {
            if (parent?.kind !== 'authored') {
              fail(`${event.gameName} lost its canonical entry reward source`);
            }
            source = parent;
          }
          sourceKind = event.source;
          view = generationView(views, event);
        } else if (event.source === 'layoutTerminal') {
          sourceKind = 'self';
        }
        if (view === undefined) {
          fail(`${room.gameName} has no offer-time history view`);
        }
        const context = offerContext(
          catalog,
          room,
          source,
          sourceKind,
          view,
          event.sequence,
          emptyLookups,
          event.source === 'hubTarget' ? hubBoardPeers : Object.freeze([]),
        );
        branches =
          context === undefined
            ? advanceRewardBranches(branches, event.sequence)
            : processRewardOffer(branches, context, findings);
        if (event.source === 'hubTarget' && room.incomingReward !== undefined) {
          hubBoardPeers = Object.freeze([
            ...hubBoardPeers,
            { origin: event.targetOrigin, offer: room.incomingReward.offer },
          ]);
        }
        break;
      }
      case 'offerPointMaterialized': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && requireDeclaration(catalog, room.gameName);
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room?.kind !== 'authored' || declaration === undefined || roomView === undefined) {
          fail('Hub shop offer point has no authored room');
        }
        branches = processShopInventory(
          branches,
          {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            facts: (branchHistory, shopNames = new Set()) =>
              rewardFacts(
                catalog,
                room,
                declaration,
                roomView.preparation,
                branchHistory,
                'self',
                rewardLookup.internal,
                shopNames,
              ),
            fail,
          },
          findings,
        );
        break;
      }
      case 'producerRoleAdvanced': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && requireDeclaration(catalog, room.gameName);
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          fail('Hub producer role has no authored room');
        }
        if (room.kind === 'hub') {
          fail('Hub room cannot advance a reward producer');
        }
        branches = processProducerRole(
          catalog,
          branches,
          room,
          event,
          (branchHistory) =>
            createRewardFacts({
              catalog,
              source: room,
              sourceDeclaration: declaration,
              view: roomView.preOutgoing ?? roomView.entry,
              history: branchHistory,
              enteredBiomeCount: 1,
              currentBatchRoomGameNames: Object.freeze([]),
              fail,
            }),
          findings,
          fail,
        );
        break;
      }
      case 'shopPurchasesApplied': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && requireDeclaration(catalog, room.gameName);
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room?.kind !== 'authored' || declaration === undefined || roomView === undefined) {
          fail('Hub shop purchases have no authored room');
        }
        branches = processShopPurchases(
          branches,
          {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            facts: (branchHistory, shopNames = new Set()) =>
              rewardFacts(
                catalog,
                room,
                declaration,
                roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
                branchHistory,
                'self',
                rewardLookup.internal,
                shopNames,
              ),
            fail,
          },
          findings,
        );
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
  }

  const immutableFindings = Object.freeze([...findings.values()]);
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    rewardLookups: rewardLookup.public,
  });
}

export function evaluateNRewards(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): HubRewardSimulation {
  if (snapshot.biomeKey !== 'N' || history.biomeKey !== 'N') {
    fail('N rewards require biome N');
  }
  return evaluateHubRewards(catalog, snapshot, history);
}
