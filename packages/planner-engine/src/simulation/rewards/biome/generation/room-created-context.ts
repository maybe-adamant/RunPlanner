import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import { semanticAddressKey } from '../../../../authored-project/addresses';
import type { HistoryEvent, HistoryStateView, RoomCreationSource } from '../../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalLocalReward,
  CanonicalTarget,
} from '../../../materialization';
import type { HermesShrineCandidateContext } from '../../../hermes-shrine';
import { countedBinding } from '../../processing';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import { visibleStoreOptionNames } from '../../facts';
import { ImmutableSetView } from '../prepared-inputs';

type CanonicalRewardSource = CanonicalAuthoredRoom | CanonicalHubRoom;

export interface RoomCreatedRewardContext {
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly sourceDeclaration: RoomDeclaration;
  readonly incoming: CanonicalAuthoredRoom['incomingReward'];
  readonly unresolvedIncoming: CanonicalAuthoredRoom['unresolvedIncomingReward'];
  /** Concrete local rewards before the first unresolved local slot. */
  readonly localRewards: readonly CanonicalLocalReward[];
  /** The first unresolved local slot blocks every later local reward. */
  readonly unresolvedLocalReward:
    NonNullable<CanonicalAuthoredRoom['unresolvedLocalRewards']>[number] | undefined;
  readonly source: CanonicalRewardSource;
  readonly currentRoom: CanonicalRewardSource | undefined;
  readonly generationView: HistoryStateView | undefined;
  readonly currentShopNames: ReadonlySet<string>;
  readonly peerParentOrigin: CanonicalRewardSource['origin'];
  readonly peerCreationSource: RoomCreationSource;
}

export type RoomCreatedContextResult =
  | Readonly<{ readonly kind: 'empty' }>
  | Readonly<{ readonly kind: 'hub' }>
  | Readonly<{ readonly kind: 'blockedBiomeEntry' }>
  | Readonly<{ readonly kind: 'reward'; readonly context: RoomCreatedRewardContext }>;

/**
 * Resolves the declaration-owned reward envelope for one room-created event.
 * It performs no offer generation: later transitions receive this immutable
 * context and return their own branch, frontier, and finding products.
 */
export function prepareRoomCreatedRewardContext(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>,
  inputs: {
    readonly rooms: ReadonlyMap<string, CanonicalRewardSource>;
    readonly views: ReadonlyMap<
      string,
      {
        readonly preparation?: HistoryStateView;
        readonly entry?: HistoryStateView;
        readonly preOutgoing?: HistoryStateView;
        readonly targetGenerations: readonly {
          readonly targetOrigin: import('../../../../authored-project/addresses').SemanticAddress;
          readonly before: HistoryStateView;
        }[];
      }
    >;
    readonly targets: ReadonlyMap<string, CanonicalTarget>;
    readonly hubTargetByOrigin: ReadonlyMap<string, CanonicalHubTarget>;
    readonly additionalContinuations: ReadonlyMap<
      string,
      {
        readonly room: CanonicalAuthoredRoom;
        readonly origin: import('../../../../authored-project/addresses').SemanticAddress;
      }
    >;
    readonly expectedStores: ReadonlyMap<string, string | undefined>;
    readonly hermesShrineAssessments: ReadonlyMap<
      string,
      { readonly assessments: readonly HermesShrineCandidateContext[] }
    >;
    readonly historyCurrent?: HistoryStateView;
  },
): RoomCreatedContextResult {
  const room = inputs.rooms.get(semanticAddressKey(event.origin));
  if (room === undefined) return Object.freeze({ kind: 'empty' });
  if (room.gameName !== event.gameName) {
    throw new BiomeRewardSimulationContractError(
      `${semanticAddressKey(event.origin)} is ${room.gameName} in the snapshot but ${event.gameName} in history`,
    );
  }
  if (room.kind === 'hub') return Object.freeze({ kind: 'hub' });

  const incoming = room.incomingReward;
  const unresolvedIncoming = room.unresolvedIncomingReward;
  const concreteLocalRewards = room.localRewards ?? [];
  const unresolvedLocalRewards = room.unresolvedLocalRewards ?? [];
  const orderedLocalRewards = Object.freeze(
    [...concreteLocalRewards, ...unresolvedLocalRewards].sort(
      (left, right) =>
        room.encounterPhases.findIndex((phase) => phase.slotKey === left.encounterPhaseKey) -
        room.encounterPhases.findIndex((phase) => phase.slotKey === right.encounterPhaseKey),
    ),
  );
  const firstUnresolvedLocalIndex = orderedLocalRewards.findIndex((reward) =>
    unresolvedLocalRewards.includes(reward as (typeof unresolvedLocalRewards)[number]),
  );
  const concreteLocalKeys = new Set(concreteLocalRewards.map((reward) => reward.slotKey));
  const localRewards = Object.freeze(
    orderedLocalRewards
      .slice(
        0,
        firstUnresolvedLocalIndex < 0 ? orderedLocalRewards.length : firstUnresolvedLocalIndex,
      )
      .filter((reward): reward is CanonicalLocalReward => concreteLocalKeys.has(reward.slotKey)),
  );
  const unresolvedLocalReward =
    firstUnresolvedLocalIndex < 0
      ? undefined
      : (orderedLocalRewards[firstUnresolvedLocalIndex] as (typeof unresolvedLocalRewards)[number]);
  if (
    incoming === undefined &&
    unresolvedIncoming === undefined &&
    localRewards.length === 0 &&
    unresolvedLocalRewards.length === 0
  )
    return Object.freeze({ kind: 'empty' });

  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined)
    throw new BiomeRewardSimulationContractError(`${room.gameName} has no declaration`);

  let source: CanonicalRewardSource = room;
  let currentRoom: CanonicalRewardSource | undefined =
    event.source === 'biomeEntry' ? undefined : room;
  let generationView = inputs.views.get(semanticAddressKey(room.origin))?.preparation;
  let currentShopNames: ReadonlySet<string> = new Set();
  let peerParentOrigin: CanonicalRewardSource['origin'] = source.origin;
  let peerCreationSource: RoomCreationSource = 'generatedTarget';

  if (event.source === 'generatedTarget') {
    const target = inputs.targets.get(semanticAddressKey(event.targetOrigin));
    const parent = inputs.rooms.get(semanticAddressKey(event.parentOrigin));
    const parentViews = inputs.views.get(semanticAddressKey(event.parentOrigin));
    if (target === undefined)
      throw new BiomeRewardSimulationContractError('generated reward lost its source room');
    if (
      semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin) ||
      semanticAddressKey(target.origin) !== semanticAddressKey(event.targetOrigin)
    )
      throw new BiomeRewardSimulationContractError(
        `target ${semanticAddressKey(event.targetOrigin)} does not match its reward history event`,
      );
    if (parent !== undefined && parentViews !== undefined) {
      if (semanticAddressKey(parent.origin) !== semanticAddressKey(event.parentOrigin))
        throw new BiomeRewardSimulationContractError(
          `target ${semanticAddressKey(event.targetOrigin)} has the wrong reward parent`,
        );
      source = parent;
      currentRoom = parent;
      generationView =
        parentViews.targetGenerations.find(
          (candidate) =>
            semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
        )?.before ?? parentViews.preOutgoing;
      currentShopNames = visibleStoreOptionNames(
        parent,
        inputs.hermesShrineAssessments.get(semanticAddressKey(parent.origin))?.assessments,
      );
    } else if (event.parentOrigin.kind !== 'hubRoom') {
      throw new BiomeRewardSimulationContractError('generated reward lost its source room');
    }
    const expectedStore = inputs.expectedStores.get(semanticAddressKey(event.targetOrigin));
    const resolvedStores = [
      ...(incoming === undefined || countedBinding(declaration, incoming) === undefined
        ? []
        : [incoming.resolvedStoreKey]),
      ...localRewards.map((reward) => reward.resolvedStoreKey),
    ];
    if (
      inputs.expectedStores.has(semanticAddressKey(event.targetOrigin)) &&
      resolvedStores.some((storeKey) => storeKey !== expectedStore)
    )
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} resolved a reward store other than ${String(expectedStore)}`,
      );
  } else if (event.source === 'additionalExit') {
    const continuation = inputs.additionalContinuations.get(
      semanticAddressKey(event.additionalOrigin),
    );
    const parent = inputs.rooms.get(semanticAddressKey(event.parentOrigin));
    const parentViews = inputs.views.get(semanticAddressKey(event.parentOrigin));
    if (
      continuation === undefined ||
      parent?.kind !== 'authored' ||
      parentViews?.entry === undefined ||
      semanticAddressKey(continuation.room.origin) !== semanticAddressKey(event.origin)
    )
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} lost its entry-time additional continuation source`,
      );
    source = parent;
    currentRoom = parent;
    generationView = parentViews.entry;
    currentShopNames = visibleStoreOptionNames(
      parent,
      inputs.hermesShrineAssessments.get(semanticAddressKey(parent.origin))?.assessments,
    );
  } else if (event.source === 'hubTarget') {
    const parent = inputs.rooms.get(semanticAddressKey(event.parentOrigin));
    const parentViews = inputs.views.get(semanticAddressKey(event.parentOrigin));
    const target = inputs.hubTargetByOrigin.get(semanticAddressKey(event.targetOrigin));
    if (
      parent?.kind !== 'hub' ||
      target === undefined ||
      semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin)
    )
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} lost its declaration-owned Hub reward source`,
      );
    source = parent;
    currentRoom = parent;
    generationView = parentViews?.targetGenerations.find(
      (candidate) =>
        semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
    )?.before;
    peerParentOrigin = parent.origin;
    peerCreationSource = 'hubTarget';
  } else if (event.source === 'localVisit') {
    const parent = inputs.rooms.get(semanticAddressKey(event.parentOrigin));
    const parentViews = inputs.views.get(semanticAddressKey(event.parentOrigin));
    if (parent?.kind !== 'authored')
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} lost its parent-local reward source`,
      );
    source = parent;
    currentRoom = parent;
    generationView = parentViews?.targetGenerations.find(
      (candidate) =>
        semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
    )?.before;
    peerParentOrigin = parent.origin;
    peerCreationSource = 'localVisit';
  } else if (localRewards.length !== 0) {
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} materialized local rewards outside a generated target`,
    );
  }

  if (
    generationView === undefined &&
    event.source === 'biomeEntry' &&
    unresolvedIncoming !== undefined &&
    inputs.historyCurrent !== undefined
  )
    generationView = inputs.historyCurrent;
  if (generationView === undefined) {
    if (event.source === 'biomeEntry' && !inputs.views.has(semanticAddressKey(room.origin)))
      return Object.freeze({ kind: 'blockedBiomeEntry' });
    throw new BiomeRewardSimulationContractError(`${room.gameName} has no offer-time history view`);
  }
  const sourceDeclaration = catalog.rooms.byKey[source.gameName] ?? declaration;
  return Object.freeze({
    kind: 'reward',
    context: Object.freeze({
      room,
      declaration,
      sourceDeclaration,
      incoming,
      unresolvedIncoming,
      localRewards,
      unresolvedLocalReward,
      source,
      currentRoom,
      generationView,
      currentShopNames: new ImmutableSetView(currentShopNames),
      peerParentOrigin,
      peerCreationSource,
    }),
  });
}
