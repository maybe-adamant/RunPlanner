import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createInfernalContractPedestalAddress,
  createRewardWheelAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { positionedCommandInsertionIndexes } from '../../authored-project/commands/dispatch';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { PositionedCommand } from '../../authored-project/commands/chosen-index';
import {
  INITIAL_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  stygianWellGenerationKey,
  stygianWellRerolls,
} from '../../authored-project/feature-rolls';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions/key';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../authored-project/shop';
import type { Catalog } from '../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { RoomActionParticipation, RoomActionRow, RoomActionWindow } from '../room-actions';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import { roomObjectInteractionsForProjectEvaluationAssembly } from './project-evaluation-assembly';
import {
  authoredRoom,
  roomWalk,
  spawnedLootForProjectEvaluationAssembly,
  spawnMomentEntryIndex,
  type SpawnedLootItem,
  type SpawnedLootReward,
  type SpawnedLootSource,
} from './spawned-loot';

/** The room objects a player acts on, as the engine classifies each action today. */
export type LiveObjectKind =
  | 'worldShop'
  | 'contractPedestal'
  | 'hermesShrine'
  | 'stygianWell'
  | 'purgingPool'
  | 'fountain'
  | 'keepsakeRack'
  | 'eris'
  /** An encounter's required NPC contact (Nemesis, Narcissus, Echo, a field NPC). */
  | 'encounterContact'
  | 'gorgon'
  /** A Fields cage's completion. */
  | 'fieldsCage'
  /** A Ship wheel's choice and its offers' rerolls. */
  | 'rewardWheel'
  | 'challengeSwitch'
  | 'lockedDoors'
  /** Door and cage reroll presses. */
  | 'doorRerolls';

/**
 * A choice the command still needs before it applies. The choice's values are
 * not part of this product: a blank Travel Deal item's are read where the
 * room's reached actions end, not at the gap. The indices a command accepts do
 * not depend on the value chosen, since the action it places and its order
 * constraints are the same for every value.
 */
export type LiveActionChoice = 'levelResolution' | 'travelDealItem';

/** One thing that can be done to an item at a gap. */
export type LiveAction =
  /** The authored row standing at this gap: the action taken here. */
  | {
      readonly kind: 'placed';
      readonly reference: RoomActionReference;
      readonly action: RoomActionAddress;
    }
  /** Places a new action at this gap. */
  | {
      readonly kind: 'place';
      readonly reference: RoomActionReference;
      /** Applies as is, its index set to this gap; with `needsChoice`, once the choice is added. */
      readonly command: ProjectCommand;
      /** The required action's default restore position. */
      readonly canonical?: true;
      readonly needsChoice?: LiveActionChoice;
    }
  /** Moves the item's later row to this gap. */
  | {
      readonly kind: 'move';
      readonly reference: RoomActionReference;
      readonly action: RoomActionAddress;
      readonly fromIndex: number;
      readonly command: Extract<ProjectCommand, { readonly kind: 'MoveRoomAction' }>;
    };

/**
 * Whether the item must be acted on, and the last gap at which any action on
 * it is legal: its window and dependencies close there.
 */
export interface LiveObligation {
  readonly participation: RoomActionParticipation;
  /** For a required action: the last gap at which it has a legal action. */
  readonly deadline?: number;
}

/** Loot spawned and not yet collected at the gap. */
export interface LivePickup extends LiveObligation {
  readonly kind: 'pickup';
  /** The reward owner the collect action acquires. */
  readonly owner: SemanticAddress;
  readonly reference: RoomActionReference;
  readonly source: SpawnedLootSource;
  readonly reward?: SpawnedLootReward;
  /** The collect row's lifecycle window, once it is a roster row. */
  readonly window?: RoomActionWindow;
  /** Where it spawned: the gap, and its spawn moment's key or the action whose settlement spawned it. */
  readonly spawn: {
    readonly gap: number;
    readonly moment?: string;
    readonly sourceAction?: RoomActionAddress;
  };
  /** The unlock that frees it, while it is still locked at this gap. */
  readonly lockedUntil?: string;
  readonly actions: readonly LiveAction[];
}

/** An object usable at the gap, with each legal action on it. */
export interface LiveObject {
  readonly kind: 'object';
  readonly object: LiveObjectKind;
  /** The room for a room's own object; the phase, its Gorgon or the wheel otherwise. */
  readonly owner: SemanticAddress;
  readonly actions: readonly (LiveAction & LiveObligation)[];
}

export type LiveItem = LivePickup | LiveObject;

/** What is live between two rows of the room's action order. */
export interface LiveGap {
  /** The action index a new action placed here takes. */
  readonly index: number;
  /**
   * The lifecycle Timeline entries the gap spans: from the entry after the row
   * before it through the entry before the row after it (half-open).
   */
  readonly entries: { readonly from: number; readonly to: number };
  readonly items: readonly LiveItem[];
}

export interface RoomLiveActions {
  readonly owner: OccurrenceAddress;
  /** The gap the walk stands at: the next action goes here. */
  readonly frontier: number;
  /** Every gap through the frontier, in order. */
  readonly gaps: readonly LiveGap[];
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/** The object a row acts on; undefined for a pickup. */
function objectOf(
  occurrence: OccurrenceAddress,
  row: Pick<RoomActionRow, 'reference' | 'sourceFamily'>,
): { readonly object: LiveObjectKind; readonly owner: SemanticAddress } | undefined {
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const reference = row.reference;
  const phase = (phaseKey: string) =>
    createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      phaseKey,
    );
  const own = (object: LiveObjectKind) => frozen({ object, owner: occurrence });
  switch (reference.kind) {
    case 'collectRequiredReward':
    case 'interactIncomingReward':
    case 'interactLocalReward':
    case 'interactWheelReward':
      return undefined;
    case 'interactAcquisitionEntry':
      // A Travel Deal refill is a purchase, not spawned loot.
      return row.sourceFamily?.kind === 'shopTravelDealRefill' ? own('worldShop') : undefined;
    case 'interactShopOffer':
      return own('worldShop');
    case 'interactInfernalContractPedestal':
      return frozen({
        object: 'contractPedestal' as const,
        owner: createInfernalContractPedestalAddress(biome, occurrence.occurrenceId),
      });
    case 'purchaseHermesShrineOffer':
      return own('hermesShrine');
    case 'purchaseStygianWellOffer':
    case 'rerollStygianWell':
      return own('stygianWell');
    case 'sellPurgingPoolTrait':
    case 'rerollPurgingPool':
      return own('purgingPool');
    case 'useFountain':
      return own('fountain');
    case 'interactKeepsakeRack':
      return own('keepsakeRack');
    case 'interactEris':
      return own('eris');
    case 'interactChallengeSwitch':
      return own('challengeSwitch');
    case 'unlockExit':
      return own('lockedDoors');
    case 'reroll':
      return reference.target.kind === 'wheelOffer'
        ? frozen({
            object: 'rewardWheel' as const,
            owner: createRewardWheelAddress(
              biome,
              occurrence.occurrenceId,
              reference.target.wheelKey,
            ),
          })
        : own('doorRerolls');
    case 'chooseRewardWheel':
      return frozen({
        object: 'rewardWheel' as const,
        owner: createRewardWheelAddress(biome, occurrence.occurrenceId, reference.wheelKey),
      });
    case 'interactEncounter':
      return frozen({ object: 'encounterContact' as const, owner: phase(reference.phaseKey) });
    case 'interactGorgon':
      return frozen({
        object: 'gorgon' as const,
        owner: createGorgonPhaseAddress(phase(reference.phaseKey)),
      });
    case 'completeFieldsCage':
      return frozen({ object: 'fieldsCage' as const, owner: phase(reference.phaseKey) });
  }
}

/** The room action a feature purchase command places first. */
function purchaseReference(command: PositionedCommand): RoomActionReference {
  switch (command.kind) {
    case 'ReplaceShopPurchaseParticipation':
      return frozen({ kind: 'interactShopOffer', offerKey: command.offer.offerKey });
    case 'PurchaseShopTravelDealRefill':
      return frozen({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
      });
    case 'SetStygianWellPurchase':
      return frozen({ kind: 'purchaseStygianWellOffer', generationKey: command.generationKey });
    case 'SetHermesShrinePurchase':
      return frozen({
        kind: 'purchaseHermesShrineOffer',
        generationKey: command.generationKey,
        rushed: false,
      });
    case 'PurchaseHermesShrineOffer':
      return frozen({
        kind: 'purchaseHermesShrineOffer',
        generationKey: command.generationKey,
        rushed: command.rushed,
      });
    case 'PlaceHermesShrineDelivery':
    case 'PlaceClockedTraitPickup':
      return frozen({
        kind: 'interactAcquisitionEntry',
        siteKey: command.entry.site.pointKey,
        entryKey: command.entry.entryKey,
        ...(command.encounterPhaseKey === undefined
          ? {}
          : { encounterPhaseKey: command.encounterPhaseKey }),
      });
    case 'PlaceEchoGoldPickup':
      return frozen({
        kind: 'interactAcquisitionEntry',
        siteKey: command.site.pointKey,
        entryKey: command.entryKey,
      });
  }
}

/** A new purchase an object offers, not yet a row: the command and every index it may take. */
interface ObjectPurchase {
  readonly object: LiveObjectKind;
  readonly owner: SemanticAddress;
  readonly reference: RoomActionReference;
  readonly command: ProjectCommand;
  readonly indexes: ReadonlySet<number>;
  readonly needsChoice?: LiveActionChoice;
}

/**
 * The purchases a room's objects offer that are not yet rows: a World Shop's
 * unbought items and live Travel Deal item, a Shrine's unbought items to buy
 * or rush, a Well's unbought stocked items, and an uncollected Pedestal, which
 * only appends.
 */
function objectPurchases(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  occurrence: OccurrenceAddress,
  orderLength: number,
): readonly ObjectPurchase[] {
  const document = assembly.project;
  const purchases: ObjectPurchase[] = [];
  const positioned = (
    object: LiveObjectKind,
    command: PositionedCommand,
    needsChoice?: LiveActionChoice,
    probe: PositionedCommand = command,
  ) => {
    const indexes = positionedCommandInsertionIndexes(document, catalog, probe);
    if (indexes.length === 0) return;
    purchases.push(
      frozen({
        object,
        owner: occurrence,
        reference: purchaseReference(command),
        command,
        indexes: new Set(indexes),
        ...(needsChoice === undefined ? {} : { needsChoice }),
      }),
    );
  };
  const interactions = roomObjectInteractionsForProjectEvaluationAssembly(assembly, occurrence);
  const shop = interactions?.worldShop;
  for (const offer of shop?.offers ?? []) positioned('worldShop', offer.command);
  const refill = shop?.travelDealRefill;
  if (refill !== undefined) {
    if (refill.rewardType !== null) positioned('worldShop', refill.command);
    // A blank item is stocked by the purchase; its positions do not depend on the value.
    else if (refill.values[0] !== undefined)
      positioned('worldShop', refill.command, 'travelDealItem', {
        ...refill.command,
        value: refill.values[0],
      });
  }
  const shrine = interactions?.hermesShrine;
  const shrineItems = [
    ...(shrine?.offers ?? []).map((offer) => ({ offer, candidate: undefined })),
    ...(shrine?.travelDealRefill === undefined
      ? []
      : [
          {
            offer: shrine.travelDealRefill,
            candidate: shrine.travelDealRefill.candidateRewardTypes[0],
          },
        ]),
  ];
  for (const { offer, candidate } of shrineItems)
    for (const command of [offer.buy, offer.rush]) {
      if (offer.rewardType !== null) positioned('hermesShrine', command);
      // A blank refill is stocked by the purchase; its positions do not depend on the reward.
      else if (candidate !== undefined)
        positioned('hermesShrine', command, 'travelDealItem', {
          ...command,
          rewardType: candidate,
        });
    }
  const pedestal = interactions?.championItem?.collect;
  if (pedestal !== undefined && 'command' in pedestal)
    purchases.push(
      frozen({
        object: 'contractPedestal' as const,
        owner: createInfernalContractPedestalAddress(
          createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
          occurrence.occurrenceId,
        ),
        reference: frozen({ kind: 'interactInfernalContractPedestal' as const }),
        command: pedestal.command,
        // Collecting appends where the room's actions end.
        indexes: new Set([orderLength]),
      }),
    );
  const well = room.stygianWell;
  if (well !== undefined) {
    const order = room.roomActionRoster.rows.flatMap((row) =>
      row.rank === null ? [] : [row.reference],
    );
    const purchased = new Set<string>(well.purchasedGenerationKeys ?? []);
    const generationKeys = [
      ...STYGIAN_WELL_SLOT_KEYS.map((slotKey) =>
        stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey),
      ),
      ...stygianWellRerolls(order).flatMap((reroll) =>
        STYGIAN_WELL_SLOT_KEYS.map((slotKey) => stygianWellGenerationKey(reroll.rerollId, slotKey)),
      ),
      'travelDealRefill' as const,
    ];
    for (const generationKey of generationKeys) {
      if (purchased.has(generationKey)) continue;
      positioned('stygianWell', {
        kind: 'SetStygianWellPurchase',
        occurrence,
        generationKey,
        purchased: true,
      });
    }
  }
  return frozen(purchases);
}

function isPositioned(command: ProjectCommand): command is PositionedCommand {
  return (
    command.kind === 'PlaceHermesShrineDelivery' ||
    command.kind === 'PlaceClockedTraitPickup' ||
    command.kind === 'PlaceEchoGoldPickup'
  );
}

/** Command with its index set to the gap. */
function atIndex(command: ProjectCommand, index: number): ProjectCommand {
  return command.kind === 'SetInfernalContractPedestalCollected'
    ? command
    : (frozen({ ...command, index }) as ProjectCommand);
}

/**
 * What is live at each gap of one entered room's action order, from its
 * entry through the walk's frontier: the loot spawned and not yet collected
 * there, and the objects usable there, each with its legal actions at that
 * gap. A gap's legal actions are the roster's authorable insertions and moves
 * to it, the row standing at it, and the feature and placement commands that
 * accept its index; nothing is evaluated again. Undefined for a room the
 * evaluated biome does not enter or the assessed history does not reach.
 */
export function liveActionsForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomLiveActions | undefined {
  const room = authoredRoom(assembly, occurrence);
  if (room === undefined || !room.entered) return undefined;
  const walk = roomWalk(assembly, occurrence);
  if (walk.unreached === true) return undefined;
  const loot = spawnedLootForProjectEvaluationAssembly(catalog, assembly, occurrence);
  if (loot === undefined) return undefined;
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const roster = room.roomActionRoster;
  const entries = room.roomLifecycleTimeline.entries;
  const liveRows = roster.rows.filter((row) => !row.stale);
  const orderLength = roster.rows.filter((row) => row.rank !== null).length;
  const rowByKey = new Map(liveRows.map((row) => [row.key, row]));
  const actionAddress = (reference: RoomActionReference) =>
    createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));

  // Stale rows have no Timeline entry, so the gaps around one share one stretch of it.
  const actionEntries = entries.flatMap((entry, index) =>
    entry.kind === 'action' ? [{ index, rank: entry.rank }] : [],
  );
  /** The first gap of the stretch holding a Timeline entry. */
  const gapOfEntry = (entryIndex: number) =>
    actionEntries.findLast((entry) => entry.index < entryIndex)?.rank ?? 0;
  /** The last gap of the stretch holding a Timeline entry. */
  const lastGapOfEntry = (entryIndex: number) =>
    (actionEntries.find((entry) => entry.index >= entryIndex)?.rank ?? orderLength + 1) - 1;
  const stop = walk.stop;
  // The walk passed every entry before its stop, as the spawned loot reads it.
  const frontier =
    stop === undefined || stop.kind === 'exit' ? orderLength : lastGapOfEntry(stop.entryIndex);

  /**
   * Every gap of the whole order at which a row may stand, with the action
   * that puts it there: its own gap, and the roster's authorable insertions
   * and moves. The one authority for a row's offered actions and its deadline.
   */
  const rowGaps = new Map<string, Map<number, LiveAction>>();
  const addRowGap = (key: string, gap: number, action: LiveAction) => {
    const byGap = rowGaps.get(key) ?? new Map<number, LiveAction>();
    byGap.set(gap, action);
    rowGaps.set(key, byGap);
  };
  for (const row of liveRows)
    if (row.rank !== null)
      addRowGap(
        row.key,
        row.rank - 1,
        frozen({
          kind: 'placed' as const,
          reference: row.reference,
          action: actionAddress(row.reference),
        }),
      );
  for (const proposal of roster.proposals) {
    if (!proposal.structurallyAuthorable || proposal.toIndex === undefined) continue;
    const row = rowByKey.get(roomActionKey(proposal.reference));
    if (row === undefined) continue;
    const action = actionAddress(row.reference);
    if (proposal.kind === 'insert' && row.rank === null)
      addRowGap(
        row.key,
        proposal.toIndex,
        frozen({
          kind: 'place' as const,
          reference: row.reference,
          command: frozen({
            kind: 'InsertRoomAction' as const,
            action,
            reference: row.reference,
            index: proposal.toIndex,
          }),
          ...(proposal.canonical === true ? { canonical: true as const } : {}),
        }),
      );
    else if (proposal.kind === 'move' && row.rank !== null && proposal.anchorIndex !== undefined)
      addRowGap(
        row.key,
        proposal.anchorIndex,
        frozen({
          kind: 'move' as const,
          reference: row.reference,
          action,
          fromIndex: row.rank - 1,
          command: frozen({ kind: 'MoveRoomAction' as const, action, toIndex: proposal.toIndex }),
        }),
      );
  }
  /** A row's action at a gap; a row placed before the gap is done there and has none. */
  const rowAction = (row: RoomActionRow, gap: number): LiveAction | undefined =>
    row.rank !== null && row.rank - 1 < gap ? undefined : rowGaps.get(row.key)?.get(gap);
  /** For a required row, the last gap of the whole order at which it may stand. */
  const rowDeadline = (row: RoomActionRow): number | undefined => {
    const gaps = rowGaps.get(row.key);
    return row.participation !== 'required' || gaps === undefined
      ? undefined
      : Math.max(...gaps.keys());
  };

  // Pickups, from the spawned loot, each with the gap it spawned at.
  interface PickupSpawn {
    readonly item: SpawnedLootItem;
    readonly gap: number;
    readonly moment?: string;
    readonly sourceAction?: RoomActionAddress;
  }
  const spawns: PickupSpawn[] = [];
  for (const moment of loot.moments) {
    let gap = gapOfEntry(spawnMomentEntryIndex(entries, moment.kind, moment.phaseKey));
    if (moment.kind === 'afterEncounterReward') {
      // A Ship wheel's end effects spawn once its reward is collected.
      const wheelKey = roster.lifecycleStructure.phases.find(
        (phase) => phase.phaseKey === moment.phaseKey,
      )?.rewardWheelKey;
      const reward = liveRows.find(
        (row) =>
          row.reference.kind === 'interactWheelReward' && row.reference.wheelKey === wheelKey,
      );
      if (reward?.rank !== null && reward?.rank !== undefined) gap = Math.max(gap, reward.rank);
    }
    for (const item of moment.items) spawns.push({ item, gap, moment: moment.key });
  }
  for (const spawn of loot.actionSpawns) {
    const source = rowByKey.get(roomActionKey(spawn.source));
    if (source?.rank === null || source?.rank === undefined) continue;
    for (const item of spawn.items)
      spawns.push({ item, gap: source.rank, sourceAction: spawn.sourceAction });
  }
  const unlockGaps = new Map(
    loot.unlocks.map((unlock) => [
      unlock.key,
      gapOfEntry(spawnMomentEntryIndex(entries, 'encounterEnd', unlock.phaseKey)),
    ]),
  );
  const derivedIndexes = new Map<string, ReadonlySet<number>>();
  const pickupAt = (spawn: PickupSpawn, gap: number): LivePickup | undefined => {
    const { item } = spawn;
    if (gap < spawn.gap) return undefined;
    const placedIndex = item.placement.kind === 'placed' ? item.placement.rank - 1 : undefined;
    if (placedIndex !== undefined && placedIndex < gap) return undefined;
    const key = roomActionKey(item.reference);
    const row = rowByKey.get(key);
    const actions: LiveAction[] = [];
    let deadline: number | undefined;
    if (row !== undefined && (row.rank !== null || item.placement.kind === 'unplaced')) {
      const action = rowAction(row, gap);
      if (action !== undefined)
        actions.push(
          action.kind === 'place' && item.needsChoice !== undefined
            ? frozen({ ...action, needsChoice: item.needsChoice })
            : action,
        );
      deadline = rowDeadline(row);
    } else if (item.placement.kind === 'unplaced' && item.placement.command !== undefined) {
      const command = item.placement.command;
      const indexes =
        derivedIndexes.get(key) ??
        (isPositioned(command)
          ? new Set(positionedCommandInsertionIndexes(assembly.project, catalog, command))
          : new Set<number>());
      derivedIndexes.set(key, indexes);
      if (indexes.has(gap))
        actions.push(
          frozen({
            kind: 'place' as const,
            reference: item.reference,
            command: atIndex(command, gap),
            ...(item.needsChoice === undefined ? {} : { needsChoice: item.needsChoice }),
          }),
        );
      if (item.participation === 'required' && indexes.size > 0) deadline = Math.max(...indexes);
    }
    const unlockGap = item.lockedUntil === undefined ? undefined : unlockGaps.get(item.lockedUntil);
    return frozen({
      kind: 'pickup' as const,
      owner: item.owner,
      reference: item.reference,
      source: item.source,
      ...(item.reward === undefined ? {} : { reward: item.reward }),
      participation: item.participation,
      ...(deadline === undefined ? {} : { deadline }),
      ...(row === undefined ? {} : { window: row.window }),
      spawn: frozen({
        gap: spawn.gap,
        ...(spawn.moment === undefined ? {} : { moment: spawn.moment }),
        ...(spawn.sourceAction === undefined ? {} : { sourceAction: spawn.sourceAction }),
      }),
      ...(item.lockedUntil !== undefined && (unlockGap === undefined || unlockGap > gap)
        ? { lockedUntil: item.lockedUntil }
        : {}),
      actions: frozen(actions),
    });
  };

  // Objects: every row acting on one, and the purchases not yet rows.
  const objectRows = liveRows.flatMap((row) => {
    const object = objectOf(occurrence, row);
    return object === undefined ? [] : [{ row, ...object }];
  });
  const purchases = objectPurchases(catalog, assembly, room, occurrence, orderLength);
  const objectsAt = (gap: number): LiveObject[] => {
    const byObject = new Map<
      string,
      {
        object: LiveObjectKind;
        owner: SemanticAddress;
        actions: (LiveAction & LiveObligation)[];
      }
    >();
    const add = (
      object: LiveObjectKind,
      owner: SemanticAddress,
      action: LiveAction & LiveObligation,
    ) => {
      const key = `${object}:${semanticAddressKey(owner)}`;
      const entry = byObject.get(key) ?? { object, owner, actions: [] };
      entry.actions.push(action);
      byObject.set(key, entry);
    };
    for (const { row, object, owner } of objectRows) {
      const action = rowAction(row, gap);
      if (action === undefined) continue;
      const deadline = rowDeadline(row);
      add(
        object,
        owner,
        frozen({
          ...action,
          participation: row.participation,
          ...(deadline === undefined ? {} : { deadline }),
        }),
      );
    }
    for (const purchase of purchases) {
      if (!purchase.indexes.has(gap)) continue;
      add(
        purchase.object,
        purchase.owner,
        frozen({
          kind: 'place' as const,
          reference: purchase.reference,
          command: atIndex(purchase.command, gap),
          ...(purchase.needsChoice === undefined ? {} : { needsChoice: purchase.needsChoice }),
          participation: 'optional' as const,
        }),
      );
    }
    return [...byObject.values()].map((entry) =>
      frozen({
        kind: 'object' as const,
        object: entry.object,
        owner: entry.owner,
        actions: frozen(entry.actions),
      }),
    );
  };

  const gaps: LiveGap[] = [];
  for (let gap = 0; gap <= frontier; gap += 1) {
    const items: LiveItem[] = [
      ...spawns.flatMap((spawn) => {
        const pickup = pickupAt(spawn, gap);
        return pickup === undefined ? [] : [pickup];
      }),
      ...objectsAt(gap),
    ];
    gaps.push(
      frozen({
        index: gap,
        entries: frozen({
          from: (actionEntries.findLast((entry) => entry.rank <= gap)?.index ?? -1) + 1,
          to: Math.min(
            actionEntries.find((entry) => entry.rank > gap)?.index ?? entries.length,
            gap === frontier && stop !== undefined && stop.kind !== 'exit'
              ? stop.entryIndex + (stop.at === 'entry' ? 1 : 0)
              : entries.length,
          ),
        }),
        items: frozen(items),
      }),
    );
  }
  return frozen({ owner: room.origin, frontier, gaps: frozen(gaps) });
}
