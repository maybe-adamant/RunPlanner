import type { Catalog } from '../../catalog-schema';
import {
  countedRewardBinding,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createPostbossKeepsakeSelectionAddress,
  createRoomActionAddress,
  hubTerminalTakeoverForSource,
  ordinaryTargetGameNames,
  roomActionDomainForOccurrence,
  roomActionKey,
  scheduleRequiredRoomActions,
  semanticAddressKey,
  shopOfferOptionValues,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  takeoverPrebossGameNames,
  type BiomeAddress,
  type BatchRewardStoreAddress,
  type ExitDecisionAddress,
  type HubAction,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project';
import { hermesShrineInitialSlotKey } from '../../authored-project/model';
import { exitDecisionForSource } from '../../authored-project/topology/query';
import {
  biomeStartRoomGameNames,
  resolveBiomeStart,
  routeRoomDeclaration,
} from '../../authored-project/route-profile';
import {
  locallyValidRewardOffers,
  ORDINARY_SOURCE_CAP,
  type ResolvedRewardOffer,
} from '../../reward-kernel';
import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
} from '../candidates/session';
import type { StartRoomCandidateQuery } from '../candidates/start-room';
import type { ForcePressureLedgerEntry } from '../generation';
import { DRAFT_OPTIONS } from '../../authored-project/draft-spec';
import { countedRewardTypeDomain } from '../evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { assessmentRepairOwner } from '../finding-regions';
import type { SemanticFinding } from '../model';
import { draftStartTraits } from './basket';
import { latestRunState } from './report';
import type { RewardOfferExclusionEvidence } from '../rewards/offer-exclusions';
import type { RewardProducerCandidateResult } from '../rewards/producer-frontiers';
import {
  draftEncounterChoice,
  draftOccurrenceEncounterChoice,
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
import { settleDraftCommand, settleDraftCommandWithoutNewFinding } from './settle';
import { routeResourceAuthoring } from '../resources';
import { draftBasketTraitKeys, draftKeepsakeOptions, type DraftSpec } from './spec';
import {
  draftBoostElements,
  DraftSteering,
  draftSideDoorWeight,
  draftSiblingHoldsGodBoon,
  NPC_EXCLUDED_REWARD_FACTOR,
  NPC_WINDOW_WEIGHT,
  type DraftProgress,
} from './steering';
import { DraftTraitOffers } from './trait-offers';
import type { DraftWorldProduct } from './world';

/** A pursued Clockwork Goal door: above any boon door (at most 90), below a story room (200). */
const TARTARUS_GOAL_WEIGHT = 150;

/** A Clockwork combat room left without an authored reward resolves to a Goal. */
function clockworkGoal(catalog: Catalog, routeKey: string, occurrence: RoomOccurrence): boolean {
  const mode = routeRoomDeclaration(catalog.rooms.byKey[occurrence.gameName], routeKey)?.mode;
  return (
    mode?.kind === 'authored' &&
    mode.templateKey === 'ClockworkCombat' &&
    occurrence.state.kind === 'counted' &&
    occurrence.state.reward === null
  );
}

/** A Shop door beside a door to a new god with queued traits. */
const SHOP_OUTRANKED_FACTOR = 0.001;

/** The offer weight of a wanted god's boon; a due god's is higher. */
const WANTED_GOD_WEIGHT = 30;

const RESOURCE_FAMILIES = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;

/**
 * One finding-driven draft walk over a working project. Every value comes from
 * an engine domain and is admitted by the engine's own candidate query.
 */
export class DraftWalk {
  assembly: ProjectEvaluationAssembly;
  private session: ProjectCandidateSession | undefined;
  private readonly hooked = new Set<string>();
  private readonly steering: DraftSteering;
  private readonly traitOffers: DraftTraitOffers;
  private readonly samples: DraftSampleContext;
  private readonly encounterChoices: DraftEncounterChoiceContext;
  private nextOccurrence = 0;
  /** Rooms entered per biome that have had their essence roll. */
  private readonly essenceRooms = new Map<number, number>();
  /** Reward commands this walk applied. */
  private readonly authoredRewards = new Set<string>();
  private stepCount = 0;
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

  constructor(
    readonly catalog: Catalog,
    start: ProjectEvaluationAssembly,
    readonly spec: DraftSpec,
    readonly rng: DraftRng,
    schedule: DraftGodSchedule,
    world: DraftWorldProduct,
  ) {
    this.assembly = start;
    const held = draftStartTraits(catalog, start.project.route, spec.loadout);
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
      evaluate: this.evaluate,
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
  }

  /** Decisions taken so far, across every biome this walk ran. */
  get steps(): number {
    return this.stepCount;
  }

  /** Why the last biome run stopped short. */
  get failure(): string | undefined {
    return this.failureReason;
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
      if (this.issueBiomeIndex() > biomeIndex) {
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
      this.maybePlaceEssence(biomeIndex);
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
   * Each newly entered room places an unplaced resource point at the spec's resource room
   * chance, preferring an element a waiting basket trait needs.
   */
  private maybePlaceEssence(biomeIndex: number): void {
    const biomeKey = this.project.route.itineraryBiomeKeys[biomeIndex];
    const biome = this.assembly.evaluation.route.biomes.find((b) => b.biomeKey === biomeKey);
    if (biome === undefined || !('history' in biome)) return;
    const entered = biome.history.ledgers.roomAppearances.filter(
      (appearance) =>
        appearance.origin.kind === 'occurrence' && appearance.origin.biomeKey === biomeKey,
    );
    if (entered.length <= (this.essenceRooms.get(biomeIndex) ?? 0)) return;
    this.essenceRooms.set(biomeIndex, entered.length);
    const latest = entered.at(-1)!;
    if (latest.origin.kind !== 'occurrence') return;
    const occurrenceId = latest.origin.occurrenceId;
    const route = this.project.route;
    // Only a room that can host an unplaced point rolls.
    const support = this.roomOf(latest.gameName)?.resourcePointSupport;
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
      const settled = settleDraftCommandWithoutNewFinding(this.catalog, this.assembly, {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress(route.routeKey),
        family,
        value: { biomeKey: biomeKey!, occurrenceId },
      });
      if (settled === undefined) continue;
      this.assembly = settled;
      this.session = undefined;
      return;
    }
  }

  private candidates(): ProjectCandidateSession {
    return (this.session ??= createPreparedProjectCandidateSession(this.catalog, this.assembly));
  }

  private evaluate: ProjectCandidateSession['evaluate'] = ((query: never) =>
    this.candidates().evaluate(query)) as ProjectCandidateSession['evaluate'];

  /** Applies a command through edit settlement; false when the command authority refuses it. */
  apply(command: ProjectCommand): boolean {
    const settled = settleDraftCommand(this.catalog, this.assembly, command);
    if (settled === undefined) return false;
    this.assembly = settled;
    this.session = undefined;
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
   * Buys what the basket wants now: a boon of a god that can take its next basket
   * trait, at the purchase pace; a due Hermes or Hammer; on Dream, an element a
   * waiting trait needs. A purchase that invalidates the route is undone.
   */
  private buyWanted(
    offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    value: ResolvedRewardOffer,
  ): void {
    const progress = this.steering.progress();
    const supply = draftProvider(this.catalog, value);
    const god = this.steering.offerGod(value);
    const elements = draftBoostElements(this.catalog, value.rewardType);
    const wanted =
      supply === 'hermes' || supply === 'hammer'
        ? this.steering.supplyNeed(supply, progress) === 'now'
        : god !== undefined
          ? this.steering.purchasesPerBiome() > 0 &&
            this.steering.godTakes(god, progress) &&
            this.rng() < this.purchaseChance()
          : elements.some((element) => this.steering.wantedElements(progress).includes(element));
    if (!wanted) return;
    if (!this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true })) return;
    if (this.assembly.evaluation.issue?.kind === 'invalid')
      this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: false });
  }

  /** Ahead of the purchase pace a boon is bought less often, behind it more often; never always or never. */
  private purchaseChance(): number {
    const behind = this.steering.purchasesBehind();
    // Catch up steeply when behind, and buy readily once the boon bag runs low.
    const chance =
      behind > 0 ? Math.min(0.7 + 0.15 * behind, 0.95) : Math.max(0.5 + 0.2 * behind, 0.15);
    return this.steering.boonBagLow() ? Math.max(chance, 0.85) : chance;
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
      case 'hermesShrineInventoryMissing':
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
        return this.placeRequiredActions(origin);
      case 'fieldsSpatialPointMissing':
      case 'fieldsSpatialPointUnavailable':
      case 'fieldsSpatialPointDuplicate':
        return origin.kind === 'fieldsSpatial' && this.fieldsSpatialPoint(origin, reason);
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

  /** Appends the next Hub action: an unvisited open door, or the one fountain use. */
  private extendHubVisits(
    visit: Extract<SemanticAddress, { readonly kind: 'hubVisit' | 'hubFountain' }>,
  ): boolean {
    const decision = this.hubDecision(visit.biomeKey, visit.hubKey);
    if (decision === undefined) return false;
    const unvisited = this.unvisitedHubDoors.get(visit.biomeKey);
    const hub = createHubDecisionAddress(
      createBiomeAddress(visit.routeKey, visit.biomeKey),
      visit.hubKey,
    );
    const visited = new Set(
      decision.actions.flatMap((action) =>
        action.kind === 'roomVisit' ? [action.hubSlotKey] : [],
      ),
    );
    const next: HubAction[] = decision.openTargets
      .filter((target) => !visited.has(target.hubSlotKey))
      .map((target) => ({ kind: 'roomVisit', hubSlotKey: target.hubSlotKey }));
    if (!decision.actions.some((action) => action.kind === 'useFountain'))
      next.push({ kind: 'useFountain' });
    const weight = (action: HubAction) => {
      if (action.kind === 'useFountain') return 0.5;
      const target = decision.openTargets.find((t) => t.hubSlotKey === action.hubSlotKey);
      const occurrence =
        target === undefined ? undefined : this.occurrence(visit.biomeKey, target.occurrenceId);
      if (occurrence === undefined) return 1;
      if (unvisited?.has(occurrence.occurrenceId) === true) return 0;
      const reward = 'reward' in occurrence.state ? occurrence.state.reward : undefined;
      return (
        this.steering.npcVisitWeight(
          occurrence.gameName,
          reward?.offer.rewardType,
          visit.biomeKey,
        ) ?? this.steering.roomWeight(occurrence.gameName, visit.biomeKey)
      );
    };
    const orders: HubAction[][] =
      visit.kind === 'hubFountain'
        ? this.shuffle([...decision.actions.keys(), decision.actions.length]).map((index) => [
            ...decision.actions.slice(0, index),
            { kind: 'useFountain' },
            ...decision.actions.slice(index),
          ])
        : this.weighted(next, weight).map((action) => [...decision.actions, action]);
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

  /** A forced Shrine's inventory: a declared option of the slot's group, never one already tried. */
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
    for (const option of this.shuffle(group?.options.values ?? [])) {
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
      if (
        this.spec.pursueTartarusGoal === true &&
        clockworkGoal(this.catalog, this.project.route.routeKey, occurrence)
      )
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
      const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
      const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
      if (occurrence === undefined || shop === undefined) return false;
      const slotKey =
        origin.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
          ? this.refilledSlotKey(origin.biomeKey, origin.occurrenceId, shop.profileKey)
          : origin.offerKey;
      if (slotKey === undefined) return false;
      const values = shopOfferOptionValues(
        this.catalog,
        occurrence.gameName,
        shop.profileKey,
        slotKey,
      ).filter((value) => {
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
      for (const value of this.inPoolOrder(ordered, values, (v) => v.offer))
        if (apply({ kind: 'ReplaceShopOfferOption', offer: origin, value })) {
          this.buyWanted(origin, value.offer);
          return true;
        }
      return false;
    }
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
      return this.tryOffers(
        [rewardType],
        evaluateEntry,
        (value) => ({ kind: 'ReplaceAcquisitionEntryOffer', entry: origin, value }),
        apply,
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
          // A fountain room makes a wanted or due god boon somewhat likelier.
          room.kind === 'Reprieve' ? 2 : 1,
          this.npcExcludedRewards(origin.biomeKey, occurrence),
          this.siblingHoldsBoon(origin.biomeKey, occurrence),
          () => this.unvisitedHubDoorReward(origin, occurrence, types),
          // A Hub door is visited later, so its reward is not paced to the board's depth.
          !this.hubDoor(origin.biomeKey, occurrence),
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
    evaluate: (value: ResolvedRewardOffer) => { readonly kind: string },
    command: (value: ResolvedRewardOffer) => ProjectCommand,
    apply: (command: ProjectCommand) => boolean,
    wantedGodBoost = 1,
    npcExcluded: ReadonlySet<string> = new Set(),
    avoidBoon = false,
    whenNoneLegal?: () => boolean,
    paced = true,
  ): boolean {
    const legal = rewardTypes
      .flatMap((type) => locallyValidRewardOffers(this.catalog.rewards, type))
      .filter((offer) => this.steering.offerWeight(offer) > 0 && !this.offerStopped(offer))
      .filter((offer) => {
        const evaluation = evaluate(offer);
        if (!('result' in evaluation) || typeof evaluation.result !== 'object') return false;
        const result = evaluation.result as Partial<RewardProducerCandidateResult> | null;
        if (result?.supported === false) this.noteExclusions(result.exclusions ?? []);
        return result?.supported === true && result.findings?.length === 0;
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

  /** Stops chasing what an offer exclusion holding in every branch rules out. */
  private noteExclusions(exclusions: readonly RewardOfferExclusionEvidence[]): void {
    for (const exclusion of exclusions) {
      if (!exclusion.allBranches) continue;
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

  private placeRequiredActions(origin: SemanticAddress): boolean {
    if (!('biomeKey' in origin) || !('occurrenceId' in origin)) return false;
    if (origin.kind === 'incomingReward') {
      const state = this.occurrence(origin.biomeKey, origin.occurrenceId)?.state;
      // An unauthored reward owns no actions yet; authoring it schedules them.
      if (state !== undefined && 'reward' in state && state.reward === null)
        return this.authorReward(origin, false);
    }
    const occurrenceId = origin.occurrenceId as OccurrenceId;
    const biome = createBiomeAddress(origin.routeKey, origin.biomeKey);
    const located = roomActionDomainForOccurrence(this.project, this.catalog, biome, occurrenceId);
    if (located === undefined) return false;
    const authored = new Set(located.occurrence.roomActions.order.map(roomActionKey));
    const missing = located.domain.contributions.flatMap((entry) =>
      entry.kind === 'action' &&
      entry.participation === 'required' &&
      !authored.has(roomActionKey(entry.reference))
        ? [entry.reference]
        : [],
    );
    let changed = false;
    for (const reference of missing) {
      const current = roomActionDomainForOccurrence(
        this.project,
        this.catalog,
        biome,
        occurrenceId,
      );
      if (current === undefined) break;
      const scheduled = scheduleRequiredRoomActions({
        catalog: this.catalog,
        domain: current.domain,
        order: current.occurrence.roomActions.order,
        requiredKeys: new Set([roomActionKey(reference)]),
      });
      const index = scheduled.findIndex(
        (entry) => roomActionKey(entry) === roomActionKey(reference),
      );
      changed =
        this.apply({
          kind: 'InsertRoomAction',
          action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
          reference,
          index: Math.max(index, 0),
        }) || changed;
    }
    return changed;
  }

  private fieldsSpatialPoint(
    spatial: Extract<SemanticAddress, { readonly kind: 'fieldsSpatial' }>,
    reason: SemanticFinding,
  ): boolean {
    const ids = reason.evidence['supportPointIds'];
    if (!Array.isArray(ids)) return false;
    for (const pointId of this.shuffle(ids.filter((id): id is number => typeof id === 'number')))
      if (this.apply({ kind: 'ReplaceFieldsSpatialPoint', spatial, pointId })) return true;
    return false;
  }
}
