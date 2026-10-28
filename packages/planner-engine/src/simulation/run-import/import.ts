import type { Catalog } from '../../catalog-schema';
import {
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type SemanticAddress,
} from '../../authored-project';
import type { RunRecord } from '../../run-record/model';
import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
} from '../candidates/session';
import { settleCommandUnlessRefused } from '../edit-settlement';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import type { SemanticFinding } from '../model';
import { RunImportGuesser } from './guess';
import { answerNemesis, guessNemesisEvent } from './nemesis';
import { occurrenceIdOf, RecordOccurrences } from './occurrences';
import type {
  RunImportArea,
  RunImportReason,
  RunImportReport,
  RunImportReportEntry,
  RunImportStop,
} from './report';
import { answerHub, importSideRoomVisits } from './hub';
import { answerTopology } from './topology';
import { answerReward } from './rewards';
import { answerLevelResolution, answerSteadyGrowth, answerTraitOffer } from './trait-offers';
import { answerArcanaGrant } from './arcana';
import { importDispositions, reportUnplacedDispositions } from './dispositions';
import { importRoomActionOrders } from './action-order';
import { importEncounters } from './encounters';
import { answerCommerce, importCommerce } from './commerce';
import { answerFeatures, importFeatures, recordedHexTree, reportDenialBans } from './features';
import { answerFields, importFieldsRooms } from './fields';
import { answerWheels, importWheelConversions, importWheels } from './wheels';
import { areaOfFinding, isQuestionFinding } from './areas';
import { importResourcePlacements } from './resources';
import { routeKeyForRecord } from './vocabulary';
import { compareImportToRecord } from './conformance';

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

const findingKey = (finding: SemanticFinding) =>
  `${finding.code} ${semanticAddressKey(finding.origin)}`;

/** Rooms the assessment has entered; an earlier stop shrinks them. */
const enteredRoomCount = (assembly: ProjectEvaluationAssembly) =>
  assembly.evaluation.route.biomes.reduce(
    (count, biome) => count + ('history' in biome ? biome.history.rooms.length : 0),
    0,
  );

/** Guesses one question may take; one it keeps surviving cannot be settled. */
const MAX_GUESSES_PER_ISSUE = 3;

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
  /** Whether evaluation has entered the occurrence. */
  readonly entered: (occurrenceId: string) => boolean;
  /** Whether an entered occurrence changed, or was entered, since the previous sweep. */
  readonly pending: (occurrenceId: string) => boolean;
  readonly note: (entry: RunImportReportEntry) => void;
  /** Record facts already authored, so each is used once: screens, encounter phases. */
  readonly used: Set<string>;
  /** Marks that the record answered the current question but the engine refused the value. */
  readonly refuse: () => void;
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
 * assessment issue like Draft: each question is answered from the record and
 * validated by the engine; what the record cannot answer, or the engine
 * refuses, takes the first eligible candidate and is reported.
 */
export function projectFromRunRecord(catalog: Catalog, record: RunRecord): RunImport {
  const entries: RunImportReportEntry[] = [];
  const finish = (project: ProjectDocument, stop: RunImportStop | undefined): RunImport => {
    if (stop !== undefined)
      entries.push({
        area: stop.area,
        reason: 'stopped',
        ...(stop.address === undefined ? {} : { address: stop.address }),
        ...(stop.record === undefined ? {} : { record: stop.record }),
      });
    const report = Object.freeze({
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
    return Object.freeze(
      stop === undefined
        ? { kind: 'complete' as const, project, report }
        : { kind: 'stopped' as const, project, report, stop: Object.freeze(stop) },
    );
  };
  const routeKey = routeKeyForRecord(catalog, record);
  if (routeKey === undefined)
    return finish(
      createProjectDocument(catalog, {
        projectId: `run-${record.run.runCount}`,
        routeKey: catalog.routes.values[0]!.key,
      }),
      { area: record.route.dream ? 'dream' : 'route', code: 'unsupportedRoute' },
    );
  const route = catalog.routes.byKey[routeKey]!;
  const project = createProjectDocument(catalog, {
    projectId: `run-${record.run.runCount}`,
    routeKey,
    configuredBiomeCount: Math.min(record.route.biomes.length, route.biomeKeys.length),
  });
  const walk = new RunImportWalk(
    catalog,
    record,
    simulateProjectAssembly(catalog, project),
    entries,
  );
  walk.importLoadout();
  // Door and wheel rerolls are not modelled: the plan's stores keep the rewards they replaced.
  for (const [roomIndex, room] of record.rooms.entries())
    for (let count = 0; count < (room.rerolls ?? 0); count += 1)
      entries.push({ area: 'reroll', reason: 'unsupportedArea', record: { roomIndex, visit: 0 } });
  const stop = walk.run();
  walk.reportUnusedScreens(stop);
  entries.push(
    ...compareImportToRecord(
      catalog,
      record,
      walk.occurrences,
      walk.assembly,
      stop === undefined ? record.rooms.length : (stop.record?.roomIndex ?? 0),
    ),
  );
  return finish(walk.assembly.project, stop);
}

class RunImportWalk {
  private session: ProjectCandidateSession | undefined;
  private refusedAnswer = false;
  private guesser: RunImportGuesser | undefined;
  private readonly retractions = new Map<
    string,
    { readonly undo: ProjectCommand; readonly entry: RunImportReportEntry }
  >();
  readonly occurrences: RecordOccurrences;
  private readonly context: RunImportContext;

  constructor(
    readonly catalog: Catalog,
    readonly record: RunRecord,
    public assembly: ProjectEvaluationAssembly,
    private readonly entries: RunImportReportEntry[],
  ) {
    this.occurrences = new RecordOccurrences(catalog, record);
    this.context = {
      catalog,
      record,
      occurrences: this.occurrences,
      assembly: () => this.assembly,
      candidates: () => this.candidates(),
      apply: (command) => this.apply(command),
      applyValid: (command) => this.transaction(() => this.apply(command)),
      transaction: (run) => this.transaction(run),
      entered: (occurrenceId) => this.enteredOccurrences().has(occurrenceId),
      pending: (occurrenceId) =>
        this.dirty.has(occurrenceId) && this.enteredOccurrences().has(occurrenceId),
      note: (entry) => this.entries.push(entry),
      used: new Set(),
      refuse: () => {
        this.refusedAnswer = true;
      },
      retractable: (owners, undo, entry) => {
        for (const owner of owners)
          this.retractions.set(semanticAddressKey(owner), { undo, entry });
      },
    };
  }

  private candidates(): ProjectCandidateSession {
    return (this.session ??= createPreparedProjectCandidateSession(this.catalog, this.assembly));
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
    if (!run()) return this.rollback(before);
    const ownerKey = (finding: SemanticFinding) => semanticAddressKey(finding.origin);
    const stop = new Set(before.evaluation.issue?.reasons.map(ownerKey) ?? []);
    const known = new Set(before.evaluation.findings.map(findingKey));
    const enteredBefore = this.enteredOccurrences(before);
    const added = () =>
      this.assembly.evaluation.findings.filter(
        (finding) => !known.has(findingKey(finding)) && !isQuestionFinding(finding),
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
      if (!this.apply(retraction.undo)) return this.rollback(before);
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
    return this.rollback(before);
  }

  private rollback(before: ProjectEvaluationAssembly): false {
    this.assembly = before;
    this.session = undefined;
    return false;
  }

  apply(command: ProjectCommand): boolean {
    const settled = settleCommandUnlessRefused(this.catalog, this.assembly, command);
    if (settled === undefined) return false;
    this.assembly = settled;
    this.session = undefined;
    return true;
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
    const end = stop === undefined ? this.record.rooms.length : (stop.record?.roomIndex ?? 0);
    for (const [roomIndex, room] of this.record.rooms.slice(0, end).entries())
      for (const position of room.traitScreens.keys())
        if (!this.context.used.has(`screen:${roomIndex}:${position}`))
          this.entries.push({
            area: 'traitOffer',
            reason: 'unsupportedArea',
            record: { roomIndex, visit: 0 },
          });
  }

  /** Weapon, aspect, familiar, starting keepsake, Arcana and Fear, each validated by its command. */
  importLoadout(): void {
    const { loadout } = this.record;
    const route = createRouteAddress(this.assembly.project.route.routeKey);
    const tryApply = (command: ProjectCommand) => {
      if (!this.apply(command)) this.report('loadout', 'refused', route, command);
    };
    const aspectKey = loadout.aspect?.name;
    if (aspectKey !== undefined)
      tryApply({ kind: 'ReplaceRouteLoadout', route, weaponKey: loadout.weapon, aspectKey });
    else this.report('loadout', 'notInRecord', route);
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
   * owner, is answered from the record once and guessed a bounded number of
   * times, so the walk is bounded by the plan's distinct questions.
   */
  run(): RunImportStop | undefined {
    const answered = new Set<string>();
    const refused = new Set<string>();
    const guessCounts = new Map<string, number>();
    let ordered = false;
    for (;;) {
      // Optional authorship the route never asks for settles before the next question.
      for (let before; before !== this.assembly;) {
        before = this.assembly;
        this.occurrences.bindEngineOccurrences(this.assembly.project);
        this.markDirty();
        importEncounters(this.context);
        importDispositions(this.context);
        importSideRoomVisits(this.context);
        importCommerce(this.context);
        importFeatures(this.context);
        importWheels(this.context);
        importWheelConversions(this.context);
        importFieldsRooms(this.context);
        importResourcePlacements(this.context);
      }
      const issue = this.assembly.evaluation.issue;
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
      } else if (!guessCounts.has(key)) {
        // The record's answer applied, but the question survived it.
        refused.add(key);
      }
      const guessed = (guessCounts.get(key) ?? 0) + 1;
      guessCounts.set(key, guessed);
      if (
        guessed <= MAX_GUESSES_PER_ISSUE &&
        this.guess(reason, refused.has(key) ? 'refused' : 'notInRecord')
      )
        continue;
      const record = this.occurrences.locationOf(reason.origin);
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
      answerLevelResolution(this.context, reason) ||
      answerSteadyGrowth(this.context, reason)
    );
  }

  private guess(reason: SemanticFinding, fallback: RunImportReason): boolean {
    let commands: readonly ProjectCommand[] | undefined;
    this.guesser ??= new RunImportGuesser(this.catalog, this.assembly.project, this.assembly);
    const result = this.guesser.guess(this.assembly);
    if (result !== undefined) {
      this.assembly = result.assembly;
      this.session = undefined;
      commands = result.commands;
    } else commands = guessNemesisEvent(this.context, reason);
    if (commands === undefined) return false;
    const area = areaOfFinding(reason);
    // Required actions take their native schedule when no trait timestamp orders them.
    const why = area === 'roomActionOrder' ? 'assumption' : fallback;
    for (const command of commands) this.report(area, why, reason.origin, command);
    return true;
  }
}
