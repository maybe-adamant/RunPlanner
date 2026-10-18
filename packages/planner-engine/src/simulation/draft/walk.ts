import type { Catalog } from '../../catalog-schema';
import {
  applyProjectCommand,
  countedRewardBinding,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRoomActionAddress,
  hubTerminalTakeoverForSource,
  ordinaryTargetGameNames,
  parseEchoLastRewardPickupEntryKey,
  roomActionDomainForOccurrence,
  roomActionKey,
  scheduleRequiredRoomActions,
  semanticAddressKey,
  shopOfferOptionValues,
  takeoverPrebossGameNames,
  type AuthoredTraitOffer,
  type BiomeAddress,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
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
  type TraitOfferAddress,
} from '../../authored-project';
import { exitDecisionForSource } from '../../authored-project/topology/query';
import { createDefaultAuthoredHexTree } from '../../authored-project/traits/hex-tree';
import { biomeStartRoomGameNames, resolveBiomeStart } from '../../authored-project/route-profile';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
} from '../candidates/session';
import type { StartRoomCandidateQuery } from '../candidates/start-room';
import { settleProjectEdit } from '../edit-settlement';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  countedRewardTypeDomain,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import {
  DRAFT_HAMMER_TARGET,
  DRAFT_HERMES_TARGET,
  draftHalfTarget,
  draftSupply,
  heldFromGiver,
  latestRunState,
  type DraftSupply,
} from './report';
import type { SemanticFinding } from '../model';
import type { DraftSpec } from './spec';
import { draftWorldGiverKeys } from './world';

/** A seeded xorshift stream; every random draft choice reads it. */
export type DraftRng = () => number;

export function createDraftRng(seed: number): DraftRng {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** What the walk has acquired so far, read from the latest Run State snapshot. */
export interface DraftProgress {
  readonly equippedTraitKeys: readonly string[];
  readonly hammers: number;
  readonly hermes: number;
}

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

/**
 * One finding-driven draft walk over a working project. Every value comes from
 * an engine domain and is admitted by the engine's own candidate query.
 */
export class DraftWalk {
  assembly: ProjectEvaluationAssembly;
  private session: ProjectCandidateSession | undefined;
  private readonly hooked = new Set<string>();
  private readonly worldGivers: ReadonlySet<string>;
  private nextOccurrence = 0;
  steps = 0;
  failure: string | undefined;
  /** The biome being walked. */
  biomeIndex = 0;
  /** Hermes and Hammer rewards some decision in this walk could legally take. */
  readonly legalSupply = new Set<DraftSupply>();

  constructor(
    readonly catalog: Catalog,
    start: ProjectEvaluationAssembly,
    readonly spec: DraftSpec,
    readonly rng: DraftRng,
  ) {
    this.assembly = start;
    this.worldGivers = new Set(draftWorldGiverKeys(catalog, start.project.route, spec.world));
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
   * Authors one biome until the route's issue leaves it, then equips its rack.
   * False at a dead end or the step limit; the route then stays incomplete.
   */
  runBiome(biomeIndex: number, maxSteps: number): boolean {
    this.biomeIndex = biomeIndex;
    while (this.steps < maxSteps) {
      if (this.issueBiomeIndex() > biomeIndex) {
        if (biomeIndex < this.project.route.biomes.length - 1) this.equipRack(biomeIndex);
        return true;
      }
      const issue = this.assembly.evaluation.issue!;
      const reason = issue.reasons[0]!;
      if (!this.optionalChoices(reason) && !this.repair(reason)) {
        this.failure = `${reason.code} at ${semanticAddressKey(reason.origin)}`;
        return false;
      }
      this.steps += 1;
    }
    this.failure = 'step limit';
    return false;
  }

  private candidates(): ProjectCandidateSession {
    return (this.session ??= createPreparedProjectCandidateSession(this.catalog, this.assembly));
  }

  private evaluate: ProjectCandidateSession['evaluate'] = ((query: never) =>
    this.candidates().evaluate(query)) as ProjectCandidateSession['evaluate'];

  /** Applies a command through edit settlement; false when the command authority refuses it. */
  apply(command: ProjectCommand): boolean {
    try {
      applyProjectCommand(this.project, this.catalog, command);
    } catch {
      return false;
    }
    const settled = settleProjectEdit({
      catalog: this.catalog,
      before: this.assembly,
      command,
      evaluate: (project) => simulateProjectAssembly(this.catalog, project),
    });
    if (settled.assembly.project === this.project) return false;
    this.assembly = settled.assembly;
    this.session = undefined;
    return true;
  }

  private shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(this.rng() * (index + 1));
      [result[index], result[swap]] = [result[swap]!, result[index]!];
    }
    return result;
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

  progress(): DraftProgress {
    const snapshot = latestRunState(this.assembly);
    return {
      equippedTraitKeys: Object.keys(snapshot?.traits.equippedTraits ?? {}),
      hammers: heldFromGiver(this.catalog, snapshot, 'WeaponUpgrade'),
      hermes: heldFromGiver(this.catalog, snapshot, 'Hermes'),
    };
  }

  // --- Targets -----------------------------------------------------------

  private wantedBasket(progress: DraftProgress): string[] {
    return this.spec.basketTraitKeys.filter((key) => !progress.equippedTraitKeys.includes(key));
  }

  /** Olympian sources outside the world are never chosen; Anvil and Story rewards are filtered. */
  private offerWeight(offer: ResolvedRewardOffer): number {
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
      return wanted.some((key) => giver.traitKeys.includes(key)) ? 30 : 4;
    }
    const supply = draftSupply(offer.rewardType);
    if (supply !== undefined) {
      const held = supply === 'hermes' ? progress.hermes : progress.hammers;
      const halfTarget = draftHalfTarget(this.biomeIndex, this.project.route.biomes.length);
      const runTarget = supply === 'hermes' ? DRAFT_HERMES_TARGET : DRAFT_HAMMER_TARGET;
      return held < halfTarget ? 25 : held < runTarget ? 3 : 0.2;
    }
    return 1;
  }

  /** Buys a Shop Hermes or Hammer the half still needs; a purchase the engine refuses is undone. */
  private buyWantedSupply(
    offer: Extract<SemanticAddress, { readonly kind: 'shopOffer' }>,
    value: ResolvedRewardOffer,
  ): void {
    const supply = draftSupply(value.rewardType);
    if (supply === undefined) return;
    const progress = this.progress();
    const held = supply === 'hermes' ? progress.hermes : progress.hammers;
    if (held >= draftHalfTarget(this.biomeIndex, this.project.route.biomes.length)) return;
    if (!this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true })) return;
    if (this.assembly.evaluation.issue?.kind === 'invalid')
      this.apply({ kind: 'ReplaceShopPurchaseParticipation', offer, purchased: false });
  }

  private noteSupply(offers: readonly ResolvedRewardOffer[]): void {
    for (const offer of offers) {
      const supply = draftSupply(offer.rewardType);
      if (supply !== undefined && this.offerWeight(offer) > 0) this.legalSupply.add(supply);
    }
  }

  private roomWeight(gameName: string, biomeKey: string): number {
    const room = this.catalog.rooms.byKey[gameName];
    if (room?.kind === 'Story')
      return this.spec.world.storyNpcByBiome[biomeKey] === undefined ? 0.5 : 200;
    if (room?.kind === 'Shop') return 0.4;
    return 1;
  }

  // --- Optional choices no finding asks for ------------------------------

  /** Encounter choice for the finding's room, once its phases are reached. */
  private optionalChoices(reason: SemanticFinding): boolean {
    const origin = reason.origin;
    if (!('biomeKey' in origin)) return false;
    const occurrenceId =
      'occurrenceId' in origin
        ? origin.occurrenceId
        : 'source' in origin && origin.source.kind === 'occurrence'
          ? origin.source.occurrenceId
          : 'owner' in origin && typeof origin.owner === 'object' && 'occurrenceId' in origin.owner
            ? origin.owner.occurrenceId
            : undefined;
    if (typeof occurrenceId !== 'string') return false;
    const key = `encounters:${origin.biomeKey}:${occurrenceId}`;
    if (this.hooked.has(key)) return false;
    const outcome = this.chooseEncounters(origin.biomeKey, occurrenceId as OccurrenceId);
    if (outcome.reached) this.hooked.add(key);
    return outcome.changed;
  }

  /** The drafted keepsake for the rack after this biome's Postboss. */
  private equipRack(biomeIndex: number): boolean {
    const keepsakeKey = this.spec.rackKeepsakeKeys[biomeIndex];
    const plan = this.project.route.biomes[biomeIndex];
    if (keepsakeKey === undefined || keepsakeKey === null || plan === undefined) return false;
    const biome = createBiomeAddress(this.project.route.routeKey, plan.biomeKey);
    for (const occurrence of plan.topology?.occurrences ?? []) {
      if (!this.catalog.rooms.byKey[occurrence.gameName]?.hasKeepsakeRack) continue;
      const selection = createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(biome, occurrence.occurrenceId),
      );
      if (this.apply({ kind: 'ReplacePostbossKeepsake', selection, keepsakeKey })) return true;
    }
    return false;
  }

  /** Selects wanted field NPC encounters, else a random combat encounter; never Nemesis events. */
  private chooseEncounters(
    biomeKey: string,
    occurrenceId: OccurrenceId,
  ): { readonly reached: boolean; readonly changed: boolean } {
    const occurrence = this.occurrence(biomeKey, occurrenceId);
    if (occurrence === undefined) return { reached: false, changed: false };
    const wanted = this.spec.world.fieldNpcsByBiome[biomeKey] ?? [];
    let changed = false;
    let reached = false;
    for (const phaseKey of Object.keys(occurrence.encounters.encounterKeyByPhase)) {
      const phase = createEncounterPhaseAddress(
        createBiomeAddress(this.project.route.routeKey, biomeKey),
        { kind: 'occurrence', occurrenceId },
        phaseKey,
      );
      const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        this.assembly,
        phase,
      );
      if (support === undefined) continue;
      reached = true;
      if (!support.activationSatisfied) continue;
      const candidates = support.candidateEncounterKeys.filter(
        (key) => this.catalog.encounterDefinitions.byKey[key]?.kind !== 'nonCombat',
      );
      const npcFor = (key: string) =>
        this.catalog.encounterDefinitions.byKey[key]?.npcPresentationKey;
      const field = candidates.find((key) => {
        const npc = npcFor(key);
        return npc !== undefined && wanted.includes(npc) && !this.metFieldNpc(biomeKey, npc);
      });
      const ordinary = candidates.filter((key) => npcFor(key) === undefined);
      const choice = field ?? (ordinary.length > 0 ? this.shuffle(ordinary)[0] : undefined);
      if (choice === undefined || choice === support.selectedEncounterKey) continue;
      changed = this.apply({ kind: 'SelectEncounter', phase, encounterKey: choice }) || changed;
    }
    return { reached, changed };
  }

  private metFieldNpc(biomeKey: string, npc: string): boolean {
    return (
      this.project.route.biomes
        .find((biome) => biome.biomeKey === biomeKey)
        ?.topology?.occurrences.some((occurrence) =>
          Object.values(occurrence.encounters.encounterKeyByPhase).some(
            (key) => this.catalog.encounterDefinitions.byKey[key]?.npcPresentationKey === npc,
          ),
        ) === true
    );
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
        return origin.kind === 'traitOffer' && this.authorTraitOffer(origin);
      case 'roomActionPlacementRequired':
        return this.placeRequiredActions(origin);
      case 'fieldsSpatialPointMissing':
      case 'fieldsSpatialPointUnavailable':
      case 'fieldsSpatialPointDuplicate':
        return origin.kind === 'fieldsSpatial' && this.fieldsSpatialPoint(origin, reason);
      case 'fountainRarityResultMissing':
      case 'fountainRarityResultUnavailable':
        return origin.kind === 'fountainRarityOutcome' && this.fountainRarity(origin, reason);
      case 'keepsakeEquipResultMissing':
      case 'keepsakeEquipResultUnavailable':
        return origin.kind === 'keepsakeEquipResult' && this.keepsakeEquipResult(origin);
      case 'figurineOutcomeMissing':
      case 'figurineOutcomeWrongCardinality':
      case 'figurineOutcomeTargetUnavailable':
        return origin.kind === 'figurineArcana' && this.figurine(origin);
      case 'judgmentOutcomeMissing':
      case 'judgmentOutcomeWrongCardinality':
      case 'judgmentOutcomeTargetUnavailable':
        return origin.kind === 'judgmentArcana' && this.judgment(origin);
      case 'hexActivationMissing':
      case 'hexActivationUnavailable':
        return origin.kind === 'acquisitionRole' && this.hexActivation(origin);
      default:
        if (origin.kind === 'levelResolution') return this.levelResolution(origin);
        if (origin.kind === 'rewardWheel') return this.rewardWheelPicked(origin);
        return false;
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
    const TAKEOVER = '\u0000takeover';
    const choices = takeover === undefined ? legal : [...legal, TAKEOVER];
    for (const gameName of this.weighted(choices, (name) =>
      name === TAKEOVER ? 0.5 : this.roomWeight(name, target.biomeKey),
    )) {
      if (gameName === TAKEOVER) {
        if (applyTakeover()) return true;
        continue;
      }
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
      this.roomWeight(slot.roomGameName, openSet.biomeKey),
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
      return occurrence === undefined ? 1 : this.roomWeight(occurrence.gameName, visit.biomeKey);
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
    const slotKey = feature.target.generationKey.replace('initial:', '');
    if (slotKey !== 'first' && slotKey !== 'secondLeft' && slotKey !== 'secondRight') return false;
    const profile = this.catalog.rewards.shops.byKey.SurfaceShop;
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
    const decision = topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        JSON.stringify(candidate.source) === JSON.stringify(selection.source),
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') return false;
    const targets = decision.normal.targets;
    const ordered = this.weighted(targets, (target) => {
      const occurrence = this.occurrence(selection.biomeKey, target.occurrenceId);
      if (occurrence === undefined) return 1;
      const reward = 'reward' in occurrence.state ? occurrence.state.reward : undefined;
      const offerWeight =
        reward !== undefined && reward !== null
          ? Math.max(this.offerWeight(reward.offer), 0.01)
          : 1;
      return this.roomWeight(occurrence.gameName, selection.biomeKey) * offerWeight;
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
      for (const value of this.weighted(values, (v) => this.offerWeight(v.offer)))
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
      .filter((offer) => this.offerWeight(offer) > 0)
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
    for (const offer of this.weighted(legal, (o) => this.offerWeight(o)))
      if (this.apply(command(offer))) return true;
    return false;
  }

  // --- Trait offers --------------------------------------------------------

  /** Wraps an edit owned by an Echo replay entry, as the editor does. */
  private echoWrapped(
    owner: SemanticAddress,
    edit: Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceTraitOffer' | 'ReplaceLevelResolution' }
    >,
  ): ProjectCommand {
    if (
      owner.kind === 'acquisitionEntry' &&
      parseEchoLastRewardPickupEntryKey(owner.entryKey) !== undefined
    ) {
      const replay = derivedAcquisitionEntriesForProjectEvaluationAssembly(
        this.assembly,
        owner.site,
      ).find(
        (entry) =>
          entry.kind === 'echoLastReward' &&
          semanticAddressKey(entry.address) === semanticAddressKey(owner),
      );
      if (replay !== undefined && 'fixedReward' in replay && replay.fixedReward !== undefined)
        return {
          kind: 'EditEchoReplay',
          entry: owner,
          sourceOffer: replay.fixedReward.offer,
          edit,
        };
    }
    return edit;
  }

  private offerSupported(trait: TraitOfferAddress, value: AuthoredTraitOffer): boolean {
    const evaluation = this.evaluate({ kind: 'traitOffer', trait, value });
    return (
      evaluation.kind === 'traitOffer' &&
      evaluation.result.supported &&
      evaluation.result.findings.length === 0
    );
  }

  /** Never an exchange row or a trait-removing Duo. */
  private monotonicSelection(trait: TraitOfferAddress, value: AuthoredTraitOfferTraits): boolean {
    const index = OPTION_KEYS.indexOf(value.selectedOptionKey);
    const selected = value.options[index];
    if (selected === undefined) return false;
    if (this.catalog.traits.byKey[selected.traitKey]?.selectedDisposition.kind === 'ransom')
      return false;
    const evaluation = this.evaluate({ kind: 'traitOffer', trait, value });
    return (
      evaluation.kind === 'traitOffer' &&
      evaluation.result.assessments[index]?.replacementTransition === undefined
    );
  }

  private accepts(command: ProjectCommand): boolean {
    try {
      applyProjectCommand(this.project, this.catalog, command);
      return true;
    } catch {
      return false;
    }
  }

  private authorTraitOffer(trait: TraitOfferAddress): boolean {
    const command = (value: AuthoredTraitOffer) =>
      this.echoWrapped(trait.owner, { kind: 'ReplaceTraitOffer', trait, value });
    for (const giver of this.shuffle(this.catalog.traitGivers.values)) {
      if (giver.providerKind === 'olympian' && !this.worldGivers.has(giver.key)) continue;
      const draft = this.candidates().traitOfferStartingOutcome(trait, giver.key);
      // The command binds one provider to this address; its starting outcome is accepted.
      if (draft === undefined || !this.accepts(command(draft))) continue;
      const values = draft.kind === 'traits' ? this.steerTraitOffer(trait, draft) : [draft];
      for (const value of values) if (this.apply(command(value))) return true;
    }
    return false;
  }

  /** Wanted basket placements first, then every other legal row in random order. */
  private steerTraitOffer(
    trait: TraitOfferAddress,
    draft: AuthoredTraitOfferTraits,
  ): AuthoredTraitOfferTraits[] {
    const select = (options: readonly AuthoredTraitOption[], index: number) => {
      const traitKey = options[index]!.traitKey;
      const hexTree = this.catalog.hexes.byKey[traitKey]
        ? createDefaultAuthoredHexTree(this.catalog, traitKey)
        : undefined;
      const { hexTree: _hexTree, ...rest } = draft;
      void _hexTree;
      return {
        ...rest,
        options: options as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: OPTION_KEYS[index]!,
        ...(hexTree === undefined ? {} : { hexTree }),
      } as AuthoredTraitOfferTraits;
    };
    const legal = (candidate: AuthoredTraitOfferTraits) =>
      this.offerSupported(trait, candidate) && this.monotonicSelection(trait, candidate);
    const indexes = [...draft.options.keys()];
    const giverTraits = this.catalog.traitGivers.byKey[draft.giverKey]?.traitKeys ?? [];
    const wanted = this.shuffle(
      this.wantedBasket(this.progress()).filter((key) => giverTraits.includes(key)),
    );
    for (const traitKey of wanted) {
      const declaration = this.catalog.traits.byKey[traitKey];
      const rarities =
        declaration?.rarityDomain.kind === 'ranked'
          ? this.shuffle(declaration.rarityDomain.freshOfferRarities)
          : [undefined];
      for (const index of this.shuffle(indexes))
        for (const rarity of rarities) {
          const options = [...draft.options];
          options[index] = rarity === undefined ? { traitKey } : { traitKey, rarity };
          const candidate = select(options, index);
          if (legal(candidate)) return [candidate];
        }
    }
    return this.shuffle(indexes)
      .map((index) => select(draft.options, index))
      .filter(legal);
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

  private fountainRarity(
    outcome: Extract<SemanticAddress, { readonly kind: 'fountainRarityOutcome' }>,
    reason: SemanticFinding,
  ): boolean {
    const keys = reason.evidence['eligibleTargetKeys'];
    if (!Array.isArray(keys)) return false;
    for (const targetTraitKey of this.shuffle(
      keys.filter((k): k is string => typeof k === 'string'),
    )) {
      const evaluation = this.evaluate({ kind: 'fountainRarityOutcome', outcome, targetTraitKey });
      if (evaluation.kind === 'fountainRarityOutcome' && !evaluation.result.selectedPossible)
        continue;
      if (this.apply({ kind: 'ReplaceFountainRarityTarget', outcome, targetTraitKey })) return true;
    }
    return false;
  }

  private keepsakeEquipResult(
    result: Extract<SemanticAddress, { readonly kind: 'keepsakeEquipResult' }>,
  ): boolean {
    const evaluation = this.evaluate({ kind: 'keepsakeEquipResult', result });
    if (evaluation.kind !== 'keepsakeEquipResult') return false;
    for (const option of this.shuffle(
      evaluation.result.options.filter((o) => o.selectedPossible),
    )) {
      const command = (
        option.resultKind === 'jeweledPom'
          ? { kind: 'ReplaceJeweledPomEquipResult', result, value: option.value }
          : option.resultKind === 'experimentalHammer'
            ? { kind: 'ReplaceExperimentalHammerEquipResult', result, value: option.value }
            : { kind: 'ReplaceTranscendentEmbryoEquipResult', result, value: option.value }
      ) as ProjectCommand;
      if (this.apply(command)) return true;
    }
    return false;
  }

  private figurine(
    figurine: Extract<SemanticAddress, { readonly kind: 'figurineArcana' }>,
  ): boolean {
    const probe = this.evaluate({ kind: 'figurineArcana', figurine, arcanaKeys: [] });
    if (probe.kind !== 'figurineArcana') return false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const arcanaKeys = this.shuffle(probe.result.inactiveArcanaKeys).slice(
        0,
        probe.result.requiredCount,
      );
      const evaluation = this.evaluate({ kind: 'figurineArcana', figurine, arcanaKeys });
      if (evaluation.kind !== 'figurineArcana' || !evaluation.result.selectedPossible) continue;
      if (evaluation.result.findings.length > 0) continue;
      if (this.apply({ kind: 'ReplaceFigurineArcana', figurine, arcanaKeys })) return true;
    }
    return false;
  }

  private judgment(
    judgment: Extract<SemanticAddress, { readonly kind: 'judgmentArcana' }>,
  ): boolean {
    const probe = this.evaluate({ kind: 'judgmentArcana', judgment, arcanaKeys: [] });
    if (probe.kind !== 'judgmentArcana') return false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const arcanaKeys = this.shuffle(probe.result.inactiveArcanaKeys).slice(
        0,
        probe.result.requiredCount,
      );
      const evaluation = this.evaluate({ kind: 'judgmentArcana', judgment, arcanaKeys });
      if (evaluation.kind !== 'judgmentArcana' || !evaluation.result.selectedPossible) continue;
      if (evaluation.result.findings.length > 0) continue;
      if (this.apply({ kind: 'ReplaceJudgmentArcana', judgment, arcanaKeys })) return true;
    }
    return false;
  }

  private hexActivation(
    acquisition: Extract<SemanticAddress, { readonly kind: 'acquisitionRole' }>,
  ): boolean {
    const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
      this.assembly,
      acquisition,
    )?.hexActivation;
    if (capability === undefined) return false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const selectedNodeKeys: string[] = [];
      while (selectedNodeKeys.length < capability.count) {
        const available = capability.availableNodeKeys(selectedNodeKeys);
        if (available.length === 0) break;
        selectedNodeKeys.push(this.shuffle(available)[0]!);
      }
      if (capability.assess(selectedNodeKeys).length > 0) continue;
      if (this.apply({ kind: 'ReplaceHexActivation', acquisition, value: { selectedNodeKeys } }))
        return true;
    }
    return false;
  }

  private levelResolution(
    levelResolution: Extract<SemanticAddress, { readonly kind: 'levelResolution' }>,
  ): boolean {
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(
      this.assembly,
      levelResolution,
    );
    if (capability === undefined) return false;
    for (const [branchIndex, branch] of capability.branches.entries()) {
      const targets = this.shuffle(branch.eligibleTargetTraitKeys);
      const offered = targets.slice(0, branch.requiredOfferCount);
      for (const targetTraitKey of branch.effectKind === 'choice' ? offered : targets) {
        const value =
          branch.effectKind === 'random'
            ? ({ kind: 'random', targetTraitKey } as const)
            : ({
                kind: 'choice',
                offeredTraitKeys: offered,
                selectedTraitKey: targetTraitKey,
              } as const);
        if (capability.evaluate(value)[branchIndex]?.supported !== true) continue;
        if (
          this.apply(
            this.echoWrapped(levelResolution.owner, {
              kind: 'ReplaceLevelResolution',
              levelResolution,
              value,
            }),
          )
        )
          return true;
      }
    }
    return false;
  }
}
