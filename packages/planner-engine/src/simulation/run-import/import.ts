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
import { guessNemesisEvent } from './nemesis';
import { RecordOccurrences } from './occurrences';
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
import { answerLevelResolution, answerTraitOffer } from './trait-offers';
import {
  importDispositions,
  reportRoomActionOrders,
  reportUnplacedDispositions,
} from './dispositions';
import { importEncounters } from './encounters';
import { areaOfFinding } from './areas';
import { routeKeyForRecord } from './vocabulary';

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
  readonly note: (entry: RunImportReportEntry) => void;
  /** Record facts already authored, so each is used once: screens, encounter phases. */
  readonly used: Set<string>;
  /** Marks that the record answered the current question but the engine refused the value. */
  readonly refuse: () => void;
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
  const stop = walk.run();
  return finish(walk.assembly.project, stop);
}

class RunImportWalk {
  private session: ProjectCandidateSession | undefined;
  private refusedAnswer = false;
  private guesser: RunImportGuesser | undefined;
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
      note: (entry) => this.entries.push(entry),
      used: new Set(),
      refuse: () => {
        this.refusedAnswer = true;
      },
    };
  }

  private candidates(): ProjectCandidateSession {
    return (this.session ??= createPreparedProjectCandidateSession(this.catalog, this.assembly));
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
    for (;;) {
      this.occurrences.bindEngineOccurrences(this.assembly.project);
      importEncounters(this.context);
      importDispositions(this.context);
      importSideRoomVisits(this.context);
      const issue = this.assembly.evaluation.issue;
      if (issue === undefined) {
        reportUnplacedDispositions(this.context);
        reportRoomActionOrders(this.context);
        return undefined;
      }
      const reason = issue.reasons[0]!;
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
      answerTopology(this.context, reason) ||
      answerReward(this.context, reason) ||
      answerTraitOffer(this.context, reason) ||
      answerLevelResolution(this.context, reason)
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
    const why =
      area === 'roomActionOrder'
        ? 'assumption'
        : unreadAreas.has(area)
          ? 'unsupportedArea'
          : fallback;
    for (const command of commands) this.report(area, why, reason.origin, command);
    return true;
  }
}

/** Areas the importer does not yet read from the record; their questions are guessed. */
const unreadAreas: ReadonlySet<RunImportArea> = new Set([
  'shop',
  'well',
  'pool',
  'anvil',
  'embryo',
  'pathOfStars',
  'chaosGate',
  'rack',
  'fountain',
  'wheel',
  'fields',
  'npc',
  'menace',
]);
