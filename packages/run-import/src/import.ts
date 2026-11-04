import {
  assessPublicDreamItinerary,
  createBiomeAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { createAuthoringSession, type AuthoringSession } from '@run-planner/engine/authoring';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  type ProjectCandidateSession,
  findingsAddedSince,
  planEndAvailability,
  type ProjectEvaluationAssembly,
  simulateProjectAssembly,
  type SemanticFinding,
  type SettlementFault,
} from '@run-planner/engine/simulation';
import type { RunRecord } from './run-record/model';
import { answerNemesis } from './nemesis';
import { answerByAcceptance } from './open-questions';
import { occurrenceIdOf, RecordOccurrences } from './occurrences';
import type {
  RunImportArea,
  RunImportEnd,
  RunImportReason,
  RunImportReport,
  RunImportReportEntry,
  RunImportRoomAcceptance,
  RunImportStop,
} from './report';
import { answerHub, importPhantomExits, importSideRoomVisits } from './hub';
import { answerTopology } from './topology';
import { answerReward } from './rewards';
import { answerLevelResolution, answerSteadyGrowth, answerTraitOffer } from './trait-offers';
import { answerArcanaGrant } from './arcana';
import {
  answerCarrierChild,
  importMaxHealthRolls,
  unansweredMaxHealthRolls,
  type MaxHealthRollQuestion,
} from './carrier-children';
import { importDispositions, reportUnplacedDispositions } from './dispositions';
import { importRoomActionOrders } from './action-order';
import { importEncounters } from './encounters';
import { answerCommerce, importCommerce } from './commerce';
import { answerFeatures, importFeatures, recordedHexTree, reportDenialBans } from './features';
import { answerFields, importFieldsConversions, importFieldsRooms } from './fields';
import {
  answerWheels,
  importWheelConversions,
  importWheels,
  releaseOpenWheelWindows,
  solveWheelOffers,
  unsolvedWheels,
} from './wheels';
import { areaOfFinding, areaOfOwner, isQuestionFinding } from './areas';
import { importResourcePlacements } from './resources';
import { unsupportedChallengeSwitches } from './room-uses';
import { routeKeyForRecord } from './vocabulary';
import { compareEntrySaves, entrySaves, mismatchEntries, type EntrySaves } from './conformance';
import { judgeRoom, judgeRooms } from './acceptance';
import {
  importRerolls,
  unplacedStoreScreenRerolls,
  unreachedRerolls,
  unsupportedScreenRerolls,
} from './rerolls';

/**
 * A complete import settles every question; a stopped one ends its plan before
 * the question nothing could settle. Either way the report lists every value
 * the record did not answer exactly, the stop included.
 */
export type RunImport =
  | {
      readonly kind: 'complete';
      readonly project: ProjectDocument;
      readonly report: RunImportReport;
    }
  | {
      readonly kind: 'stopped';
      readonly project: ProjectDocument;
      readonly report: RunImportReport;
      readonly stop: RunImportStop;
    };

/** Rooms the assessment has entered; an earlier stop shrinks them. */
const enteredRoomCount = (assembly: ProjectEvaluationAssembly) =>
  assembly.evaluation.route.biomes.reduce(
    (count, biome) => count + ('history' in biome ? biome.history.rooms.length : 0),
    0,
  );

/** Choices one question may take; one it keeps surviving cannot be settled. */
const MAX_CHOICES_PER_ISSUE = 3;

/** What each area's answerer borrows from the import walk. */
export interface RunImportContext {
  readonly catalog: Catalog;
  readonly record: RunRecord;
  readonly occurrences: RecordOccurrences;
  readonly assembly: () => ProjectEvaluationAssembly;
  readonly candidates: () => ProjectCandidateSession;
  /** Applies one command through edit settlement; false when it is refused or changes nothing. */
  readonly apply: (command: ProjectCommand) => boolean;
  /** Applies one command unless it is refused or adds a finding other than missing input. */
  readonly applyValid: (command: ProjectCommand) => boolean;
  /** Runs several applications as one, kept only when they succeed and stay valid as `applyValid`. */
  readonly transaction: (run: () => boolean) => boolean;
  /**
   * Runs `run` against the plan and then undoes all of it, its authorship,
   * report entries, used record facts, claimed kills, occurrence bindings and
   * withdrawn retractions included, returning its result.
   */
  readonly probe: <Result>(run: () => Result) => Result;
  /**
   * Answers from the record each question the plan asks inside the
   * occurrences `owns` names, as the walk would, until one is not answered;
   * inside `probe` it completes a candidate authoring of a room so the room
   * can be judged.
   */
  readonly settleQuestions: (owns: (occurrenceId: string) => boolean) => void;
  /** Authors the optional record facts the route never asks for, as the walk does before each question. */
  readonly sweep: () => void;
  /** Whether evaluation has entered the occurrence. */
  readonly entered: (occurrenceId: string) => boolean;
  /** Whether an entered occurrence changed, or was entered, since the previous sweep. */
  readonly pending: (occurrenceId: string) => boolean;
  readonly note: (entry: RunImportReportEntry) => void;
  /** Record facts already authored, so each is used once: screens, encounter phases. */
  readonly used: Set<string>;
  /** Picked max-health rolls waiting for their room's next entry save, by offer and row. */
  readonly maxHealthRolls: Map<string, MaxHealthRollQuestion>;
  /** Next-biome kills not yet claimed by a Menace conversion, per record room. */
  readonly unclaimedKills: Map<number, Map<string, number>>;
  /**
   * Judges a record room at its next entry save against the plan as it
   * stands; inside `probe`, it tests a candidate authoring of the room.
   */
  readonly acceptance: (roomIndex: number) => RunImportRoomAcceptance;
  /** Marks that the record answered the current question but the engine refused the value. */
  readonly refuse: () => void;
  /** Ends the walk at a record fact no answer can explain; the plan stops before it. */
  readonly halt: (stop: RunImportStop) => void;
  /**
   * Registers how to withdraw optional authorship whose finding only a later
   * stop reveals; the withdrawal is reported as refused under `entry`.
   */
  readonly retractable: (
    owners: readonly SemanticAddress[],
    undo: ProjectCommand,
    entry: RunImportReportEntry,
  ) => void;
}

/**
 * Imports an observed run as an ordinary plan. The walk follows the route's
 * assessment issue: each question is answered from the record and validated
 * by the engine; what the record cannot answer, or the engine refuses, takes
 * the engine-legal answer the room's next entry save accepts and is reported,
 * and without one the plan stops before it.
 */
export function projectFromRunRecord(catalog: Catalog, record: RunRecord): RunImport {
  const entries: RunImportReportEntry[] = [];
  const finish = (
    project: ProjectDocument,
    stop: RunImportStop | undefined,
    rooms: readonly RunImportRoomAcceptance[],
    end?: RunImportEnd,
  ): RunImport => {
    if (stop !== undefined)
      entries.push({
        area: stop.area,
        reason: 'stopped',
        ...(stop.address === undefined ? {} : { address: stop.address }),
        ...(stop.record === undefined ? {} : { record: stop.record }),
      });
    const report = Object.freeze({
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
      ...(end === undefined ? {} : { end: Object.freeze(end) }),
      rooms: Object.freeze(rooms.map((room) => Object.freeze(room))),
    });
    return Object.freeze(
      stop === undefined
        ? { kind: 'complete' as const, project, report }
        : { kind: 'stopped' as const, project, report, stop: Object.freeze(stop) },
    );
  };
  const routeKey = routeKeyForRecord(catalog, record);
  const itinerary = routeKey === undefined ? undefined : recordItinerary(catalog, routeKey, record);
  if (routeKey === undefined || itinerary === undefined)
    return finish(
      createProjectDocument(catalog, {
        projectId: `run-${record.run.runCount}`,
        routeKey: catalog.routes.values[0]!.key,
      }),
      { area: record.route.dream ? 'dream' : 'route', code: 'unsupportedRoute' },
      record.rooms.map((_, roomIndex) => ({ roomIndex, verdict: 'unchecked', reason: 'stopped' })),
    );
  const project = createProjectDocument(catalog, {
    projectId: `run-${record.run.runCount}`,
    routeKey,
    ...(catalog.routes.byKey[routeKey]!.dreamItinerary === undefined
      ? {}
      : { itineraryBiomeKeys: itinerary }),
    configuredBiomeCount: Math.min(record.route.biomes.length, itinerary.length),
  });
  const walk = new RunImportWalk(
    catalog,
    record,
    simulateProjectAssembly(catalog, project),
    entries,
  );
  walk.importLoadout();
  entries.push(
    ...unsupportedScreenRerolls(catalog, record),
    ...unsupportedChallengeSwitches(record),
  );
  const walked = walk.run();
  walk.reportUnusedScreens(walked);
  // A run that died or was abandoned in its last room never settled that room,
  // so a question there or past it is no stop: the plan ends before the room.
  const lastRoom = record.outcome.kind === 'victory' ? undefined : record.rooms.length - 1;
  const answered =
    walked !== undefined &&
    lastRoom !== undefined &&
    (walked.record?.roomIndex ?? record.rooms.length) >= lastRoom
      ? undefined
      : walked;
  walk.reportUnreachedRerolls();
  entries.push(...unansweredMaxHealthRolls(walk.context));
  // A stop past the record's rooms leaves every room judged where the plan reached it.
  const answeredThrough =
    answered === undefined
      ? record.rooms.length
      : (answered.record?.roomIndex ?? record.rooms.length);
  // The run state after a room whose next entry save differs is unknown, so the plan ends there.
  const mismatched = walk
    .finalAcceptance(answeredThrough)
    .find((room): room is JudgedRoom => room.verdict === 'mismatch');
  const stop = mismatched === undefined ? answered : entryMismatchStop(mismatched);
  const throughRoom = mismatched === undefined ? answeredThrough : mismatched.roomIndex + 1;
  entries.push(
    ...mismatchEntries(
      compareEntrySaves(catalog, record, walk.occurrences, walk.assembly, throughRoom),
    ),
  );
  // Every room is judged on the plan the walk built. A death or abandonment,
  // or an entry mismatch, then ends the plan after its last settled room
  // before it; a question the walk could not settle leaves the plan open there.
  const rooms = walk.finalAcceptance(throughRoom);
  const cause =
    mismatched !== undefined
      ? ('entryMismatch' as const)
      : answered !== undefined || record.outcome.kind === 'victory'
        ? undefined
        : record.outcome.kind;
  const endRoom =
    cause === undefined
      ? undefined
      : walk.endPlanBefore(
          mismatched !== undefined ? mismatched.roomIndex : record.rooms.length - 1,
        );
  return finish(
    walk.assembly.project,
    stop,
    rooms,
    cause === undefined || endRoom === undefined
      ? undefined
      : { cause, record: { roomIndex: endRoom, visit: 0 } },
  );
}

type JudgedRoom = Extract<RunImportRoomAcceptance, { readonly introduced: unknown }>;

/** The stop at a room whose next entry save the plan's state differs from. */
function entryMismatchStop(room: JudgedRoom): RunImportStop {
  const differences = [...room.introduced, ...room.carried];
  return {
    area: differences[0]!.area,
    code: 'entryMismatch',
    record: { roomIndex: room.roomIndex, visit: 0 },
    families: [...new Set(differences.map((difference) => difference.family))],
  };
}

/**
 * The route's biomes: its preset, or for a Dream run the biomes it visited,
 * filled to the itinerary's length with the first legal choices, which stay
 * unconfigured. Undefined when the visited biomes are no legal itinerary.
 */
function recordItinerary(
  catalog: Catalog,
  routeKey: string,
  record: RunRecord,
): readonly string[] | undefined {
  const route = catalog.routes.byKey[routeKey]!;
  if (route.dreamItinerary === undefined) return route.biomeKeys;
  const itinerary = [...record.route.biomes];
  for (;;) {
    const assessment = assessPublicDreamItinerary(catalog, itinerary);
    if (assessment.issues.length > 0) return undefined;
    if (assessment.complete) return itinerary;
    const next = assessment.nextChoices.find((choice) => choice.legal);
    if (next === undefined) return undefined;
    itinerary.push(next.biomeKey);
  }
}

export class RunImportWalk {
  private readonly authoring: AuthoringSession;
  private refusedAnswer = false;
  private halted: RunImportStop | undefined;
  private readonly retractions = new Map<
    string,
    { readonly undo: ProjectCommand; readonly entry: RunImportReportEntry }
  >();
  readonly occurrences: RecordOccurrences;
  readonly context: RunImportContext;
  private readonly saves: EntrySaves;
  /** Each room's verdict when the walk first reached its next entry save, in room order. */
  private readonly reached: RunImportRoomAcceptance[] = [];

  constructor(
    readonly catalog: Catalog,
    readonly record: RunRecord,
    start: ProjectEvaluationAssembly,
    private readonly entries: RunImportReportEntry[],
  ) {
    this.authoring = createAuthoringSession(catalog, start);
    this.occurrences = new RecordOccurrences(catalog, record);
    this.saves = entrySaves(record);
    this.context = {
      catalog,
      record,
      occurrences: this.occurrences,
      assembly: () => this.assembly,
      candidates: () => this.authoring.candidates(),
      apply: (command) => this.apply(command),
      applyValid: (command) => this.transaction(() => this.apply(command)),
      transaction: (run) => this.transaction(run),
      probe: (run) => this.probe(run),
      settleQuestions: (owns) => this.settleQuestions(owns),
      sweep: () => this.sweep(),
      entered: (occurrenceId) => this.enteredOccurrences().has(occurrenceId),
      pending: (occurrenceId) =>
        this.dirty.has(occurrenceId) && this.enteredOccurrences().has(occurrenceId),
      note: (entry) => this.entries.push(entry),
      used: new Set(),
      maxHealthRolls: new Map(),
      unclaimedKills: new Map(),
      acceptance: (roomIndex) => this.judge(roomIndex),
      refuse: () => {
        this.refusedAnswer = true;
      },
      halt: (stop) => {
        this.halted ??= stop;
      },
      retractable: (owners, undo, entry) => {
        for (const owner of owners)
          this.retractions.set(semanticAddressKey(owner), { undo, entry });
      },
    };
  }

  get assembly(): ProjectEvaluationAssembly {
    return this.authoring.current();
  }

  private judge(roomIndex: number): RunImportRoomAcceptance {
    return judgeRoom(
      this.catalog,
      this.record,
      this.saves,
      this.occurrences,
      this.assembly,
      roomIndex,
    );
  }

  /**
   * Accepts, in room order, each room whose next entry save the plan now
   * reaches, keeping its verdict at that moment.
   */
  private acceptReachedRooms(): void {
    for (
      let roomIndex = this.reached.length;
      roomIndex < this.record.rooms.length;
      roomIndex += 1
    ) {
      const acceptance = this.judge(roomIndex);
      if (acceptance.verdict === 'unchecked' && acceptance.reason === 'unreached') return;
      this.reached.push(acceptance);
    }
  }

  /**
   * Every room judged against the final plan, through `throughRoom`. A room
   * whose verdict later authoring changed also names the one it was accepted with.
   */
  finalAcceptance(throughRoom: number): readonly RunImportRoomAcceptance[] {
    return judgeRooms(
      this.catalog,
      this.record,
      this.saves,
      this.occurrences,
      this.assembly,
      throughRoom,
    ).map((room) => {
      const reached = this.reached[room.roomIndex];
      return room.verdict !== 'unchecked' &&
        reached !== undefined &&
        reached.verdict !== 'unchecked' &&
        reached.verdict !== room.verdict
        ? { ...room, whenReached: reached.verdict }
        : room;
    });
  }

  private dirty = new Set<string>();
  private readonly seen = new Map<string, unknown>();
  private seenBindings = -1;

  /** Occurrences whose authored state changed, or that were entered or rebound, since the last sweep. */
  private markDirty(): void {
    const entered = this.enteredOccurrences();
    const rebound = this.occurrences.bindings !== this.seenBindings;
    this.seenBindings = this.occurrences.bindings;
    const dirty = new Set<string>();
    for (const biome of this.assembly.project.route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? []) {
        const id = occurrence.occurrenceId;
        const marker = entered.has(id) ? occurrence : undefined;
        if (rebound || this.seen.get(id) !== marker) dirty.add(id);
        this.seen.set(id, marker);
      }
    this.dirty = dirty;
  }

  private enteredCache:
    { assembly: ProjectEvaluationAssembly; ids: ReadonlySet<string> } | undefined;

  private enteredOccurrences(assembly = this.assembly): ReadonlySet<string> {
    if (this.enteredCache?.assembly === assembly) return this.enteredCache.ids;
    const ids = new Set<string>();
    for (const biome of assembly.evaluation.route.biomes)
      if ('history' in biome)
        for (const room of biome.history.rooms)
          if (room.origin.kind === 'occurrence') ids.add(room.origin.occurrenceId);
    if (assembly === this.assembly) this.enteredCache = { assembly, ids };
    return ids;
  }

  /**
   * Keeps what `run` applied unless it adds a finding the walk cannot answer
   * as a question. Settling the current stop may reveal the next one, but only
   * in a room the walk had not yet entered.
   */
  transaction(run: () => boolean): boolean {
    const before = this.assembly;
    const mark = this.entries.length;
    if (!run()) return this.rollback(before, mark);
    const ownerKey = (finding: SemanticFinding) => semanticAddressKey(finding.origin);
    const stop = new Set(before.evaluation.issue?.reasons.map(ownerKey) ?? []);
    const enteredBefore = this.enteredOccurrences(before);
    const added = () =>
      findingsAddedSince(before.evaluation.findings, this.assembly.evaluation.findings).filter(
        (finding) => !isQuestionFinding(finding),
      );
    const inEnteredRoom = (finding: SemanticFinding) => {
      const occurrenceId = occurrenceIdOf(finding.origin);
      return occurrenceId === undefined || enteredBefore.has(occurrenceId);
    };
    // Revealing a stop in an entered room is only acceptable where it withdraws
    // optional authorship that was registered as retractable.
    const withdrawn: string[] = [];
    for (const finding of added().filter(inEnteredRoom)) {
      const retraction = this.retractions.get(ownerKey(finding));
      if (retraction === undefined) continue;
      if (!this.apply(retraction.undo)) return this.rollback(before, mark);
      withdrawn.push(ownerKey(finding));
    }
    const remaining = added();
    if (
      remaining.length === 0 ||
      (stop.size > 0 &&
        !remaining.some(inEnteredRoom) &&
        this.assembly.evaluation.findings.every((finding) => !stop.has(ownerKey(finding))) &&
        enteredRoomCount(this.assembly) >= enteredRoomCount(before))
    ) {
      for (const key of withdrawn) {
        this.entries.push({ ...this.retractions.get(key)!.entry, reason: 'refused' });
        this.retractions.delete(key);
      }
      return true;
    }
    return this.rollback(before, mark);
  }

  probe<Result>(run: () => Result): Result {
    const entries = this.entries.length;
    const retractions = new Map(this.retractions);
    const refusedAnswer = this.refusedAnswer;
    const halted = this.halted;
    const used = new Set(this.context.used);
    const maxHealthRolls = new Map(this.context.maxHealthRolls);
    const unclaimedKills = [...this.context.unclaimedKills].map(
      ([roomIndex, kills]) => [roomIndex, new Map(kills)] as const,
    );
    const restoreBindings = this.occurrences.savepoint();
    const dirty = this.dirty;
    const seen = new Map(this.seen);
    const seenBindings = this.seenBindings;
    try {
      return this.authoring.probe(run);
    } finally {
      this.entries.length = entries;
      this.retractions.clear();
      for (const [key, retraction] of retractions) this.retractions.set(key, retraction);
      this.refusedAnswer = refusedAnswer;
      this.halted = halted;
      this.context.used.clear();
      for (const key of used) this.context.used.add(key);
      this.context.maxHealthRolls.clear();
      for (const [key, roll] of maxHealthRolls) this.context.maxHealthRolls.set(key, roll);
      this.context.unclaimedKills.clear();
      for (const [roomIndex, kills] of unclaimedKills)
        this.context.unclaimedKills.set(roomIndex, new Map(kills));
      restoreBindings();
      this.dirty = dirty;
      this.seen.clear();
      for (const [key, marker] of seen) this.seen.set(key, marker);
      this.seenBindings = seenBindings;
    }
  }

  /** Optional authorship the route never asks for, settled before the next question. */
  private sweep(): void {
    for (let before; before !== this.assembly;) {
      before = this.assembly;
      this.occurrences.bindEngineOccurrences(this.assembly.project);
      this.markDirty();
      // A bracket's rerolls rewrite its draws before the entered room's pickup is answered.
      importRerolls(this.context);
      importEncounters(this.context);
      importDispositions(this.context);
      importSideRoomVisits(this.context);
      importPhantomExits(this.context);
      importCommerce(this.context);
      importFeatures(this.context);
      importWheels(this.context);
      importWheelConversions(this.context);
      // A ship room's rerolls wait for its unpicked offers, so a closed window sweeps again.
      if (solveWheelOffers(this.context)) before = undefined;
      importFieldsRooms(this.context);
      importFieldsConversions(this.context);
      importResourcePlacements(this.context);
      importMaxHealthRolls(this.context);
    }
  }

  private settleQuestions(owns: (occurrenceId: string) => boolean): void {
    const asked = new Set<string>();
    for (;;) {
      const reason = this.assembly.evaluation.issue?.reasons[0];
      const occurrenceId = reason === undefined ? undefined : occurrenceIdOf(reason.origin);
      if (
        reason === undefined ||
        !isQuestionFinding(reason) ||
        occurrenceId === undefined ||
        !owns(occurrenceId)
      )
        return;
      // Each question is answered once; one that survives its answer stays open.
      const key = `${reason.code} ${semanticAddressKey(reason.origin)}`;
      if (asked.has(key)) return;
      asked.add(key);
      if (!this.answer(reason)) return;
    }
  }

  /** Restores `before`, dropping the faults of applications made since `mark`. */
  private rollback(before: ProjectEvaluationAssembly, mark: number): false {
    this.authoring.restore(before);
    const kept = this.entries.slice(mark).filter((entry) => entry.reason !== 'engineFault');
    this.entries.length = mark;
    this.entries.push(...kept);
    return false;
  }

  /**
   * Ends the plan after the latest record room before `before` the engine can
   * end it at: settled, valid and on the path. Returns that room, if any.
   */
  endPlanBefore(before: number): number | undefined {
    const route = createRouteAddress(this.assembly.project.route.routeKey);
    for (let roomIndex = before - 1; roomIndex >= this.occurrences.prologue; roomIndex -= 1) {
      const room = createOccurrenceAddress(
        createBiomeAddress(route.routeKey, this.occurrences.biomeOfRoom[roomIndex]!),
        this.occurrences.occurrenceOf(roomIndex),
      );
      if (!planEndAvailability(this.catalog, this.assembly, room).available) continue;
      if (
        this.apply({
          kind: 'ReplacePlanEnd',
          route,
          planEnd: { biomeKey: room.biomeKey, occurrenceId: room.occurrenceId },
        })
      )
        return roomIndex;
    }
    return undefined;
  }

  /** Settles one command; false when it is refused or changes nothing. A settlement fault is reported and the command kept. */
  apply(command: ProjectCommand): boolean {
    const outcome = this.authoring.apply(command);
    if (outcome.kind !== 'applied') return false;
    if (outcome.fault !== undefined) this.reportFault(outcome.fault);
    return true;
  }

  private reportFault(fault: SettlementFault): void {
    this.report(areaOfOwner(fault.owner), 'engineFault', fault.owner);
  }

  private report(
    area: RunImportArea,
    reason: RunImportReason,
    address?: SemanticAddress,
    applied?: ProjectCommand,
  ): void {
    const record = address === undefined ? undefined : this.occurrences.locationOf(address);
    this.entries.push({
      area,
      reason,
      ...(address === undefined ? {} : { address }),
      ...(applied === undefined ? {} : { applied }),
      ...(record === undefined ? {} : { record }),
    });
  }

  /**
   * Recorded trait screens no answer consumed, in rooms before any stop: the
   * plan holds none of their picks.
   */
  reportUnusedScreens(stop: RunImportStop | undefined): void {
    const end =
      stop === undefined
        ? this.record.rooms.length
        : (stop.record?.roomIndex ?? this.record.rooms.length);
    for (const [roomIndex, room] of this.record.rooms.slice(0, end).entries())
      for (const position of room.traitScreens.keys())
        if (!this.context.used.has(`screen:${roomIndex}:${position}`))
          this.entries.push({
            area: 'traitOffer',
            reason: 'unsupportedArea',
            record: { roomIndex, visit: 0 },
          });
  }

  /**
   * Door rerolls and unpicked wheel offers in rooms whose bracket the walk
   * never closed, and Well or Pool rerolls no screen took.
   */
  reportUnreachedRerolls(): void {
    this.entries.push(
      ...unreachedRerolls(this.context),
      ...unsolvedWheels(this.context),
      ...unplacedStoreScreenRerolls(this.context),
    );
  }

  /**
   * Weapon, aspect, familiar, starting keepsake, Arcana and Fear, each validated by its command.
   * A fresh-profile route fixes all of them, so the record authors none. A refused weapon and
   * aspect stops the plan before its first room: no room is played on the route's default kit.
   */
  importLoadout(): void {
    const { loadout } = this.record;
    const route = createRouteAddress(this.assembly.project.route.routeKey);
    if (this.catalog.routes.byKey[route.routeKey]!.initialProfile.kind === 'freshFile') return;
    const tryApply = (command: ProjectCommand) => {
      if (this.apply(command)) return true;
      this.report('loadout', 'refused', route, command);
      return false;
    };
    const { weapon: weaponKey } = loadout;
    const aspectKey = loadout.aspect?.name;
    if (weaponKey === undefined || aspectKey === undefined)
      this.report('loadout', 'notInRecord', route);
    else if (!tryApply({ kind: 'ReplaceRouteLoadout', route, weaponKey, aspectKey })) {
      this.halted = {
        area: 'loadout',
        code: 'refused',
        address: route,
        record: { roomIndex: 0, visit: 0 },
      };
      return;
    }
    // Aspect of Selene's rolled Hex tree is the run's first Spell snapshot; its talents never change.
    if (this.assembly.project.route.loadout.aspectHexTree !== undefined) {
      const spell = this.record.rooms.find((room) => room.spell !== undefined)?.spell;
      const value =
        spell === undefined
          ? undefined
          : recordedHexTree(this.catalog, 'SpellMoonBeamTrait', spell);
      if (value === undefined) this.report('pathOfStars', 'notInRecord', route);
      else tryApply({ kind: 'ReplaceAspectHexTree', route, value });
    }
    if (loadout.familiar !== undefined)
      tryApply({ kind: 'ReplaceFamiliar', route, familiarKey: loadout.familiar.name });
    if (loadout.keepsake !== undefined)
      tryApply({
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress(route.routeKey),
        keepsakeKey: loadout.keepsake.name,
      });
    tryApply({
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: loadout.arcana
        .map((card) => card.name)
        .filter((key) => this.catalog.arcanaCards.byKey[key]?.activation.kind === 'manual'),
    });
    for (const [vowKey, rank] of Object.entries(loadout.vows))
      if (rank !== (this.assembly.project.route.loadout.fearRanks[vowKey] ?? 0))
        tryApply({ kind: 'ReplaceFearVowRank', route, vowKey, rank });
  }

  /**
   * Answers the route's issue until none remains. Each question, by code and
   * owner, is answered from the record once and chosen by acceptance a bounded
   * number of times, so the walk is bounded by the plan's distinct questions.
   */
  run(): RunImportStop | undefined {
    const answered = new Set<string>();
    const refused = new Set<string>();
    const choiceCounts = new Map<string, number>();
    let ordered = false;
    for (;;) {
      this.sweep();
      this.acceptReachedRooms();
      if (this.halted !== undefined) {
        // Rooms before a stop take their stamped action order too.
        if (!ordered) {
          ordered = true;
          const before = this.assembly;
          importRoomActionOrders(this.context);
          if (this.assembly !== before) continue;
        }
        return this.halted;
      }
      const issue = this.assembly.evaluation.issue;
      // A ship window still open as the walk ends never closes; its waiting pickups are authored.
      if (issue === undefined && releaseOpenWheelWindows(this.context)) continue;
      if (issue === undefined) {
        // Ordering by trait times runs once the plan is complete; a question it reveals is answered next.
        if (!ordered) {
          ordered = true;
          const before = this.assembly;
          importRoomActionOrders(this.context);
          if (this.assembly !== before) continue;
        }
        reportUnplacedDispositions(this.context);
        reportDenialBans(this.context);
        return undefined;
      }
      const reason = issue.reasons[0]!;
      const retraction = this.retractions.get(semanticAddressKey(reason.origin));
      if (retraction !== undefined && !isQuestionFinding(reason)) {
        this.retractions.delete(semanticAddressKey(reason.origin));
        this.entries.push({ ...retraction.entry, reason: 'refused' });
        if (this.apply(retraction.undo)) continue;
        // The withdrawal itself was refused: the invalid authorship stays and is reported again.
        this.entries.push({ ...retraction.entry, reason: 'refused', applied: retraction.undo });
      }
      const key = `${reason.code} ${semanticAddressKey(reason.origin)}`;
      if (!answered.has(key)) {
        answered.add(key);
        this.refusedAnswer = false;
        if (this.answer(reason)) continue;
        if (this.refusedAnswer) refused.add(key);
      } else if (!choiceCounts.has(key)) {
        // The record's answer applied, but the question survived it.
        refused.add(key);
      }
      const chosen = (choiceCounts.get(key) ?? 0) + 1;
      choiceCounts.set(key, chosen);
      if (
        chosen <= MAX_CHOICES_PER_ISSUE &&
        this.chooseByAcceptance(reason, refused.has(key) ? 'refused' : 'notInRecord')
      )
        continue;
      const record = this.occurrences.locationOf(reason.origin);
      if (releaseOpenWheelWindows(this.context, record?.roomIndex)) continue;
      // Rooms before the stop take their stamped action order too.
      if (!ordered) {
        ordered = true;
        const before = this.assembly;
        importRoomActionOrders(this.context);
        if (this.assembly !== before) continue;
      }
      return {
        area: areaOfFinding(reason),
        code: reason.code,
        address: reason.origin,
        ...(record === undefined ? {} : { record }),
      };
    }
  }

  private answer(reason: SemanticFinding): boolean {
    return (
      answerHub(this.context, reason) ||
      answerCommerce(this.context, reason) ||
      answerFeatures(this.context, reason) ||
      answerWheels(this.context, reason) ||
      answerFields(this.context, reason) ||
      answerNemesis(this.context, reason) ||
      answerArcanaGrant(this.context, reason) ||
      answerTopology(this.context, reason) ||
      answerReward(this.context, reason) ||
      answerTraitOffer(this.context, reason) ||
      answerCarrierChild(this.context, reason) ||
      answerLevelResolution(this.context, reason) ||
      answerSteadyGrowth(this.context, reason)
    );
  }

  /**
   * A question the record cannot answer takes the engine-legal answer its
   * room's next entry save accepts; without one it stays open.
   */
  private chooseByAcceptance(reason: SemanticFinding, fallback: RunImportReason): boolean {
    const answer = answerByAcceptance(this.context, reason);
    if (answer === undefined) return false;
    const area = areaOfFinding(reason);
    const record = this.occurrences.locationOf(reason.origin);
    // Other accepted answers leave run states the record cannot tell apart.
    for (const command of answer.commands)
      this.entries.push({
        area,
        reason: fallback,
        address: reason.origin,
        applied: command,
        ...(answer.alternatives.length === 0 ? {} : { alternatives: answer.alternatives }),
        ...(record === undefined ? {} : { record }),
      });
    return true;
  }
}
