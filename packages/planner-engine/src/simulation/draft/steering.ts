import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { DRAFT_PROVIDER_CAPS } from './basket';
import type { DraftHeldTraits, DraftPrerequisites } from './prerequisites';
import { latestRunState } from './report';
import {
  draftProvider,
  draftSupplyTraitKeys,
  type DraftGodSchedule,
  type DraftSupply,
} from './schedule';
import type { DraftSpec } from './spec';
import type { DraftNpcGiver, DraftWorldProduct } from './world';

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

/** Offer weight of a giver whose basket trait is still wanted. */
const WANTED_GIVER_WEIGHT = 30;
/** Offer weight of a giver whose basket trait is due now. */
const DUE_GIVER_WEIGHT = 60;

/** The draft's weights and targets: what the basket still wants, and when. */
export class DraftSteering {
  private readonly worldGivers: ReadonlySet<string>;
  private readonly hermesTraits: ReadonlySet<string>;
  private readonly hammerTraits: ReadonlySet<string>;
  private readonly npcGivers: readonly DraftNpcGiver[];
  /** Basket NPC traits by the itinerary index of their NPC's biome. */
  private readonly npcTraitBiomes: ReadonlyMap<string, number>;

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
    this.hermesTraits = draftSupplyTraitKeys(catalog, 'hermes');
    this.hammerTraits = draftSupplyTraitKeys(catalog, 'hammer');
    this.npcGivers = world.npcGivers;
    this.npcTraitBiomes = world.npcTraitBiomes;
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
          : { traitKeys: new Set(equippedTraitKeys), elementCounts: snapshot.traits.elementCounts },
    };
  }

  wantedBasket(progress: DraftProgress): string[] {
    return this.spec.basketTraitKeys.filter((key) => !progress.equippedTraitKeys.includes(key));
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

  /**
   * Whether the biome likely has another room before its last forced depth;
   * a cheap stand-in for a later chance to meet an NPC.
   */
  laterRoomLikely(biomeKey: string): boolean {
    let lastForced = 0;
    for (const room of this.catalog.rooms.values)
      if (
        room.roomSetKey === biomeKey &&
        room.force?.kind === 'depthWindow' &&
        room.force.axis === 'biomeDepthCache'
      )
        lastForced = Math.max(lastForced, room.force.deadline);
    const biome = this.state
      .assembly()
      .evaluation.route.biomes.find((b) => b.biomeKey === biomeKey);
    const depth =
      biome !== undefined && 'history' in biome
        ? biome.history.ledgers.roomAppearances.filter((a) => a.origin.biomeKey === biomeKey).length
        : 0;
    return depth + 1 < lastForced;
  }

  /** Basket traits a Hermes, Hammer or Selene giver offers. */
  basketOf(providerKind: DraftSupply | 'spell'): string[] {
    return this.spec.basketTraitKeys.filter((key) =>
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
      !wanted.some((key) => this.ready(key, progress))
    );
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
    const wanted = this.basketOf(supply).filter(
      (key) => !progress.equippedTraitKeys.includes(key) && this.ready(key, progress),
    );
    if (wanted.length === 0) return undefined;
    const due = this.dueTraits();
    return wanted.some((key) => due.includes(key)) ? 'now' : 'later';
  }

  /** Steering weight of a reward; Olympian sources outside the world and the Anvil weigh nothing. */
  offerWeight(offer: ResolvedRewardOffer): number {
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
      const needed = wanted.some((key) => giver.traitKeys.includes(key));
      const weight = this.dueGods(progress).has(giver.key)
        ? DUE_GIVER_WEIGHT
        : needed
          ? WANTED_GIVER_WEIGHT
          : 4;
      const prerequisites = this.neededPrerequisites(progress);
      const unlocks = giver.traitKeys.some(
        (key) => prerequisites.has(key) && wanted.includes(key) && this.ready(key, progress),
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
    if (provider === undefined) return 1;
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

  /**
   * Gods with an offerable basket trait not yet held that is due by this
   * biome or that a wanted NPC trait waits on.
   */
  private dueGods(progress: DraftProgress): ReadonlySet<string> {
    const due = new Set<string>();
    const traitKeys = [...this.dueTraits(), ...this.npcPrerequisites(progress)];
    for (const traitKey of traitKeys)
      if (!progress.equippedTraitKeys.includes(traitKey) && this.ready(traitKey, progress))
        for (const giver of this.catalog.traitGivers.values)
          if (giver.providerKind === 'olympian' && giver.traitKeys.includes(traitKey))
            due.add(giver.key);
    return due;
  }

  /** A door placement waits on a story NPC whose wanted trait is not ready while a later room is likely. */
  roomWeight(gameName: string, biomeKey: string, placing = false): number {
    const room = this.catalog.rooms.byKey[gameName];
    if (room?.kind === 'Story') {
      if (this.spec.world.storyNpcByBiome[biomeKey] === undefined) return 0.5;
      const biomeIndex = this.state.assembly().project.route.itineraryBiomeKeys.indexOf(biomeKey);
      const giver = this.npcGivers.find((g) => g.story && g.biomeIndex === biomeIndex);
      const waits =
        placing &&
        giver !== undefined &&
        this.npcWaiting(giver.giverKey, this.progress()) &&
        this.laterRoomLikely(biomeKey);
      return waits ? 0.1 : 200;
    }
    if (room?.kind === 'Shop') return 0.4;
    return 1;
  }
}
