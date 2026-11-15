import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  countedRewardBinding,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createPostbossKeepsakeSelectionAddress,
  hubTerminalTakeoverForSource,
  ordinaryTargetGameNames,
  roomActionKey,
  semanticAddressKey,
  applyProjectCommand,
  authoredShopOffer,
  createShopOfferAddress,
  shopOfferOptionValues,
  infernalContractPedestalOptionValues,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  takeoverPrebossGameNames,
  type AuthoredTraitOfferTraits,
  type BiomeAddress,
  type BatchRewardStoreAddress,
  type ExitDecisionAddress,
  type HubAction,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type TargetAddress,
  hermesShrineInitialSlotKey,
  exitDecisionForSource,
  biomeStartRoomGameNames,
  resolveBiomeStart,
  routeRoomDeclaration,
  DRAFT_OPTIONS,
  clockworkExitRewards,
} from '@run-planner/engine/authored-project';
import {
  locallyValidRewardOffers,
  ORDINARY_SOURCE_CAP,
  type ResolvedRewardOffer,
  type ShopOptionSelection,
} from '@run-planner/engine/reward-kernel';
import type { AuthoringSession } from '@run-planner/engine/authoring';
import {
  type ProjectCandidateEvaluation,
  type ProjectCandidateSession,
  type StartRoomCandidateQuery,
  type ForcePressureLedgerEntry,
  countedRewardTypeDomain,
  type ProjectEvaluationAssembly,
  assessmentRepairOwner,
  type SemanticFinding,
  type SettlementFault,
  type RewardOfferExclusionReason,
  prepareRouteStartTraitRequirements,
  routeResourceAuthoring,
  nextRequiredPlacement,
  liveRoomForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  goldLedgerForProjectEvaluationAssembly,
  GoldLedgerContractError,
  type GoldPurchaseAvailability,
  type LiveRoom,
  type RequiredPlacement,
  roomLayoutAuthoringForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { latestRunState } from './report';
import {
  draftEncounterChoice,
  draftOccurrenceEncounterChoice,
  draftPhaseEncounter,
  type DraftEncounterChoiceContext,
} from './encounters';
import { createDraftPrerequisites } from './prerequisites';
import { shuffleDraft, type DraftRng } from './rng';
import {
  sampleArcanaChoice,
  sampleFountainRarity,
  sampleHexActivation,
  sampleKeepsakeEquipResult,
  sampleLevelResolution,
  sampleSteadyGrowth,
  type DraftSampleContext,
} from './samples';
import { draftProvider, type DraftGodSchedule, type DraftSupply } from './schedule';
import { draftBasketTraitKeys, draftKeepsakeOptions, type DraftSpec } from './spec';
import {
  draftBoostElements,
  draftFillerKind,
  DraftSteering,
  draftSideDoorWeight,
  draftSiblingHoldsGodBoon,
  NPC_EXCLUDED_REWARD_FACTOR,
  NPC_WINDOW_WEIGHT,
  type DraftProgress,
  type DraftPurchaseGold,
  type DraftPurchaseKind,
} from './steering';
import {
  draftFieldsCagePoint,
  draftFieldsCageSlotKey,
  draftHeroStart,
  draftHubMap,
  nearestFirst,
  type DraftHubMap,
  type DraftPoint,
} from './spatial';
import { DraftTraitOffers } from './trait-offers';
import type { DraftWorldProduct } from './world';

/** A pursued Clockwork Goal door: above any boon door (at most 90), below a story room (200). */
const TARTARUS_GOAL_WEIGHT = 150;

/** An offered reward's exact result; absent when its candidate context is unavailable. */
function rewardOfferResult(evaluation: ProjectCandidateEvaluation) {
  switch (evaluation.kind) {
    case 'startingReward':
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'acquisitionEntryOffer':
      return evaluation.result;
    default:
      return undefined;
  }
}

/** The room an origin lies in: its own occurrence, or the one hosting its acquisition site. */
function originRoom(origin: SemanticAddress): OccurrenceAddress | undefined {
  if (origin.kind === 'acquisitionEntry') return originRoom(origin.site.owner);
  if (!('occurrenceId' in origin)) return undefined;
  return createOccurrenceAddress(
    createBiomeAddress(origin.routeKey, origin.biomeKey),
    origin.occurrenceId,
  );
}

/** Loot lying live at a gap of the room. */
type LivePickup = Extract<LiveRoom['gaps'][number]['items'][number], { readonly kind: 'pickup' }>;

/** A required pickup to collect, at the gap its placement takes, by the command placing it there. */
interface PickupPlacement {
  readonly key: string;
  readonly gap: number;
  readonly command: ProjectCommand;
}

/** The command a pickup's verb places it with at its gap; none while it stands or for a move. */
function pickupPlacementCommand(item: LivePickup): ProjectCommand | undefined {
  for (const verb of item.verbs) {
    if (verb.standing === true || verb.reference === undefined) continue;
    const command = verb.commands?.[0];
    if (command !== undefined && command.kind !== 'MoveRoomAction') return command;
  }
  return undefined;
}

/**
 * The required pickup the room offers earliest from `floor`, where the live room first lets it
 * be placed (its spawn, or its cage's unlock), stepped past the pickups standing there that
 * spawned no later, so loot is collected in spawn order before the next interaction. `tried`
 * holds the row keys already tried.
 */
function earliestRequiredPickup(
  live: LiveRoom,
  tried: ReadonlySet<string>,
  floor: number,
): PickupPlacement | undefined {
  const offeredAt = (gap: number, key: string) => {
    const item = live.gaps[gap]?.items.find(
      (candidate): candidate is LivePickup =>
        candidate.kind === 'pickup' && roomActionKey(candidate.reference) === key,
    );
    return item === undefined ? undefined : pickupPlacementCommand(item);
  };
  for (const gap of live.gaps) {
    if (gap.index < floor) continue;
    for (const item of gap.items) {
      if (item.kind !== 'pickup' || item.participation !== 'required') continue;
      const key = roomActionKey(item.reference);
      let command = tried.has(key) ? undefined : pickupPlacementCommand(item);
      if (command === undefined) continue;
      let at = gap.index;
      for (;;) {
        const standing = live.gaps[at]?.items.some(
          (other) =>
            other.kind === 'pickup' &&
            other.spawn.gap <= item.spawn.gap &&
            other.verbs.some((verb) => verb.standing === true),
        );
        const later = standing ? offeredAt(at + 1, key) : undefined;
        if (later === undefined) break;
        at += 1;
        command = later;
      }
      return { key, gap: at, command };
    }
  }
  return undefined;
}

/** The gold of a purchase the draft never buys, and of one that costs nothing. */
const UNAFFORDABLE: DraftPurchaseGold = Object.freeze({ odds: 0, spare: -Infinity });
const FREE: DraftPurchaseGold = Object.freeze({ odds: 1, spare: Infinity });

/** Steps a pending purchase may wait for the gold walk to reach it. */
const PENDING_PURCHASE_STEPS = 12;

/** Where a walk stood: its assembly, the commands and faults it had kept and its own memory. */
interface DraftWalkMark {
  readonly assembly: ProjectEvaluationAssembly;
  readonly commands: number;
  readonly faults: number;
  readonly memory: DraftWalkMemory;
}

/** A copy of what a walk remembers of its own decisions, beside the plan they authored. */
interface DraftWalkMemory {
  readonly stepCount: number;
  readonly phases: number;
  readonly hooked: ReadonlySet<string>;
  readonly encounterRooms: ReadonlyMap<number, number>;
  readonly essenceRooms: ReadonlyMap<number, number>;
  readonly dropRoomsDone: ReadonlySet<string>;
  readonly steeredShops: ReadonlySet<string>;
  readonly judgedShopItems: ReadonlyMap<
    string,
    { readonly wanted: ReadonlySet<string>; readonly filler: ReadonlySet<string> }
  >;
  readonly steeredItems: ReadonlyMap<string, ResolvedRewardOffer>;
  readonly waitingShops: ReadonlySet<string>;
  readonly authoredRewards: ReadonlySet<string>;
  readonly legalSupply: ReadonlySet<DraftSupply>;
  readonly stoppedGods: ReadonlySet<string>;
  readonly unacquiredDevotionSources: ReadonlyMap<string, number>;
  readonly unvisitedHubDoors: ReadonlyMap<string, ReadonlySet<string>>;
  readonly hubVisitRanks: ReadonlyMap<string, readonly string[]>;
  readonly authoredOffers: ReadonlyMap<string, AuthoredTraitOfferTraits>;
}

function refill<T>(target: Set<T>, from: ReadonlySet<T>): void {
  target.clear();
  from.forEach((value) => target.add(value));
}

function refillMap<K, V>(target: Map<K, V>, from: ReadonlyMap<K, V>): void {
  target.clear();
  from.forEach((value, key) => target.set(key, value));
}

/** A Shop door beside a door to a new god with queued traits. */
const SHOP_OUTRANKED_FACTOR = 0.001;

/** The offer weight of a wanted god's boon; a due god's is higher. */
const WANTED_GOD_WEIGHT = 30;

/** The steered-stock key of a room's Contract pedestal. */
const PEDESTAL_STEER_KEY = 'infernalContractPedestal';

const RESOURCE_FAMILIES = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;

/** Quick Buck and Buried Treasure: their drops are optional, but a player takes them. */
const PICKED_UP_DROP_TRAITS = ['MoneyMultiplierBoon', 'RoomRewardBonusBoon'] as const;

/**
 * The earliest pickup of a Quick Buck or Buried Treasure drop not yet placed, by the
 * commands the live room offers at the first gap from `floor` it is live; `placed`
 * holds the row keys already tried.
 */
function firstTraitDropPlacement(
  live: LiveRoom,
  placed: ReadonlySet<string>,
  floor: number,
):
  | { readonly key: string; readonly gap: number; readonly commands: readonly ProjectCommand[] }
  | undefined {
  for (const gap of live.gaps.filter((candidate) => candidate.index >= floor))
    for (const item of gap.items) {
      if (
        item.kind !== 'pickup' ||
        item.lockedUntil !== undefined ||
        item.source.kind !== 'generated' ||
        item.source.family.kind !== 'trait' ||
        !(PICKED_UP_DROP_TRAITS as readonly string[]).includes(item.source.family.traitKey)
      )
        continue;
      const key = roomActionKey(item.reference);
      if (placed.has(key)) continue;
      const verb = item.verbs.find((candidate) => candidate.verb === 'pickUp');
      if (verb === undefined || verb.standing === true) continue;
      // A move means the pickup already stands later in the order.
      const first = verb.commands?.[0];
      if (first === undefined || first.kind === 'MoveRoomAction') continue;
      return { key, gap: gap.index, commands: verb.commands! };
    }
  return undefined;
}

/**
 * One finding-driven draft walk over a working project. Every value comes from
 * an engine domain and is admitted by the engine's own candidate query.
 */
export class DraftWalk {
  private readonly hooked = new Set<string>();
  private readonly steering: DraftSteering;
  private readonly traitOffers: DraftTraitOffers;
  private readonly samples: DraftSampleContext;
  private readonly encounterChoices: DraftEncounterChoiceContext;
  private nextOccurrence = 0;
  /** Encounter phases this walk customized as it left their rooms, by phase key, in order. */
  private readonly draftedPhaseKeys: string[] = [];
  /** Rooms the plan entered before this walk, by biome key and occurrence ID; their encounters stay. */
  private readonly inheritedRooms = new Set<string>();
  /** Rooms per biome whose encounters the walk has customized, in entry order. */
  private readonly encounterRooms = new Map<number, number>();
  /** Rooms entered per biome that have had their essence roll. */
  private readonly essenceRooms = new Map<number, number>();
  /** Rooms the walk passed after their Quick Buck and Buried Treasure drops were picked up. */
  private readonly dropRoomsDone = new Set<string>();
  /** Shops and Contract pedestals whose filled stock the walk has steered, and Travel Deal items. */
  private readonly steeredShops = new Set<string>();
  /** Each steered Shop's items already judged as wanted items and as filler. */
  private readonly judgedShopItems = new Map<
    string,
    { readonly wanted: Set<string>; readonly filler: Set<string> }
  >();
  /** The steered pick of each Shop slot and Travel Deal item, by its address key. */
  private readonly steeredItems = new Map<string, ResolvedRewardOffer>();
  /** Steered Shops whose judging waits on a pending purchase. */
  private readonly waitingShops = new Set<string>();
  /** A purchase applied before the gold walk reaches it, with where the walk stood before it. */
  private pendingPurchase:
    | {
        readonly offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>;
        readonly kind: DraftPurchaseKind;
        readonly mark: DraftWalkMark;
        readonly step: number;
      }
    | undefined;
  /** Reward commands this walk applied. */
  private readonly authoredRewards = new Set<string>();
  private stepCount = 0;
  /** Every command this walk applied, in order. */
  readonly appliedCommands: ProjectCommand[] = [];
  /** Settlement faults beside the commands this walk applied, in order. */
  readonly faults: SettlementFault[] = [];
  private failureReason: string | undefined;
  /** The biome being walked. */
  private biomeIndex = 0;
  /** Hermes and Hammer rewards some decision in this walk could legally take. */
  readonly legalSupply = new Set<DraftSupply>();
  /** Gods the native cap or interaction rule bars for the rest of this walk. */
  private readonly stoppedGods = new Set<string>();
  /** Devotion sources found unacquired, with the acquired god count then. */
  private readonly unacquiredDevotionSources = new Map<string, number>();
  /** Hub doors showing a god outside the pool, by biome; the walk never visits them. */
  private readonly unvisitedHubDoors = new Map<string, Set<string>>();
  /**
   * Each Hub's open doors in the weighted order its first visit drew them, by biome and Hub
   * key; the Hub visits the first ones it still needs.
   */
  private readonly hubVisitRanks = new Map<string, readonly string[]>();

  constructor(
    readonly catalog: Catalog,
    private readonly authoring: AuthoringSession,
    readonly spec: DraftSpec,
    readonly rng: DraftRng,
    schedule: DraftGodSchedule,
    world: DraftWorldProduct,
    /** Rooms of the start an earlier walk of the same draft entered, by biome and occurrence ID. */
    private readonly draftedBefore: ReadonlySet<string> = new Set(),
  ) {
    const held = prepareRouteStartTraitRequirements(
      catalog,
      authoring.current().project.route,
      spec.loadout,
    ).held;
    this.steering = new DraftSteering(
      catalog,
      spec,
      schedule,
      world,
      createDraftPrerequisites(catalog, draftBasketTraitKeys(spec), held),
      held,
      { assembly: () => this.assembly, biomeIndex: () => this.biomeIndex },
    );
    const shuffle = <T>(values: readonly T[]) => this.shuffle(values);
    const apply = (command: ProjectCommand) => this.apply(command);
    this.traitOffers = new DraftTraitOffers({
      catalog,
      spec,
      steering: this.steering,
      hooked: this.hooked,
      project: () => this.project,
      candidates: () => this.candidates(),
      startingOutcome: (trait, giverKey) =>
        this.candidates().traitOfferStartingOutcome(trait, giverKey),
      apply,
      shuffle,
      fail: (reason) => {
        this.failureReason = reason;
      },
    });
    this.samples = {
      assembly: () => this.assembly,
      evaluate: this.evaluate,
      apply,
      shuffle,
      traitGuard: () => {
        const progress = this.steering.progress();
        return (traitKey) => this.traitOffers.traitAllowed(traitKey, progress);
      },
    };
    this.encounterChoices = {
      catalog,
      spec,
      steering: this.steering,
      hooked: this.hooked,
      assembly: () => this.assembly,
      apply,
      shuffle,
      random: () => this.rng(),
      reauthorReward: (biomeKey, occurrenceId, excluded) =>
        this.reauthorIncomingReward(biomeKey, occurrenceId, excluded),
    };
    // The Shops the plan already entered were stocked by whoever entered them.
    for (const biomeKey of this.project.route.itineraryBiomeKeys)
      for (const room of this.enteredRooms(biomeKey)) {
        this.inheritedRooms.add(`${biomeKey}/${room.occurrenceId}`);
        this.steeredShops.add(`${biomeKey}/${room.occurrenceId}`);
        this.steeredShops.add(`${biomeKey}/${room.occurrenceId}/${TRAVEL_DEAL_REFILL_ENTRY_KEY}`);
        this.steeredShops.add(`${biomeKey}/${room.occurrenceId}/${PEDESTAL_STEER_KEY}`);
      }
  }

  /** Encounter phases this walk customized as it left their rooms, by phase key. */
  get draftedPhases(): ReadonlySet<string> {
    return new Set(this.draftedPhaseKeys);
  }

  /** Rooms this draft entered, in earlier walks or this one, by biome key and occurrence ID. */
  get draftedRooms(): ReadonlySet<string> {
    const rooms = new Set(this.draftedBefore);
    for (const biomeKey of this.project.route.itineraryBiomeKeys)
      for (const room of this.enteredRooms(biomeKey)) {
        const key = `${biomeKey}/${room.occurrenceId}`;
        if (!this.inheritedRooms.has(key)) rooms.add(key);
      }
    return rooms;
  }

  /** Decisions taken so far, across every biome this walk ran. */
  get steps(): number {
    return this.stepCount;
  }

  /** Why the last biome run stopped short. */
  get failure(): string | undefined {
    return this.failureReason;
  }

  get assembly(): ProjectEvaluationAssembly {
    return this.authoring.current();
  }

  get project(): ProjectDocument {
    return this.assembly.project;
  }

  /** The configured biome the route's issue belongs to; route-start issues belong to the first. */
  private issueBiomeIndex(): number {
    const issue = this.assembly.evaluation.issue;
    if (issue === undefined) return this.project.route.biomes.length;
    const origin = issue.reasons[0]!.origin;
    return 'biomeKey' in origin
      ? Math.max(this.project.route.itineraryBiomeKeys.indexOf(origin.biomeKey), 0)
      : 0;
  }

  /**
   * Authors one biome and equips its drafted rack keepsake until the route's
   * issue leaves it. False at a dead end, a refused rack or the step limit.
   */
  runBiome(biomeIndex: number, maxSteps: number): boolean {
    this.biomeIndex = biomeIndex;
    this.steering.paceBiome(() => this.rng());
    while (this.stepCount < maxSteps) {
      // Before the biome closes, so the rooms its last step entered roll too.
      this.maybePlaceEssence(biomeIndex);
      this.draftLeftEncounters(biomeIndex);
      this.pickUpTraitDrops(biomeIndex);
      this.steerShops(biomeIndex);
      if (this.issueBiomeIndex() > biomeIndex) {
        // The biome closes only on judged purchases.
        if (this.pendingPurchase !== undefined) {
          this.settlePendingPurchase(true);
          continue;
        }
        const rack = this.equipRack(biomeIndex);
        if (rack === 'equipped') {
          this.stepCount += 1;
          continue;
        }
        if (rack === 'refused') {
          this.failureReason ??= `rackKeepsakeRefused at ${this.project.route.itineraryBiomeKeys[biomeIndex]}`;
          return false;
        }
        return true;
      }
      const issue = this.assembly.evaluation.issue!;
      const reason = issue.reasons[0]!;
      if (!draftEncounterChoice(this.encounterChoices, reason) && !this.repair(reason)) {
        this.failureReason ??= `${reason.code} at ${semanticAddressKey(reason.origin)}`;
        return false;
      }
      this.stepCount += 1;
    }
    this.failureReason = 'step limit';
    return false;
  }

  /**
   * Each room entered since the previous step, in entry order, places an unplaced resource
   * point at the spec's resource room chance, preferring an element a waiting basket trait
   * needs. Rooms this walk enters in an earlier biome roll too; those it starts with were
   * rolled by the walk that entered them.
   */
  private maybePlaceEssence(biomeIndex: number): void {
    const biomeKeys = this.project.route.itineraryBiomeKeys;
    for (const [index, biomeKey] of biomeKeys.slice(0, biomeIndex + 1).entries()) {
      const entered = this.enteredRooms(biomeKey);
      const rolled = this.essenceRooms.get(index);
      if (rolled === undefined && index < biomeIndex) {
        this.essenceRooms.set(index, entered.length);
        continue;
      }
      if (entered.length <= (rolled ?? 0)) continue;
      this.essenceRooms.set(index, entered.length);
      for (const room of entered.slice(rolled ?? 0))
        this.rollEssence(biomeKey, room.occurrenceId, room.gameName);
    }
  }

  /**
   * Customizes the encounters of each room the walk has left, as the post pass would, so a
   * later Shop's gold reads the rosters the plan keeps; the post pass covers the rest.
   */
  private draftLeftEncounters(biomeIndex: number): void {
    const biomeKey = this.project.route.itineraryBiomeKeys[biomeIndex];
    if (biomeKey === undefined) return;
    const entered = this.enteredRooms(biomeKey);
    const done = this.encounterRooms.get(biomeIndex) ?? 0;
    // The last entered room is where the walk stands.
    if (entered.length - 1 <= done) return;
    this.encounterRooms.set(biomeIndex, entered.length - 1);
    const left = new Set(
      entered
        .slice(done, -1)
        .map((room) => room.occurrenceId as string)
        .filter((occurrenceId) => !this.inheritedRooms.has(`${biomeKey}/${occurrenceId}`)),
    );
    const authoring = {
      current: () => this.assembly,
      settle: (command: ProjectCommand) => {
        const outcome = this.authoring.apply(command, 'noNewFinding');
        if (outcome.kind !== 'applied') return false;
        this.appliedCommands.push(command);
        if (outcome.fault !== undefined) this.faults.push(outcome.fault);
        return true;
      },
    };
    for (const phase of reachedEncounterPhasesForProjectEvaluationAssembly(this.assembly)) {
      const key = semanticAddressKey(phase);
      if (
        phase.biomeKey !== biomeKey ||
        !left.has(phase.owner.occurrenceId) ||
        this.draftedPhaseKeys.includes(key)
      )
        continue;
      // A phase not active yet (behind a Fig Leaf or Gorgon choice) is left to the post pass.
      if (
        encounterPhaseSequenceStatusForProjectEvaluationAssembly(this.assembly, phase)?.kind !==
        'active'
      )
        continue;
      this.draftedPhaseKeys.push(key);
      draftPhaseEncounter(this.catalog, authoring, phase, this.rng);
    }
  }

  /** The biome's entered rooms, in entry order. */
  private enteredRooms(
    biomeKey: string,
  ): readonly { readonly occurrenceId: OccurrenceId; readonly gameName: string }[] {
    const biome = this.assembly.evaluation.route.biomes.find((b) => b.biomeKey === biomeKey);
    if (biome === undefined || !('history' in biome)) return [];
    return biome.history.ledgers.roomAppearances.flatMap((appearance) =>
      appearance.origin.kind === 'occurrence' && appearance.origin.biomeKey === biomeKey
        ? [{ occurrenceId: appearance.origin.occurrenceId, gameName: appearance.gameName }]
        : [],
    );
  }

  private rollEssence(biomeKey: string, occurrenceId: OccurrenceId, gameName: string): void {
    const route = this.project.route;
    // Only a room that can host an unplaced point rolls.
    const support = this.roomOf(gameName)?.resourcePointSupport;
    if (
      support === undefined ||
      support.excludedRouteKeys?.includes(route.routeKey) === true ||
      !support.families.some((family) => route.resourcePlacements[family] === null)
    )
      return;
    const percent = this.spec.resourceRoomChance ?? DRAFT_OPTIONS.resourceRoomChance.default;
    if (this.rng() >= percent / 100) return;
    const legal = routeResourceAuthoring(this.catalog, route).legalTargetsByFamily;
    const rules = support.rules;
    const families = RESOURCE_FAMILIES.filter(
      (family) =>
        route.resourcePlacements[family] === null &&
        legal[family].some(
          (target) => target.biomeKey === biomeKey && target.occurrenceId === occurrenceId,
        ),
    );
    const wanted = this.steering.wantedElements(this.steering.progress());
    const preferred = (family: (typeof RESOURCE_FAMILIES)[number]) => {
      const element = rules[family].element;
      return Number(element !== undefined && wanted.includes(element));
    };
    const ordered = this.shuffle(families).sort((a, b) => preferred(b) - preferred(a));
    for (const family of ordered) {
      const outcome = this.authoring.apply(
        {
          kind: 'ReplaceResourcePlacement',
          route: createRouteAddress(route.routeKey),
          family,
          value: { biomeKey, occurrenceId },
        },
        'noNewFinding',
      );
      if (outcome.kind !== 'applied') continue;
      if (outcome.fault !== undefined) this.faults.push(outcome.fault);
      return;
    }
  }

  /**
   * While Quick Buck or Buried Treasure is held, picks up their optional drops in each of
   * the biome's entered rooms not yet read since the walk passed it, in spawn order, each
   * at the first gap the engine's live room offers it.
   */
  private pickUpTraitDrops(biomeIndex: number): void {
    const biomeKey = this.project.route.itineraryBiomeKeys[biomeIndex];
    if (biomeKey === undefined) return;
    const equipped = latestRunState(this.assembly)?.traits.equippedTraits ?? {};
    if (!PICKED_UP_DROP_TRAITS.some((key) => key in equipped)) return;
    const biome = createBiomeAddress(this.project.route.routeKey, biomeKey);
    for (const room of this.enteredRooms(biomeKey)) {
      const key = `${biomeKey}/${room.occurrenceId}`;
      if (this.dropRoomsDone.has(key)) continue;
      const occurrence = createOccurrenceAddress(biome, room.occurrenceId);
      const placed = new Set<string>();
      // Each drop after the one placed before it, in spawn order.
      let floor = 0;
      for (;;) {
        const live = liveRoomForProjectEvaluationAssembly(
          this.catalog,
          this.assembly,
          occurrence,
          'placements',
        );
        if (live === undefined) break;
        const placement = firstTraitDropPlacement(live, placed, floor);
        if (placement === undefined) {
          // A room the walk has passed spawns nothing more.
          if (live.leftBehind !== undefined) this.dropRoomsDone.add(key);
          break;
        }
        placed.add(placement.key);
        if (this.applyAll(placement.commands)) floor = placement.gap + 1;
      }
    }
  }

  /** Applies one verb's commands in order, never adding a finding; false at a refusal. */
  private applyAll(commands: readonly ProjectCommand[]): boolean {
    for (const command of commands) {
      const outcome = this.authoring.apply(command, 'noNewFinding');
      if (outcome.kind !== 'applied') return false;
      this.appliedCommands.push(command);
      if (outcome.fault !== undefined) this.faults.push(outcome.fault);
    }
    return true;
  }

  private candidates(): ProjectCandidateSession {
    return this.authoring.candidates();
  }

  private evaluate: ProjectCandidateSession['evaluate'] = ((query: never) =>
    this.candidates().evaluate(query)) as ProjectCandidateSession['evaluate'];

  /** Applies a command through edit settlement; false when the command authority refuses it. */
  apply(command: ProjectCommand): boolean {
    const outcome = this.authoring.apply(command);
    if (outcome.kind !== 'applied') return false;
    this.appliedCommands.push(command);
    if (outcome.fault !== undefined) this.faults.push(outcome.fault);
    return true;
  }

  private shuffle<T>(values: readonly T[]): T[] {
    return shuffleDraft(this.rng, values);
  }

  /** A weighted random order; zero-weight values are dropped. */
  private weighted<T>(values: readonly T[], weight: (value: T) => number): T[] {
    const pool = values
      .map((value) => ({ value, weight: weight(value) }))
      .filter((e) => e.weight > 0);
    const result: T[] = [];
    while (pool.length > 0) {
      let roll = this.rng() * pool.reduce((sum, entry) => sum + entry.weight, 0);
      let index = 0;
      for (; index < pool.length - 1; index += 1) {
        roll -= pool[index]!.weight;
        if (roll <= 0) break;
      }
      result.push(pool.splice(index, 1)[0]!.value);
    }
    return result;
  }

  private occurrenceId(biomeKey: string): OccurrenceId {
    this.nextOccurrence += 1;
    return createOccurrenceId(`${biomeKey}-draft-${this.nextOccurrence}`);
  }

  /** A room as this route declares it, with its route overlay applied. */
  private roomOf(gameName: string) {
    return routeRoomDeclaration(this.catalog.rooms.byKey[gameName], this.project.route.routeKey);
  }

  private occurrence(biomeKey: string, occurrenceId: string): RoomOccurrence | undefined {
    return this.project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
  }

  /** What the walk has acquired so far. */
  progress(): DraftProgress {
    return this.steering.progress();
  }

  hermesReserved(): boolean {
    return this.steering.hermesReserved();
  }

  wastedHermes(): number {
    return this.steering.wastedHermes();
  }

  scheduledTargets(): ReturnType<DraftSteering['scheduledTargets']> {
    return this.steering.scheduledTargets();
  }

  /**
   * Whether the basket wants an item now: a boon of a god that can take its next basket
   * trait, a due Hermes or Hammer, or on Dream an element a waiting trait needs.
   */
  private wantedNow(value: ResolvedRewardOffer): boolean {
    const progress = this.steering.progress();
    const supply = draftProvider(this.catalog, value);
    const god = this.steering.offerGod(value);
    return supply === 'hermes' || supply === 'hammer'
      ? this.steering.supplyNeed(supply, progress) === 'now'
      : god !== undefined
        ? this.steering.godTakes(god, progress)
        : draftBoostElements(this.catalog, value.rewardType).some((element) =>
            this.steering.wantedElements(progress).includes(element),
          );
  }

  /** Collects a Contract pedestal's free item when wanted; one that invalidates the route is put back. */
  private collectPedestal(
    pedestal: Extract<SemanticAddress, { readonly kind: 'infernalContractPedestal' }>,
    value: ResolvedRewardOffer,
  ): void {
    if (!this.wantedNow(value)) return;
    const collect = (collected: boolean): ProjectCommand => ({
      kind: 'SetInfernalContractPedestalCollected',
      pedestal,
      collected,
    });
    if (!this.apply(collect(true))) return;
    if (this.assembly.evaluation.issue?.kind === 'invalid') this.apply(collect(false));
  }

  /**
   * Judges a steered Shop's items in slot order, its Travel Deal item last: each wanted item,
   * then, once every slot holds an item, the filler the spending style buys as weighted picks;
   * filling an empty slot judges the Shop again. A pending purchase stops the judging until a
   * later step settles it. True once done.
   */
  private buyShop(biomeKey: string, occurrenceId: OccurrenceId): boolean {
    if (this.pendingPurchase !== undefined) return false;
    const occurrence = this.occurrence(biomeKey, occurrenceId);
    const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
    const profile = this.catalog.rewards.shops.byKey[shop?.profileKey ?? ''];
    if (occurrence === undefined || shop === undefined || profile === undefined) return true;
    const judged = this.judgedItems(`${biomeKey}/${occurrenceId}`);
    const slotKeys = profile.slots.values.map((slot) => slot.key);
    const keys = [
      ...slotKeys,
      ...(shop.travelDealRefill === undefined ? [] : [TRAVEL_DEAL_REFILL_ENTRY_KEY]),
    ];
    const biome = createBiomeAddress(this.project.route.routeKey, biomeKey);
    // The steered pick names what a Mystery boon was chosen for; the stock may not.
    const itemOf = (offerKey: string) => {
      const current = this.occurrence(biomeKey, occurrenceId);
      const stocked =
        current === undefined ? undefined : authoredShopOffer(current, offerKey)?.reward?.offer;
      return stocked === undefined
        ? undefined
        : (this.steeredItems.get(
            semanticAddressKey(createShopOfferAddress(biome, occurrenceId, offerKey)),
          ) ?? stocked);
    };
    // An empty slot is judged once the walk fills it, and filler waits for every slot.
    let empty = false;
    for (const offerKey of keys) {
      if (judged.wanted.has(offerKey)) continue;
      const value = itemOf(offerKey);
      if (value === undefined) {
        empty ||= offerKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY;
        continue;
      }
      judged.wanted.add(offerKey);
      if (
        this.wantedNow(value) &&
        this.purchase(createShopOfferAddress(biome, occurrenceId, offerKey), 'wanted') === 'pending'
      )
        return false;
    }
    if (empty || this.steering.fillerAppetite() === 'none') return true;
    const bought = new Set(
      (this.occurrence(biomeKey, occurrenceId)?.roomActions?.order ?? []).flatMap((action) =>
        action.kind === 'interactShopOffer' ? [action.offerKey] : [],
      ),
    );
    const weight = (offerKey: string) => {
      const value = itemOf(offerKey);
      return value === undefined || bought.has(offerKey) || judged.filler.has(offerKey)
        ? 0
        : this.steering.shopFillerWeight(value);
    };
    // A kind that reaches its amount stops being bought, so the weights are read per pick.
    for (;;) {
      const offerKey = this.weighted(keys, weight)[0];
      if (offerKey === undefined) return true;
      judged.filler.add(offerKey);
      if (
        this.purchase(createShopOfferAddress(biome, occurrenceId, offerKey), 'filler') === 'pending'
      )
        return false;
    }
  }

  /**
   * Buys a Shop item when its gold clears the spending style (see `purchaseClears`), judged
   * after every earlier purchase. A purchase the gold walk does not reach until its own choice
   * is made, such as a Mystery boon's god boon screen, is pending until a later step reaches it.
   */
  private purchase(
    offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    kind: DraftPurchaseKind,
  ): 'bought' | 'declined' | 'pending' {
    if (this.steering.spending() === 'none') return 'declined';
    const mark = this.mark();
    if (!this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true }))
      return 'declined';
    const gold =
      this.assembly.evaluation.issue?.kind === 'invalid' ? UNAFFORDABLE : this.purchaseGold(offer);
    if (gold === undefined) {
      this.pendingPurchase = { offer, kind, mark, step: this.stepCount };
      return 'pending';
    }
    return this.settlePurchase(offer, kind, gold, mark) ? 'bought' : 'declined';
  }

  /**
   * Keeps a purchase whose gold clears its kind. A wanted item that does not takes back the
   * run's earlier filler purchases, latest first, until it does; failing that, the walk returns
   * to where it stood before the purchase.
   */
  private settlePurchase(
    offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    kind: DraftPurchaseKind,
    gold: DraftPurchaseGold,
    mark: DraftWalkMark,
  ): boolean {
    if (this.steering.purchaseClears(kind, gold)) return true;
    if (kind === 'wanted')
      for (const filler of this.fillerPurchases(offer)) {
        // A take-back that would add a finding keeps its filler.
        const command: ProjectCommand = {
          kind: 'ReplaceShopPurchaseParticipation',
          offer: filler,
          purchased: false,
        };
        const applied = this.authoring.apply(command, 'noNewFinding');
        if (applied.kind !== 'applied') continue;
        this.appliedCommands.push(command);
        if (applied.fault !== undefined) this.faults.push(applied.fault);
        if (this.steering.purchaseClears(kind, this.purchaseGold(offer) ?? UNAFFORDABLE))
          return true;
      }
    this.returnTo(mark);
    // The declined item stays judged, and its Shop's judging resumes.
    const shop = `${offer.biomeKey}/${offer.occurrenceId}`;
    this.judgedItems(shop)[kind].add(offer.offerKey);
    this.waitingShops.add(shop);
    return false;
  }

  /** Where the walk stands now, to return to. */
  private mark(): DraftWalkMark {
    return {
      assembly: this.assembly,
      commands: this.appliedCommands.length,
      faults: this.faults.length,
      memory: {
        stepCount: this.stepCount,
        phases: this.draftedPhaseKeys.length,
        hooked: new Set(this.hooked),
        encounterRooms: new Map(this.encounterRooms),
        essenceRooms: new Map(this.essenceRooms),
        dropRoomsDone: new Set(this.dropRoomsDone),
        steeredShops: new Set(this.steeredShops),
        judgedShopItems: new Map(
          [...this.judgedShopItems].map(([key, judged]) => [
            key,
            { wanted: new Set(judged.wanted), filler: new Set(judged.filler) },
          ]),
        ),
        steeredItems: new Map(this.steeredItems),
        waitingShops: new Set(this.waitingShops),
        authoredRewards: new Set(this.authoredRewards),
        legalSupply: new Set(this.legalSupply),
        stoppedGods: new Set(this.stoppedGods),
        unacquiredDevotionSources: new Map(this.unacquiredDevotionSources),
        unvisitedHubDoors: new Map(
          [...this.unvisitedHubDoors].map(([key, doors]) => [key, new Set(doors)]),
        ),
        hubVisitRanks: new Map(this.hubVisitRanks),
        authoredOffers: this.traitOffers.memory(),
      },
    };
  }

  /**
   * Returns the walk to a mark, as if it never took the steps since: the plan, the commands
   * and faults it kept and everything it remembers of its decisions. Its RNG and occurrence
   * IDs move on.
   */
  private returnTo(mark: DraftWalkMark): void {
    const { memory } = mark;
    this.authoring.restore(mark.assembly);
    this.appliedCommands.length = mark.commands;
    this.faults.length = mark.faults;
    this.stepCount = memory.stepCount;
    this.draftedPhaseKeys.length = memory.phases;
    refill(this.hooked, memory.hooked);
    refillMap(this.encounterRooms, memory.encounterRooms);
    refillMap(this.essenceRooms, memory.essenceRooms);
    refill(this.dropRoomsDone, memory.dropRoomsDone);
    refill(this.steeredShops, memory.steeredShops);
    // In place, so a Shop's judging under way keeps reading the same sets.
    for (const key of [...this.judgedShopItems.keys()])
      if (!memory.judgedShopItems.has(key)) this.judgedShopItems.delete(key);
    memory.judgedShopItems.forEach((judged, key) => {
      const current = this.judgedItems(key);
      refill(current.wanted, judged.wanted);
      refill(current.filler, judged.filler);
    });
    refillMap(this.steeredItems, memory.steeredItems);
    refill(this.waitingShops, memory.waitingShops);
    refill(this.authoredRewards, memory.authoredRewards);
    refill(this.legalSupply, memory.legalSupply);
    refill(this.stoppedGods, memory.stoppedGods);
    refillMap(this.unacquiredDevotionSources, memory.unacquiredDevotionSources);
    this.unvisitedHubDoors.clear();
    memory.unvisitedHubDoors.forEach((doors, key) =>
      this.unvisitedHubDoors.set(key, new Set(doors)),
    );
    refillMap(this.hubVisitRanks, memory.hubVisitRanks);
    this.traitOffers.restoreMemory(memory.authoredOffers);
  }

  /** A steered Shop's judged items, by biome key and occurrence ID. */
  private judgedItems(shop: string): {
    readonly wanted: Set<string>;
    readonly filler: Set<string>;
  } {
    let judged = this.judgedShopItems.get(shop);
    if (judged === undefined) {
      judged = { wanted: new Set(), filler: new Set() };
      this.judgedShopItems.set(shop, judged);
    }
    return judged;
  }

  /**
   * Judges the pending purchase once the gold walk reaches it, which the choices and required
   * placements the next steps author bring about; one still out of reach after a few steps, or
   * `now`, is taken back. True while it still waits.
   */
  private settlePendingPurchase(now = false): boolean {
    const pending = this.pendingPurchase;
    if (pending === undefined) return false;
    const { offer } = pending;
    const gold = this.purchaseGold(offer);
    if (gold === undefined && !now && this.stepCount - pending.step < PENDING_PURCHASE_STEPS)
      return true;
    this.pendingPurchase = undefined;
    this.settlePurchase(offer, pending.kind, gold ?? UNAFFORDABLE, pending.mark);
    return false;
  }

  /**
   * The engine's gold for a reached purchase: the chance the gold held before it covers its
   * price and the mean gold left after it; unaffordable when the plan leaves it unpriced,
   * undefined when the gold walk does not reach it yet.
   */
  private purchaseGold(offer: SemanticAddress): DraftPurchaseGold | undefined {
    let priced: GoldPurchaseAvailability;
    try {
      priced = goldLedgerForProjectEvaluationAssembly(this.catalog, this.assembly).purchaseAt(
        offer,
      );
    } catch (error) {
      if (error instanceof GoldLedgerContractError) return UNAFFORDABLE;
      throw error;
    }
    if (priced.availability === 'unavailable')
      return priced.reason === 'coverageNotReached' ? undefined : UNAFFORDABLE;
    const { purchase } = priced;
    if (purchase.venue === 'free') return FREE;
    const odds = purchase.affordableProbability;
    return odds === undefined || purchase.balanceBefore.availability !== 'available'
      ? UNAFFORDABLE
      : { odds, spare: purchase.balanceBefore.balance.mean - purchase.price.mean };
  }

  /**
   * The draft's filler purchases before a purchase, latest first: Shops in entry order, each in
   * purchase order. A Shop the plan held before the draft keeps what was bought there.
   */
  private fillerPurchases(
    except: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
  ): Extract<SemanticAddress, { readonly kind: 'shopOffer' }>[] {
    const purchases: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>[] = [];
    const seen = new Set<string>();
    for (const biomeKey of this.project.route.itineraryBiomeKeys) {
      const biome = createBiomeAddress(this.project.route.routeKey, biomeKey);
      for (const room of this.enteredRooms(biomeKey)) {
        const key = `${biomeKey}/${room.occurrenceId}`;
        if (seen.has(key) || (this.inheritedRooms.has(key) && !this.draftedBefore.has(key)))
          continue;
        seen.add(key);
        const occurrence = this.occurrence(biomeKey, room.occurrenceId);
        if (occurrence === undefined) continue;
        for (const action of occurrence.roomActions?.order ?? []) {
          if (action.kind !== 'interactShopOffer') continue;
          const address = createShopOfferAddress(biome, room.occurrenceId, action.offerKey);
          if (semanticAddressKey(address) === semanticAddressKey(except)) continue;
          const bought = authoredShopOffer(occurrence, action.offerKey)?.reward?.offer;
          if (bought !== undefined && draftFillerKind(bought.rewardType) !== undefined)
            purchases.push(address);
        }
      }
    }
    return purchases.reverse();
  }

  /** A basket Hermes or Hammer reward some decision could take; none while the basket reserves every Hermes room. */
  private noteSupply(offers: readonly ResolvedRewardOffer[]): void {
    for (const offer of offers) {
      if (this.steering.offerWeight(offer) <= 0) continue;
      const supply = draftProvider(this.catalog, offer);
      if (supply === undefined || supply === 'spell' || this.steering.basketOf(supply).length === 0)
        continue;
      if (supply === 'hermes' && this.steering.hermesReserved()) continue;
      this.legalSupply.add(supply);
    }
  }

  /** Equips the drafted keepsake at the rack after this biome's Postboss, once. */
  private equipRack(biomeIndex: number): 'none' | 'equipped' | 'refused' {
    const plan = this.project.route.biomes[biomeIndex];
    if (plan === undefined) return 'none';
    // The spec holds one keepsake per rack slot, in slot order.
    const slot = draftKeepsakeOptions(this.catalog, this.project.route).rackSlots.findIndex(
      (candidate) => candidate.afterBiomeKey === plan.biomeKey,
    );
    const keepsakeKey = this.spec.rackKeepsakeKeys[slot];
    if (keepsakeKey === undefined || keepsakeKey === null) return 'none';
    const rack = plan.topology?.occurrences.find(
      (occurrence) => occurrence.keepsakeRack !== undefined,
    );
    if (rack === undefined) return 'refused';
    if (rack.keepsakeRack?.keepsakeKey === keepsakeKey) return 'none';
    const selection = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(
        createBiomeAddress(this.project.route.routeKey, plan.biomeKey),
        rack.occurrenceId,
      ),
    );
    return this.apply({ kind: 'ReplacePostbossKeepsake', selection, keepsakeKey })
      ? 'equipped'
      : 'refused';
  }

  // --- Repairs -------------------------------------------------------------

  private repair(reason: SemanticFinding): boolean {
    const origin = reason.origin;
    switch (reason.code) {
      case 'baseRewardStoreUnavailable':
        if (origin.kind === 'rewardWheel') return this.rewardWheelStore(origin, reason);
        return origin.kind === 'batchRewardStore' && this.batchRewardStore(origin);
      case 'hubOpenSetIncomplete':
        return origin.kind === 'hubOpenSet' && this.openHubSlot(origin);
      case 'hubVisitOrderIncomplete':
        return (
          (origin.kind === 'hubVisit' || origin.kind === 'hubFountain') &&
          this.extendHubVisits(origin)
        );
      case 'sideRoomGenerationUnavailable':
        return origin.kind === 'localVisitSlot' && this.sideRoomGeneration(origin, reason);
      // Settlement stocks a blank Shrine; an item that turned illegal is redrawn here.
      case 'hermesShrineInventoryWrongGroup':
      case 'hermesShrineInventoryDuplicate':
      case 'hermesShrineInventoryRequirement':
        return origin.kind === 'roomFeature' && this.hermesShrineOffer(origin);
      case 'steadyGrowthOutcomeMissing':
      case 'steadyGrowthOutcomeUnavailable':
        return origin.kind === 'steadyGrowthOutcome' && sampleSteadyGrowth(this.samples, origin);
      case 'biomeFieldMissing':
        return origin.kind === 'biomeField' && this.biomeField(origin);
      case 'biomeTopologyMissing':
        return origin.kind === 'biome' && this.createStart(origin);
      case 'targetMissing':
        return origin.kind === 'target' && this.createTarget(origin);
      case 'batchRewardStoreMissing':
        return origin.kind === 'batchRewardStore' && this.batchRewardStore(origin);
      case 'batchStateMissing':
        return origin.kind === 'exitDecision' && this.fieldsCageOutcome(origin);
      case 'pickedTargetMissing':
        return origin.kind === 'exitSelection' && this.selectExit(origin);
      case 'rewardMissing':
        return this.authorReward(origin, false);
      case 'rewardBagEntryUnavailable':
      case 'rewardSourceUnavailable':
      case 'rewardAcquisitionUnavailable':
        return this.authorReward(origin, true);
      case 'traitOfferMissing':
        return origin.kind === 'traitOffer' && this.traitOffers.author(origin);
      case 'roomActionPlacementRequired':
      case 'hermesShrineDeliveryPlacementRequired':
      case 'echoGoldPickupPlacementRequired':
        return this.placeRequiredActions(origin);
      case 'fountainRarityResultMissing':
      case 'fountainRarityResultUnavailable':
        return (
          origin.kind === 'fountainRarityOutcome' &&
          sampleFountainRarity(this.samples, origin, reason)
        );
      case 'keepsakeEquipResultMissing':
      case 'keepsakeEquipResultUnavailable':
        return (
          origin.kind === 'keepsakeEquipResult' &&
          sampleKeepsakeEquipResult(
            this.samples,
            origin,
            origin.selection.kind === 'keepsakeSelection' && origin.selection.owner === 'routeStart'
              ? this.spec.loadout.keepsakeEquipResults?.[origin.resultKind]
              : undefined,
          )
        );
      case 'figurineOutcomeMissing':
      case 'figurineOutcomeWrongCardinality':
      case 'figurineOutcomeTargetUnavailable':
        return origin.kind === 'figurineArcana' && sampleArcanaChoice(this.samples, origin);
      case 'judgmentOutcomeMissing':
      case 'judgmentOutcomeWrongCardinality':
      case 'judgmentOutcomeTargetUnavailable':
        return origin.kind === 'judgmentArcana' && sampleArcanaChoice(this.samples, origin);
      case 'hexActivationMissing':
      case 'hexActivationUnavailable':
        return origin.kind === 'acquisitionRole' && sampleHexActivation(this.samples, origin);
      default: {
        if (origin.kind === 'levelResolution') return sampleLevelResolution(this.samples, origin);
        if (origin.kind === 'rewardWheel') return this.rewardWheelPicked(origin);
        const owner = assessmentRepairOwner(origin);
        return owner.kind === 'traitOffer' && this.traitOffers.repickCarrierChild(owner, origin);
      }
    }
  }

  /** A random value from the field's declared domain, never one already tried here. */
  private biomeField(field: Extract<SemanticAddress, { readonly kind: 'biomeField' }>): boolean {
    const descriptor = this.catalog.biomeLayouts.byKey[field.biomeKey]?.fields.find(
      (candidate) => candidate.key === field.fieldKey,
    );
    if (descriptor === undefined) return false;
    const domain: readonly (boolean | number | string)[] =
      descriptor.kind === 'boolean'
        ? [true, false]
        : descriptor.kind === 'enum'
          ? descriptor.values
          : Array.from(
              { length: descriptor.max - descriptor.min + 1 },
              (_, i) => descriptor.min + i,
            );
    for (const value of this.shuffle(domain)) {
      const key = `field:${semanticAddressKey(field)}:${String(value)}`;
      if (this.hooked.has(key)) continue;
      this.hooked.add(key);
      if (this.apply({ kind: 'ReplaceBiomeField', field, value })) return true;
    }
    return false;
  }

  private createStart(biome: BiomeAddress): boolean {
    const layout = this.catalog.biomeLayouts.byKey[biome.biomeKey];
    if (layout === undefined) return false;
    const names = biomeStartRoomGameNames(
      resolveBiomeStart(this.catalog, this.project.route.routeKey, layout),
    );
    const occurrenceId = createOccurrenceId(`${biome.biomeKey}-start`);
    for (const gameName of this.shuffle(names)) {
      const query: StartRoomCandidateQuery = { kind: 'startRoom', owner: biome, gameName };
      const evaluation = this.candidates().evaluate(query);
      if (
        evaluation.kind === 'startRoom' &&
        !evaluation.result.supportedGameNames.includes(gameName)
      )
        continue;
      if (this.apply({ kind: 'CreateStart', biome, occurrenceId, gameName })) return true;
    }
    return this.apply({ kind: 'CreateStart', biome, occurrenceId });
  }

  private decisionFor(target: TargetAddress | BatchRewardStoreAddress): ExitDecisionAddress {
    return createExitDecisionAddress(
      createBiomeAddress(target.routeKey, target.biomeKey),
      target.source,
    );
  }

  private createTarget(target: TargetAddress): boolean {
    const layout = this.catalog.biomeLayouts.byKey[target.biomeKey];
    const topology = this.project.route.biomes.find(
      (b) => b.biomeKey === target.biomeKey,
    )?.topology;
    if (layout === undefined || topology === undefined || topology === null) return false;
    const decision = this.decisionFor(target);
    const terminal = hubTerminalTakeoverForSource(this.catalog, layout, topology, target.source);
    if (terminal !== undefined) return this.enterHub(decision, terminal.hubKey);
    let takeover:
      { gameName: string; requiredExitKeys: readonly string[]; required: boolean } | undefined;
    const takeoverNames =
      layout.progression.kind === 'hub'
        ? []
        : takeoverPrebossGameNames(this.catalog, target.biomeKey);
    for (const gameName of takeoverNames) {
      const evaluation = this.evaluate({
        kind: 'takeoverPrebossBatch',
        source: decision,
        gameName,
      });
      if (
        evaluation.kind === 'takeoverPrebossBatch' &&
        evaluation.result.support !== 'impossible' &&
        evaluation.result.findings.length === 0
      )
        takeover = {
          gameName,
          requiredExitKeys: evaluation.result.requiredExitKeys,
          required: evaluation.result.support === 'required',
        };
    }
    const applyTakeover = () => {
      if (takeover === undefined) return false;
      const targetOccurrenceIds = Object.fromEntries(
        takeover.requiredExitKeys.map((exitKey) => [exitKey, this.occurrenceId(target.biomeKey)]),
      );
      const edit = { decision, gameName: takeover.gameName, targetOccurrenceIds };
      return (
        this.apply({ kind: 'CreateTakeoverBatch', ...edit }) ||
        this.apply({ kind: 'ReplaceWithTakeoverBatch', ...edit })
      );
    };
    if (takeover?.required === true) return applyTakeover();
    const uncommitted = exitDecisionForSource(topology, target.source) === undefined;
    const names = ordinaryTargetGameNames(
      this.catalog,
      layout,
      topology,
      target,
      uncommitted ? 'uncommitted' : 'authored',
    );
    let pressure: ForcePressureLedgerEntry | undefined;
    const legal = names.filter((gameName) => {
      const evaluation = this.evaluate({ kind: 'roomTarget', target, gameName });
      if (evaluation.kind === 'roomTarget') pressure ??= evaluation.result.pressure;
      // An uncommitted first target has no reached context yet; its static domain stands.
      return (
        evaluation.kind === 'unavailable' ||
        (evaluation.kind === 'roomTarget' && evaluation.result.findings.length === 0)
      );
    });
    const choices: readonly ({ kind: 'room'; gameName: string } | { kind: 'takeover' })[] = [
      ...legal.map((gameName) => ({ kind: 'room' as const, gameName })),
      ...(takeover === undefined ? [] : [{ kind: 'takeover' as const }]),
    ];
    const forced = this.steering.windowForcedRoom(legal, pressure, target.biomeKey, this.rng);
    const ordered = this.weighted(choices, (entry) =>
      entry.kind === 'takeover'
        ? 0.5
        : this.steering.roomWeight(entry.gameName, target.biomeKey, true),
    );
    for (const choice of forced === undefined
      ? ordered
      : [
          { kind: 'room' as const, gameName: forced },
          ...ordered.filter((entry) => entry.kind !== 'room' || entry.gameName !== forced),
        ]) {
      if (choice.kind === 'takeover') {
        if (applyTakeover()) return true;
        continue;
      }
      const gameName = choice.gameName;
      const occurrenceId = this.occurrenceId(target.biomeKey);
      if (
        this.apply({ kind: 'CreateTarget', target, occurrenceId, gameName }) ||
        this.apply({
          kind: 'InitializeExitDecision',
          decision,
          edit: { kind: 'target', target, occurrenceId, gameName },
        })
      )
        return true;
    }
    return false;
  }

  /** The bounded Hub entry's terminal: the board replaces this source's doors when required. */
  private enterHub(decision: ExitDecisionAddress, hubKey: string): boolean {
    // Before generation the declared force stands; a reached context must still require it.
    const evaluation = this.evaluate({ kind: 'hubTerminalTakeover', source: decision });
    if (evaluation.kind === 'hubTerminalTakeover' && evaluation.result.support !== 'required')
      return false;
    const hub: HubDecisionAddress = Object.freeze({
      kind: 'hubDecision',
      routeKey: decision.routeKey,
      biomeKey: decision.biomeKey,
      hubKey,
    });
    const prebossOccurrenceId = this.occurrenceId(decision.biomeKey);
    return (
      this.apply({
        kind: 'InitializeExitDecision',
        decision,
        edit: { kind: 'hub', hub, prebossOccurrenceId },
      }) || this.apply({ kind: 'ReplaceWithHubDecision', decision, hub, prebossOccurrenceId })
    );
  }

  /**
   * Opens one more Hub door; a wanted story door goes first. A pool too small to fill the
   * doors with distinct gods opens every door it can, leaving unvisited doors for other gods.
   */
  private openHubSlot(openSet: Extract<SemanticAddress, { readonly kind: 'hubOpenSet' }>): boolean {
    if (!this.openOneHubSlot(openSet)) return false;
    if (this.spec.world.godKeys.length >= ORDINARY_SOURCE_CAP) return true;
    const layout = this.catalog.biomeLayouts.byKey[openSet.biomeKey];
    const maxOpen = layout?.progression.kind === 'hub' ? layout.progression.openCount.max : 0;
    while (
      (this.hubDecision(openSet.biomeKey, openSet.hubKey)?.openTargets.length ?? maxOpen) <
        maxOpen &&
      this.openOneHubSlot(openSet)
    );
    return true;
  }

  private hubDecision(biomeKey: string, hubKey: string): HubDecision | undefined {
    return this.project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.decisions.find(
        (candidate): candidate is HubDecision =>
          candidate.kind === 'hub' && candidate.hubKey === hubKey,
      );
  }

  private openOneHubSlot(
    openSet: Extract<SemanticAddress, { readonly kind: 'hubOpenSet' }>,
  ): boolean {
    const layout = this.catalog.biomeLayouts.byKey[openSet.biomeKey];
    if (layout?.progression.kind !== 'hub') return false;
    const slots = this.weighted(layout.progression.slots, (slot) =>
      this.steering.roomWeight(slot.roomGameName, openSet.biomeKey),
    );
    for (const slot of slots) {
      const address = createHubSlotAddress(
        createBiomeAddress(openSet.routeKey, openSet.biomeKey),
        openSet.hubKey,
        slot.slotKey,
      );
      const occurrenceId = this.occurrenceId(openSet.biomeKey);
      const localSlotKeys =
        this.roomOf(slot.roomGameName)?.localChildren.flatMap((child) =>
          child.kind === 'fixedRoomSlots' ? child.slots.map((local) => local.slotKey) : [],
        ) ?? [];
      const localOccurrenceIdsBySlot = Object.fromEntries(
        localSlotKeys.map((key) => [key, this.occurrenceId(openSet.biomeKey)]),
      );
      const evaluation = this.evaluate({
        kind: 'hubSlot',
        slot: address,
        open: true,
        occurrenceId,
        localOccurrenceIdsBySlot,
      });
      if (
        evaluation.kind === 'hubSlot' &&
        (evaluation.result.currentlyOpen ||
          !evaluation.result.selectedPossible ||
          evaluation.result.findings.length > 0)
      )
        continue;
      if (
        this.apply({ kind: 'OpenHubSlot', slot: address, occurrenceId, localOccurrenceIdsBySlot })
      )
        return true;
    }
    return false;
  }

  /**
   * Appends the next Hub action, walking the Hub's map: the first time, it draws the Hub's visits
   * with the steering weights. A drawn visit hosting a selected field NPC whose window is open
   * goes first; then the nearest of the other drawn visits and the fountain, from where the
   * walk stands (the Hub's entry, the door of the room last visited or the fountain); a host
   * whose window has not opened waits for the rest. The fountain, unused after the last visit,
   * comes last.
   */
  private extendHubVisits(
    visit: Extract<SemanticAddress, { readonly kind: 'hubVisit' | 'hubFountain' }>,
  ): boolean {
    const decision = this.hubDecision(visit.biomeKey, visit.hubKey);
    const layout = this.catalog.biomeLayouts.byKey[visit.biomeKey];
    if (decision === undefined || layout?.progression.kind !== 'hub') return false;
    const hub = createHubDecisionAddress(
      createBiomeAddress(visit.routeKey, visit.biomeKey),
      visit.hubKey,
    );
    const fountain: HubAction = { kind: 'useFountain' };
    const orders: HubAction[][] =
      visit.kind === 'hubFountain'
        ? [...decision.actions.keys(), decision.actions.length]
            .reverse()
            .map((index) => [
              ...decision.actions.slice(0, index),
              fountain,
              ...decision.actions.slice(index),
            ])
        : this.nextHubActions(
            visit,
            decision,
            layout.progression.requiredVisits,
            draftHubMap(this.catalog, layout.progression),
          ).map((action) => [...decision.actions, action]);
    for (const actions of orders) {
      const evaluation = this.evaluate({ kind: 'hubActionOrder', hub, actions });
      // Later repairable findings may follow; only an impossible order is refused here.
      if (evaluation.kind === 'hubActionOrder' && !evaluation.result.selectedPossible) continue;
      if (!this.apply({ kind: 'ReplaceHubActionOrder', hub, actions })) continue;
      // A Hub room without a finding of its own still has its encounters chosen when reached.
      const last = actions.at(-1);
      const target =
        last?.kind === 'roomVisit'
          ? decision.openTargets.find((t) => t.hubSlotKey === last.hubSlotKey)
          : undefined;
      if (target !== undefined)
        draftOccurrenceEncounterChoice(this.encounterChoices, visit.biomeKey, target.occurrenceId);
      return true;
    }
    return false;
  }

  /** The Hub's next action candidates, preferred first, as `extendHubVisits` orders them. */
  private nextHubActions(
    visit: Extract<SemanticAddress, { readonly kind: 'hubVisit' }>,
    decision: HubDecision,
    requiredVisits: number,
    map: DraftHubMap,
  ): HubAction[] {
    const visited = new Set(
      decision.actions.flatMap((action) =>
        action.kind === 'roomVisit' ? [action.hubSlotKey] : [],
      ),
    );
    const unvisited = decision.openTargets
      .map((target) => target.hubSlotKey)
      .filter((slotKey) => !visited.has(slotKey));
    const key = `${visit.biomeKey}/${visit.hubKey}`;
    let ranked = this.hubVisitRanks.get(key);
    if (ranked === undefined) {
      ranked = Object.freeze(
        this.weighted(unvisited, (slotKey) =>
          this.hubVisitWeight(visit.biomeKey, decision, slotKey),
        ),
      );
      this.hubVisitRanks.set(key, ranked);
    }
    const open = ranked.filter((slotKey) => unvisited.includes(slotKey));
    const drawn = open.slice(0, Math.max(0, requiredVisits - visited.size));
    const hosting = (slotKey: string) => {
      const room = this.hubVisitRoom(visit.biomeKey, decision, slotKey);
      return room === undefined
        ? undefined
        : this.steering.npcHosting(room.gameName, room.rewardType, visit.biomeKey);
    };
    const last = decision.actions.findLast(
      (action) => action.kind === 'roomVisit' || action.kind === 'useFountain',
    );
    const from =
      last === undefined
        ? map.entry
        : last.kind === 'roomVisit'
          ? map.doorBySlot.get(last.hubSlotKey)
          : map.fountain;
    const at = (action: HubAction): DraftPoint | undefined =>
      action.kind === 'roomVisit'
        ? map.doorBySlot.get(action.hubSlotKey)
        : action.kind === 'useFountain'
          ? map.fountain
          : undefined;
    const visitOf = (slotKey: string): HubAction => ({ kind: 'roomVisit', hubSlotKey: slotKey });
    const fountainUsed = decision.actions.some((action) => action.kind === 'useFountain');
    const free: HubAction[] = drawn
      .filter((slotKey) => hosting(slotKey) === undefined)
      .map(visitOf);
    if (!fountainUsed) free.push({ kind: 'useFountain' });
    return [
      ...nearestFirst(
        from,
        drawn.filter((slotKey) => hosting(slotKey) === 'open').map(visitOf),
        at,
      ),
      ...nearestFirst(from, free, at),
      ...nearestFirst(
        from,
        drawn.filter((slotKey) => hosting(slotKey) === 'later').map(visitOf),
        at,
      ),
      // Past the drawn visits, the rest in their drawn rank.
      ...open.slice(drawn.length).map(visitOf),
    ];
  }

  /**
   * A Hub visit's steering weight: its NPC window's where it hosts a selected field NPC, its
   * room's otherwise; none for a door left unvisited for another god.
   */
  private hubVisitWeight(biomeKey: string, decision: HubDecision, slotKey: string): number {
    const room = this.hubVisitRoom(biomeKey, decision, slotKey);
    if (room === undefined) return 1;
    if (this.unvisitedHubDoors.get(biomeKey)?.has(room.occurrenceId) === true) return 0;
    return (
      this.steering.npcVisitWeight(room.gameName, room.rewardType, biomeKey) ??
      this.steering.roomWeight(room.gameName, biomeKey)
    );
  }

  /** The room behind an open Hub door and the reward type it shows. */
  private hubVisitRoom(biomeKey: string, decision: HubDecision, slotKey: string) {
    const target = decision.openTargets.find((t) => t.hubSlotKey === slotKey);
    const occurrence =
      target === undefined ? undefined : this.occurrence(biomeKey, target.occurrenceId);
    if (occurrence === undefined) return undefined;
    const reward = 'reward' in occurrence.state ? occurrence.state.reward : undefined;
    return {
      occurrenceId: occurrence.occurrenceId,
      gameName: occurrence.gameName,
      rewardType: reward?.offer.rewardType,
    };
  }

  private sideRoomGeneration(
    slot: Extract<SemanticAddress, { readonly kind: 'localVisitSlot' }>,
    reason: SemanticFinding,
  ): boolean {
    const outcomes = reason.evidence['supportOutcomes'];
    if (!Array.isArray(outcomes)) return false;
    for (const generation of this.shuffle(
      outcomes.filter(
        (o): o is 'generated' | 'notGenerated' => o === 'generated' || o === 'notGenerated',
      ),
    ))
      if (this.apply({ kind: 'SetLocalVisitGeneration', slot, generation })) return true;
    return false;
  }

  /**
   * A Shrine item that turned illegal: a declared option of the slot's group, never one already
   * tried nor one offered on a live hero condition the planner does not model.
   */
  private hermesShrineOffer(
    feature: Extract<SemanticAddress, { readonly kind: 'roomFeature' }>,
  ): boolean {
    if (feature.target.kind !== 'hermesShrineOffer') return false;
    const slotKey = hermesShrineInitialSlotKey(feature.target.generationKey);
    const room = this.roomOf(
      this.occurrence(feature.biomeKey, feature.occurrenceId)?.gameName ?? '',
    );
    const profile = this.catalog.rewards.shops.byKey[room?.surfaceShop?.profileKey ?? ''];
    if (slotKey === undefined || profile === undefined) return false;
    const group = profile?.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? ''];
    const occurrence = createOccurrenceAddress(
      createBiomeAddress(feature.routeKey, feature.biomeKey),
      feature.occurrenceId,
    );
    const options = (group?.options.values ?? []).filter(
      (option) => option.unmodeledOfferCondition === undefined,
    );
    for (const option of this.shuffle(options)) {
      const key = `shrine:${semanticAddressKey(feature)}:${option.rewardType}`;
      if (this.hooked.has(key)) continue;
      this.hooked.add(key);
      if (
        this.apply({
          kind: 'ReplaceHermesShrineOffer',
          occurrence,
          slotKey,
          value: { rewardType: option.rewardType },
        })
      )
        return true;
    }
    return false;
  }

  private batchRewardStore(
    store: Extract<SemanticAddress, { readonly kind: 'batchRewardStore' }>,
  ): boolean {
    const evaluation = this.evaluate({
      kind: 'batchRewardStore',
      rewardStore: store,
      storeKey: '',
    });
    if (evaluation.kind !== 'batchRewardStore') return false;
    const decision = this.decisionFor(store);
    for (const storeKey of this.shuffle(evaluation.result.supportStoreKeys))
      if (
        this.apply({
          kind: 'InitializeExitDecision',
          decision,
          edit: { kind: 'rewardStore', storeKey },
        }) ||
        this.apply({ kind: 'ReplaceBatchRewardStore', rewardStore: store, storeKey }) ||
        this.apply({ kind: 'ReplaceBossDoorRewardStore', rewardStore: store, storeKey })
      )
        return true;
    return false;
  }

  private rewardWheelStore(
    wheel: Extract<SemanticAddress, { readonly kind: 'rewardWheel' }>,
    reason: SemanticFinding,
  ): boolean {
    const keys = reason.evidence['supportStoreKeys'];
    if (!Array.isArray(keys)) return false;
    for (const storeKey of this.shuffle(keys.filter((k): k is string => typeof k === 'string')))
      if (this.apply({ kind: 'ReplaceRewardWheelStore', wheel, storeKey })) return true;
    return false;
  }

  private rewardWheelPicked(
    wheel: Extract<SemanticAddress, { readonly kind: 'rewardWheel' }>,
  ): boolean {
    const probe = this.evaluate({ kind: 'rewardWheelOfferCount', wheel, offerCount: 0 });
    const count = probe.kind === 'rewardWheelOfferCount' ? probe.result.offerCount : 3;
    for (const pickedOfferIndex of this.shuffle(Array.from({ length: count }, (_, i) => i))) {
      const evaluation = this.evaluate({ kind: 'rewardWheelPicked', wheel, pickedOfferIndex });
      if (evaluation.kind === 'rewardWheelPicked' && !evaluation.result.selectedPossible) continue;
      if (this.apply({ kind: 'ReplaceRewardWheelPicked', wheel, pickedOfferIndex })) return true;
    }
    return false;
  }

  private fieldsCageOutcome(decision: ExitDecisionAddress): boolean {
    const evaluation = this.evaluate({ kind: 'fieldsCageOutcome', decision, cageOutcome: 'max' });
    if (evaluation.kind !== 'fieldsCageOutcome') return false;
    for (const cageOutcome of this.shuffle(evaluation.result.supportOutcomes))
      if (
        this.apply({
          kind: 'InitializeExitDecision',
          decision,
          edit: { kind: 'fieldsCageOutcome', cageOutcome },
        }) ||
        this.apply({ kind: 'ReplaceFieldsCageOutcome', decision, cageOutcome })
      )
        return true;
    return false;
  }

  private selectExit(
    selection: Extract<SemanticAddress, { readonly kind: 'exitSelection' }>,
  ): boolean {
    const topology = this.project.route.biomes.find(
      (b) => b.biomeKey === selection.biomeKey,
    )?.topology;
    const decision =
      topology === undefined || topology === null
        ? undefined
        : exitDecisionForSource(topology, selection.source);
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') return false;
    const targets = decision.normal.targets;
    const rewardOf = (occurrence: RoomOccurrence | undefined) =>
      occurrence !== undefined && 'reward' in occurrence.state
        ? occurrence.state.reward
        : undefined;
    // A door to a new god with queued traits outranks a Shop, which cannot stock that god yet.
    const newGodDoor = targets.some((target) => {
      const reward = rewardOf(this.occurrence(selection.biomeKey, target.occurrenceId));
      return reward !== undefined && reward !== null && this.steering.queuedNewGod(reward.offer);
    });
    const clockwork = clockworkExitRewards(this.catalog, this.project, selection);
    const ordered = this.weighted(targets, (target) => {
      const occurrence = this.occurrence(selection.biomeKey, target.occurrenceId);
      if (occurrence === undefined) return 1;
      const reward = rewardOf(occurrence);
      if (
        this.steering.npcHosting(
          occurrence.gameName,
          reward?.offer.rewardType,
          selection.biomeKey,
        ) === 'open'
      )
        return NPC_WINDOW_WEIGHT;
      const offerWeight =
        reward !== undefined && reward !== null
          ? Math.max(this.steering.offerWeight(reward.offer), 0.01)
          : 1;
      if (this.spec.pursueTartarusGoal === true && clockwork.get(target.exitKey) === 'goal')
        return TARTARUS_GOAL_WEIGHT;
      const outranked =
        newGodDoor && this.roomOf(occurrence.gameName)?.kind === 'Shop' ? SHOP_OUTRANKED_FACTOR : 1;
      return (
        this.steering.roomWeight(occurrence.gameName, selection.biomeKey) * offerWeight * outranked
      );
    });
    // An offered story room is created once per run: its door goes before any other.
    const story = (target: (typeof targets)[number]) => {
      const occurrence = this.occurrence(selection.biomeKey, target.occurrenceId);
      return (
        occurrence !== undefined &&
        this.steering.storyTarget(occurrence.gameName, selection.biomeKey)
      );
    };
    for (const target of [...ordered.filter(story), ...ordered.filter((t) => !story(t))])
      if (
        this.apply({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'normal', exitKey: target.exitKey },
        })
      )
        return true;
    return false;
  }

  /**
   * Steers each Shop the biome's walk has entered once, as it would a blank one: settlement
   * stocks a Shop on first reach, so its slots are replaced in slot order with steered picks,
   * then its wanted items and filler are bought. A Travel Deal item, stocked once a purchase
   * restocks it, and a Contract pedestal's item, stocked once the Contract spawns it, are
   * steered and bought the same way.
   */
  private steerShops(biomeIndex: number): void {
    const biomeKey = this.project.route.itineraryBiomeKeys[biomeIndex];
    if (biomeKey === undefined || this.settlePendingPurchase()) return;
    const biome = createBiomeAddress(this.project.route.routeKey, biomeKey);
    for (const room of this.enteredRooms(biomeKey)) {
      const occurrence = this.occurrence(biomeKey, room.occurrenceId);
      const key = `${biomeKey}/${room.occurrenceId}`;
      const apply = (command: ProjectCommand) => this.apply(command);
      // Settlement stocks the pedestal once the Contract spawns it; the walk steers it once.
      const pedestalKey = `${key}/${PEDESTAL_STEER_KEY}`;
      if (
        !this.steeredShops.has(pedestalKey) &&
        (occurrence?.infernalContractPedestal?.reward ?? null) !== null
      ) {
        this.steeredShops.add(pedestalKey);
        this.steerPedestal(createInfernalContractPedestalAddress(biome, room.occurrenceId), apply);
      }
      const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
      const profile = this.catalog.rewards.shops.byKey[shop?.profileKey ?? ''];
      if (shop === undefined || profile === undefined) continue;
      if (!this.steeredShops.has(key)) {
        this.steeredShops.add(key);
        // Each pick is judged beside its stocked peers, so it never invalidates them.
        for (const slot of profile.slots.values)
          this.steerShopOffer(createShopOfferAddress(biome, room.occurrenceId, slot.key), apply);
        this.judgeShop(biomeKey, room.occurrenceId);
      } else if (this.waitingShops.has(key)) {
        // Judging resumes only while the walk still stands in the Shop.
        if (this.enteredRooms(biomeKey).at(-1)?.occurrenceId === room.occurrenceId)
          this.judgeShop(biomeKey, room.occurrenceId);
        else this.waitingShops.delete(key);
      }
      const refillKey = `${key}/${TRAVEL_DEAL_REFILL_ENTRY_KEY}`;
      const stocked = this.occurrence(biomeKey, room.occurrenceId);
      if (
        this.steeredShops.has(refillKey) ||
        stocked?.state.kind !== 'shop' ||
        (stocked.state.shop?.travelDealRefill?.reward ?? null) === null
      )
        continue;
      this.steeredShops.add(refillKey);
      const origin = createShopOfferAddress(biome, room.occurrenceId, TRAVEL_DEAL_REFILL_ENTRY_KEY);
      if (this.steerShopOffer(origin, apply) !== undefined)
        this.judgeShop(biomeKey, room.occurrenceId);
    }
  }

  /** Judges a Shop's items, keeping it waiting while a purchase is out of the gold walk's reach. */
  private judgeShop(biomeKey: string, occurrenceId: OccurrenceId): void {
    const key = `${biomeKey}/${occurrenceId}`;
    if (this.buyShop(biomeKey, occurrenceId)) this.waitingShops.delete(key);
    else this.waitingShops.add(key);
  }

  /**
   * Replaces one Shop slot, or its Travel Deal item, with a steered pick among the values its
   * inventory admits beside its peers, never one offered on a live hero condition the planner
   * does not model; the pick, or undefined when none applies.
   */
  private steerShopOffer(
    origin: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    apply: (command: ProjectCommand) => boolean,
  ): ShopOptionSelection | undefined {
    const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
    const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
    if (occurrence === undefined || shop === undefined) return undefined;
    const slotKey =
      origin.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? this.refilledSlotKey(origin.biomeKey, origin.occurrenceId, shop.profileKey)
        : origin.offerKey;
    if (slotKey === undefined) return undefined;
    const profile = this.catalog.rewards.shops.byKey[shop.profileKey];
    const undrawn = new Set(
      (profile?.groups.values ?? []).flatMap((group) =>
        group.options.values.flatMap((option) =>
          option.unmodeledOfferCondition === undefined ? [] : [option.key],
        ),
      ),
    );
    const values = shopOfferOptionValues(this.catalog, shop.profileKey, slotKey).filter((value) => {
      if (undrawn.has(value.optionKey)) return false;
      const evaluation = this.evaluate({ kind: 'shopOfferOption', offer: origin, value });
      return (
        'result' in evaluation &&
        'supported' in evaluation.result &&
        evaluation.result.supported &&
        evaluation.result.findings.length === 0
      );
    });
    this.noteSupply(values.map((value) => value.offer));
    const ordered = this.weighted(values, (v) => this.steering.shopWeight(v.offer));
    for (const value of this.inPoolOrder(ordered, values, (v) => v.offer)) {
      const command: ProjectCommand = { kind: 'ReplaceShopOfferOption', offer: origin, value };
      // The stock already holds the pick: nothing to replace.
      if (
        applyProjectCommand(this.project, this.catalog, command) === this.project ||
        apply(command)
      ) {
        this.steeredItems.set(semanticAddressKey(origin), value.offer);
        return value;
      }
    }
    return undefined;
  }

  /** Replaces the Contract pedestal's item with a steered pick and collects it when wanted. */
  private steerPedestal(
    origin: Extract<SemanticAddress, { readonly kind: 'infernalContractPedestal' }>,
    apply: (command: ProjectCommand) => boolean,
  ): boolean {
    const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
    if (occurrence === undefined) return false;
    const values = infernalContractPedestalOptionValues(this.catalog, occurrence.gameName).filter(
      (value) => {
        const evaluation = this.evaluate({
          kind: 'infernalContractPedestalOption',
          pedestal: origin,
          value,
        });
        return (
          'result' in evaluation &&
          'supported' in evaluation.result &&
          evaluation.result.supported &&
          evaluation.result.findings.length === 0
        );
      },
    );
    this.noteSupply(values.map((value) => value.offer));
    const ordered = this.weighted(values, (v) => this.steering.shopWeight(v.offer));
    for (const value of this.inPoolOrder(ordered, values, (v) => v.offer)) {
      const command: ProjectCommand = {
        kind: 'ReplaceInfernalContractPedestalOption',
        pedestal: origin,
        value,
      };
      // The stock already holds the pick: nothing to replace.
      if (
        applyProjectCommand(this.project, this.catalog, command) === this.project ||
        apply(command)
      ) {
        this.collectPedestal(origin, value.offer);
        return true;
      }
    }
    return false;
  }

  /** The Shop slot a Travel Deal refill restocks, as settlement derived it. */
  private refilledSlotKey(
    biomeKey: string,
    occurrenceId: string,
    profileKey: string,
  ): string | undefined {
    const biome = this.assembly.evaluation.route.biomes.find((b) => b.biomeKey === biomeKey);
    if (biome === undefined || !('rewards' in biome)) return undefined;
    const refill = biome.rewards.derivedAcquisitionEntries.find(
      (entry) =>
        entry.kind === 'travelDealRefill' &&
        entry.address.site.owner.kind === 'occurrence' &&
        entry.address.site.owner.occurrenceId === occurrenceId,
    );
    const slotIndex = refill?.slotIndex;
    return slotIndex === undefined
      ? undefined
      : this.catalog.rewards.shops.byKey[profileKey]?.slots.values[slotIndex]?.key;
  }

  /** A reward already authored here that became unavailable is not tried again, so repairs cannot cycle. */
  private authorReward(origin: SemanticAddress, retry: boolean): boolean {
    const apply = (command: ProjectCommand) => {
      const key = JSON.stringify(command);
      if (retry && this.authoredRewards.has(key)) return false;
      if (!this.apply(command)) return false;
      this.authoredRewards.add(key);
      return true;
    };
    if (origin.kind === 'startingReward') {
      const binding = this.catalog.runStartReward.incomingReward;
      if (binding.kind !== 'countedChoice') return false;
      return this.tryOffers(
        binding.allowedRewardTypes,
        (value) => this.evaluate({ kind: 'startingReward', reward: origin, value }),
        (value) => ({ kind: 'ReplaceStartingReward', reward: origin, value }),
        apply,
      );
    }
    if (origin.kind === 'shopOffer') {
      if (this.steerShopOffer(origin, apply) === undefined) return false;
      this.judgeShop(origin.biomeKey, origin.occurrenceId);
      return true;
    }
    if (origin.kind === 'infernalContractPedestal') return this.steerPedestal(origin, apply);
    if (origin.kind === 'rewardWheelOffer') {
      const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
      const room = occurrence === undefined ? undefined : this.roomOf(occurrence.gameName);
      const attachment = this.catalog.encounterEnvelopes.byKey[
        room?.encounterEnvelopeKey ?? ''
      ]?.slots
        .map((slot) => slot.rewardAttachment)
        .find(
          (candidate) => candidate?.kind === 'rewardWheel' && candidate.key === origin.wheelKey,
        );
      if (attachment?.kind !== 'rewardWheel') return false;
      return this.tryOffers(
        countedRewardTypeDomain(this.catalog, this.assembly, origin, attachment.reward),
        (value) => this.evaluate({ kind: 'rewardWheelOffer', offer: origin, value }),
        (value) => ({ kind: 'ReplaceRewardWheelOffer', offer: origin, value }),
        apply,
      );
    }
    if (origin.kind === 'acquisitionEntry') {
      // A pickup a purchase leaves at its site, such as a bought Mystery boon, has one fixed
      // reward type; a probe's `rewardTypeFixed` exclusion names it when the entry key does not.
      // A Shop slot's entry key is no reward type, so any locally valid offer probes it.
      const evaluateEntry = (value: ResolvedRewardOffer) =>
        this.evaluate({ kind: 'acquisitionEntryOffer', entry: origin, value });
      const probe =
        this.catalog.rewards.rewardTypes.byKey[origin.entryKey] === undefined
          ? this.catalog.rewards.rewardTypes.values
              .map((type) => locallyValidRewardOffers(this.catalog.rewards, type.gameName)[0])
              .find((offer) => offer !== undefined)
          : locallyValidRewardOffers(this.catalog.rewards, origin.entryKey)[0];
      const probed = probe === undefined ? undefined : evaluateEntry(probe);
      const fixed =
        probed?.kind === 'acquisitionEntryOffer'
          ? probed.result.exclusions?.find((exclusion) => exclusion.kind === 'rewardTypeFixed')
          : undefined;
      const rewardType =
        fixed?.kind === 'rewardTypeFixed'
          ? fixed.rewardType
          : probed?.kind === 'acquisitionEntryOffer' && probed.result.supported
            ? probe!.rewardType
            : origin.entryKey;
      if (this.catalog.rewards.rewardTypes.byKey[rewardType] === undefined) return false;
      // A pickup that opens its own boon screen, such as a Mystery boon, leaves that screen
      // missing until the walk authors it next.
      const ownScreen = (finding: SemanticFinding) =>
        finding.code === 'traitOfferMissing' &&
        finding.origin.kind === 'traitOffer' &&
        semanticAddressKey(finding.origin.owner) === semanticAddressKey(origin);
      return this.tryOffers(
        [rewardType],
        evaluateEntry,
        (value) => ({ kind: 'ReplaceAcquisitionEntryOffer', entry: origin, value }),
        apply,
        { followUp: ownScreen },
      );
    }
    if (origin.kind !== 'incomingReward' && origin.kind !== 'localReward') return false;
    const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
    const room = occurrence === undefined ? undefined : this.roomOf(occurrence.gameName);
    if (occurrence === undefined || room === undefined) return false;
    const binding = countedRewardBinding(room, occurrence.state.kind, origin);
    const types =
      binding !== undefined
        ? countedRewardTypeDomain(this.catalog, this.assembly, origin, binding)
        : origin.kind === 'incomingReward' && room.incomingReward.kind === 'fixed'
          ? [room.incomingReward.rewardType]
          : [];
    return origin.kind === 'incomingReward'
      ? this.tryOffers(
          types,
          (value) => this.evaluate({ kind: 'incomingReward', reward: origin, value }),
          (value) => ({ kind: 'ReplaceIncomingReward', reward: origin, value }),
          apply,
          {
            // A fountain room makes a wanted or due god boon somewhat likelier.
            wantedGodBoost: room.kind === 'Reprieve' ? 2 : 1,
            npcExcluded: this.npcExcludedRewards(origin.biomeKey, occurrence),
            avoidBoon: this.siblingHoldsBoon(origin.biomeKey, occurrence),
            whenNoneLegal: () => this.unvisitedHubDoorReward(origin, occurrence, types),
            // A Hub door is visited later, so its reward is not paced to the board's depth.
            paced: !this.hubDoor(origin.biomeKey, occurrence),
          },
        )
      : this.tryOffers(
          types,
          (value) => this.evaluate({ kind: 'localReward', reward: origin, value }),
          (value) => ({ kind: 'ReplaceLocalReward', reward: origin, value }),
          apply,
        );
  }

  private tryOffers(
    rewardTypes: readonly string[],
    evaluate: (value: ResolvedRewardOffer) => ProjectCandidateEvaluation,
    command: (value: ResolvedRewardOffer) => ProjectCommand,
    apply: (command: ProjectCommand) => boolean,
    {
      wantedGodBoost = 1,
      npcExcluded = new Set<string>(),
      avoidBoon = false,
      whenNoneLegal,
      paced = true,
      followUp = () => false,
    }: {
      readonly wantedGodBoost?: number;
      readonly npcExcluded?: ReadonlySet<string>;
      readonly avoidBoon?: boolean;
      readonly whenNoneLegal?: () => boolean;
      readonly paced?: boolean;
      /** A finding the offer leaves for the walk's next repair, not against the offer. */
      readonly followUp?: (finding: SemanticFinding) => boolean;
    } = {},
  ): boolean {
    const legal = rewardTypes
      .flatMap((type) => locallyValidRewardOffers(this.catalog.rewards, type))
      .filter((offer) => this.steering.offerWeight(offer) > 0 && !this.offerStopped(offer))
      .filter((offer) => {
        const result = rewardOfferResult(evaluate(offer));
        if (result === undefined) return false;
        if (!result.supported) this.noteExclusions(result.exclusions ?? []);
        return result.supported && result.findings.every(followUp);
      });
    if (legal.length === 0 && whenNoneLegal !== undefined) return whenNoneLegal();
    this.noteSupply(legal);
    const weight = (offer: ResolvedRewardOffer) => {
      const base = this.steering.offerWeight(offer, paced);
      const boosted =
        this.steering.offerGod(offer) !== undefined && base >= WANTED_GOD_WEIGHT
          ? base * wantedGodBoost
          : base;
      const kept = draftSideDoorWeight(this.catalog, offer, boosted, avoidBoon);
      return npcExcluded.has(offer.rewardType) ? kept * NPC_EXCLUDED_REWARD_FACTOR : kept;
    };
    const ordered = this.inPoolOrder(this.weighted(legal, weight), legal, (offer) => offer);
    for (const offer of ordered) if (apply(command(offer))) return true;
    return false;
  }

  /**
   * A Hub door with no pool reward left shows a boon of a god outside the pool and is never
   * visited, while the board keeps its required visits; a story door stays pool-only.
   */
  /** Whether the occurrence is an open door of its biome's Hub board. */
  private hubDoor(biomeKey: string, occurrence: RoomOccurrence): boolean {
    const layout = this.catalog.biomeLayouts.byKey[biomeKey];
    if (layout?.progression.kind !== 'hub') return false;
    return (
      this.hubDecision(biomeKey, layout.progression.hubKey)?.openTargets.some(
        (target) => target.occurrenceId === occurrence.occurrenceId,
      ) === true
    );
  }

  private unvisitedHubDoorReward(
    origin: Extract<SemanticAddress, { readonly kind: 'incomingReward' }>,
    occurrence: RoomOccurrence,
    rewardTypes: readonly string[],
  ): boolean {
    const layout = this.catalog.biomeLayouts.byKey[origin.biomeKey];
    if (layout?.progression.kind !== 'hub' || !this.hubDoor(origin.biomeKey, occurrence))
      return false;
    if (this.roomOf(occurrence.gameName)?.kind === 'Story') return false;
    const unvisited = this.unvisitedHubDoors.get(origin.biomeKey) ?? new Set<string>();
    if (unvisited.size + 1 > layout.progression.openCount.max - layout.progression.requiredVisits) {
      this.failureReason ??= `unvisitedHubDoorsExhausted at ${origin.biomeKey}`;
      return false;
    }
    const legal = rewardTypes
      .flatMap((type) => locallyValidRewardOffers(this.catalog.rewards, type))
      .filter((offer) => this.steering.unvisitedDoorGodWeight(offer) > 0)
      .filter((offer) => {
        const evaluation = this.evaluate({ kind: 'incomingReward', reward: origin, value: offer });
        return (
          evaluation.kind === 'incomingReward' &&
          evaluation.result.supported &&
          evaluation.result.findings.length === 0
        );
      });
    for (const offer of this.weighted(legal, (o) => this.steering.unvisitedDoorGodWeight(o))) {
      if (!this.apply({ kind: 'ReplaceIncomingReward', reward: origin, value: offer })) continue;
      this.unvisitedHubDoors.set(origin.biomeKey, unvisited.add(occurrence.occurrenceId));
      return true;
    }
    return false;
  }

  /**
   * New gods arrive in pool order: an offer from a god not yet acquired becomes the same offer
   * from the next unacquired pool god; where that one is not legal, it is tried last.
   */
  private inPoolOrder<T>(
    ordered: readonly T[],
    legal: readonly T[],
    offerOf: (value: T) => ResolvedRewardOffer,
  ): T[] {
    const newGods = this.steering.newGods();
    const next = newGods[0];
    if (next === undefined) return [...ordered];
    const result: T[] = [];
    const outOfOrder: T[] = [];
    for (const value of ordered) {
      const offer = offerOf(value);
      const god = this.steering.offerGod(offer);
      if (god === undefined || god === next || !newGods.includes(god)) {
        if (!result.includes(value)) result.push(value);
        continue;
      }
      const twin = legal.find((candidate) => {
        const other = offerOf(candidate);
        return (
          other.rewardType === offer.rewardType &&
          other.payload?.kind === offer.payload?.kind &&
          this.steering.offerGod(other) === next
        );
      });
      if (twin !== undefined && !result.includes(twin)) result.push(twin);
      outOfOrder.push(value);
    }
    return [...result, ...outOfOrder];
  }

  private acquiredGodCount(): number {
    return latestRunState(this.assembly)?.godPool.acquiredSourceKeys.length ?? 0;
  }

  /** Stops chasing what an offer exclusion rules out. */
  private noteExclusions(exclusions: readonly RewardOfferExclusionReason[]): void {
    for (const exclusion of exclusions) {
      if (exclusion.kind === 'godCap' || exclusion.kind === 'godNotInteracted') {
        const giverKey = this.catalog.traitGiverByAcquisitionGameName[exclusion.source];
        if (giverKey !== undefined) this.stoppedGods.add(giverKey);
      } else if (exclusion.kind === 'devotionSourceNotAcquired')
        for (const source of exclusion.sources)
          this.unacquiredDevotionSources.set(source, this.acquiredGodCount());
    }
  }

  /** A stopped god's boon, or a Devotion trial naming a source unacquired since no god was gained. */
  private offerStopped(offer: ResolvedRewardOffer): boolean {
    if (offer.payload?.kind === 'DevotionPair') {
      const count = this.acquiredGodCount();
      return [offer.payload.chosenSource, offer.payload.spurnedSource].some(
        (source) => this.unacquiredDevotionSources.get(source) === count,
      );
    }
    const god = this.steering.offerGod(offer);
    return god !== undefined && this.stoppedGods.has(god);
  }

  /** Whether another door of this room's exit already holds a god boon. */
  private siblingHoldsBoon(biomeKey: string, occurrence: RoomOccurrence): boolean {
    const topology = this.project.route.biomes.find((b) => b.biomeKey === biomeKey)?.topology;
    const decision = topology?.decisions.find(
      (d) =>
        d.kind === 'exit' &&
        d.normal.kind === 'batch' &&
        d.normal.targets.some((t) => t.occurrenceId === occurrence.occurrenceId),
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') return false;
    const doors = decision.normal.targets.map((t) => {
      const door = this.occurrence(biomeKey, t.occurrenceId);
      const reward = door !== undefined && 'reward' in door.state ? door.state.reward : null;
      return { occurrenceId: t.occurrenceId, ...(reward ? { offer: reward.offer } : {}) };
    });
    return draftSiblingHoldsGodBoon(this.catalog, doors, occurrence.occurrenceId);
  }

  /** Reward types this room should avoid so a selected NPC can be met in it or a sibling. */
  private npcExcludedRewards(biomeKey: string, occurrence: RoomOccurrence): ReadonlySet<string> {
    const topology = this.project.route.biomes.find((b) => b.biomeKey === biomeKey)?.topology;
    if (topology === undefined || topology === null) return new Set();
    const byId = (id: string) => this.occurrence(biomeKey, id);
    for (const decision of topology.decisions) {
      if (decision.kind === 'hub') {
        if (!decision.openTargets.some((t) => t.occurrenceId === occurrence.occurrenceId)) continue;
        const visited = new Set(
          decision.actions.flatMap((a) => (a.kind === 'roomVisit' ? [a.hubSlotKey] : [])),
        );
        const siblings = decision.openTargets
          .filter((t) => !visited.has(t.hubSlotKey))
          .flatMap((t) => byId(t.occurrenceId) ?? []);
        return this.steering.npcExcludedRewards(biomeKey, occurrence, siblings, true);
      }
      if (
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.some((t) => t.occurrenceId === occurrence.occurrenceId)
      ) {
        const siblings = decision.normal.targets.flatMap((t) => byId(t.occurrenceId) ?? []);
        return this.steering.npcExcludedRewards(biomeKey, occurrence, siblings, false);
      }
    }
    return new Set();
  }

  /**
   * Re-authors an entered room's reward to one a selected NPC's encounter accepts, when the
   * engine's encounter evidence names only the reward as excluding it.
   */
  private reauthorIncomingReward(
    biomeKey: string,
    occurrenceId: OccurrenceId,
    excluded: ReadonlySet<string>,
  ): boolean {
    const occurrence = this.occurrence(biomeKey, occurrenceId);
    const room = occurrence === undefined ? undefined : this.roomOf(occurrence.gameName);
    if (occurrence === undefined || room === undefined) return false;
    const origin = createIncomingRewardAddress(
      createBiomeAddress(this.project.route.routeKey, biomeKey),
      occurrenceId,
    );
    const binding = countedRewardBinding(room, occurrence.state.kind, origin);
    if (binding === undefined) return false;
    const types = countedRewardTypeDomain(this.catalog, this.assembly, origin, binding).filter(
      (type) => !excluded.has(type),
    );
    return this.tryOffers(
      types,
      (value) => this.evaluate({ kind: 'incomingReward', reward: origin, value }),
      (value) => ({ kind: 'ReplaceIncomingReward', reward: origin, value }),
      (command) => this.apply(command),
    );
  }

  // --- Other owners --------------------------------------------------------

  /**
   * Places what the origin's room still requires in the order the room presents it: each required
   * pickup at the earliest point the live room offers it, in spawn order, and every other
   * required action by the engine's next required placement where the walk stands. Stops when
   * nothing required is placeable, an edit is refused, a placement comes back or the walk stops
   * at a row placed here; optional pickups and purchases stay the walk's choices.
   */
  private placeRequiredActions(origin: SemanticAddress): boolean {
    if (origin.kind === 'incomingReward') {
      const state = this.occurrence(origin.biomeKey, origin.occurrenceId)?.state;
      // An unauthored reward owns no actions yet; its own finding places them once authored.
      if (state !== undefined && 'reward' in state && state.reward === null)
        return this.authorReward(origin, false);
    }
    const room = originRoom(origin);
    if (room === undefined) return false;
    const placed = new Set<string>();
    const tried = new Set<string>();
    // Past the last pickup placed here, so the next one follows it.
    let floor = 0;
    let changed = false;
    for (;;) {
      const live = liveRoomForProjectEvaluationAssembly(
        this.catalog,
        this.assembly,
        room,
        'placements',
      );
      // The walk stops at or before a row placed here: that row's own contact comes first.
      if (live === undefined || live.frontier < floor) return changed;
      const pickup = earliestRequiredPickup(live, tried, floor);
      if (pickup !== undefined) {
        tried.add(pickup.key);
        // Not placeable this early: the frontier placement below takes it instead.
        if (!this.applyEarlyPickup(pickup.command)) continue;
        placed.add(pickup.key);
        floor = pickup.gap + 1;
        changed = true;
        continue;
      }
      const next = nextRequiredPlacement(this.catalog, this.assembly, room, placed);
      const offered = next.reached ? next.placement : undefined;
      if (offered === undefined) return changed;
      const placement =
        offered.reference.kind === 'completeFieldsCage'
          ? this.nearestCageUnlock(room, live, offered, placed)
          : offered;
      const key = roomActionKey(placement.reference);
      // A placement offered again did not hold; a refused one is the walk's dead end here.
      if (placed.has(key)) return changed;
      placed.add(key);
      if (!this.apply(placement.command)) return changed;
      changed = true;
    }
  }

  /**
   * The cage unlock to place next: of those the live room offers at the frontier beside the
   * engine's `offered` one, the cage whose stored point is nearest where the walk stands, the
   * last unlocked cage's point or else the room's entry. Flipping mirrors the whole room, so it
   * leaves the distances alone.
   */
  private nearestCageUnlock(
    room: OccurrenceAddress,
    live: LiveRoom,
    offered: RequiredPlacement,
    placed: ReadonlySet<string>,
  ): RequiredPlacement {
    const occurrence = this.occurrence(room.biomeKey, room.occurrenceId);
    if (occurrence?.state.kind !== 'fieldsCombat') return offered;
    const declaration = this.roomOf(occurrence.gameName);
    const pointIdBySlot = occurrence.state.spatial.cagePointIdBySlot;
    const cagePoint = (phaseKey: string) => {
      const slotKey = draftFieldsCageSlotKey(this.catalog, declaration, phaseKey);
      return slotKey === undefined
        ? undefined
        : draftFieldsCagePoint(declaration, pointIdBySlot[slotKey]);
    };
    const index = (command: ProjectCommand) =>
      'index' in command && typeof command.index === 'number' ? command.index : live.frontier;
    const unlocks: RequiredPlacement[] = [offered];
    let last: string | undefined;
    for (const gap of live.gaps)
      for (const item of gap.items) {
        if (item.kind !== 'object' || item.object !== 'fieldsCage') continue;
        for (const verb of item.verbs) {
          const reference = verb.reference;
          if (reference?.kind !== 'completeFieldsCage' || verb.participation !== 'required')
            continue;
          if (verb.standing === true) {
            if (gap.index < live.frontier) last = reference.phaseKey;
            continue;
          }
          const command = verb.commands?.[0];
          if (
            gap.index !== live.frontier ||
            command === undefined ||
            command.kind === 'MoveRoomAction' ||
            index(command) !== index(offered.command) ||
            placed.has(roomActionKey(reference)) ||
            roomActionKey(reference) === roomActionKey(offered.reference)
          )
            continue;
          unlocks.push({ reference, command });
        }
      }
    if (unlocks.length === 1) return offered;
    const entry = roomLayoutAuthoringForProjectEvaluationAssembly(this.assembly, room)?.settlement
      .entry;
    const from =
      last !== undefined
        ? cagePoint(last)
        : entry === undefined || entry.kind === 'unknown'
          ? undefined
          : draftHeroStart(declaration, entry.point.startPointId);
    return nearestFirst(from, unlocks, (unlock) =>
      unlock.reference.kind === 'completeFieldsCage'
        ? cagePoint(unlock.reference.phaseKey)
        : undefined,
    )[0]!;
  }

  /**
   * Places a required pickup ahead of the walk's frontier; one whose earlier acquisition makes
   * a later row invalid is taken back, as is a refused one.
   */
  private applyEarlyPickup(command: ProjectCommand): boolean {
    const before = this.assembly;
    const outcome = this.authoring.apply(command);
    if (outcome.kind !== 'applied') return false;
    if (this.assembly.evaluation.issue?.kind === 'invalid') {
      this.authoring.restore(before);
      return false;
    }
    this.appliedCommands.push(command);
    if (outcome.fault !== undefined) this.faults.push(outcome.fault);
    return true;
  }
}
