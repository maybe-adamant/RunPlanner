import {
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type OccurrenceAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { AcquisitionEntrySourceFamily } from '../../authored-project/acquisition/entry-source-family';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  parseHeraclesBountySiteKey,
} from '../../authored-project/acquisition/pickup-producers';
import type { ProjectCommand } from '../../authored-project/commands/types';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  parseHermesShrineDeliveryEntryKey,
} from '../../authored-project/hermes-shrine-delivery';
import type { AuthoredRewardState, RoomActionReference } from '../../authored-project/model';
import { createUnresolvedLevelResolutions } from '../../authored-project/traits/state';
import { roomActionKey } from '../../authored-project/room-actions/key';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../authored-project/shop';
import type { Catalog } from '../../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from '../candidates/evaluated-biome';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { RoomActionParticipation, RoomActionRow } from '../room-actions';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import {
  clockedTraitPickupPlacementForProjectEvaluationAssembly,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
} from './project-evaluation-assembly';

/**
 * When the game spawns loot on its own: on entry (an Opening or Devotion
 * reward, Fields cages and optionals), the fourth-biome Preboss delivery
 * flush, an encounter's start (H minibosses) or mid-combat (Arachne's
 * cocoon), its end, and in an O phase the deliveries and drops after its
 * wheel reward.
 */
export type SpawnMomentKind =
  | 'roomEntered'
  | 'deliveryFlush'
  | 'encounterStart'
  | 'duringEncounter'
  | 'encounterEnd'
  | 'afterEncounterReward';

/** What spawned one item. */
export type SpawnedLootSource =
  /** One acquisition role of the room's incoming reward. */
  | { readonly kind: 'roomReward' }
  /** The drop the room's declaration forces (a Boss reward). */
  | { readonly kind: 'requiredDrop' }
  | { readonly kind: 'rewardWheel'; readonly wheelKey: string }
  /** A Fields cage or optional reward; a cage names the phase that frees it. */
  | {
      readonly kind: 'fieldsReward';
      readonly groupKey: string;
      readonly slotKey: string;
      readonly cagePhaseKey?: string;
    }
  | { readonly kind: 'generated'; readonly family: AcquisitionEntrySourceFamily };

export type SpawnedLootPlacement =
  | {
      readonly kind: 'placed';
      readonly action: RoomActionAddress;
      /** One-based position in the room's action order. */
      readonly rank: number;
    }
  /** `command` places it; absent when no placement is authorable now. */
  | { readonly kind: 'unplaced'; readonly command?: ProjectCommand };

export interface SpawnedLootItem {
  /** The reward owner the collect action acquires: a role, local reward, wheel offer or entry. */
  readonly owner: SemanticAddress;
  /** The action that collects it. */
  readonly reference: RoomActionReference;
  readonly source: SpawnedLootSource;
  readonly participation: RoomActionParticipation;
  readonly placement: SpawnedLootPlacement;
  /** The key of the unlock that frees it, for loot that spawns before it can be taken. */
  readonly lockedUntil?: string;
  /**
   * An unplaced pickup whose placement asks for a choice: the Pom level its
   * reward resolves, such as a Supply Chain Pom Slice's target.
   */
  readonly needsChoice?: 'levelResolution';
}

export interface SpawnMoment {
  /** Stable within the room: the kind, plus the phase where it has one. */
  readonly key: string;
  readonly kind: SpawnMomentKind;
  readonly phaseKey?: string;
  /** In the game's spawn order. */
  readonly items: readonly SpawnedLootItem[];
}

/** The moment locked loot becomes takeable: a Fields cage's or an H miniboss's encounter end. */
export interface SpawnUnlock {
  /** The `lockedUntil` its items carry. */
  readonly key: string;
  readonly kind: 'encounterEnd';
  readonly phaseKey: string;
  /** The same items as their spawn moments list, in spawn order. */
  readonly items: readonly SpawnedLootItem[];
}

/** Loot one source action spawns when it settles. */
export interface ActionSpawn {
  readonly source: RoomActionReference;
  readonly sourceAction: RoomActionAddress;
  readonly items: readonly SpawnedLootItem[];
}

export interface RoomSpawnedLoot {
  readonly owner: OccurrenceAddress;
  /** Moments that spawn something, in room chronology. */
  readonly moments: readonly SpawnMoment[];
  /** Unlocks of loot spawned before it can be taken, in room chronology. */
  readonly unlocks: readonly SpawnUnlock[];
  /** Source actions that spawn something, in roster order. */
  readonly actionSpawns: readonly ActionSpawn[];
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function authoredRoom(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  const biome = candidateBiome(assembly.evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return undefined;
  const key = semanticAddressKey(occurrence);
  return candidateBiomeRooms(biome).find((room) => semanticAddressKey(room.origin) === key);
}

/**
 * Where a delivery's purchase sits in the run: its Shrine room's entry, then
 * the purchase's place in that room's actions. Delivery traits are equipped,
 * and so expire, in purchase order.
 */
function deliveryPurchaseOrder(
  assembly: ProjectEvaluationAssembly,
): (entryKey: string) => readonly number[] {
  const roomOrder = new Map<string, number>();
  for (const biome of assembly.evaluation.route.biomes) {
    if (!('history' in biome)) continue;
    for (const room of biome.history.rooms) {
      const key = semanticAddressKey(room.origin);
      if (!roomOrder.has(key)) roomOrder.set(key, roomOrder.size);
    }
  }
  return (entryKey) => {
    const parsed = parseHermesShrineDeliveryEntryKey(entryKey);
    if (parsed === undefined) return [Number.MAX_SAFE_INTEGER];
    const source = createOccurrenceAddress(
      createBiomeAddress(parsed.routeKey, parsed.biomeKey),
      parsed.sourceOccurrenceId,
    );
    const order =
      assembly.project.route.biomes
        .find((biome) => biome.biomeKey === parsed.biomeKey)
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === parsed.sourceOccurrenceId,
        )?.roomActions.order ?? [];
    const purchase = order.findIndex(
      (reference) =>
        reference.kind === 'purchaseHermesShrineOffer' &&
        reference.generationKey === parsed.generationKey,
    );
    return [
      roomOrder.get(semanticAddressKey(source)) ?? Number.MAX_SAFE_INTEGER,
      purchase < 0 ? Number.MAX_SAFE_INTEGER : purchase,
    ];
  };
}

function compareOrder(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

type LevelResolutions = AuthoredRewardState['levelResolutionsByAcquisitionRole'];

/** The reward resolves a Pom level for the role, or for any role when none is named. */
function resolvesLevel(levels: LevelResolutions, role?: string): boolean {
  return (
    levels !== undefined &&
    (role === undefined ? Object.keys(levels).length > 0 : levels[role] !== undefined)
  );
}

/** Whether collecting the row's authored reward resolves a Pom level. */
function rowResolvesLevel(room: CanonicalAuthoredRoom, reference: RoomActionReference): boolean {
  switch (reference.kind) {
    case 'interactIncomingReward':
      return resolvesLevel(
        room.incomingReward?.levelResolutionsByAcquisitionRole,
        reference.acquisitionRole,
      );
    case 'interactLocalReward':
      return resolvesLevel(
        [...(room.localRewards ?? []), ...(room.fieldsOptionalRewards ?? [])].find(
          (reward) =>
            reward.groupKey === reference.groupKey && reward.slotKey === reference.slotKey,
        )?.levelResolutionsByAcquisitionRole,
      );
    case 'interactWheelReward':
      return resolvesLevel(
        room.rewardWheels
          ?.find((wheel) => wheel.wheelKey === reference.wheelKey)
          ?.offers.find((offer) => offer.picked)?.levelResolutionsByAcquisitionRole,
      );
    case 'interactAcquisitionEntry':
      return resolvesLevel(
        room.acquisitionSites[reference.siteKey]?.entries[reference.entryKey]
          ?.levelResolutionsByAcquisitionRole,
      );
    default:
      return false;
  }
}

/**
 * The collect action for an unranked active row: a required row's canonical
 * insertion, otherwise its latest legal one.
 */
function insertion(
  room: CanonicalAuthoredRoom,
  row: RoomActionRow,
  action: RoomActionAddress,
): ProjectCommand | undefined {
  const inserts = room.roomActionRoster.proposals.filter(
    (candidate) =>
      candidate.kind === 'insert' &&
      candidate.structurallyAuthorable &&
      roomActionKey(candidate.reference) === row.key,
  );
  // A required row without a canonical insertion keeps its latest legal one.
  const proposal =
    (row.participation === 'required'
      ? inserts.find((candidate) => candidate.canonical === true)
      : undefined) ?? inserts.at(-1);
  return proposal?.toIndex === undefined
    ? undefined
    : frozen({
        kind: 'InsertRoomAction',
        action,
        reference: proposal.reference,
        index: proposal.toIndex,
      });
}

/**
 * How far the walk went through a room's Timeline: every entry of a room it
 * walked through, none of a room its assessed history does not reach, and in
 * the room it stopped in, the entries before its stop. An entry at an `entry`
 * stop is blocking: the walk reached it and blocks on its own contact there.
 */
interface RoomWalk {
  readonly entry: (entryIndex: number) => 'settled' | 'blocking' | 'unreached';
}

function roomWalk(assembly: ProjectEvaluationAssembly, occurrence: OccurrenceAddress): RoomWalk {
  const all: RoomWalk = { entry: () => 'settled' };
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === occurrence.biomeKey,
  );
  if (biome === undefined || biome.coverage.kind !== 'prefix') return all;
  const key = semanticAddressKey(occurrence);
  if (
    'history' in biome &&
    !biome.history.rooms.some((room) => semanticAddressKey(room.origin) === key)
  )
    return { entry: () => 'unreached' };
  const stop = biome.coverage.roomStop;
  if (stop === undefined || semanticAddressKey(stop.room) !== key) return all;
  return {
    entry: (entryIndex) =>
      entryIndex < stop.entryIndex
        ? 'settled'
        : entryIndex === stop.entryIndex && stop.at === 'entry'
          ? 'blocking'
          : 'unreached',
  };
}

/**
 * The loot the game spawns in one entered room, grouped by the
 * moment it appears or the action whose settlement spawns it. Items are what
 * spawned, from the active action domain and the reached due contacts, placed
 * or not; undefined for a room the evaluated biome does not enter. Only what
 * the walk produced is published: a moment's items once the walk reaches its
 * Timeline boundary, all together even while it blocks there (how each item
 * resolves is its own row's question), and an action's spawn once the walk
 * settled that action. Nothing past the room's stop and nothing from a source
 * action still unresolved at it is listed.
 */
export function spawnedLootForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomSpawnedLoot | undefined {
  const room = authoredRoom(assembly, occurrence);
  if (room === undefined || !room.entered) return undefined;
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const roster = room.roomActionRoster;
  const structure = roster.lifecycleStructure;
  const actionAddress = (reference: RoomActionReference) =>
    createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));
  const liveRows = roster.rows.filter((row) => !row.stale);
  const rowByKey = new Map(liveRows.map((row) => [row.key, row]));

  const fromRow = (
    row: RoomActionRow,
    source: SpawnedLootSource,
    lockedUntil?: string,
  ): SpawnedLootItem => {
    const action = actionAddress(row.reference);
    const command = row.rank === null ? insertion(room, row, action) : undefined;
    const needsChoice = row.rank === null && rowResolvesLevel(room, row.reference);
    return frozen({
      owner: row.owner,
      reference: row.reference,
      source: frozen(source),
      participation: row.participation,
      placement:
        row.rank !== null
          ? frozen({ kind: 'placed' as const, action, rank: row.rank })
          : frozen({
              kind: 'unplaced' as const,
              ...(command === undefined ? {} : { command }),
            }),
      ...(lockedUntil === undefined ? {} : { lockedUntil }),
      ...(needsChoice ? { needsChoice: 'levelResolution' as const } : {}),
    });
  };
  /** Placing a derived pickup authors its reward: a fixed one, else one of its single type. */
  const derivedResolvesLevel = (
    entry: AcquisitionEntryAddress,
    capability: {
      readonly rewardTypes?: readonly string[];
      readonly fixedReward?: AuthoredRewardState;
      readonly producerLifecycleKey?: string;
    },
  ): boolean => {
    const authored = room.acquisitionSites[entry.site.pointKey]?.entries[entry.entryKey];
    if (authored !== undefined && authored !== null)
      return resolvesLevel(authored.levelResolutionsByAcquisitionRole);
    if (capability.fixedReward !== undefined)
      return resolvesLevel(capability.fixedReward.levelResolutionsByAcquisitionRole);
    const rewardType = capability.rewardTypes?.length === 1 ? capability.rewardTypes[0] : undefined;
    return (
      rewardType !== undefined &&
      capability.producerLifecycleKey !== undefined &&
      createUnresolvedLevelResolutions(
        catalog,
        { rewardType },
        { kind: 'producerLifecycle', key: capability.producerLifecycleKey },
        occurrence.routeKey,
      ) !== undefined
    );
  };
  /** A derived pickup joins its ranked row only for placement. */
  const fromDerived = (
    entry: AcquisitionEntryAddress,
    reference: RoomActionReference,
    family: AcquisitionEntrySourceFamily,
    participation: RoomActionParticipation,
    command: ProjectCommand | undefined,
    capability: Parameters<typeof derivedResolvesLevel>[1],
  ): SpawnedLootItem => {
    const placed = liveRows.find(
      (row) =>
        row.rank !== null &&
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === entry.site.pointKey &&
        row.reference.entryKey === entry.entryKey,
    );
    return frozen({
      owner: entry,
      reference: placed?.reference ?? reference,
      source: frozen({ kind: 'generated' as const, family }),
      participation: placed?.participation ?? participation,
      placement:
        placed?.rank !== undefined && placed.rank !== null
          ? frozen({
              kind: 'placed' as const,
              action: actionAddress(placed.reference),
              rank: placed.rank,
            })
          : frozen({
              kind: 'unplaced' as const,
              ...(command === undefined ? {} : { command }),
            }),
      ...(placed?.rank === undefined || placed.rank === null
        ? derivedResolvesLevel(entry, capability)
          ? { needsChoice: 'levelResolution' as const }
          : {}
        : {}),
    });
  };

  const phaseKeys = structure.phases.map((phase) => phase.phaseKey);
  const lastPhaseKey = phaseKeys.at(-1);
  const phaseDefinition = (phaseKey: string) => {
    const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(
      assembly,
      createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        phaseKey,
      ),
    );
    return status?.kind === 'active' && status.encounterDefinitionKey !== undefined
      ? catalog.encounterDefinitions.byKey[status.encounterDefinitionKey]
      : undefined;
  };
  const startSpawnPhase = phaseKeys.find(
    (phaseKey) => phaseDefinition(phaseKey)?.createsIncomingRewardAtStart === true,
  );
  const combatSpawnPhase = phaseKeys.find(
    (phaseKey) => phaseDefinition(phaseKey)?.createsIncomingRewardInCombat === true,
  );

  const walk = roomWalk(assembly, occurrence);
  const entries = room.roomLifecycleTimeline.entries;
  type EntryState = ReturnType<RoomWalk['entry']>;
  /** A boundary the room lacks stands at its last entry. */
  const boundaryState = (kind: string, phaseKey?: string): EntryState => {
    const index = entries.findIndex(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === kind &&
        (phaseKey === undefined ||
          ('phaseKey' in entry.boundary && entry.boundary.phaseKey === phaseKey)),
    );
    return walk.entry(index >= 0 ? index : entries.length - 1);
  };
  /** An action the walk never ranks never runs, so it settles nothing. */
  const actionSettled = (reference: RoomActionReference): boolean => {
    const key = roomActionKey(reference);
    const index = entries.findIndex((entry) => entry.kind === 'action' && entry.action.key === key);
    return index >= 0 && walk.entry(index) === 'settled';
  };
  const encounterEndState = (phaseKey: string): EntryState =>
    entries.some(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'encounterEnd' &&
        entry.boundary.phaseKey === phaseKey,
    )
      ? boundaryState('encounterEnd', phaseKey)
      : boundaryState('bossDefeated', phaseKey);
  const momentState = (kind: SpawnMomentKind, phaseKey: string | undefined): EntryState => {
    switch (kind) {
      case 'roomEntered':
      case 'deliveryFlush':
        return boundaryState('roomEntered');
      case 'encounterStart':
      case 'duringEncounter':
        return phaseKey === undefined
          ? boundaryState('roomEntered')
          : boundaryState('encounterStart', phaseKey);
      case 'encounterEnd':
        return phaseKey === undefined
          ? walk.entry(entries.length - 1)
          : encounterEndState(phaseKey);
      case 'afterEncounterReward': {
        const end =
          phaseKey === undefined ? walk.entry(entries.length - 1) : encounterEndState(phaseKey);
        // A Ship wheel's end effects spawn only once its reward is collected.
        const wheelKey = structure.phases.find(
          (phase) => phase.phaseKey === phaseKey,
        )?.rewardWheelKey;
        const collected =
          wheelKey !== undefined &&
          actionSettled(frozen({ kind: 'interactWheelReward' as const, wheelKey }));
        return collected ? end : 'unreached';
      }
    }
  };
  /** Everything a moment spawns spawns together once the walk reaches it. */
  const reached = (state: EntryState): boolean => state !== 'unreached';

  const moments = new Map<string, { kind: SpawnMomentKind; phaseKey?: string }>();
  const momentItems = new Map<string, SpawnedLootItem[]>();
  const momentKey = (kind: SpawnMomentKind, phaseKey?: string) =>
    phaseKey === undefined ? kind : `${kind}:${phaseKey}`;
  const add = (kind: SpawnMomentKind, phaseKey: string | undefined, item: SpawnedLootItem) => {
    if (!reached(momentState(kind, phaseKey))) return;
    const key = momentKey(kind, phaseKey);
    if (!moments.has(key)) moments.set(key, phaseKey === undefined ? { kind } : { kind, phaseKey });
    const items = momentItems.get(key) ?? [];
    items.push(item);
    momentItems.set(key, items);
  };
  /** A phase's end: its reward first, then what its end effects spawn. */
  const endEffectsMoment = (phaseKey: string): SpawnMomentKind =>
    structure.phases.find((phase) => phase.phaseKey === phaseKey)?.rewardWheelKey !== undefined
      ? 'afterEncounterReward'
      : 'encounterEnd';

  const unlockKey = (phaseKey: string) => momentKey('encounterEnd', phaseKey);
  const beforeCombat = (row: RoomActionRow) =>
    row.window.kind === 'standard' && row.window.phase === 'beforeCombat';

  // Rewards, which each moment spawns before its other loot.
  for (const row of liveRows) {
    const reference = row.reference;
    switch (reference.kind) {
      case 'interactIncomingReward': {
        const roomReward = { kind: 'roomReward' } as const;
        // Roles before combat (an Opening reward, Devotion's choice) are there on entry.
        if (beforeCombat(row)) add('roomEntered', undefined, fromRow(row, roomReward));
        else if (startSpawnPhase !== undefined)
          // An H miniboss cages its reward until the encounter ends.
          add(
            'encounterStart',
            startSpawnPhase,
            fromRow(row, roomReward, unlockKey(startSpawnPhase)),
          );
        else if (combatSpawnPhase !== undefined)
          add('duringEncounter', combatSpawnPhase, fromRow(row, roomReward));
        else if (lastPhaseKey !== undefined)
          add('encounterEnd', lastPhaseKey, fromRow(row, roomReward));
        else add('roomEntered', undefined, fromRow(row, roomReward));
        break;
      }
      case 'collectRequiredReward':
        add(
          lastPhaseKey === undefined ? 'roomEntered' : 'encounterEnd',
          lastPhaseKey,
          fromRow(row, { kind: 'requiredDrop' }),
        );
        break;
      case 'interactWheelReward': {
        const phaseKey = structure.phases.find(
          (phase) => phase.rewardWheelKey === reference.wheelKey,
        )?.phaseKey;
        if (phaseKey !== undefined)
          add(
            'encounterEnd',
            phaseKey,
            fromRow(row, { kind: 'rewardWheel', wheelKey: reference.wheelKey }),
          );
        break;
      }
      case 'interactLocalReward': {
        const cagePhaseKey = row.window.kind === 'fields' ? row.window.phaseKey : undefined;
        add(
          'roomEntered',
          undefined,
          fromRow(
            row,
            {
              kind: 'fieldsReward',
              groupKey: reference.groupKey,
              slotKey: reference.slotKey,
              ...(cagePhaseKey === undefined ? {} : { cagePhaseKey }),
            },
            // A cage holds its reward until its encounter ends.
            cagePhaseKey === undefined ? undefined : unlockKey(cagePhaseKey),
          ),
        );
        break;
      }
      default:
        break;
    }
  }

  // Due deliveries spawn as their delivery traits expire, in trait (purchase) order.
  const owner = room.origin;
  const deliverySite = createAcquisitionSiteAddress(owner, HERMES_SHRINE_DELIVERY_SITE_KEY);
  const purchaseOrder = deliveryPurchaseOrder(assembly);
  const deliveries = derivedAcquisitionEntriesForProjectEvaluationAssembly(assembly, deliverySite)
    .filter((entry) => entry.kind === 'hermesShrineDelivery')
    .map((entry) => ({ entry, order: purchaseOrder(entry.address.entryKey) }))
    .sort((left, right) => compareOrder(left.order, right.order))
    .map(({ entry }) => entry);
  for (const entry of deliveries) {
    const reference = frozen({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: HERMES_SHRINE_DELIVERY_SITE_KEY,
      entryKey: entry.address.entryKey,
      ...(entry.encounterPhaseKey === undefined
        ? {}
        : { encounterPhaseKey: entry.encounterPhaseKey }),
    });
    const item = fromDerived(
      entry.address,
      reference,
      entry.sourceFamily ?? frozen({ kind: 'hermesShrineDelivery' as const }),
      // A due delivery is the required obligation edit settlement places.
      'required',
      frozen({
        kind: 'PlaceHermesShrineDelivery',
        entry: entry.address,
        ...(entry.encounterPhaseKey === undefined
          ? {}
          : { encounterPhaseKey: entry.encounterPhaseKey }),
      }),
      entry,
    );
    if (entry.encounterPhaseKey === undefined) add('deliveryFlush', undefined, item);
    else add(endEffectsMoment(entry.encounterPhaseKey), entry.encounterPhaseKey, item);
  }

  // Matured clock drops follow the deliveries (`CheckChamberTraits`).
  const exitSite = createAcquisitionSiteAddress(owner, 'roomExit');
  const exitEntries = derivedAcquisitionEntriesForProjectEvaluationAssembly(assembly, exitSite);
  for (const entry of exitEntries) {
    if (
      entry.kind !== 'clockedTraitPickup' ||
      entry.encounterPhaseKey === undefined ||
      entry.sourceFamily === undefined
    )
      continue;
    const reference = frozen({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: entry.address.entryKey,
      encounterPhaseKey: entry.encounterPhaseKey,
    });
    add(
      endEffectsMoment(entry.encounterPhaseKey),
      entry.encounterPhaseKey,
      fromDerived(
        entry.address,
        reference,
        entry.sourceFamily,
        entry.participation ?? 'optional',
        clockedTraitPickupPlacementForProjectEvaluationAssembly(assembly, entry.address),
        entry,
      ),
    );
  }

  // Generated pickups an encounter's end or a source action spawns.
  const actionSpawns = new Map<string, { source: RoomActionReference; items: SpawnedLootItem[] }>();
  const addActionSpawn = (source: RoomActionReference, item: SpawnedLootItem) => {
    if (!actionSettled(source)) return;
    const key = roomActionKey(source);
    const spawn = actionSpawns.get(key) ?? { source, items: [] };
    spawn.items.push(item);
    actionSpawns.set(key, spawn);
  };
  for (const row of liveRows) {
    const reference = row.reference;
    const family = row.sourceFamily;
    if (reference.kind !== 'interactAcquisitionEntry' || family === undefined) continue;
    if (parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined) continue;
    switch (family.kind) {
      case 'heraclesBounty': {
        // His post-combat walk drops it after the encounter's own end spawns.
        const phaseKey = parseHeraclesBountySiteKey(reference.siteKey);
        if (phaseKey !== undefined)
          add('encounterEnd', phaseKey, fromRow(row, { kind: 'generated', family }));
        break;
      }
      // The Artificer's replacement spawns as its source converts; Sea Star's copy as its source is collected.
      case 'trait':
      case 'nemesisEvent':
      case 'erisGift':
      case 'challengeSwitch':
      case 'echo':
      case 'artificer':
      case 'seaStar': {
        if (family.kind === 'echo' && family.effect !== 'lastReward') break;
        const source = row.dependencies.find(
          (dependency) => dependency.kind === 'afterAction' && dependency.authoringOnly !== true,
        );
        if (source?.kind === 'afterAction' && rowByKey.has(roomActionKey(source.action)))
          addActionSpawn(source.action, fromRow(row, { kind: 'generated', family }));
        break;
      }
      case 'hermesShrineDelivery': {
        // A rushed item spawns in its Shrine's own room as the purchase settles.
        const delivery = parseHermesShrineDeliveryEntryKey(reference.entryKey);
        if (
          delivery === undefined ||
          delivery.routeKey !== occurrence.routeKey ||
          delivery.biomeKey !== occurrence.biomeKey ||
          delivery.sourceOccurrenceId !== occurrence.occurrenceId
        )
          break;
        const purchase = row.dependencies.find(
          (dependency) =>
            dependency.kind === 'afterAction' &&
            dependency.action.kind === 'purchaseHermesShrineOffer',
        );
        if (purchase?.kind === 'afterAction' && rowByKey.has(roomActionKey(purchase.action)))
          addActionSpawn(purchase.action, fromRow(row, { kind: 'generated', family }));
        break;
      }
      // A Travel Deal refill is a purchase, not spawned loot.
      case 'shopTravelDealRefill':
        break;
    }
  }
  // Gold Gold Gold's duplicate spawns with its World Shop purchase.
  for (const entry of exitEntries) {
    if (
      entry.kind !== 'echoDoubleShopReward' ||
      entry.address.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY ||
      entry.sourceOfferKey === undefined
    )
      continue;
    const source: RoomActionReference =
      entry.sourceOfferKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? frozen({
            kind: 'interactAcquisitionEntry',
            siteKey: 'roomExit',
            entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          })
        : frozen({ kind: 'interactShopOffer', offerKey: entry.sourceOfferKey });
    addActionSpawn(
      source,
      fromDerived(
        entry.address,
        frozen({
          kind: 'interactAcquisitionEntry' as const,
          siteKey: 'roomExit',
          entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
        }),
        entry.sourceFamily ?? frozen({ kind: 'echo' as const, effect: 'doubleShop' as const }),
        entry.participation ?? 'optional',
        frozen({
          kind: 'PlaceEchoGoldPickup',
          site: exitSite,
          entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          sourceOfferKey: entry.sourceOfferKey,
        }),
        entry,
      ),
    );
  }

  const chronology: string[] = [momentKey('roomEntered'), momentKey('deliveryFlush')];
  for (const phaseKey of phaseKeys)
    chronology.push(
      momentKey('encounterStart', phaseKey),
      momentKey('duringEncounter', phaseKey),
      momentKey('encounterEnd', phaseKey),
      momentKey('afterEncounterReward', phaseKey),
    );
  const unknown = [...moments.keys()].filter((key) => !chronology.includes(key));
  const spawnOrder = [...chronology, ...unknown].flatMap((key) => momentItems.get(key) ?? []);
  const unlocks = phaseKeys.flatMap((phaseKey) => {
    if (!reached(encounterEndState(phaseKey))) return [];
    const key = unlockKey(phaseKey);
    const items = spawnOrder.filter((item) => item.lockedUntil === key);
    return items.length === 0
      ? []
      : [frozen({ key, kind: 'encounterEnd' as const, phaseKey, items: frozen(items) })];
  });
  const rosterOrder = new Map(roster.rows.map((row, index) => [row.key, index]));
  return frozen({
    owner,
    moments: frozen(
      [...chronology, ...unknown].flatMap((key) => {
        const moment = moments.get(key);
        if (moment === undefined) return [];
        return [
          frozen({
            key,
            ...moment,
            items: frozen(momentItems.get(key) ?? []),
          }),
        ];
      }),
    ),
    unlocks: frozen(unlocks),
    actionSpawns: frozen(
      [...actionSpawns.values()]
        .sort(
          (left, right) =>
            (rosterOrder.get(roomActionKey(left.source)) ?? Number.MAX_SAFE_INTEGER) -
            (rosterOrder.get(roomActionKey(right.source)) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((spawn) =>
          frozen({
            source: spawn.source,
            sourceAction: actionAddress(spawn.source),
            items: frozen(spawn.items),
          }),
        ),
    ),
  });
}
