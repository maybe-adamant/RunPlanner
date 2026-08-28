import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import performanceSnapshotContract from '../apps/planner/test/support/performance-snapshot-contract.json' with { type: 'json' };

export const performanceSnapshotFormat = performanceSnapshotContract.format;
export const performanceSnapshotSampleCount = performanceSnapshotContract.sampleCount;
export const performanceMetricNames = Object.freeze(performanceSnapshotContract.metrics);
export const performanceProductTargetsMs = Object.freeze(performanceSnapshotContract.targetsMs);

const performanceProductTargetKeys = Object.freeze({
  interaction: 'interaction',
  cachedUndo: 'cachedUndo',
});

export class PerformanceSnapshotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PerformanceSnapshotError';
  }
}

export class PerformanceCommandError extends Error {
  constructor(command, args, exitCode, stderr) {
    const renderedCommand = [command, ...args].join(' ');
    const detail = stderr.trim();
    super(
      `${renderedCommand} exited with code ${String(exitCode)}${detail.length > 0 ? `: ${detail}` : ''}`,
    );
    this.name = 'PerformanceCommandError';
    this.command = command;
    this.args = args;
    this.exitCode = exitCode;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireFiniteNonNegative(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new PerformanceSnapshotError(`${path} must be a finite non-negative duration`);
  }
}

function requireCanonicalTargets(targets, source) {
  const actualNames = Object.keys(targets).sort();
  const expectedNames = Object.keys(performanceProductTargetsMs).sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new PerformanceSnapshotError(`${source}.targetsMs is missing or incompatible`);
  }
  for (const name of expectedNames) {
    requireFiniteNonNegative(targets[name], `${source}.targetsMs.${name}`);
    if (targets[name] !== performanceProductTargetsMs[name]) {
      throw new PerformanceSnapshotError(
        `${source}.targetsMs.${name} must equal the canonical Gate A target`,
      );
    }
  }
}

function readSnapshotFile(path, source) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PerformanceSnapshotError(`could not read ${source} snapshot ${path}: ${detail}`);
  }
  return validatePerformanceSnapshot(parsed, source);
}

export function validatePerformanceSnapshot(snapshot, source = 'snapshot') {
  if (!isRecord(snapshot)) {
    throw new PerformanceSnapshotError(`${source} must be an object`);
  }
  if (snapshot.format !== performanceSnapshotFormat) {
    throw new PerformanceSnapshotError(
      `${source} has incompatible format ${String(snapshot.format)}; expected ${performanceSnapshotFormat}`,
    );
  }
  if (snapshot.sampleCount !== performanceSnapshotSampleCount) {
    throw new PerformanceSnapshotError(
      `${source} has incompatible sampleCount ${String(snapshot.sampleCount)}; expected ${performanceSnapshotSampleCount}`,
    );
  }
  if (!isRecord(snapshot.targetsMs)) {
    throw new PerformanceSnapshotError(`${source}.targetsMs is missing or incompatible`);
  }
  requireCanonicalTargets(snapshot.targetsMs, source);
  if (!isRecord(snapshot.metrics)) {
    throw new PerformanceSnapshotError(`${source}.metrics is missing or incompatible`);
  }

  const actualNames = Object.keys(snapshot.metrics).sort();
  const expectedNames = [...performanceMetricNames].sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new PerformanceSnapshotError(
      `${source}.metrics must contain exactly the eight Gate A metrics`,
    );
  }
  for (const name of performanceMetricNames) {
    requireFiniteNonNegative(snapshot.metrics[name], `${source}.metrics.${name}`);
  }
  return snapshot;
}

function metricThresholds(name) {
  const cachedUndo = name.endsWith('.cachedUndoPublicationMs');
  return Object.freeze({
    percent: cachedUndo ? 50 : 20,
    absoluteMs: cachedUndo ? 10 : 100,
    targetKey: cachedUndo
      ? performanceProductTargetKeys.cachedUndo
      : performanceProductTargetKeys.interaction,
  });
}

function percentDelta(baseMs, candidateMs) {
  if (baseMs === 0) {
    if (candidateMs === 0) return 0;
    return candidateMs > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return ((candidateMs - baseMs) / baseMs) * 100;
}

export function comparePerformanceSnapshots(baseSnapshot, candidateSnapshot) {
  const base = validatePerformanceSnapshot(baseSnapshot, 'base');
  const candidate = validatePerformanceSnapshot(candidateSnapshot, 'candidate');
  const metrics = performanceMetricNames.map((name) => {
    const baseMs = base.metrics[name];
    const candidateMs = candidate.metrics[name];
    const deltaMs = candidateMs - baseMs;
    const percent = percentDelta(baseMs, candidateMs);
    const thresholds = metricThresholds(name);
    const regression = percent > thresholds.percent && deltaMs >= thresholds.absoluteMs;
    const targetMs = performanceProductTargetsMs[thresholds.targetKey];
    return Object.freeze({
      name,
      baseMs,
      candidateMs,
      deltaMs,
      percentDelta: percent,
      thresholdPercent: thresholds.percent,
      thresholdAbsoluteMs: thresholds.absoluteMs,
      productTargetMs: targetMs,
      exceedsProductTarget: candidateMs >= targetMs,
      regression,
    });
  });
  return Object.freeze({
    base,
    candidate,
    metrics: Object.freeze(metrics),
    regressions: Object.freeze(metrics.filter(({ regression }) => regression)),
  });
}

function formatDuration(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPercent(value) {
  if (value === Number.POSITIVE_INFINITY) return '+∞%';
  if (value === Number.NEGATIVE_INFINITY) return '-∞%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatPerformanceReport(
  comparison,
  { baseRef = 'resolved base', candidateRef = 'working tree' } = {},
) {
  const lines = [
    `Performance comparison: ${candidateRef} against ${baseRef}`,
    'Metric | Base | Candidate | Delta | Change | Product target | Verdict',
    '--- | ---: | ---: | ---: | ---: | ---: | ---',
  ];
  for (const metric of comparison.metrics) {
    const target = metric.exceedsProductTarget ? 'at or over target' : 'within target';
    const verdict = metric.regression ? 'REGRESSION' : 'ok';
    lines.push(
      `${metric.name} | ${formatDuration(metric.baseMs)} | ${formatDuration(metric.candidateMs)} | ${formatDuration(metric.deltaMs)} | ${formatPercent(metric.percentDelta)} | ${formatDuration(metric.productTargetMs)} (${target}) | ${verdict}`,
    );
  }
  lines.push(
    comparison.regressions.length === 0
      ? 'Relative verdict: PASS'
      : `Relative verdict: FAIL (${comparison.regressions.length} metric${comparison.regressions.length === 1 ? '' : 's'} regressed)`,
  );
  return lines.join('\n');
}

export function resolveBaseReference({ dirty, candidateRevision, baseRef, resolvedBaseRevision }) {
  const requestedBaseRef = baseRef ?? (dirty ? 'HEAD' : 'HEAD^');
  if (!dirty && resolvedBaseRevision !== undefined && resolvedBaseRevision === candidateRevision) {
    throw new PerformanceSnapshotError(
      `resolved clean base ${requestedBaseRef} is identical to candidate ${candidateRevision}`,
    );
  }
  return Object.freeze({ requestedBaseRef, resolvedBaseRevision });
}

function runProcess(command, args, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new PerformanceCommandError(command, args, code ?? 1, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function runGit(runner, cwd, args) {
  const result = await runner('git', args, { cwd, env: process.env });
  return result.stdout.trim();
}

async function runSnapshot(runner, cwd, outputPath) {
  await runner(npmCommand(), ['run', 'test:performance:snapshot'], {
    cwd,
    env: {
      ...process.env,
      RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT: outputPath,
    },
  });
  try {
    return readSnapshotFile(outputPath, cwd);
  } catch (error) {
    if (error instanceof PerformanceSnapshotError) throw error;
    throw new PerformanceSnapshotError(`could not read snapshot produced by ${cwd}`);
  }
}

function containsWorktree(worktreeList, targetPath) {
  const resolvedTargetPath = resolve(targetPath);
  return worktreeList.split(/\r?\n/).some((line) => {
    if (!line.startsWith('worktree ')) return false;
    return resolve(line.slice('worktree '.length)) === resolvedTargetPath;
  });
}

async function recoverBaseWorktree(runner, cwd, baseWorktree, removeError) {
  let retryError;
  try {
    await runner('git', ['worktree', 'remove', '--force', '--force', baseWorktree], {
      cwd,
      env: process.env,
    });
  } catch (error) {
    retryError = error;
  }
  const verificationErrors = [];
  try {
    const worktreeList = await runGit(runner, cwd, ['worktree', 'list', '--porcelain']);
    if (containsWorktree(worktreeList, baseWorktree)) {
      verificationErrors.push(new Error(`temporary worktree remains registered: ${baseWorktree}`));
    }
  } catch (error) {
    verificationErrors.push(error);
  }
  if (verificationErrors.length === 0) return { errors: [], preserveWorktree: false };
  const recoveryErrors =
    retryError === undefined ? verificationErrors : [retryError, ...verificationErrors];
  return {
    errors: [
      new AggregateError(
        [removeError, ...recoveryErrors],
        `temporary worktree cleanup recovery failed for ${baseWorktree}`,
      ),
    ],
    preserveWorktree: true,
  };
}

async function cleanupBaseWorktree(runner, cwd, baseWorktree) {
  try {
    await runner('git', ['worktree', 'remove', '--force', baseWorktree], {
      cwd,
      env: process.env,
    });
    return { errors: [], preserveWorktree: false };
  } catch (error) {
    return recoverBaseWorktree(runner, cwd, baseWorktree, error);
  }
}

function defaultTempDirectory(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export async function runPerformanceComparison({
  cwd = process.cwd(),
  baseRef: explicitBaseRef,
  runner = runProcess,
  createTempDirectory = defaultTempDirectory,
} = {}) {
  let temporaryRoot;
  let baseWorktree;
  let candidateOutput;
  let baseOutput;
  let comparison;
  let operationError;
  try {
    const status = await runGit(runner, cwd, ['status', '--porcelain', '--untracked-files=all']);
    const dirty = status.length > 0;
    const candidateRevision = await runGit(runner, cwd, ['rev-parse', 'HEAD']);
    const requestedBaseRef = explicitBaseRef ?? process.env.RUN_PLANNER_PERFORMANCE_BASE_REF;
    const unresolvedBaseRef = requestedBaseRef ?? (dirty ? 'HEAD' : 'HEAD^');
    const resolvedBaseRevision = await runGit(runner, cwd, [
      'rev-parse',
      '--verify',
      `${unresolvedBaseRef}^{commit}`,
    ]);
    const baseResolution = resolveBaseReference({
      dirty,
      candidateRevision,
      baseRef: requestedBaseRef,
      resolvedBaseRevision,
    });

    temporaryRoot = await createTempDirectory('run-planner-performance-compare-');
    candidateOutput = join(temporaryRoot, 'candidate.json');
    baseOutput = join(temporaryRoot, 'base.json');
    const candidate = await runSnapshot(runner, cwd, candidateOutput);

    baseWorktree = join(temporaryRoot, 'base-worktree');
    await runner('git', ['worktree', 'add', '--detach', baseWorktree, resolvedBaseRevision], {
      cwd,
      env: process.env,
    });
    await runner(npmCommand(), ['install', '--ignore-scripts', '--prefer-offline'], {
      cwd: baseWorktree,
      env: process.env,
    });
    const base = await runSnapshot(runner, baseWorktree, baseOutput);
    const rawComparison = comparePerformanceSnapshots(base, candidate);
    comparison = Object.freeze({
      ...rawComparison,
      dirty,
      candidateRevision,
      baseRevision: resolvedBaseRevision,
      requestedBaseRef: baseResolution.requestedBaseRef,
    });
  } catch (error) {
    operationError = error;
  }
  const cleanupErrors = [];
  let preserveWorktree = false;
  if (baseWorktree !== undefined) {
    const worktreeCleanup = await cleanupBaseWorktree(runner, cwd, baseWorktree);
    cleanupErrors.push(...worktreeCleanup.errors);
    preserveWorktree = worktreeCleanup.preserveWorktree;
  }
  if (preserveWorktree) {
    for (const outputPath of [candidateOutput, baseOutput]) {
      if (outputPath === undefined) continue;
      try {
        rmSync(outputPath, { force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  } else if (temporaryRoot !== undefined) {
    try {
      rmSync(temporaryRoot, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    const cleanupMessage = cleanupErrors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join('; ');
    if (operationError !== undefined) {
      throw new AggregateError(
        [operationError, ...cleanupErrors],
        `Performance comparison failed and cleanup failed: ${cleanupMessage}`,
      );
    }
    throw new AggregateError(
      cleanupErrors,
      `Performance comparison cleanup failed: ${cleanupMessage}`,
    );
  }
  if (operationError !== undefined) throw operationError;
  return comparison;
}

function parseSnapshotArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (
      argument === '--base-snapshot' ||
      argument === '--candidate-snapshot' ||
      argument === '--base-ref'
    ) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new PerformanceSnapshotError(`${argument} requires a value`);
      }
      options[argument.slice(2).replaceAll('-', '')] = value;
      index += 1;
      continue;
    }
    throw new PerformanceSnapshotError(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseSnapshotArguments(process.argv.slice(2));
  let comparison;
  let baseRef = options.baseref;
  let candidateRef;
  if (options.basesnapshot !== undefined || options.candidatesnapshot !== undefined) {
    if (options.basesnapshot === undefined || options.candidatesnapshot === undefined) {
      throw new PerformanceSnapshotError(
        '--base-snapshot and --candidate-snapshot must be supplied together',
      );
    }
    comparison = comparePerformanceSnapshots(
      readSnapshotFile(options.basesnapshot, 'base'),
      readSnapshotFile(options.candidatesnapshot, 'candidate'),
    );
    baseRef = baseRef ?? 'snapshot';
    candidateRef = 'snapshot';
  } else {
    comparison = await runPerformanceComparison({ baseRef });
    baseRef = `${comparison.requestedBaseRef} (${comparison.baseRevision})`;
    candidateRef = `${comparison.dirty ? 'dirty ' : ''}candidate ${comparison.candidateRevision}`;
  }
  process.stdout.write(`${formatPerformanceReport(comparison, { baseRef, candidateRef })}\n`);
  if (comparison.regressions.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Performance comparison failed: ${message}\n`);
    process.exitCode = 1;
  }
}
