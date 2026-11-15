import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  createGorgonPhaseAddress,
  createInfernalContractPedestalAddress,
  createRewardWheelAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { authoredAcquisitionSources } from '../../authored-project/acquisition/acquisition-sources';
import { positionedCommandInsertionIndexes } from '../../authored-project/commands/dispatch';
import type {
  DerivedPickupPlacementCommand,
  ProjectCommand,
} from '../../authored-project/commands/types';
import {
  positionedCommandReference,
  type PositionedCommand,
} from '../../authored-project/commands/chosen-index';
import {
  INITIAL_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  featureRerollIdsInUse,
  rerollActionKind,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  stygianWellPurchasedGenerationKeys,
  stygianWellRerolls,
} from '../../authored-project/feature-rolls';
import type {
  AcquisitionDisposition,
  AuthoredRewardState,
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from '../../authored-project/model';
import {
  nextRerollId,
  rerollAppendIndex,
  type RerollSurface,
} from '../../authored-project/rerolls';
import { roomActionKey } from '../../authored-project/room-actions/key';
import {
  requiredObjectDeadline,
  waitsForRequiredObjects,
} from '../../authored-project/room-actions/required-object-gate';
import { composeStartingReward } from '../../authored-project/room-state/starting-reward';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../authored-project/shop';
import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import {
  asUnplacedWhenReplaced,
  type RoomActionParticipation,
  type RoomActionRow,
} from '../room-actions';
import { timedPickupReference, type UnsettledPickupSource } from '../rewards/acquisition/artifacts';
import { activeRoomActionRoster, authoredRoom, roomWalk } from './evaluated-room';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  placementAcquisitionConversionForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  roomObjectInteractionsForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from './project-evaluation-assembly';
import {
  rerollSpendAllowanceForProjectEvaluationAssembly,
  rerollSurfaceForProjectEvaluationAssembly,
} from './reroll-authoring';
import {
  rewardOutcome,
  spawnedLootForProjectEvaluationAssembly,
  type SpawnCause,
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

/** One distinct interaction a player has with an item. */
export type LiveVerbKind =
  /** Collect a loose pickup, or take the Contract pedestal's item. */
  | 'pickUp'
  /** Collect a pickup converting it to gold with the Time Piece. */
  | 'goldify'
  /** Collect a pickup transforming it with the Artificer. */
  | 'transform'
  /** Buy a World Shop, Travel Deal, Hermes Shrine or Stygian Well item. */
  | 'buy'
  /** Rush a bought Hermes Shrine item. */
  | 'rush'
  /** Sell a trait at a Pool of Purging. */
  | 'sell'
  /** Press a door, cage or wheel reroll, or reroll a Well's or Pool's list. */
  | 'reroll'
  /** Choose a Ship wheel, which starts its phase's fight. */
  | 'choose'
  /** Talk to an encounter's NPC, the Gorgon's Athena or Eris. */
  | 'talkTo'
  /** Unlock a Fields cage, starting its fight, or press a locked door. */
  | 'unlock'
  /** Use the fountain or the keepsake rack. */
  | 'use'
  /** Press the challenge switch. */
  | 'press';

/**
 * The picker a verb needs. `before`: the picker supplies the verb's commands,
 * which are then absent; the indices a command accepts do not depend on the
 * value chosen. `after`: the commands apply as is and the picker then sets the
 * placed row's own outcome, which placing the row opens.
 */
export type LiveVerbChoice =
  /** A Pom's level, or the trait a level resolution takes. */
  | { readonly picker: 'levelResolution'; readonly timing: 'after' }
  /**
   * The item Travel Deal restocks: the purchase (a World Shop item's) or rush
   * (a Hermes Shrine item's) restocks its slot as it settles, so the restocked
   * item is that row's outcome, from the room's object interactions.
   */
  | { readonly picker: 'travelDealRefill'; readonly timing: 'after' }
  /**
   * Which of a Ship wheel's offers its choice takes: each offer, in side
   * order, with the commands that place the choice with that offer picked.
   */
  | {
      readonly picker: 'rewardWheelPick';
      readonly timing: 'before';
      readonly wheel: RewardWheelAddress;
      readonly values: readonly LiveWheelPick[];
    }
  /**
   * A press's target, from the reroll surface. Choosing one places the press
   * with its result unset, which its row's `rerollResult` picker then opens on.
   */
  | { readonly picker: 'rerollPress'; readonly timing: 'before'; readonly surface: RerollSurface }
  /** The reward a placed door, cage or wheel press draws. */
  | { readonly picker: 'rerollResult'; readonly timing: 'after' }
  /** The list a Well or Pool reroll restocks, pinned slot by slot. */
  | { readonly picker: 'stygianWellRoll' | 'purgingPoolRoll'; readonly timing: 'after' }
  /** The keepsake the rack swaps in; with none chosen the held keepsake stays. */
  | { readonly picker: 'keepsake'; readonly timing: 'after' }
  /** The reward the Artificer's replacement takes. */
  | { readonly picker: 'artificerReplacement'; readonly timing: 'after' }
  /**
   * The outcome the placed row settles, which its own picker shows where the
   * reached state has one: Sea Star's copy of a pickup, a pickup's or
   * contact's trait offer (a boon, the
   * Gorgon's Athena), an Anvil of Fates result, a Path of Stars screen, a
   * Fateful Twist's result, a Nemesis event's reward and traded boon, the
   * Phial's target at the fountain, a challenge switch's outcome, or the
   * fight a locked door's press starts.
   */
  | {
      readonly picker:
        | 'seaStar'
        | 'traitOffer'
        | 'anvilResult'
        | 'hexActivation'
        | 'stygianWellTwist'
        | 'nemesisEvent'
        | 'fountainRarity'
        | 'challengeSwitchOutcome'
        | 'unlockExitFight';
      readonly timing: 'after';
    };

/** One offer a wheel's choice can take. */
export interface LiveWheelPick {
  readonly offerKey: string;
  /** Its 1-based place among the wheel's offers. */
  readonly pickedOfferIndex: number;
  /** The reward it offers; absent while it is not chosen. */
  readonly offer?: ResolvedRewardOffer;
  readonly commands: readonly ProjectCommand[];
}

/** One interaction available on an item at a gap. */
export interface LiveVerb {
  readonly verb: LiveVerbKind;
  readonly participation: RoomActionParticipation;
  /** For a required verb: the last gap at which its window and dependencies let it stand. */
  readonly deadline?: number;
  /**
   * The row it stands as or places; absent for a new door, cage or wheel
   * reroll press, whose target the picker chooses.
   */
  readonly reference?: RoomActionReference;
  /** For a new door, cage or wheel reroll press: the reroll id its row takes. */
  readonly rerollId?: string;
  /** The conversion's acquisition role, for a verb that sets one. */
  readonly acquisition?: AcquisitionRoleAddress;
  /** The row standing at this gap performs this verb: nothing to do. */
  readonly standing?: true;
  /**
   * Performs it at this gap, in order, as one edit: a new row's placement, a
   * later row's move here, or a conversion. Empty while standing; absent when
   * the picker supplies them.
   */
  readonly commands?: readonly ProjectCommand[];
  /** A required action's default restore position. */
  readonly canonical?: true;
  readonly choice?: LiveVerbChoice;
}

/** Loot spawned and not yet collected at the gap. */
export interface LivePickup {
  readonly kind: 'pickup';
  /** The reward owner the collect action acquires. */
  readonly owner: SemanticAddress;
  readonly reference: RoomActionReference;
  readonly source: SpawnedLootSource;
  readonly reward?: SpawnedLootReward;
  readonly participation: RoomActionParticipation;
  /** For a required pickup: the last gap at which it has a legal action. */
  readonly deadline?: number;
  /**
   * For an unplaced derived pickup (a due delivery, a matured clocked drop,
   * Echo's Gold duplicate): the last index its placement command accepts.
   */
  readonly lastIndex?: number;
  /** Where it spawned: the gap, and its spawn moment's key or the action whose settlement spawned it. */
  readonly spawn: {
    readonly gap: number;
    readonly moment?: string;
    readonly sourceAction?: RoomActionAddress;
  };
  /** The unlock that frees it, while it is still locked at this gap. */
  readonly lockedUntil?: string;
  readonly verbs: readonly LiveVerb[];
}

/** An object usable at the gap, with each interaction it allows there. */
export interface LiveObject {
  readonly kind: 'object';
  readonly object: LiveObjectKind;
  /** The room for a room's own object; the phase, its Gorgon or the wheel otherwise. */
  readonly owner: SemanticAddress;
  /**
   * Its rows' and purchases' verbs, then the ones whose row a picker creates
   * or the engine allocates (a reroll press, a Well or Pool reroll); each
   * stocked Pool slot's sale is a roster row.
   */
  readonly verbs: readonly LiveVerb[];
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

/**
 * What lets the room progress at the frontier, once nothing else required
 * is live there: leaving through its doors, or choosing the next Ship wheel,
 * whose verb stands on that wheel. Leaving is the exit decision, not a row.
 */
export type LiveProgression =
  | { readonly kind: 'leaveRoom' }
  | { readonly kind: 'chooseWheel'; readonly wheel: RewardWheelAddress };

export interface LiveRoom {
  readonly owner: OccurrenceAddress;
  /** The gap the walk stands at: the next action goes here. */
  readonly frontier: number;
  /** Every gap through the frontier, in order. */
  readonly gaps: readonly LiveGap[];
  /** What lets the room progress at the frontier once nothing else required is live there. */
  readonly progression?: LiveProgression;
  /** The optional pickups still loose when the room is left, once the walk passes the room. */
  readonly leftBehind?: readonly LivePickup[];
  /**
   * The walk stopped in the room before passing its frontier: at a required
   * item left unplaced, which the frontier's items answer, or at any other
   * block, which no frontier item answers. Absent once the walk passed it.
   */
  readonly blocked?: { readonly kind: 'placement' } | { readonly kind: 'stop' };
}

/**
 * `interactions`: every verb, with a standing row's conversions and the
 * object verbs a picker creates. `placements`: only the verb each row,
 * placement or purchase performs, for a consumer that places what a room
 * requires and never pays for conversions or pickers.
 */
export type LiveRoomDetail = 'interactions' | 'placements';

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
    case 'rushHermesShrineOffer':
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

/** A new purchase an object offers, not yet a row: the command and every index it may take. */
interface ObjectPurchase {
  readonly object: LiveObjectKind;
  readonly owner: SemanticAddress;
  readonly reference: RoomActionReference;
  readonly command: ProjectCommand;
  readonly indexes: ReadonlySet<number>;
  readonly choice?: LiveVerbChoice;
}

const TRAVEL_DEAL_REFILL_CHOICE: LiveVerbChoice = frozen({
  picker: 'travelDealRefill',
  timing: 'after',
});

/**
 * The purchases a room's objects offer that are not yet rows: a World Shop's
 * unbought items and stocked Travel Deal item, a Shrine's unbought items to
 * buy, its stocked refill and bought ones to rush, a Well's unbought stocked
 * items, and an uncollected Pedestal, which only appends. The purchase or rush
 * Travel Deal restocks on settles the restocked item, so its picker follows it.
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
    choice?: LiveVerbChoice,
    probe: PositionedCommand = command,
  ) => {
    const indexes = positionedCommandInsertionIndexes(document, catalog, probe);
    if (indexes.length === 0) return;
    purchases.push(
      frozen({
        object,
        owner: occurrence,
        reference: positionedCommandReference(command),
        command,
        indexes: new Set(indexes),
        ...(choice === undefined ? {} : { choice }),
      }),
    );
  };
  const interactions = roomObjectInteractionsForProjectEvaluationAssembly(assembly, occurrence);
  const shop = interactions?.worldShop;
  const restocks =
    shop?.travelDealRestocksNextPurchase === true ? TRAVEL_DEAL_REFILL_CHOICE : undefined;
  for (const offer of shop?.offers ?? []) positioned('worldShop', offer.command, restocks);
  // A blank item stops the walk at the purchase that restocks it, so only a stocked one is bought.
  const refill = shop?.travelDealRefill;
  if (refill !== undefined && refill.rewardType !== null) positioned('worldShop', refill.command);
  const shrine = interactions?.hermesShrine;
  for (const offer of [
    ...(shrine?.offers ?? []),
    ...(shrine?.travelDealRefill === undefined ? [] : [shrine.travelDealRefill]),
  ])
    if (offer.rewardType !== null) positioned('hermesShrine', offer.buy);
  // A bought item's rush, wherever its rush row may enter; an initial item's may refill.
  for (const { rush } of shrine?.rushes ?? [])
    positioned(
      'hermesShrine',
      {
        kind: rush.kind,
        occurrence: rush.occurrence,
        generationKey: rush.generationKey,
        rushed: rush.rushed,
      },
      shrine?.travelDealRefillsNextRush === true && rush.generationKey !== 'travelDealRefill'
        ? TRAVEL_DEAL_REFILL_CHOICE
        : undefined,
    );
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
    const purchased = new Set<string>(stygianWellPurchasedGenerationKeys(order));
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

/** The verb a row of this kind performs. */
export function liveVerbKind(reference: RoomActionReference): LiveVerbKind {
  switch (reference.kind) {
    case 'collectRequiredReward':
    case 'interactIncomingReward':
    case 'interactLocalReward':
    case 'interactWheelReward':
    case 'interactInfernalContractPedestal':
      return 'pickUp';
    case 'interactAcquisitionEntry':
      // A Travel Deal refill is a purchase, not spawned loot.
      return reference.siteKey === 'roomExit' && reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? 'buy'
        : 'pickUp';
    case 'interactShopOffer':
    case 'purchaseStygianWellOffer':
      return 'buy';
    case 'purchaseHermesShrineOffer':
      return 'buy';
    case 'rushHermesShrineOffer':
      return 'rush';
    case 'sellPurgingPoolTrait':
      return 'sell';
    case 'reroll':
    case 'rerollStygianWell':
    case 'rerollPurgingPool':
      return 'reroll';
    case 'chooseRewardWheel':
      return 'choose';
    case 'interactEncounter':
    case 'interactGorgon':
    case 'interactEris':
      return 'talkTo';
    case 'completeFieldsCage':
    case 'unlockExit':
      return 'unlock';
    case 'useFountain':
    case 'interactKeepsakeRack':
      return 'use';
    case 'interactChallengeSwitch':
      return 'press';
  }
}

function authoredOccurrence(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
): RoomOccurrence | undefined {
  return document.route.biomes
    .find((biome) => biome.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrence.occurrenceId);
}

/** The run's starting reward, which the route's first room acquires instead of its own. */
function routeStartIncoming(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
  authored: RoomOccurrence,
): AuthoredRewardState | undefined {
  const first = document.route.biomes[0];
  if (
    first?.biomeKey !== occurrence.biomeKey ||
    first.topology?.startOccurrenceId !== occurrence.occurrenceId
  )
    return undefined;
  return (
    composeStartingReward(
      document.route.loadout.startingReward,
      authored.startingRewardAcquisition,
    ) ?? undefined
  );
}

/** The verb taking an acquisition with each disposition; a normal one is the row's own verb. */
const DISPOSITION_VERBS: readonly (readonly [
  AcquisitionDisposition['kind'],
  LiveVerbKind | null,
])[] = [
  ['normal', null],
  ['timePiece', 'goldify'],
  ['artificer', 'transform'],
];

/**
 * The ways a standing row's one acquisition role can be taken, from the
 * capability the walk captured at that row's contact: the row's own verb
 * (picking it up, buying it), and goldifying or transforming it where the
 * reached state supports that conversion, which a paid item never does, or
 * the row already converts. Undefined when the row acquires no
 * single role the walk reached: its conversions are then unknown.
 */
function standingDispositionVerbs(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
  participation: RoomActionParticipation,
  deadline: number | undefined,
): readonly LiveVerb[] | undefined {
  const authored = authoredOccurrence(assembly.project, occurrence);
  if (authored === undefined) return undefined;
  const key = roomActionKey(reference);
  const sources = authoredAcquisitionSources(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    authored,
    routeStartIncoming(assembly.project, occurrence, authored),
  ).filter((source) => source.action !== undefined && roomActionKey(source.action) === key);
  const [source] = sources;
  if (source === undefined || sources.length > 1) return undefined;
  const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
    assembly,
    source.acquisition,
  );
  if (capability?.timePieceAssessment === undefined) return undefined;
  const supported: Readonly<Record<AcquisitionDisposition['kind'], boolean>> = {
    normal: true,
    timePiece: capability.timePieceAssessment.supported,
    artificer: capability.artificerAssessment?.supported === true,
  };
  const current = source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole];
  const verbs = DISPOSITION_VERBS.flatMap(([kind, verb]): LiveVerb[] => {
    const standing = (current?.kind ?? 'normal') === kind;
    if (!standing && !supported[kind]) return [];
    return [
      Object.freeze({
        verb: verb ?? liveVerbKind(reference),
        participation,
        ...(deadline === undefined ? {} : { deadline }),
        reference,
        acquisition: source.acquisition,
        ...(standing
          ? { standing: true as const, commands: Object.freeze([]) }
          : {
              commands: Object.freeze([
                Object.freeze({
                  kind: 'ReplaceAcquisitionDisposition' as const,
                  acquisition: source.acquisition,
                  value: Object.freeze({ kind }),
                }),
              ]),
            }),
        ...(kind === 'artificer'
          ? {
              choice: Object.freeze({
                picker: 'artificerReplacement' as const,
                timing: 'after' as const,
              }),
            }
          : {}),
      }),
    ];
  });
  return Object.freeze(verbs);
}

/** Where an unplaced loose pickup came from, as the room that spawned it holds it. */
function unsettledPickupSource(
  room: CanonicalAuthoredRoom,
  reference: RoomActionReference,
): UnsettledPickupSource | undefined {
  switch (reference.kind) {
    case 'interactIncomingReward': {
      const reward = room.incomingReward;
      return reward === undefined
        ? undefined
        : {
            offer: reward.offer,
            producerLifecycleKey: reward.producerLifecycleKey,
            instanceProvenance: reward.instanceProvenance,
          };
    }
    case 'interactLocalReward': {
      const reward = [...(room.localRewards ?? []), ...(room.fieldsOptionalRewards ?? [])].find(
        (candidate) =>
          candidate.groupKey === reference.groupKey && candidate.slotKey === reference.slotKey,
      );
      return reward === undefined
        ? undefined
        : {
            offer: reward.offer,
            producerLifecycleKey: reward.producerLifecycleKey,
            instanceProvenance: 'free',
          };
    }
    case 'interactWheelReward': {
      const wheel = room.rewardWheels?.find(
        (candidate) => candidate.wheelKey === reference.wheelKey,
      );
      const offer = wheel?.offers.find((candidate) => candidate.picked)?.offer;
      return wheel === undefined || offer === undefined
        ? undefined
        : { offer, producerLifecycleKey: wheel.producerLifecycleKey, instanceProvenance: 'free' };
    }
    case 'interactAcquisitionEntry': {
      // A producer's generated pickup; a delivery or a Shop's own entries have none.
      const producer = room.pickupProducers?.find(
        (candidate) => candidate.siteKey === reference.siteKey,
      );
      const entry = room.acquisitionSites[reference.siteKey]?.entries[reference.entryKey];
      return producer === undefined || entry === undefined || entry === null
        ? undefined
        : {
            offer: entry.offer,
            producerLifecycleKey: producer.producerLifecycleKey,
            instanceProvenance: 'free',
          };
    }
    default:
      return undefined;
  }
}

/**
 * The ways an unplaced loose pickup can be taken by the edit that places it
 * at a gap: placed as its disposition stands, or placed and converted where
 * the state its row would meet there supports that conversion, which a paid
 * item never does: the state the reached row `before` it meets, else the one
 * its row would append to. The same alternatives a standing row offers from
 * its contact, each one edit. A plain pickup keeps its own outcome picker,
 * else Sea Star's copy where it applies. Undefined when its owner is no
 * single acquisition role whose source the room holds.
 */
function placementDispositionVerbs(
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  occurrence: OccurrenceAddress,
  owner: SemanticAddress,
  reference: RoomActionReference,
  obligation: Obligation,
  place: Extract<GapStep, { readonly kind: 'place' }>,
  outcome: LiveVerbChoice | undefined,
  before: string | undefined,
): readonly LiveVerb[] | undefined {
  const authored = authoredOccurrence(assembly.project, occurrence);
  const pickup = unsettledPickupSource(room, reference);
  if (authored === undefined || pickup === undefined) return undefined;
  // An unplaced row's source names no action yet: the pickup's owner is its
  // role, or the reward owner (a cage, optional reward, wheel offer or entry) holding it.
  const key = semanticAddressKey(owner);
  const sources = authoredAcquisitionSources(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    authored,
    routeStartIncoming(assembly.project, occurrence, authored),
  ).filter(
    ({ acquisition }) =>
      semanticAddressKey(acquisition) === key || semanticAddressKey(acquisition.owner) === key,
  );
  const [source] = sources;
  if (source === undefined || sources.length > 1) return undefined;
  const dispositions = source.reward.dispositionByAcquisitionRole;
  const capability = placementAcquisitionConversionForProjectEvaluationAssembly(
    assembly,
    occurrence,
    source.acquisition,
    { ...pickup, dispositionByAcquisitionRole: dispositions },
    before,
  );
  if (capability === undefined) return undefined;
  const supported: Readonly<Record<AcquisitionDisposition['kind'], boolean>> = {
    normal: true,
    timePiece: capability.timePieceAssessment.supported,
    artificer: capability.artificerAssessment.supported,
  };
  const current = dispositions[source.acquisition.acquisitionRole]?.kind ?? 'normal';
  return frozen(
    DISPOSITION_VERBS.flatMap(([kind, verb]): LiveVerb[] => {
      if (kind !== current && !supported[kind]) return [];
      const choice =
        kind === 'artificer'
          ? after('artificerReplacement')
          : kind === 'normal'
            ? (outcome ?? (capability.seaStarAssessment.supported ? after('seaStar') : undefined))
            : undefined;
      return [
        frozen({
          verb: verb ?? liveVerbKind(reference),
          participation: obligation.participation,
          ...(obligation.deadline === undefined ? {} : { deadline: obligation.deadline }),
          reference,
          acquisition: source.acquisition,
          commands: frozen(
            kind === current
              ? [place.command]
              : [
                  place.command,
                  frozen({
                    kind: 'ReplaceAcquisitionDisposition' as const,
                    acquisition: source.acquisition,
                    value: frozen({ kind }),
                  }),
                ],
          ),
          ...(place.canonical === true ? { canonical: true as const } : {}),
          ...(choice === undefined ? {} : { choice }),
        }),
      ];
    }),
  );
}

const after = (picker: Extract<LiveVerbChoice, { readonly timing: 'after' }>['picker']) =>
  frozen({ picker, timing: 'after' as const }) as LiveVerbChoice;

/**
 * The outcome a row of this kind settles on its own picker once it stands: the
 * rack's keepsake, a rerolled list, a contact's trait offer or Nemesis event,
 * a Fateful Twist's result, the Phial's target, a switch's outcome, a
 * locked door's fight or a press's drawn reward.
 */
function rowChoice(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
): LiveVerbChoice | undefined {
  switch (reference.kind) {
    case 'interactShopOffer': {
      // A bought item settles what its pickup opens, as a picked-up one does.
      const outcome = rewardOutcome(
        catalog,
        room.entryState?.kind === 'shop'
          ? room.entryState.offers.find((offer) => offer.offerKey === reference.offerKey)
          : undefined,
      );
      return outcome === undefined ? undefined : after(outcome);
    }
    case 'interactKeepsakeRack':
      return after('keepsake');
    case 'rerollStygianWell':
      return after('stygianWellRoll');
    case 'rerollPurgingPool':
      return after('purgingPoolRoll');
    case 'interactGorgon':
      return after('traitOffer');
    case 'interactEncounter': {
      const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(
        assembly,
        createEncounterPhaseAddress(
          createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          reference.phaseKey,
        ),
      );
      const definition =
        status?.kind === 'active' && status.encounterDefinitionKey !== undefined
          ? catalog.encounterDefinitions.byKey[status.encounterDefinitionKey]
          : undefined;
      if (definition?.nemesisRandomEvent !== undefined) return after('nemesisEvent');
      return definition?.traitOfferProducer === undefined ? undefined : after('traitOffer');
    }
    case 'purchaseStygianWellOffer': {
      const authored = authoredOccurrence(assembly.project, occurrence);
      const itemKey =
        authored === undefined
          ? undefined
          : stygianWellGenerationItemKey(authored, reference.generationKey);
      // A Fateful Twist rolls its item as its purchase settles.
      const grant = catalog.rewards.shops.byKey.RoomShop?.groups.values
        .flatMap((group) => group.options.values)
        .find((option) => option.key === itemKey)?.stygianWell?.grant;
      return grant?.kind === 'twist' ? after('stygianWellTwist') : undefined;
    }
    case 'useFountain':
      return after('fountainRarity');
    case 'interactChallengeSwitch':
      return after('challengeSwitchOutcome');
    case 'unlockExit':
      return after('unlockExitFight');
    case 'reroll':
      return after('rerollResult');
    default:
      return undefined;
  }
}

/** An object's verb whose row a picker creates or the engine allocates, at the one gap it takes. */
interface ObjectVerb {
  readonly object: LiveObjectKind;
  readonly owner: SemanticAddress;
  readonly gap: number;
  readonly verb: LiveVerb;
}

/**
 * The verbs a room's objects allow whose row is not a roster row yet: a door,
 * cage or wheel reroll press at its surface's append point, and a Well or Pool
 * reroll where the room's reached actions end. Each is offered only where its object is reached, a held card enables
 * it and the reroll pool there pays for it, the fixed budget edit settlement
 * enforces.
 */
function objectChoiceVerbs(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  room: CanonicalAuthoredRoom,
  orderLength: number,
  frontier: number,
): readonly ObjectVerb[] {
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const verbs: ObjectVerb[] = [];
  const surfaces: {
    readonly object: LiveObjectKind;
    readonly owner: SemanticAddress;
    readonly surface: RerollSurface;
  }[] = [{ object: 'doorRerolls', owner: occurrence, surface: { kind: 'doors', occurrence } }];
  for (const phase of room.roomActionRoster.eventGraph.phases) {
    if (phase.rewardWheelKey === undefined) continue;
    const wheel = createRewardWheelAddress(biome, occurrence.occurrenceId, phase.rewardWheelKey);
    surfaces.push({ object: 'rewardWheel', owner: wheel, surface: { kind: 'rewardWheel', wheel } });
  }
  // A new press's id and index come from the authored room its command edits.
  const authored = authoredOccurrence(assembly.project, occurrence);
  const pressId =
    authored === undefined
      ? undefined
      : nextRerollId(
          authored.roomActions.order.flatMap((reference) =>
            reference.kind === 'reroll' ? [reference.rerollId] : [],
          ),
        );
  for (const { object, owner, surface } of surfaces) {
    const settlement = rerollSurfaceForProjectEvaluationAssembly(assembly, surface);
    const gap = rerollAppendIndex(assembly.project, surface);
    if (settlement === undefined || gap === undefined || gap > frontier) continue;
    if (
      !settlement.enabled ||
      settlement.targets.every((target) => target.unavailable !== undefined)
    )
      continue;
    const allowance = rerollSpendAllowanceForProjectEvaluationAssembly(assembly, {
      kind: 'press',
      surface,
    });
    if (allowance.kind !== 'reached' || !allowance.allowed) continue;
    verbs.push(
      frozen({
        object,
        owner,
        gap,
        verb: frozen({
          verb: 'reroll' as const,
          participation: 'optional' as const,
          ...(pressId === undefined ? {} : { rerollId: pressId }),
          choice: frozen({ picker: 'rerollPress' as const, timing: 'before' as const, surface }),
        }),
      }),
    );
  }
  // A Well's or Pool's interaction stands where the room's reached actions end.
  if (frontier !== orderLength) return frozen(verbs);
  const featureReroll = (
    object: 'stygianWell' | 'purgingPool',
    option: { readonly enabled: boolean; readonly available: boolean } | undefined,
  ) => {
    if (option === undefined || !option.enabled || !option.available) return;
    const allowance = rerollSpendAllowanceForProjectEvaluationAssembly(assembly, {
      kind: 'featureReroll',
      occurrence,
      feature: object,
    });
    if (allowance.kind !== 'reached' || !allowance.allowed || authored === undefined) return;
    const index = authored.roomActions.order.length;
    const command: ProjectCommand =
      object === 'stygianWell'
        ? frozen({ kind: 'InsertStygianWellReroll' as const, occurrence, index })
        : frozen({ kind: 'InsertPurgingPoolReroll' as const, occurrence, index });
    const reference: RoomActionReference = frozen({
      kind: rerollActionKind(object),
      rerollId: nextRerollId(featureRerollIdsInUse(authored, object)),
    });
    verbs.push(
      frozen({
        object,
        owner: occurrence,
        gap: orderLength,
        verb: frozen({
          verb: 'reroll' as const,
          participation: 'optional' as const,
          reference,
          commands: frozen([command]),
          choice: frozen({
            picker:
              object === 'stygianWell'
                ? ('stygianWellRoll' as const)
                : ('purgingPoolRoll' as const),
            timing: 'after' as const,
          }),
        }),
      }),
    );
  };
  featureReroll(
    'stygianWell',
    stygianWellCandidateForProjectEvaluationAssembly(assembly, occurrence)?.interaction?.reroll,
  );
  const poolCapability = purgingPoolCandidateForProjectEvaluationAssembly(assembly, occurrence);
  const pool = poolCapability?.interaction;
  if (pool === undefined) return frozen(verbs);
  featureReroll('purgingPool', pool.reroll);
  // Each stocked slot's sale is a roster row.
  return frozen(verbs);
}

/**
 * A wheel choice's placement as a pick of each of its offers: the offer
 * already picked places it as is; another also repicks the wheel.
 */
function wheelPickChoice(
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  occurrence: OccurrenceAddress,
  wheelKey: string,
  place: ProjectCommand,
): LiveVerbChoice | undefined {
  const authored = authoredOccurrence(assembly.project, occurrence);
  const state = authored?.state.kind === 'shipCombat' ? authored.state.wheels[wheelKey] : undefined;
  const canonical = room.rewardWheels?.find((wheel) => wheel.wheelKey === wheelKey);
  if (state === undefined || canonical === undefined) return undefined;
  const wheel = createRewardWheelAddress(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    occurrence.occurrenceId,
    wheelKey,
  );
  // The wheel's offers stand in their authored order; its pick is a place among them.
  const values = Object.keys(state.offers)
    .slice(0, state.offerCount)
    .map((offerKey, index): LiveWheelPick => {
      const pickedOfferIndex = index + 1;
      const offer = canonical.offers.find((candidate) => candidate.offerKey === offerKey)?.offer;
      return frozen({
        offerKey,
        pickedOfferIndex,
        ...(offer === undefined ? {} : { offer }),
        commands: frozen(
          pickedOfferIndex === state.pickedOfferIndex
            ? [place]
            : [
                place,
                frozen({ kind: 'ReplaceRewardWheelPicked' as const, wheel, pickedOfferIndex }),
              ],
        ),
      });
    });
  return frozen({
    picker: 'rewardWheelPick' as const,
    timing: 'before' as const,
    wheel,
    values: frozen(values),
  });
}

/** Command with its index set to the gap. */
function atIndex(command: ProjectCommand, index: number): ProjectCommand {
  return command.kind === 'SetInfernalContractPedestalCollected'
    ? command
    : (frozen({ ...command, index }) as ProjectCommand);
}

const DERIVED_PLACEMENT_KINDS: ReadonlySet<ProjectCommand['kind']> = new Set<
  DerivedPickupPlacementCommand['kind']
>(['PlaceHermesShrineDelivery', 'PlaceClockedTraitPickup', 'PlaceEchoGoldPickup']);

function isDerivedPlacement(command: ProjectCommand): command is DerivedPickupPlacementCommand {
  return DERIVED_PLACEMENT_KINDS.has(command.kind);
}

/** Whether an item or action must be acted on, and for a required one its last legal gap. */
interface Obligation {
  readonly participation: RoomActionParticipation;
  readonly deadline?: number | undefined;
}

/** How a row or new action comes to stand at a gap. */
type GapStep =
  | { readonly kind: 'standing' }
  | { readonly kind: 'place'; readonly command: ProjectCommand; readonly canonical?: true }
  | { readonly kind: 'move'; readonly command: ProjectCommand };

const STANDING: GapStep = frozen({ kind: 'standing' });

/**
 * The verb a step performs on a row: standing, moving it here or placing it
 * here, with the item's or action's obligation. The row's own picker follows
 * a placement, or, `before`, supplies its command instead; a moved row keeps
 * the outcome it already has.
 */
function stepVerb(
  reference: RoomActionReference,
  obligation: Obligation,
  step: GapStep,
  rowPicker?: LiveVerbChoice,
): LiveVerb {
  const choice = step.kind === 'move' ? undefined : rowPicker;
  const base = {
    verb: liveVerbKind(reference),
    participation: obligation.participation,
    ...(obligation.deadline === undefined ? {} : { deadline: obligation.deadline }),
    reference,
  };
  if (choice?.timing === 'before') return frozen({ ...base, choice });
  return frozen({
    ...base,
    ...(step.kind === 'standing'
      ? { standing: true as const, commands: frozen([]) }
      : { commands: frozen([step.command]) }),
    ...(step.kind === 'place' && step.canonical === true ? { canonical: true as const } : {}),
    ...(choice === undefined ? {} : { choice }),
  });
}

/**
 * What is live at each gap of one entered room's action order, from its
 * entry through the walk's frontier: the loot spawned and not yet collected
 * there and the objects usable there, each with its verbs at that gap, then
 * the room's progression at its frontier and what it leaves behind. A gap's
 * verbs come from the roster's authorable insertions and moves to it, the row
 * standing at it, and the feature and placement commands that accept its
 * index; nothing is evaluated again. Each verb is an edit against the current
 * plan: after one applies, the product is read again, so two verbs offered at
 * one gap never compose. Undefined for a room the evaluated biome does not
 * enter or the assessed history does not reach.
 */
export function liveRoomForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  detail: LiveRoomDetail = 'interactions',
): LiveRoom | undefined {
  const room = authoredRoom(assembly, occurrence);
  if (room === undefined || !room.entered) return undefined;
  const walk = roomWalk(assembly, occurrence);
  if (walk.unreached === true) return undefined;
  const loot = spawnedLootForProjectEvaluationAssembly(catalog, assembly, occurrence);
  if (loot === undefined) return undefined;
  const interactions = detail === 'interactions';
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const roster = activeRoomActionRoster(assembly, occurrence, room);
  const entries = room.roomLifecycleTimeline.entries;
  const liveRows = roster.rows.filter((row) => !row.stale).map(asUnplacedWhenReplaced);
  const orderLength = roster.rows.filter((row) => row.rank !== null).length;
  const rowByKey = new Map(liveRows.map((row) => [row.key, row]));
  const actionAddress = (reference: RoomActionReference) =>
    createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));
  const rowPickers = new Map<string, LiveVerbChoice | undefined>();
  /** A row's own picker; a pickup's placement asks the outcome its spawn names first. */
  const pickerOf = (reference: RoomActionReference, placeChoice?: LiveVerbChoice) => {
    if (placeChoice !== undefined || !interactions) return placeChoice;
    const key = roomActionKey(reference);
    if (!rowPickers.has(key))
      rowPickers.set(key, rowChoice(catalog, assembly, room, occurrence, reference));
    return rowPickers.get(key);
  };

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
    stop === undefined || stop.kind === 'exit' ? orderLength : lastGapOfEntry(walk.stopIndex!);

  /**
   * Every gap of the whole order at which a row may stand, with the step
   * that puts it there: its own gap, and the roster's authorable insertions
   * and moves. The one authority for a row's verbs and its deadline.
   */
  const rowGaps = new Map<string, Map<number, GapStep>>();
  const addRowGap = (key: string, gap: number, step: GapStep) => {
    const byGap = rowGaps.get(key) ?? new Map<number, GapStep>();
    byGap.set(gap, step);
    rowGaps.set(key, byGap);
  };
  for (const row of liveRows) if (row.rank !== null) addRowGap(row.key, row.rank - 1, STANDING);
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
          command: frozen({ kind: 'MoveRoomAction' as const, action, toIndex: proposal.toIndex }),
        }),
      );
  }
  /** A row's step at a gap; a row placed before the gap is done there and has none. */
  const rowStep = (row: RoomActionRow, gap: number): GapStep | undefined =>
    row.rank !== null && row.rank - 1 < gap ? undefined : rowGaps.get(row.key)?.get(gap);
  /** For a required row, the last gap of the whole order at which it may stand. */
  const rowDeadline = (
    row: RoomActionRow,
    legal: (gap: number) => boolean = () => true,
  ): number | undefined => {
    const gaps = [...(rowGaps.get(row.key)?.keys() ?? [])].filter(legal);
    return row.participation !== 'required' || gaps.length === 0 ? undefined : Math.max(...gaps);
  };
  /**
   * A row's verbs at a gap: a standing row acquiring one reached role offers
   * each way of taking it the walk's capability there supports; any other
   * step performs its one verb.
   */
  const rowVerbs = (
    reference: RoomActionReference,
    obligation: Obligation,
    step: GapStep,
    placeChoice?: LiveVerbChoice,
  ): readonly LiveVerb[] =>
    (interactions && step.kind === 'standing'
      ? standingDispositionVerbs(
          assembly,
          occurrence,
          reference,
          obligation.participation,
          obligation.deadline,
        )
      : undefined) ?? [
      stepVerb(
        reference,
        obligation,
        step,
        // A moved row keeps its outcome; a wheel's choice is placed with the offer it takes.
        step.kind === 'move'
          ? undefined
          : interactions && step.kind === 'place' && reference.kind === 'chooseRewardWheel'
            ? wheelPickChoice(assembly, room, occurrence, reference.wheelKey, step.command)
            : pickerOf(reference, step.kind === 'place' ? placeChoice : undefined),
      ),
    ];

  // Pickups, from the spawned loot, each with the gap it spawned at.
  interface PickupSpawn {
    readonly item: SpawnedLootItem;
    readonly gap: number;
    readonly moment?: string;
    readonly sourceAction?: RoomActionAddress;
  }
  /** The gap a spawn's cause releases it at: its boundary's stretch, or right after its row. */
  const gapOfCause = (cause: SpawnCause): number | undefined => {
    switch (cause.kind) {
      case 'event':
        return gapOfEntry(
          entries.findIndex(
            (entry) => entry.kind === 'boundary' && entry.boundary.key === cause.event.key,
          ),
        );
      case 'action':
        return rowByKey.get(cause.action.actionKey)?.rank ?? undefined;
      case 'timelineEnd':
        return gapOfEntry(entries.length - 1);
    }
  };
  const spawns: PickupSpawn[] = [];
  for (const moment of loot.moments) {
    const gap = gapOfCause(moment.cause);
    if (gap === undefined) continue;
    for (const item of moment.items) spawns.push({ item, gap, moment: moment.key });
  }
  for (const spawn of loot.actionSpawns) {
    const source = rowByKey.get(roomActionKey(spawn.source));
    if (source?.rank === null || source?.rank === undefined) continue;
    for (const item of spawn.items)
      spawns.push({ item, gap: source.rank, sourceAction: spawn.sourceAction });
  }
  const unlockGaps = new Map(
    loot.unlocks.flatMap((unlock) => {
      const gap = gapOfCause(unlock.cause);
      return gap === undefined ? [] : [[unlock.key, gap] as const];
    }),
  );
  // A required object on the ground holds back every row that waits for it.
  const ordered = roster.rows
    .filter((row) => row.rank !== null)
    .sort((left, right) => left.rank! - right.rank!);
  const waits = waitsForRequiredObjects(roster.eventGraph);
  /**
   * Where a row placed at a gap would settle: at the frontier where the room's
   * reached actions end, else before the next row the walk executes, as stale
   * rows never are. Undefined before a row on a replaced item, which is never
   * executed either and stops the walk, so no state there answers.
   */
  const placementPoint = (gap: number): { readonly before?: string } | undefined => {
    if (gap >= frontier) return {};
    const next = ordered.find((row) => row.rank! > gap && rowByKey.has(row.key));
    return next === undefined || rowByKey.get(next.key)!.rank === null
      ? undefined
      : { before: next.key };
  };
  const required = ({ item }: PickupSpawn) => item.participation === 'required';
  /** Whether a required pickup at this gap stands past its deadline. */
  const gatedPast = (spawn: PickupSpawn, gap: number) => {
    const deadline = required(spawn)
      ? requiredObjectDeadline(roster.eventGraph, ordered, spawn.gap)
      : undefined;
    return deadline !== undefined && gap > deadline;
  };
  /** Whether a required pickup lies on the ground at this gap. */
  const onGround = (gap: number) =>
    spawns.some(
      (spawn) =>
        required(spawn) &&
        spawn.gap <= gap &&
        (spawn.item.placement.kind !== 'placed' || spawn.item.placement.rank - 1 >= gap),
    );
  /** Every index a derived pickup's placement command accepts after its spawn, by row key. */
  const derivedIndexes = new Map<string, readonly number[]>();
  const pickupAt = (spawn: PickupSpawn, gap: number): LivePickup | undefined => {
    const { item } = spawn;
    if (gap < spawn.gap) return undefined;
    if (item.placement.kind === 'placed' && item.placement.rank - 1 < gap) return undefined;
    const key = roomActionKey(item.reference);
    const row = rowByKey.get(key);
    const verbs: LiveVerb[] = [];
    let deadline: number | undefined;
    let lastIndex: number | undefined;
    const unlockGap = item.lockedUntil === undefined ? undefined : unlockGaps.get(item.lockedUntil);
    // A caged pickup cannot be taken until its cage unlocks; a row already there stands.
    const locked = item.lockedUntil !== undefined && (unlockGap === undefined || unlockGap > gap);
    const placeChoice = item.needsChoice === undefined ? undefined : after(item.needsChoice);
    if (row !== undefined && (row.rank !== null || item.placement.kind === 'unplaced')) {
      deadline = rowDeadline(row, (at) => !gatedPast(spawn, at));
      const step = gatedPast(spawn, gap) ? undefined : rowStep(row, gap);
      const obligation = { participation: item.participation, deadline };
      const point = placementPoint(gap);
      if (step !== undefined && (!locked || step.kind === 'standing'))
        verbs.push(
          // The edit placing it can also convert it.
          ...((interactions && step.kind === 'place' && point !== undefined
            ? placementDispositionVerbs(
                assembly,
                room,
                occurrence,
                item.owner,
                item.reference,
                obligation,
                step,
                pickerOf(item.reference, placeChoice),
                point.before,
              )
            : undefined) ?? rowVerbs(item.reference, obligation, step, placeChoice)),
        );
    } else if (item.placement.kind === 'unplaced' && item.placement.command !== undefined) {
      const command = item.placement.command;
      let indexes = derivedIndexes.get(key);
      if (indexes === undefined) {
        indexes = isDerivedPlacement(command)
          ? positionedCommandInsertionIndexes(assembly.project, catalog, command).filter(
              (index) => index >= spawn.gap && !gatedPast(spawn, index),
            )
          : [];
        derivedIndexes.set(key, indexes);
      }
      lastIndex = indexes.length === 0 ? undefined : Math.max(...indexes);
      if (item.participation === 'required') deadline = lastIndex;
      if (!locked && indexes.includes(gap))
        verbs.push(
          stepVerb(
            item.reference,
            { participation: item.participation, deadline },
            { kind: 'place', command: atIndex(command, gap) },
            pickerOf(item.reference, placeChoice),
          ),
        );
    }
    return frozen({
      kind: 'pickup' as const,
      owner: item.owner,
      reference: item.reference,
      source: item.source,
      ...(item.reward === undefined ? {} : { reward: item.reward }),
      participation: item.participation,
      ...(deadline === undefined ? {} : { deadline }),
      ...(lastIndex === undefined ? {} : { lastIndex }),
      spawn: frozen({
        gap: spawn.gap,
        ...(spawn.moment === undefined ? {} : { moment: spawn.moment }),
        ...(spawn.sourceAction === undefined ? {} : { sourceAction: spawn.sourceAction }),
      }),
      ...(locked ? { lockedUntil: item.lockedUntil } : {}),
      verbs: frozen(verbs),
    });
  };

  // Objects: every row acting on one, the purchases not yet rows, and the verbs a picker creates.
  const objectRows = liveRows.flatMap((row) => {
    const object = objectOf(occurrence, row);
    return object === undefined ? [] : [{ row, ...object }];
  });
  const purchases = objectPurchases(catalog, assembly, room, occurrence, orderLength);
  const choiceVerbs = interactions
    ? objectChoiceVerbs(assembly, occurrence, room, orderLength, frontier)
    : [];
  const objectsAt = (gap: number): LiveObject[] => {
    const byObject = new Map<
      string,
      { object: LiveObjectKind; owner: SemanticAddress; verbs: LiveVerb[] }
    >();
    const add = (object: LiveObjectKind, owner: SemanticAddress, verbs: readonly LiveVerb[]) => {
      const key = `${object}:${semanticAddressKey(owner)}`;
      const entry = byObject.get(key) ?? { object, owner, verbs: [] };
      entry.verbs.push(...verbs);
      byObject.set(key, entry);
    };
    const bought = purchases.filter((purchase) => purchase.indexes.has(gap));
    const boughtKeys = new Set(bought.map((purchase) => roomActionKey(purchase.reference)));
    for (const { row, object, owner } of objectRows) {
      const step = rowStep(row, gap);
      if (step === undefined) continue;
      // An unplaced row its object's purchase places is bought through that purchase alone,
      // and a Travel Deal item only once a purchase has restocked it.
      if (
        step.kind !== 'standing' &&
        (boughtKeys.has(row.key) || row.sourceFamily?.kind === 'shopTravelDealRefill')
      )
        continue;
      if (step.kind !== 'standing' && waits(row) && onGround(gap)) continue;
      add(
        object,
        owner,
        rowVerbs(
          row.reference,
          { participation: row.participation, deadline: rowDeadline(row) },
          step,
        ),
      );
    }
    for (const purchase of bought)
      add(purchase.object, purchase.owner, [
        stepVerb(
          purchase.reference,
          { participation: 'optional' },
          { kind: 'place', command: atIndex(purchase.command, gap) },
          pickerOf(purchase.reference, purchase.choice),
        ),
      ]);
    for (const { object, owner, gap: verbGap, verb } of choiceVerbs)
      if (verbGap === gap) add(object, owner, [verb]);
    return [...byObject.values()].map((entry) =>
      frozen({
        kind: 'object' as const,
        object: entry.object,
        owner: entry.owner,
        verbs: frozen(entry.verbs),
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
              ? walk.stopIndex! + (stop.at === 'entry' ? 1 : 0)
              : entries.length,
          ),
        }),
        items: frozen(items),
      }),
    );
  }

  const atFrontier = gaps[frontier]?.items ?? [];
  /** Each required thing live at the frontier, once: a pickup, or a required verb on an object. */
  const requiredLive = new Map<string, { readonly item: LiveItem; readonly verb?: LiveVerb }>();
  for (const item of atFrontier)
    if (item.kind === 'pickup') {
      if (item.participation === 'required')
        requiredLive.set(roomActionKey(item.reference), { item });
    } else
      item.verbs.forEach((verb, index) => {
        if (verb.participation !== 'required') return;
        const key =
          verb.reference === undefined
            ? `${semanticAddressKey(item.owner)} ${index}`
            : roomActionKey(verb.reference);
        requiredLive.set(key, { item, verb });
      });
  const [only] = requiredLive.values();
  const passed = frontier === orderLength && (stop === undefined || stop.kind === 'exit');
  const progression: LiveProgression | undefined =
    requiredLive.size === 0
      ? passed
        ? frozen({ kind: 'leaveRoom' as const })
        : undefined
      : requiredLive.size === 1 &&
          only?.item.kind === 'object' &&
          only.item.owner.kind === 'rewardWheel' &&
          only.verb?.verb === 'choose' &&
          only.verb.standing !== true
        ? frozen({ kind: 'chooseWheel' as const, wheel: only.item.owner })
        : undefined;
  const blocked =
    stop === undefined || stop.kind === 'exit'
      ? undefined
      : frozen({ kind: stop.placement === true ? ('placement' as const) : ('stop' as const) });
  return frozen({
    owner: room.origin,
    frontier,
    gaps: frozen(gaps),
    ...(blocked === undefined ? {} : { blocked }),
    ...(progression === undefined ? {} : { progression }),
    ...(passed
      ? {
          leftBehind: frozen(
            atFrontier.flatMap((item) =>
              item.kind === 'pickup' && item.participation === 'optional' ? [item] : [],
            ),
          ),
        }
      : {}),
  });
}

/** The command placing a due delivery or a matured clocked drop. */
export type TimedPickupPlacementCommand = Exclude<
  DerivedPickupPlacementCommand,
  { readonly kind: 'PlaceEchoGoldPickup' }
>;

/**
 * The command placing one due delivery or matured clocked drop at the last
 * index it may take (after its due spawn, before the next row waiting for
 * required objects); absent when it is not live in its room.
 */
export function timedPickupPlacementForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  entry: AcquisitionEntryAddress,
): TimedPickupPlacementCommand | undefined {
  const owner = entry.site.owner;
  if (owner.kind !== 'occurrence') return undefined;
  const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, owner, 'placements');
  const key = roomActionKey(timedPickupReference(entry));
  for (const item of live?.gaps.flatMap((gap) => gap.items) ?? []) {
    if (item.kind !== 'pickup' || item.lastIndex === undefined) continue;
    if (roomActionKey(item.reference) !== key) continue;
    const command = item.verbs[0]?.commands?.[0];
    if (
      command !== undefined &&
      isDerivedPlacement(command) &&
      command.kind !== 'PlaceEchoGoldPickup'
    )
      return frozen({ ...command, index: item.lastIndex });
  }
  return undefined;
}
