import type { Catalog } from '../../catalog-schema';
import {
  countedRewardBinding,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRoomActionAddress,
  hubTerminalTakeoverForSource,
  ordinaryTargetGameNames,
  roomActionDomainForOccurrence,
  roomActionKey,
  scheduleRequiredRoomActions,
  semanticAddressKey,
  shopOfferOptionValues,
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
import { biomeStartRoomGameNames, resolveBiomeStart } from '../../authored-project/route-profile';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
} from '../candidates/session';
import type { StartRoomCandidateQuery } from '../candidates/start-room';
import { countedRewardTypeDomain } from '../evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { assessmentRepairOwner } from '../finding-regions';
import type { SemanticFinding } from '../model';
import { draftStartTraits } from './basket';
import { draftEncounterChoice, type DraftEncounterChoiceContext } from './encounters';
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
import { settleDraftCommand } from './settle';
import type { DraftSpec } from './spec';
import { DraftSteering, type DraftProgress } from './steering';
import { DraftTraitOffers } from './trait-offers';
import type { DraftWorldProduct } from './world';

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
  private stepCount = 0;
  private failureReason: string | undefined;
  /** The biome being walked. */
  private biomeIndex = 0;
  /** Hermes and Hammer rewards some decision in this walk could legally take. */
  readonly legalSupply = new Set<DraftSupply>();

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
      createDraftPrerequisites(catalog, spec.basketTraitKeys, held),
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

  /** Buys a Shop Hermes or Hammer a ready basket trait needs now; a refused purchase is undone. */
  private buyWantedSupply(
    offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    value: ResolvedRewardOffer,
  ): void {
    const supply = draftProvider(this.catalog, value);
    if (supply === undefined || supply === 'spell') return;
    if (this.steering.supplyNeed(supply, this.steering.progress()) !== 'now') return;
    if (!this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true })) return;
    if (this.assembly.evaluation.issue?.kind === 'invalid')
      this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: false });
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
    const keepsakeKey = this.spec.rackKeepsakeKeys[biomeIndex];
    const plan = this.project.route.biomes[biomeIndex];
    if (keepsakeKey === undefined || keepsakeKey === null || plan === undefined) return 'none';
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
      case 'rewardBagEntryUnavailable':
      case 'rewardSourceUnavailable':
      case 'rewardAcquisitionUnavailable':
        return this.authorReward(origin);
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
          origin.kind === 'keepsakeEquipResult' && sampleKeepsakeEquipResult(this.samples, origin)
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
    const legal = names.filter((gameName) => {
      const evaluation = this.evaluate({ kind: 'roomTarget', target, gameName });
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
    for (const choice of this.weighted(choices, (entry) =>
      entry.kind === 'takeover'
        ? 0.5
        : this.steering.roomWeight(entry.gameName, target.biomeKey, true),
    )) {
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

  /** Opens one more Hub door; a wanted story door goes first. */
  private openHubSlot(openSet: Extract<SemanticAddress, { readonly kind: 'hubOpenSet' }>): boolean {
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
        this.catalog.rooms.byKey[slot.roomGameName]?.localChildren.flatMap((child) =>
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
    const decision = this.project.route.biomes
      .find((biome) => biome.biomeKey === visit.biomeKey)
      ?.topology?.decisions.find(
        (candidate): candidate is HubDecision =>
          candidate.kind === 'hub' && candidate.hubKey === visit.hubKey,
      );
    if (decision === undefined) return false;
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
      return occurrence === undefined
        ? 1
        : this.steering.roomWeight(occurrence.gameName, visit.biomeKey);
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
      if (this.apply({ kind: 'ReplaceHubActionOrder', hub, actions })) return true;
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
    const room =
      this.catalog.rooms.byKey[
        this.occurrence(feature.biomeKey, feature.occurrenceId)?.gameName ?? ''
      ];
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
    const ordered = this.weighted(targets, (target) => {
      const occurrence = this.occurrence(selection.biomeKey, target.occurrenceId);
      if (occurrence === undefined) return 1;
      const reward = 'reward' in occurrence.state ? occurrence.state.reward : undefined;
      const offerWeight =
        reward !== undefined && reward !== null
          ? Math.max(this.steering.offerWeight(reward.offer), 0.01)
          : 1;
      return this.steering.roomWeight(occurrence.gameName, selection.biomeKey) * offerWeight;
    });
    for (const target of ordered)
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

  private authorReward(origin: SemanticAddress): boolean {
    if (origin.kind === 'startingReward') {
      const binding = this.catalog.runStartReward.incomingReward;
      if (binding.kind !== 'countedChoice') return false;
      return this.tryOffers(
        binding.allowedRewardTypes,
        (value) => this.evaluate({ kind: 'startingReward', reward: origin, value }),
        (value) => ({ kind: 'ReplaceStartingReward', reward: origin, value }),
      );
    }
    if (origin.kind === 'shopOffer') {
      const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
      const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
      if (occurrence === undefined || shop === undefined) return false;
      const values = shopOfferOptionValues(
        this.catalog,
        occurrence.gameName,
        shop.profileKey,
        origin.offerKey,
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
      for (const value of this.weighted(values, (v) => this.steering.offerWeight(v.offer)))
        if (this.apply({ kind: 'ReplaceShopOfferOption', offer: origin, value })) {
          this.buyWantedSupply(origin, value.offer);
          return true;
        }
      return false;
    }
    if (origin.kind === 'rewardWheelOffer') {
      const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
      const room =
        occurrence === undefined ? undefined : this.catalog.rooms.byKey[occurrence.gameName];
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
      );
    }
    if (origin.kind !== 'incomingReward' && origin.kind !== 'localReward') return false;
    const occurrence = this.occurrence(origin.biomeKey, origin.occurrenceId);
    const room =
      occurrence === undefined ? undefined : this.catalog.rooms.byKey[occurrence.gameName];
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
        )
      : this.tryOffers(
          types,
          (value) => this.evaluate({ kind: 'localReward', reward: origin, value }),
          (value) => ({ kind: 'ReplaceLocalReward', reward: origin, value }),
        );
  }

  private tryOffers(
    rewardTypes: readonly string[],
    evaluate: (value: ResolvedRewardOffer) => { readonly kind: string },
    command: (value: ResolvedRewardOffer) => ProjectCommand,
  ): boolean {
    const legal = rewardTypes
      .flatMap((type) => locallyValidRewardOffers(this.catalog.rewards, type))
      .filter((offer) => this.steering.offerWeight(offer) > 0)
      .filter((offer) => {
        const evaluation = evaluate(offer);
        return (
          'result' in evaluation &&
          typeof evaluation.result === 'object' &&
          evaluation.result !== null &&
          'supported' in evaluation.result &&
          evaluation.result.supported === true &&
          'findings' in evaluation.result &&
          Array.isArray(evaluation.result.findings) &&
          evaluation.result.findings.length === 0
        );
      });
    this.noteSupply(legal);
    for (const offer of this.weighted(legal, (o) => this.steering.offerWeight(o)))
      if (this.apply(command(offer))) return true;
    return false;
  }

  // --- Other owners --------------------------------------------------------

  private placeRequiredActions(origin: SemanticAddress): boolean {
    if (!('biomeKey' in origin) || !('occurrenceId' in origin)) return false;
    if (origin.kind === 'incomingReward') {
      const state = this.occurrence(origin.biomeKey, origin.occurrenceId)?.state;
      // An unauthored reward owns no actions yet; authoring it schedules them.
      if (state !== undefined && 'reward' in state && state.reward === null)
        return this.authorReward(origin);
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
