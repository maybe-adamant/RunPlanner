import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { TARGET_KINDS, type DraftCorpusRun } from './measure';
import { draftCorpusBaselinePath, draftCorpusRunsDirectory } from './paths';

/** Per-spec aggregates: rates over drafted runs, medians and means; never plans. */
interface SpecSummary {
  readonly runs: number;
  readonly drafted: number;
  readonly targets: Readonly<Record<string, number>>;
  readonly orderInversionRuns: number;
  readonly orderInversionsMedian: number;
  readonly elementDeferredRuns: number;
  readonly essencesPerRun: number;
  readonly purchasesPerRun: Readonly<Record<string, number>>;
  readonly attemptsMedian: number;
  /** Across seeds, each basket trait's landing depth spread (stdev, rooms), averaged over traits. */
  readonly depthSpread?: number;
  /** Across seeds, each basket trait's distinct landing depths, averaged over traits. */
  readonly depthDistinct?: number;
  /** Taken god boon rooms per planned biome. */
  readonly godRoomsPerBiome?: number;
  /** Mean and per-run largest rooms between consecutive god boon rooms in a biome. */
  readonly godGapMean?: number;
  readonly godGapMax?: number;
  /** Share of god boon rooms in the first third of their biome's taken rooms. */
  readonly godEarlyShare?: number;
  readonly msMedian: number;
  readonly msMax: number;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Per basket trait landing in two or more seeds: depth stdev and distinct depths, averaged. */
function depthDiversity(drafted: readonly DraftCorpusRun[]): {
  readonly spread: number;
  readonly distinct: number;
} {
  const byTrait = new Map<string, number[]>();
  for (const run of drafted)
    for (const [traitKey, depth] of Object.entries(run.landingDepths ?? {}))
      (byTrait.get(traitKey) ?? byTrait.set(traitKey, []).get(traitKey)!).push(depth);
  const landed = [...byTrait.values()].filter((depths) => depths.length > 1);
  if (landed.length === 0) return { spread: 0, distinct: 0 };
  const stdev = (depths: readonly number[]) => {
    const mean = depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
    return Math.sqrt(depths.reduce((sum, d) => sum + (d - mean) ** 2, 0) / depths.length);
  };
  return {
    spread: round(landed.reduce((sum, depths) => sum + stdev(depths), 0) / landed.length),
    distinct: round(landed.reduce((sum, depths) => sum + new Set(depths).size, 0) / landed.length),
  };
}

function godRoomSummary(drafted: readonly DraftCorpusRun[]) {
  const paced = drafted.filter((run) => run.godRooms !== undefined && run.godRooms.biomes > 0);
  const sum = (value: (run: DraftCorpusRun) => number) =>
    paced.reduce((total, run) => total + value(run), 0);
  const gaps = paced.flatMap((run) => run.godRooms.gaps);
  const rooms = sum((run) => run.godRooms.rooms);
  return {
    godRoomsPerBiome: round(
      rooms /
        Math.max(
          sum((run) => run.godRooms.biomes),
          1,
        ),
    ),
    godGapMean: round(gaps.reduce((a, b) => a + b, 0) / Math.max(gaps.length, 1)),
    godGapMax: round(sum((run) => Math.max(0, ...run.godRooms.gaps)) / Math.max(paced.length, 1)),
    godEarlyShare: round(sum((run) => run.godRooms.early) / Math.max(rooms, 1)),
  };
}

function summarize(runs: readonly DraftCorpusRun[]): SpecSummary {
  const drafted = runs.filter((run) => run.outcome === 'drafted');
  const diversity = depthDiversity(drafted);
  const targets: Record<string, number> = {};
  for (const kind of TARGET_KINDS) {
    const total = drafted.reduce((sum, run) => sum + (run.targets[kind]?.total ?? 0), 0);
    if (total > 0)
      targets[kind] = round(
        drafted.reduce((sum, run) => sum + (run.targets[kind]?.met ?? 0), 0) / total,
      );
  }
  const purchasesPerRun: Record<string, number> = {};
  for (const kind of [...new Set(drafted.flatMap((run) => Object.keys(run.purchases)))].sort())
    purchasesPerRun[kind] = round(
      drafted.reduce((sum, run) => sum + (run.purchases[kind] ?? 0), 0) /
        Math.max(drafted.length, 1),
    );
  return {
    runs: runs.length,
    drafted: round(drafted.length / runs.length),
    targets,
    orderInversionRuns: round(
      drafted.filter((run) => run.orderInversions > 0).length / Math.max(drafted.length, 1),
    ),
    orderInversionsMedian: median(drafted.map((run) => run.orderInversions)),
    elementDeferredRuns: round(
      drafted.filter((run) => run.elementDeferred > 0).length / Math.max(drafted.length, 1),
    ),
    essencesPerRun: round(
      drafted.reduce((sum, run) => sum + run.essences, 0) / Math.max(drafted.length, 1),
    ),
    purchasesPerRun,
    attemptsMedian: median(drafted.map((run) => run.attempts)),
    depthSpread: diversity.spread,
    depthDistinct: diversity.distinct,
    ...godRoomSummary(drafted),
    msMedian: Math.round(median(runs.map((run) => run.ms))),
    msMax: Math.max(...runs.map((run) => run.ms)),
  };
}

function cell(value: number | undefined, before: number | undefined): string {
  if (value === undefined) return '-';
  if (before === undefined || before === value) return String(value);
  const delta = round(value - before);
  return `${value} (${delta > 0 ? '+' : ''}${delta})`;
}

function table(
  summaries: ReadonlyMap<string, SpecSummary>,
  baseline: Readonly<Record<string, SpecSummary>>,
): string {
  const header = [
    'spec',
    'drafted',
    ...TARGET_KINDS,
    'invRuns',
    'invMed',
    'elemDef',
    'ess/run',
    'buys/run',
    'attMed',
    'depSd',
    'depN',
    'god/bi',
    'gap',
    'gapMax',
    'early',
    'msMed',
    'msMax',
  ];
  const rows = [...summaries].map(([name, now]) => {
    const was = baseline[name];
    const buys = Object.entries(now.purchasesPerRun)
      .map(([kind, count]) => `${kind}:${cell(count, was?.purchasesPerRun[kind])}`)
      .join(' ');
    return [
      name,
      cell(now.drafted, was?.drafted),
      ...TARGET_KINDS.map((kind) => cell(now.targets[kind], was?.targets[kind])),
      cell(now.orderInversionRuns, was?.orderInversionRuns),
      cell(now.orderInversionsMedian, was?.orderInversionsMedian),
      cell(now.elementDeferredRuns, was?.elementDeferredRuns),
      cell(now.essencesPerRun, was?.essencesPerRun),
      buys || '-',
      cell(now.attemptsMedian, was?.attemptsMedian),
      cell(now.depthSpread, was?.depthSpread),
      cell(now.depthDistinct, was?.depthDistinct),
      cell(now.godRoomsPerBiome, was?.godRoomsPerBiome),
      cell(now.godGapMean, was?.godGapMean),
      cell(now.godGapMax, was?.godGapMax),
      cell(now.godEarlyShare, was?.godEarlyShare),
      cell(now.msMedian, was?.msMedian),
      cell(now.msMax, was?.msMax),
    ];
  });
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]!.length)),
  );
  return [header, ...rows]
    .map((row) => row.map((value, column) => value.padEnd(widths[column]!)).join(' | '))
    .join('\n');
}

/** Essence placement by route, for judging the per-room essence chance. */
function essenceTable(runs: readonly DraftCorpusRun[]): string {
  const rows = ['U', 'S', 'D', 'F'].map((prefix) => {
    const drafted = runs.filter((run) => run.outcome === 'drafted' && run.spec.startsWith(prefix));
    const counts = [0, 1, 2, 3, 4].map(
      (count) => drafted.filter((run) => run.essences === count).length,
    );
    const placed = drafted.reduce((sum, run) => sum + run.essences, 0);
    const intended = drafted.reduce((sum, run) => sum + run.essencesIntended, 0);
    const gated = drafted.reduce(
      (sum, run) => ({
        total: sum.total + run.elementGated.total,
        met: sum.met + run.elementGated.met,
        withEssence: sum.withEssence + run.elementGated.withEssence,
      }),
      { total: 0, met: 0, withEssence: 0 },
    );
    return [
      prefix,
      String(drafted.length),
      String(median(drafted.map((run) => run.essences))),
      counts.join('/'),
      `${intended}/${placed}`,
      String(counts[4]),
      `${gated.met}/${gated.total}`,
      String(gated.withEssence),
    ];
  });
  const header = [
    'route',
    'runs',
    'essMed',
    'ess 0/1/2/3/4',
    'intended',
    'all4',
    'gatedMet',
    'withEss',
  ];
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]!.length)),
  );
  return [header, ...rows]
    .map((row) => row.map((value, column) => value.padEnd(widths[column]!)).join(' | '))
    .join('\n');
}

/** Clears the last run's records, then prints the corpus table with deltas against the baseline. */
export default function setup(): () => Promise<void> {
  rmSync(draftCorpusRunsDirectory, { recursive: true, force: true });
  return async () => {
    if (!existsSync(draftCorpusRunsDirectory)) return;
    const runs = readdirSync(draftCorpusRunsDirectory)
      .map(
        (file) =>
          JSON.parse(readFileSync(join(draftCorpusRunsDirectory, file), 'utf8')) as DraftCorpusRun,
      )
      .sort((a, b) => a.specIndex - b.specIndex || a.seed - b.seed);
    const bySpec = new Map<string, DraftCorpusRun[]>();
    for (const run of runs)
      (bySpec.get(run.spec) ?? bySpec.set(run.spec, []).get(run.spec)!).push(run);
    const summaries = new Map([...bySpec].map(([name, specRuns]) => [name, summarize(specRuns)]));
    const baseline: Readonly<Record<string, SpecSummary>> = existsSync(draftCorpusBaselinePath)
      ? (JSON.parse(readFileSync(draftCorpusBaselinePath, 'utf8')) as Record<string, SpecSummary>)
      : {};
    const failures = runs
      .filter((run) => run.outcome === 'failed')
      .map((run) => `  ${run.spec} seed ${run.seed}: ${run.failure}`);
    console.log(
      `\nDraft corpus (${runs.length} runs; deltas against baseline)\n${table(summaries, baseline)}` +
        `\n\nEssences by route\n${essenceTable(runs)}` +
        (failures.length > 0 ? `\nFailed drafts:\n${failures.join('\n')}` : ''),
    );
    if (process.env.DRAFT_CORPUS_WRITE !== '1') return;
    const { DRAFT_CORPUS_RUN_COUNT } = await import('./corpus');
    if (runs.length !== DRAFT_CORPUS_RUN_COUNT) {
      console.log(
        `Baseline not written: ${runs.length} of ${DRAFT_CORPUS_RUN_COUNT} runs recorded`,
      );
      return;
    }
    const options = await resolveConfig(draftCorpusBaselinePath);
    writeFileSync(
      draftCorpusBaselinePath,
      await format(JSON.stringify(Object.fromEntries(summaries)), {
        ...options,
        filepath: draftCorpusBaselinePath,
      }),
    );
    console.log(`Wrote ${draftCorpusBaselinePath}`);
  };
}
