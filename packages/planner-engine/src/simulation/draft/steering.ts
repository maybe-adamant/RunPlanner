import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { TraitElement } from '../../catalog-schema/traits';
import { authoredShopOffer } from '../../authored-project/shop';
import {
  routeRoomDeclaration,
  routeSaveFileGodHistory,
} from '../../authored-project/route-profile';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { DRAFT_PROVIDER_CAPS, draftSourceQueues, draftTraitKind } from './basket';
import type { DraftHeldTraits, DraftPrerequisites } from './prerequisites';
import { latestRunState } from './report';
import type { RunStateSnapshot } from '../rewards';
import {
  draftProvider,
  draftSupplyTraitKeys,
  type DraftGodSchedule,
  type DraftSupply,
} from './schedule';
import { draftBasketTraitKeys, type DraftSpec } from './spec';
import type { DraftNpcGiver, DraftWorldProduct } from './world';
import type { RoomOccurrence } from '../../authored-project';
import { draftNpcHosts, draftNpcWindowOpen, type DraftNpcHost } from './npc-windows';
import type { ForcePressureLedgerEntry } from '../generation';
import type { DraftFillerKind, DraftRoomForcing } from '../../authored-project/model';
import { DRAFT_OPTIONS } from '../../authored-project/draft-spec';
import type { DraftRng } from './rng';
import { draftGodBoonBudget } from './budget';

/**
 * The draft's chance a door forces a room at this depth of its window, forced at the deadline:
 * the game's `IsRoomForced` ramp 1 / (deadline - depth), that ramp shifted one step softer
 * (1 / (deadline - depth + 1)), or only at the deadline. A window one depth wide or less
 * keeps the game's rule under every setting.
 */
export function draftWindowForceChance(
  depth: number,
  start: number,
  deadline: number,
  forcing: DraftRoomForcing = DRAFT_OPTIONS.roomForcing.default,
): number {
  if (depth < start) return 0;
  if (depth >= deadline) return 1;
  if (deadline - start <= 1 || forcing === 'game') return 1 / (deadline - depth);
  return forcing === 'softened' ? 1 / (deadline - depth + 1) : 0;
}

/** What the walk has acquired so far, read from the latest Run State snapshot. */
export interface DraftProgress {
  readonly equippedTraitKeys: readonly string[];
  /** Hermes boons held, basket or not; each spends one of the run's Hermes rooms. */
  readonly hermes: number;
  readonly held: DraftHeldTraits;
}

/** The walk state steering reads: the current evaluation and the biome being walked. */
export interface DraftSteeringState {
  readonly assembly: () => ProjectEvaluationAssembly;
  readonly biomeIndex: () => number;
}

/** The elements a pickup of this reward type contributes, as its acquisition declares them. */
export function draftBoostElements(catalog: Catalog, rewardType: string): readonly TraitElement[] {
  return Object.keys(
    catalog.rewards.acquisitions.byKey[rewardType]?.elementContributions ?? {},
  ) as TraitElement[];
}

/** Offer weight of a giver whose basket trait is still wanted. */
const WANTED_GIVER_WEIGHT = 30;
/** Offer weight of a giver whose basket trait is due now. */
const DUE_GIVER_WEIGHT = 60;
/** Offer weight of a god whose room takes no wanted basket trait. */
const IDLE_GOD_WEIGHT = 4;
/** Rooms over which a god's pull halves before its trait's target depth. */
export const PACE_HALVING_ROOMS = 0.5;
/** The pull's growth per room past a trait's target depth, as a share of the due weight. */
export const PACE_RAMP = 0.5;
/** Before its target, a god's pull falls below a non-god reward's weight. */
const PACE_FLOOR = 0.2;
/** A basket's targets span the biome when light; crowding shrinks the span to this share. */
export const PACE_MIN_SPAN = 0.6;
/** The span share is this less the biome's due traits per planned god boon. */
export const PACE_SPAN_BASE = 1.5;

/**
 * A god's pull for a trait at this room depth of its target: halving per
 * {@link PACE_HALVING_ROOMS} before the target, down to an idle god's weight, and growing past it.
 */
export function draftPaceWeight(depth: number, target: number): number {
  const past = depth - target;
  return past <= 0
    ? Math.max(PACE_FLOOR, DUE_GIVER_WEIGHT * 2 ** (past / PACE_HALVING_ROOMS))
    : DUE_GIVER_WEIGHT * (1 + PACE_RAMP * past);
}
/** A fountain door only breaks a tie with an otherwise equal door. */
const FOUNTAIN_TIE_BREAK = 1.01;
/** A preferred midshop's least weight: above any boon door (at most 90), below a story room. */
const PREFERRED_MIDSHOP_FLOOR = 100;
/** A story room the draft wants met: above every other door. */
const STORY_WEIGHT = 200;
/** Remaining eligible boon bag entries at or below which the bag counts as low. */
const LOW_BOON_BAG = 1;

/** A door or Hub visit that hosts a selected NPC in its open window: below a story room (200), above a midshop (at most 180). */
export const NPC_WINDOW_WEIGHT = 190;
/** A hosting Hub visit before its NPC's window opens, kept for a later visit. */
const NPC_EARLY_VISIT_WEIGHT = 0.2;
/** A target room that could host a selected NPC is likelier to be placed while its window is open. */
const NPC_HOST_PLACEMENT_WEIGHT = 3;
/** A reward the NPC's room excludes, while no other open door can host it. */
export const NPC_EXCLUDED_REWARD_FACTOR = 0.01;

/** Shop weight of a boon whose god can take a basket trait now, above any due god. */
const PURCHASABLE_GOD_WEIGHT = 120;

/** The reward types of each rankable filler kind, every variant included. */
const DRAFT_FILLER_REWARD_TYPES: Readonly<Record<DraftFillerKind, readonly string[]>> =
  Object.freeze({
    maxHealth: [
      'MaxHealthDrop',
      'MaxHealthDropBig',
      'MaxHealthDropSmall',
      'EmptyMaxHealthSmallDrop',
      'EmptyMaxHealthDrop',
    ],
    maxMagick: ['MaxManaDrop', 'MaxManaDropBig', 'MaxManaDropSmall'],
    gold: [
      'Currency',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'RoomMoneyTinyDrop',
    ],
    pom: ['StackUpgrade', 'StackUpgradeBig', 'StackUpgradeTriple', 'StoreRewardRandomStack'],
  });

/** The rankable filler kind a reward type belongs to. */
export function draftFillerKind(rewardType: string): DraftFillerKind | undefined {
  return (Object.keys(DRAFT_FILLER_REWARD_TYPES) as DraftFillerKind[]).find((kind) =>
    DRAFT_FILLER_REWARD_TYPES[kind].includes(rewardType),
  );
}

/** Ranked filler weights, highest rank first; unranked filler weighs 1. */
const FILLER_RANK_WEIGHTS = [6, 3, 2, 1.5] as const;
/** While filler is ranked, a god with no basket trait left weighs below the top-ranked filler. */
const FINISHED_GOD_WEIGHT = 1;
/** Shops sell no gold, so Shop filler is the other ranked kinds. */
const SHOP_FILLER_KINDS: readonly DraftFillerKind[] = ['maxHealth', 'maxMagick', 'pom'];

/**
 * The stores a biome's doors draw from: its base-store policy's keys, or else the stores its
 * rooms' counted rewards declare.
 */
export function draftDoorStoreKeys(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
): readonly string[] {
  const policy = catalog.biomeLayouts.byKey[biomeKey]?.progression.rewardStorePolicy;
  if (policy?.kind === 'authoredBaseStore') return policy.storeKeys;
  const keys = new Set<string>();
  for (const declared of catalog.rooms.values) {
    const room = routeRoomDeclaration(declared, routeKey);
    if (room.roomSetKey === biomeKey && room.incomingReward.kind === 'countedChoice')
      room.incomingReward.storeKeys.forEach((key) => keys.add(key));
  }
  return [...keys];
}

/** A god boon on a door beside one already holding a god boon, so one exit shows one boon. */
const SIDE_BOON_FACTOR = 0.01;

/** Whether an offer grants an Olympian's boon: a boon reward, a Mystery boon or a Devotion trial. */
export function draftGrantsGodBoon(catalog: Catalog, offer: ResolvedRewardOffer): boolean {
  const source =
    offer.payload?.kind === 'BoonSource'
      ? offer.payload.source
      : offer.payload?.kind === 'DevotionPair'
        ? offer.payload.chosenSource
        : undefined;
  const giverKey =
    source === undefined ? undefined : catalog.traitGiverByAcquisitionGameName[source];
  return catalog.traitGivers.byKey[giverKey ?? '']?.providerKind === 'olympian';
}

/** Whether a door other than `occurrenceId` among an exit's doors holds a god boon. */
export function draftSiblingHoldsGodBoon(
  catalog: Catalog,
  doors: readonly { readonly occurrenceId: string; readonly offer?: ResolvedRewardOffer }[],
  occurrenceId: string,
): boolean {
  return doors.some(
    (door) =>
      door.occurrenceId !== occurrenceId &&
      door.offer !== undefined &&
      draftGrantsGodBoon(catalog, door.offer),
  );
}

/** A door offer's weight, damped when it grants a god boon beside a door that already does. */
export function draftSideDoorWeight(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  weight: number,
  siblingHoldsGodBoon: boolean,
): number {
  return siblingHoldsGodBoon && draftGrantsGodBoon(catalog, offer)
    ? weight * SIDE_BOON_FACTOR
    : weight;
}

/** Eligible boon entries left in the named stores' bags. */
export function draftBoonEntriesLeft(
  bags: RunStateSnapshot['bags'],
  storeKeys: readonly string[],
): number {
  let remaining = 0;
  for (const bag of bags)
    if (storeKeys.includes(bag.storeKey))
      for (const entry of bag.entries)
        if (entry.rewardType === 'Boon' && entry.eligibility === 'eligible')
          remaining +=
            entry.remaining.kind === 'exact' ? entry.remaining.count : entry.remaining.min;
  return remaining;
}

/** The draft's weights and targets: what the basket still wants, and when. */
export class DraftSteering {
  private readonly worldGivers: ReadonlySet<string>;
  private readonly hermesTraits: ReadonlySet<string>;
  private readonly hammerTraits: ReadonlySet<string>;
  private readonly npcGivers: readonly DraftNpcGiver[];
  /** Basket NPC traits by the itinerary index of their NPC's biome. */
  private readonly npcTraitBiomes: ReadonlyMap<string, number>;
  /** Every basket trait, giver by giver. */
  readonly basket: readonly string[];
  /** Each world god's basket traits in acquisition order. */
  private readonly queues: ReadonlyMap<string, readonly string[]>;
  /** Each biome's selected field NPC encounters the draft can steer toward. */
  private readonly npcHosts: ReadonlyMap<string, readonly DraftNpcHost[]>;
  /** The biome index each scheduled basket trait falls due by. */
  private readonly dueBiome: ReadonlyMap<string, number>;
  /** Target room depths of the walked biome's due god traits, set when the biome starts. */
  private targets: ReadonlyMap<string, number> = new Map();

  constructor(
    private readonly catalog: Catalog,
    private readonly spec: DraftSpec,
    private readonly schedule: DraftGodSchedule,
    world: DraftWorldProduct,
    private readonly prerequisites: DraftPrerequisites,
    private readonly start: DraftHeldTraits,
    private readonly state: DraftSteeringState,
  ) {
    this.worldGivers = new Set(world.giverKeys);
    this.basket = draftBasketTraitKeys(spec);
    this.hermesTraits = draftSupplyTraitKeys(catalog, 'hermes');
    this.hammerTraits = draftSupplyTraitKeys(catalog, 'hammer');
    this.npcGivers = world.npcGivers;
    this.npcTraitBiomes = world.npcTraitBiomes;
    this.queues = new Map(
      draftSourceQueues(catalog, spec).map((queue) => [queue.giverKey, queue.traitKeys]),
    );
    this.npcHosts = draftNpcHosts(
      catalog,
      state.assembly().project.route.routeKey,
      spec.world.fieldNpcsByBiome,
    );
    this.dueBiome = new Map(
      schedule.byBiome.flatMap((biome, index) => biome.traitKeys.map((key) => [key, index])),
    );
  }

  /** Whether an Olympian offers this trait. */
  private godTrait(traitKey: string): boolean {
    return this.catalog.traitGivers.values.some(
      (giver) => giver.providerKind === 'olympian' && giver.traitKeys.includes(traitKey),
    );
  }

  /**
   * Gives each god trait due in the walked biome a target room depth: spread in schedule order
   * over a share of the biome's expected rooms that shrinks as the due traits crowd its planned
   * god boons, each jittered within its stratum.
   */
  paceBiome(random: () => number): void {
    const biomeIndex = this.state.biomeIndex();
    const route = this.state.assembly().project.route;
    const biomeKey = route.itineraryBiomeKeys[biomeIndex] ?? '';
    const held = this.progress().equippedTraitKeys;
    const wanted = (key: string) => this.godTrait(key) && !held.includes(key);
    const due = (this.schedule.byBiome[biomeIndex]?.traitKeys ?? []).filter(wanted);
    const overdue = this.schedule.byBiome
      .slice(0, biomeIndex)
      .flatMap((biome) => biome.traitKeys)
      .filter(wanted);
    const capacity =
      draftGodBoonBudget(this.catalog, route, this.spec).biomes.find(
        (biome) => biome.biomeKey === biomeKey,
      )?.effective ?? 0;
    const crowding = (due.length + overdue.length) / Math.max(capacity, 1);
    const share = Math.min(1, Math.max(PACE_MIN_SPAN, PACE_SPAN_BASE - crowding));
    const last = Math.max(1, this.biomeRooms(biomeKey) - 1);
    const span = (last - 1) * share;
    // Sorted uniform draws: random spacing, in schedule order.
    const draws = due.map(() => random()).sort((a, b) => a - b);
    this.targets = new Map(due.map((key, index) => [key, 1 + span * draws[index]!]));
  }

  /** Rooms the biome is expected to run: a Hub's required visits with its entry rooms, else its latest forced depth. */
  private biomeRooms(biomeKey: string): number {
    const progression = this.catalog.biomeLayouts.byKey[biomeKey]?.progression;
    if (progression?.kind === 'hub') return progression.requiredVisits + 2;
    return Math.max(this.lastForcedDepth(biomeKey), 4);
  }

  /** Rooms entered so far in the biome. */
  private biomeDepth(biomeKey: string): number {
    const biome = this.state
      .assembly()
      .evaluation.route.biomes.find((b) => b.biomeKey === biomeKey);
    return biome !== undefined && 'history' in biome
      ? biome.history.ledgers.roomAppearances.filter((a) => a.origin.biomeKey === biomeKey).length
      : 0;
  }

  /** A wanted trait's pull at the next room: paced in its due biome, overdue after it, wanted before it. */
  private traitPull(traitKey: string, paced: boolean): number {
    const biomeIndex = this.state.biomeIndex();
    const dueBiome = this.dueBiome.get(traitKey) ?? biomeIndex;
    if (dueBiome > biomeIndex) return WANTED_GIVER_WEIGHT;
    if (!paced) return DUE_GIVER_WEIGHT;
    const biomeKey = this.state.assembly().project.route.itineraryBiomeKeys[biomeIndex] ?? '';
    const w = draftPaceWeight(this.biomeDepth(biomeKey) + 1, this.targets.get(traitKey) ?? 0);
    return w;
  }

  /** A wanted trait's target depth in the walked biome; earlier for an overdue trait, later for one due ahead. */
  targetDepth(traitKey: string): number {
    const biomeIndex = this.state.biomeIndex();
    const dueBiome = this.dueBiome.get(traitKey) ?? biomeIndex;
    if (dueBiome < biomeIndex) return 0;
    if (dueBiome > biomeIndex) return Number.POSITIVE_INFINITY;
    return this.targets.get(traitKey) ?? 0;
  }

  /** Selected field NPC encounters not yet met in this biome; one waiting on a trait waits while a later room is likely. */
  private unmetNpcHosts(biomeKey: string): readonly DraftNpcHost[] {
    const hosts = this.npcHosts.get(biomeKey) ?? [];
    if (hosts.length === 0) return hosts;
    const biome = this.state
      .assembly()
      .evaluation.route.biomes.find((entry) => entry.biomeKey === biomeKey);
    const met = new Set(
      biome !== undefined && 'history' in biome
        ? biome.history.ledgers.encounterRecords
            .filter((record) => record.origin.biomeKey === biomeKey)
            .map(
              (record) =>
                this.catalog.encounterDefinitions.byKey[record.encounterKey]?.npcPresentationKey,
            )
        : [],
    );
    return hosts.filter((host) => {
      if (met.has(host.npcKey)) return false;
      const giverKey =
        this.catalog.encounterDefinitions.byKey[host.conditions.encounterKey]?.traitOfferProducer
          ?.giverKey;
      return !(this.npcWaiting(giverKey, this.progress()) && this.laterRoomLikely(biomeKey));
    });
  }

  /**
   * Whether a room with this reward hosts a selected unmet NPC: 'open' when its window holds for
   * the next entered room, 'later' when only the counters or gap still hold it back.
   */
  npcHosting(
    gameName: string,
    rewardType: string | undefined,
    biomeKey: string,
  ): 'open' | 'later' | undefined {
    let hosting: 'later' | undefined;
    for (const host of this.unmetNpcHosts(biomeKey)) {
      if (!host.hostRooms.has(gameName)) continue;
      if (rewardType !== undefined && host.conditions.excludedRewardTypes.includes(rewardType))
        continue;
      if (draftNpcWindowOpen(this.state.assembly(), biomeKey, host.conditions)) return 'open';
      hosting = 'later';
    }
    return hosting;
  }

  /** Steering weight of a door or Hub visit for the NPC window, when it hosts one. */
  npcVisitWeight(
    gameName: string,
    rewardType: string | undefined,
    biomeKey: string,
  ): number | undefined {
    const hosting = this.npcHosting(gameName, rewardType, biomeKey);
    return hosting === 'open'
      ? NPC_WINDOW_WEIGHT
      : hosting === 'later'
        ? NPC_EARLY_VISIT_WEIGHT
        : undefined;
  }

  /**
   * Reward types to avoid on this room so a selected NPC can be met there: those its encounter
   * excludes, unless another unvisited door or Hub room already hosts it with an accepted reward.
   * A door counts while the NPC's window is open; a Hub room for any later visit.
   */
  npcExcludedRewards(
    biomeKey: string,
    occurrence: RoomOccurrence,
    siblings: readonly RoomOccurrence[],
    hub: boolean,
  ): ReadonlySet<string> {
    const excluded = new Set<string>();
    for (const host of this.unmetNpcHosts(biomeKey)) {
      if (!host.hostRooms.has(occurrence.gameName)) continue;
      if (!hub && !draftNpcWindowOpen(this.state.assembly(), biomeKey, host.conditions)) continue;
      const reserved = siblings.some((sibling) => {
        const reward = 'reward' in sibling.state ? sibling.state.reward : undefined;
        return (
          sibling.occurrenceId !== occurrence.occurrenceId &&
          host.hostRooms.has(sibling.gameName) &&
          reward !== undefined &&
          reward !== null &&
          !host.conditions.excludedRewardTypes.includes(reward.offer.rewardType)
        );
      });
      if (!reserved) host.conditions.excludedRewardTypes.forEach((type) => excluded.add(type));
    }
    return excluded;
  }

  /**
   * The god's next basket trait not yet held; only it may be taken from the god.
   * A trait waiting only on run state, an element threshold or a god boon rarity count, and a
   * hosted Duo whose prerequisites are not all held are passed over until they hold.
   */
  nextQueued(godKey: string, progress: DraftProgress): string | undefined {
    const unmet = (this.queues.get(godKey) ?? []).filter(
      (key) => !progress.equippedTraitKeys.includes(key),
    );
    return unmet.find((key) => !this.passedOver(key, progress)) ?? unmet[0];
  }

  private passedOver(traitKey: string, progress: DraftProgress): boolean {
    return this.duo(traitKey)
      ? !this.ready(traitKey, progress)
      : this.prerequisites.runStateWaiting(traitKey, progress.held);
  }

  private duo(traitKey: string): boolean {
    const trait = this.catalog.traits.byKey[traitKey];
    return trait !== undefined && draftTraitKind(trait) === 'duo';
  }

  /** The source whose queue holds a basket trait: a Duo's host, else its only giver. */
  queueGiver(traitKey: string): string | undefined {
    for (const [giverKey, queue] of this.queues) if (queue.includes(traitKey)) return giverKey;
    return undefined;
  }

  /** Element thresholds a waiting basket trait still needs, first waiting trait first. */
  wantedElements(progress: DraftProgress): readonly TraitElement[] {
    const elements: TraitElement[] = [];
    for (const key of this.wantedBasket(progress))
      if (this.prerequisites.runStateWaiting(key, progress.held))
        for (const element of this.prerequisites.missingElements(key, progress.held))
          if (!elements.includes(element)) elements.push(element);
    return elements;
  }

  /** False for a god's queued basket trait while an earlier one is still unmet. */
  orderAllows(traitKey: string, progress: DraftProgress): boolean {
    for (const [godKey, queue] of this.queues)
      if (queue.includes(traitKey))
        return (
          progress.equippedTraitKeys.includes(traitKey) ||
          this.nextQueued(godKey, progress) === traitKey
        );
    return true;
  }

  /** The god's next queued trait when it is ready to take now. */
  private takeable(giverKey: string, progress: DraftProgress): string | undefined {
    const next = this.nextQueued(giverKey, progress);
    return next !== undefined && this.ready(next, progress) ? next : undefined;
  }

  /** A god whose room can take a basket trait now: its next queued trait is ready. */
  godTakes(giverKey: string, progress: DraftProgress): boolean {
    return this.takeable(giverKey, progress) !== undefined;
  }

  /** Whether the world contributes this trait giver. */
  inWorld(giverKey: string): boolean {
    return this.worldGivers.has(giverKey);
  }

  progress(): DraftProgress {
    const snapshot = latestRunState(this.state.assembly());
    const equippedTraitKeys = Object.keys(snapshot?.traits.equippedTraits ?? {});
    return {
      equippedTraitKeys,
      hermes: equippedTraitKeys.filter((key) => this.hermesTraits.has(key)).length,
      held:
        snapshot === undefined
          ? this.start
          : {
              traitKeys: new Set(equippedTraitKeys),
              elementCounts: snapshot.traits.elementCounts,
              godBoonRarityCounts: snapshot.traits.godBoonRarityCounts,
            },
    };
  }

  wantedBasket(progress: DraftProgress): string[] {
    return this.basket.filter((key) => !progress.equippedTraitKeys.includes(key));
  }

  /** Wanted basket traits another wanted basket trait still waits on. */
  neededPrerequisites(progress: DraftProgress): ReadonlySet<string> {
    return this.prerequisites.waitedOn(this.wantedBasket(progress), progress.held);
  }

  /** Wanted basket traits a wanted NPC trait waits on while its NPC's biome is not yet past. */
  private npcPrerequisites(progress: DraftProgress): ReadonlySet<string> {
    const wanted = this.wantedBasket(progress);
    const waiting = wanted.filter(
      (key) => (this.npcTraitBiomes.get(key) ?? -1) >= this.state.biomeIndex(),
    );
    return this.prerequisites.waitedOn(wanted, progress.held, waiting);
  }

  private ready(traitKey: string, progress: DraftProgress): boolean {
    return this.prerequisites.ready(traitKey, progress.held);
  }

  /** A wanted basket trait of this giver cannot be offered yet. */
  npcWaiting(giverKey: string | undefined, progress: DraftProgress): boolean {
    const traitKeys = this.catalog.traitGivers.byKey[giverKey ?? '']?.traitKeys ?? [];
    return this.wantedBasket(progress).some(
      (key) => traitKeys.includes(key) && !this.ready(key, progress),
    );
  }

  /** The catalog's rooms as this route declares them. */
  private routeRooms() {
    const routeKey = this.state.assembly().project.route.routeKey;
    return this.catalog.rooms.values.map((room) => routeRoomDeclaration(room, routeKey));
  }

  /**
   * Whether the biome likely has another room before its last forced depth;
   * a cheap stand-in for a later chance to meet an NPC.
   */
  laterRoomLikely(biomeKey: string): boolean {
    return this.biomeDepth(biomeKey) + 1 < this.lastForcedDepth(biomeKey);
  }

  /** The latest depth at which a forced room of the biome falls due. */
  private lastForcedDepth(biomeKey: string): number {
    let lastForced = 0;
    for (const room of this.routeRooms())
      if (
        room.roomSetKey === biomeKey &&
        room.force?.kind === 'depthWindow' &&
        room.force.axis === 'biomeDepthCache'
      )
        lastForced = Math.max(lastForced, room.force.deadline);
    return lastForced;
  }

  /** Basket traits a Hermes, Hammer or Selene giver offers. */
  basketOf(providerKind: DraftSupply | 'spell'): string[] {
    return this.basket.filter((key) =>
      this.catalog.traitGivers.values.some(
        (giver) => giver.providerKind === providerKind && giver.traitKeys.includes(key),
      ),
    );
  }

  private wantedHermes(progress: DraftProgress): string[] {
    return this.wantedBasket(progress).filter((key) => this.hermesTraits.has(key));
  }

  /**
   * Every remaining Hermes room is owed to a wanted Hermes trait and none can
   * be offered yet, so a Hermes reward now would spend a slot on another trait.
   */
  hermesReserved(progress: DraftProgress = this.progress()): boolean {
    const wanted = this.wantedHermes(progress);
    return (
      wanted.length > 0 &&
      wanted.length >= DRAFT_PROVIDER_CAPS.hermes - progress.hermes &&
      !this.nextSupply('hermes', progress).some((key) => this.ready(key, progress))
    );
  }

  /** The next queued basket trait of each Hermes or Hammer giver. */
  private nextSupply(supply: DraftSupply, progress: DraftProgress): string[] {
    return this.catalog.traitGivers.values
      .filter((giver) => giver.providerKind === supply)
      .flatMap((giver) => this.nextQueued(giver.key, progress) ?? []);
  }

  /** Basket traits the schedule makes due by this biome. */
  private dueTraits(): readonly string[] {
    return this.schedule.byBiome
      .slice(0, this.state.biomeIndex() + 1)
      .flatMap((biome) => biome.traitKeys);
  }

  private supplyOf(traitKey: string): DraftSupply | undefined {
    return this.hermesTraits.has(traitKey)
      ? 'hermes'
      : this.hammerTraits.has(traitKey)
        ? 'hammer'
        : undefined;
  }

  /**
   * How much a Hermes or Hammer reward helps the basket: 'now' for a ready
   * wanted trait the schedule makes due, 'later' for one not yet due, none otherwise.
   */
  supplyNeed(supply: DraftSupply, progress: DraftProgress): 'now' | 'later' | undefined {
    if (supply === 'hermes' && progress.hermes >= DRAFT_PROVIDER_CAPS.hermes) return undefined;
    const wanted = this.nextSupply(supply, progress).filter((key) => this.ready(key, progress));
    if (wanted.length === 0) return undefined;
    const due = this.dueTraits();
    return wanted.some((key) => due.includes(key)) ? 'now' : 'later';
  }

  /** The world god an offer's boon comes from, for boon rewards, Mystery boons and Devotion trials. */
  offerGod(offer: ResolvedRewardOffer): string | undefined {
    const source =
      offer.payload?.kind === 'BoonSource'
        ? offer.payload.source
        : offer.payload?.kind === 'DevotionPair'
          ? offer.payload.chosenSource
          : undefined;
    const giverKey =
      source === undefined ? undefined : this.catalog.traitGiverByAcquisitionGameName[source];
    return giverKey !== undefined &&
      this.catalog.traitGivers.byKey[giverKey]?.providerKind === 'olympian' &&
      this.worldGivers.has(giverKey)
      ? giverKey
      : undefined;
  }

  /**
   * Steering weight of a Shop item: a boon (or Mystery boon) of a god that can take a
   * basket trait now comes first, so the purchase it would take is on offer.
   */
  shopWeight(offer: ResolvedRewardOffer): number {
    const god = this.offerGod(offer);
    return god !== undefined && this.godTakes(god, this.progress())
      ? PURCHASABLE_GOD_WEIGHT
      : this.offerWeight(offer);
  }

  /** Pool gods the run has not yet picked up a boon from, in pool order. */
  newGods(): readonly string[] {
    const acquired = latestRunState(this.state.assembly())?.godPool.acquiredSourceKeys ?? [];
    const gods = new Set(
      acquired.flatMap((source) => this.catalog.traitGiverByAcquisitionGameName[source] ?? []),
    );
    return this.spec.world.godKeys.filter((godKey) => !gods.has(godKey));
  }

  /**
   * A boon of a pool god not yet met whose basket traits are still queued, where Shops stock only
   * gods already picked up on this save file.
   */
  queuedNewGod(offer: ResolvedRewardOffer): boolean {
    const routeKey = this.state.assembly().project.route.routeKey;
    if (routeSaveFileGodHistory(this.catalog, routeKey) !== 'closed') return false;
    const god = this.offerGod(offer);
    return (
      god !== undefined &&
      this.newGods().includes(god) &&
      this.nextQueued(god, this.progress()) !== undefined
    );
  }

  /** An Olympian boon outside the pool, for a Hub door the draft leaves unvisited; a shown door gains no god. */
  unvisitedDoorGodWeight(offer: ResolvedRewardOffer): number {
    if (offer.payload?.kind !== 'BoonSource') return 0;
    const giverKey = this.catalog.traitGiverByAcquisitionGameName[offer.payload.source];
    return giverKey !== undefined &&
      this.catalog.traitGivers.byKey[giverKey]?.providerKind === 'olympian' &&
      !this.worldGivers.has(giverKey)
      ? 1
      : 0;
  }

  /**
   * Steering weight of a reward; Olympian sources outside the world and the Anvil weigh nothing.
   * Unpaced, a god's due trait pulls as at its target depth, for doors whose visit comes later.
   */
  offerWeight(offer: ResolvedRewardOffer, paced = true): number {
    // The Anvil of Fates replaces held Hammers, so a monotonic draft never takes it.
    if (offer.rewardType === 'ChaosWeaponUpgrade') return 0;
    const progress = this.progress();
    const wanted = this.wantedBasket(progress);
    // A Devotion trial grants the chosen god's boon.
    const source =
      offer.payload?.kind === 'BoonSource'
        ? offer.payload.source
        : offer.payload?.kind === 'DevotionPair'
          ? offer.payload.chosenSource
          : undefined;
    const giverKey =
      source === undefined ? undefined : this.catalog.traitGiverByAcquisitionGameName[source];
    const giver = giverKey === undefined ? undefined : this.catalog.traitGivers.byKey[giverKey];
    if (giver?.providerKind === 'olympian') {
      if (!this.worldGivers.has(giver.key)) return 0;
      const weight = Math.max(
        this.npcDueGods(progress).has(giver.key) ? DUE_GIVER_WEIGHT : 0,
        this.godPull(giver.key, progress, paced),
      );
      const prerequisites = this.neededPrerequisites(progress);
      const unlocks = giver.traitKeys.some(
        (key) =>
          prerequisites.has(key) &&
          wanted.includes(key) &&
          this.ready(key, progress) &&
          this.orderAllows(key, progress),
      );
      return unlocks ? weight * 1.5 : weight;
    }
    const provider = draftProvider(this.catalog, offer);
    if (provider === 'spell') {
      const spells = this.basketOf('spell').filter((key) => wanted.includes(key));
      const npcPrerequisites = this.npcPrerequisites(progress);
      if (spells.some((key) => npcPrerequisites.has(key))) return DUE_GIVER_WEIGHT;
      return spells.length > 0 ? WANTED_GIVER_WEIGHT : 1;
    }
    if (provider === undefined) return this.fillerWeight(offer.rewardType);
    if (provider === 'hermes' && this.hermesReserved(progress)) return 0.2;
    const need = this.supplyNeed(provider, progress);
    return need === 'now' ? 25 : need === 'later' ? 3 : 1;
  }

  /** Hermes held outside the basket beyond the rooms the basket leaves free. */
  wastedHermes(progress: DraftProgress = this.progress()): number {
    const basket = this.basketOf('hermes');
    const outside = progress.equippedTraitKeys.filter(
      (key) => this.hermesTraits.has(key) && !basket.includes(key),
    ).length;
    return Math.max(0, outside - Math.max(0, DRAFT_PROVIDER_CAPS.hermes - basket.length));
  }

  /**
   * Each basket trait due by this biome, held or not; a due trait whose
   * prerequisites are not held is not judged, as steering skips it too.
   */
  scheduledTargets(): readonly {
    readonly traitKey: string;
    readonly supply?: DraftSupply;
    readonly met: boolean;
  }[] {
    const progress = this.progress();
    return this.dueTraits()
      .filter((key) => progress.equippedTraitKeys.includes(key) || this.ready(key, progress))
      .map((traitKey) => {
        const supply = this.supplyOf(traitKey);
        return {
          traitKey,
          ...(supply === undefined ? {} : { supply }),
          met: progress.equippedTraitKeys.includes(traitKey),
        };
      });
  }

  /** Ranked filler kinds still short of their amount, highest first. */
  fillerPriority(): readonly DraftFillerKind[] {
    const ranks = this.spec.fillerPriority ?? [];
    if (ranks.length === 0) return [];
    const taken = this.fillerTaken();
    return ranks
      .filter((rank) => rank.amount === undefined || (taken.get(rank.kind) ?? 0) < rank.amount)
      .map((rank) => rank.kind);
  }

  private fillerTakenCache?: {
    readonly assembly: ProjectEvaluationAssembly;
    readonly taken: ReadonlyMap<DraftFillerKind, number>;
  };

  /** Filler pickups so far by kind, each counting 1: entered rooms' rewards and Shop purchases. */
  fillerTaken(): ReadonlyMap<DraftFillerKind, number> {
    const assembly = this.state.assembly();
    if (this.fillerTakenCache?.assembly === assembly) return this.fillerTakenCache.taken;
    const taken = new Map<DraftFillerKind, number>();
    const count = (offer: ResolvedRewardOffer | undefined) => {
      const kind = offer === undefined ? undefined : draftFillerKind(offer.rewardType);
      if (kind !== undefined) taken.set(kind, (taken.get(kind) ?? 0) + 1);
    };
    for (const biome of assembly.evaluation.route.biomes) {
      if (!('history' in biome)) continue;
      const plan = assembly.project.route.biomes.find((b) => b.biomeKey === biome.biomeKey);
      for (const entry of biome.history.ledgers.roomAppearances) {
        if (entry.origin.kind !== 'occurrence' || entry.origin.biomeKey !== biome.biomeKey)
          continue;
        const id = entry.origin.occurrenceId;
        const occurrence = plan?.topology?.occurrences.find((o) => o.occurrenceId === id);
        if (occurrence !== undefined && 'reward' in occurrence.state)
          count(occurrence.state.reward?.offer);
      }
    }
    this.purchasedOffers().forEach(count);
    this.fillerTakenCache = { assembly, taken };
    return taken;
  }

  /** A reward's weight by its filler kind's rank among the kinds still short; 1 otherwise. */
  private fillerWeight(rewardType: string): number {
    const kind = draftFillerKind(rewardType);
    const rank = kind === undefined ? -1 : this.fillerPriority().indexOf(kind);
    return rank < 0 ? 1 : FILLER_RANK_WEIGHTS[rank]!;
  }

  /** A Shop item's weight as ranked Shop filler; 0 when it is none. */
  shopFillerWeight(offer: ResolvedRewardOffer): number {
    const kind = draftFillerKind(offer.rewardType);
    return kind !== undefined &&
      SHOP_FILLER_KINDS.includes(kind) &&
      this.fillerPriority().includes(kind)
      ? this.fillerWeight(offer.rewardType)
      : 0;
  }

  /**
   * A god's pull: its strongest takeable basket trait's paced pull, or an idle god's weight;
   * below the top-ranked filler once its basket traits are all held.
   */
  private godPull(giverKey: string, progress: DraftProgress, paced: boolean): number {
    if (this.fillerPriority().length > 0 && this.nextQueued(giverKey, progress) === undefined)
      return FINISHED_GOD_WEIGHT;
    const next = this.takeable(giverKey, progress);
    return Math.max(IDLE_GOD_WEIGHT, next === undefined ? 0 : this.traitPull(next, paced));
  }

  /** Gods with an offerable basket trait not yet held that a wanted NPC trait waits on. */
  private npcDueGods(progress: DraftProgress): ReadonlySet<string> {
    const due = new Set<string>();
    const traitKeys = [...this.npcPrerequisites(progress)];
    // A due trait behind its god's queue makes the god due once the queue's next trait is ready.
    for (const traitKey of traitKeys) {
      if (progress.equippedTraitKeys.includes(traitKey)) continue;
      const queueGiver = this.queueGiver(traitKey);
      for (const giver of this.catalog.traitGivers.values)
        if (
          giver.providerKind === 'olympian' &&
          giver.traitKeys.includes(traitKey) &&
          (queueGiver === undefined || queueGiver === giver.key) &&
          this.ready(
            queueGiver === giver.key ? this.nextQueued(giver.key, progress)! : traitKey,
            progress,
          )
        )
          due.add(giver.key);
    }
    return due;
  }

  /** Shop god boon purchases paced per planned biome; 0 buys none. */
  purchasesPerBiome(): number {
    return this.spec.purchasesPerBiome ?? DRAFT_OPTIONS.purchasesPerBiome.default;
  }

  /**
   * How far the run's Shop purchases trail the soft pace of purchases per planned biome,
   * measured at mid-biome; negative when ahead. Elemental boosts and filler aside.
   */
  purchasesBehind(): number {
    const pace = this.purchasesPerBiome();
    const made = this.purchasedOffers().filter(
      (offer) => offer === undefined || draftFillerKind(offer.rewardType) === undefined,
    ).length;
    return pace * this.state.biomeIndex() + pace / 2 - made;
  }

  /** Shop purchases made in one biome, filler included; elemental boosts aside. */
  biomePurchases(biomeKey: string): number {
    return this.purchasedOffers(biomeKey).length;
  }

  /** Bought Shop items, in one biome or the whole run; elemental boosts aside. */
  private purchasedOffers(biomeKey?: string): (ResolvedRewardOffer | undefined)[] {
    const offers: (ResolvedRewardOffer | undefined)[] = [];
    for (const biome of this.state.assembly().project.route.biomes) {
      if (biomeKey !== undefined && biome.biomeKey !== biomeKey) continue;
      for (const occurrence of biome.topology?.occurrences ?? [])
        for (const action of occurrence.roomActions?.order ?? []) {
          if (action.kind !== 'interactShopOffer') continue;
          const reward = authoredShopOffer(occurrence, action.offerKey)?.reward?.offer;
          if (
            reward === undefined ||
            draftBoostElements(this.catalog, reward.rewardType).length === 0
          )
            offers.push(reward);
        }
    }
    return offers;
  }

  /** Whether the eligible boon entries of the bags this biome's doors draw from are nearly spent, which a Shop never is. */
  boonBagLow(): boolean {
    return (this.boonEntriesLeft() ?? LOW_BOON_BAG + 1) <= LOW_BOON_BAG;
  }

  /** Eligible boon entries left in the bags this biome's doors draw from. */
  private boonEntriesLeft(): number | undefined {
    const assembly = this.state.assembly();
    const snapshot = latestRunState(assembly);
    if (snapshot === undefined) return undefined;
    const route = assembly.project.route;
    const biomeKey = route.itineraryBiomeKeys[this.state.biomeIndex()] ?? '';
    const storeKeys = draftDoorStoreKeys(this.catalog, route.routeKey, biomeKey);
    return draftBoonEntriesLeft(snapshot.bags, storeKeys);
  }

  /** A wanted basket trait some world god can take now that is past its target depth. */
  private overdueTakeable(): boolean {
    const progress = this.progress();
    const biomeKey =
      this.state.assembly().project.route.itineraryBiomeKeys[this.state.biomeIndex()] ?? '';
    const depth = this.biomeDepth(biomeKey) + 1;
    return [...this.worldGivers].some((giverKey) => {
      if (this.catalog.traitGivers.byKey[giverKey]?.providerKind !== 'olympian') return false;
      const next = this.takeable(giverKey, progress);
      return next !== undefined && this.targetDepth(next) < depth;
    });
  }

  /** The preferred Shop band: above any boon door, below a story room, higher behind the pace or on a low bag. */
  private preferredShopWeight(): number {
    return Math.min(
      Math.max(
        10 + 40 * Math.max(this.purchasesBehind(), 0) + (this.boonBagLow() ? 60 : 0),
        PREFERRED_MIDSHOP_FLOOR,
      ),
      180,
    );
  }

  /**
   * The room a door rolls forced inside its declared depth window, picked among the hits;
   * a door that can show a wanted story room keeps it instead.
   */
  windowForcedRoom(
    legal: readonly string[],
    pressure: ForcePressureLedgerEntry | undefined,
    biomeKey: string,
    random: DraftRng,
  ): string | undefined {
    if (pressure === undefined) return undefined;
    const optional = legal.filter((name) => pressure.optionalForcedRoomGameNames.includes(name));
    if (
      optional.length === 0 ||
      legal.some((name) => this.roomWeight(name, biomeKey, true) === STORY_WEIGHT)
    )
      return undefined;
    const routeKey = this.state.assembly().project.route.routeKey;
    const hits = optional.filter((name) => {
      const force = routeRoomDeclaration(this.catalog.rooms.byKey[name], routeKey)?.force;
      if (force?.kind !== 'depthWindow') return false;
      const depth =
        force.axis === 'biomeEncounterDepth'
          ? pressure.biomeEncounterDepth
          : pressure.biomeDepthCache;
      return (
        random() < draftWindowForceChance(depth, force.start, force.deadline, this.spec.roomForcing)
      );
    });
    return hits.length === 0 ? undefined : hits[Math.floor(random() * hits.length)];
  }

  /** A story room of the biome's selected story NPC; offered once per run, so its door is taken. */
  storyTarget(gameName: string, biomeKey: string): boolean {
    return (
      this.spec.world.storyNpcByBiome[biomeKey] !== undefined &&
      routeRoomDeclaration(
        this.catalog.rooms.byKey[gameName],
        this.state.assembly().project.route.routeKey,
      )?.kind === 'Story'
    );
  }

  /** A door placement waits on a story NPC whose wanted trait is not ready while a later room is likely. */
  roomWeight(gameName: string, biomeKey: string, placing = false): number {
    const room = routeRoomDeclaration(
      this.catalog.rooms.byKey[gameName],
      this.state.assembly().project.route.routeKey,
    );
    if (room?.kind === 'Story') {
      if (this.spec.world.storyNpcByBiome[biomeKey] === undefined) return 0.5;
      const biomeIndex = this.state.assembly().project.route.itineraryBiomeKeys.indexOf(biomeKey);
      const giver = this.npcGivers.find((g) => g.story && g.biomeIndex === biomeIndex);
      const waits =
        placing &&
        giver !== undefined &&
        this.npcWaiting(giver.giverKey, this.progress()) &&
        this.laterRoomLikely(biomeKey);
      return waits ? 0.1 : STORY_WEIGHT;
    }
    if (room?.kind === 'Shop') {
      // A mid-biome Shop the player prefers, or one beside doors that can no longer show a
      // boon, is taken over any boon door, below a story room (200).
      if (this.spec.preferMidshops === true || this.boonEntriesLeft() === 0)
        return this.preferredShopWeight();
      // Behind the purchase pace a Shop door is more welcome, ahead of it less.
      return this.purchasesBehind() > 0 ? 1.5 : 0.4;
    }
    // A Preboss Shop is preferred when the boon bag runs low or a takeable trait is overdue.
    if (
      room?.kind === 'Preboss' &&
      room.incomingReward.kind === 'shop' &&
      (this.boonBagLow() || this.overdueTakeable())
    )
      return this.preferredShopWeight();
    // A fountain door only breaks a tie with an otherwise equal door.
    if (room?.kind === 'Reprieve') return FOUNTAIN_TIE_BREAK;
    if (placing && this.npcHosting(gameName, undefined, biomeKey) === 'open')
      return NPC_HOST_PLACEMENT_WEIGHT;
    return 1;
  }
}
