import { mkdirSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';

import {
  comparePerformanceSnapshots,
  formatPerformanceReport,
  PerformanceCommandError,
  PerformanceSnapshotError,
  resolveBaseReference,
  resolveProcessInvocation,
  runPerformanceComparison,
  performanceMetricNames,
  performanceSnapshotFormat,
  performanceSnapshotSampleCount,
} from './compare-performance-snapshot.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    // The production comparator owns recursive cleanup; test fixtures are tiny and explicit.
    rmSync(directory, { recursive: true, force: true });
  }
});

function snapshot(value = 10) {
  return {
    format: performanceSnapshotFormat,
    sampleCount: performanceSnapshotSampleCount,
    targetsMs: { interaction: 1_000, cachedUndo: 50 },
    metrics: Object.fromEntries(performanceMetricNames.map((name) => [name, value])),
  };
}

function withMetrics(baseValue, overrides = {}) {
  return {
    ...snapshot(baseValue),
    metrics: { ...snapshot(baseValue).metrics, ...overrides },
  };
}

describe('performance snapshot comparison', () => {
  it('accepts unchanged and percent-only changes', () => {
    const unchanged = comparePerformanceSnapshots(snapshot(500), snapshot(500));
    assert.equal(unchanged.regressions.length, 0);
    const percentOnly = comparePerformanceSnapshots(
      snapshot(100),
      withMetrics(100, { 'underworld.fullRebuildMs': 121 }),
    );
    assert.equal(percentOnly.regressions.length, 0, '21 percent is below the absolute threshold');
  });

  it('requires both percentage and absolute thresholds for ordinary metrics', () => {
    const absoluteOnly = comparePerformanceSnapshots(
      snapshot(500),
      withMetrics(500, { 'underworld.fullRebuildMs': 600 }),
    );
    assert.equal(absoluteOnly.regressions.length, 0, '20 percent is not strictly greater');
    const percentOnly = comparePerformanceSnapshots(
      snapshot(1_000),
      withMetrics(1_000, { 'underworld.fullRebuildMs': 1_201 }),
    );
    assert.equal(percentOnly.regressions.length, 1, 'both thresholds are exceeded');
    const belowAbsolute = comparePerformanceSnapshots(
      snapshot(10),
      withMetrics(10, { 'underworld.fullRebuildMs': 13 }),
    );
    assert.equal(belowAbsolute.regressions.length, 0);

    const exactAbsolute = comparePerformanceSnapshots(
      snapshot(1_000),
      withMetrics(1_000, { 'underworld.fullRebuildMs': 1_100 }),
    );
    assert.equal(exactAbsolute.regressions.length, 0, '20 percent is strictly required');
    const justOverBoth = comparePerformanceSnapshots(
      snapshot(1_000),
      withMetrics(1_000, { 'underworld.fullRebuildMs': 1_201 }),
    );
    assert.equal(justOverBoth.regressions.length, 1);
  });

  it('uses strict percentage and inclusive absolute boundaries for cached Undo', () => {
    const exactPercent = comparePerformanceSnapshots(
      snapshot(10),
      withMetrics(10, { 'underworld.cachedUndoPublicationMs': 15 }),
    );
    assert.equal(exactPercent.regressions.length, 0);
    const exactAbsolute = comparePerformanceSnapshots(
      snapshot(10),
      withMetrics(10, { 'underworld.cachedUndoPublicationMs': 20 }),
    );
    assert.equal(exactAbsolute.regressions.length, 1);
  });

  it('handles a zero base through the absolute threshold', () => {
    const below = comparePerformanceSnapshots(
      snapshot(0),
      withMetrics(0, { 'underworld.fullRebuildMs': 99 }),
    );
    assert.equal(below.regressions.length, 0);
    const reached = comparePerformanceSnapshots(
      snapshot(0),
      withMetrics(0, { 'underworld.fullRebuildMs': 100 }),
    );
    assert.equal(reached.regressions.length, 1);
  });

  it('rejects negative, nonfinite, missing, and incompatible snapshots', () => {
    assert.throws(
      () => comparePerformanceSnapshots(snapshot(-1), snapshot(1)),
      PerformanceSnapshotError,
    );
    assert.throws(
      () =>
        comparePerformanceSnapshots(
          withMetrics(10, { 'surface.fullRebuildMs': Number.NaN }),
          snapshot(10),
        ),
      PerformanceSnapshotError,
    );
    const missing = snapshot(10);
    delete missing.metrics['surface.fullRebuildMs'];
    assert.throws(
      () => comparePerformanceSnapshots(missing, snapshot(10)),
      PerformanceSnapshotError,
    );
    assert.throws(
      () => comparePerformanceSnapshots({ ...snapshot(10), format: 'other' }, snapshot(10)),
      PerformanceSnapshotError,
    );
    assert.throws(
      () => comparePerformanceSnapshots({ ...snapshot(10), sampleCount: 2 }, snapshot(10)),
      /sampleCount/,
    );
    assert.throws(
      () =>
        comparePerformanceSnapshots(
          { ...snapshot(10), targetsMs: { interaction: 1_000 } },
          snapshot(10),
        ),
      /targetsMs/,
    );
    assert.throws(
      () =>
        comparePerformanceSnapshots(
          { ...snapshot(10), metrics: { ...snapshot(10).metrics, 'surface.fullRebuildMs': '10' } },
          snapshot(10),
        ),
      /finite non-negative duration/,
    );
  });

  it('resolves dirty, clean, and explicit bases and rejects identical clean bases', () => {
    assert.equal(
      resolveBaseReference({ dirty: true, candidateRevision: 'a', resolvedBaseRevision: 'a' })
        .requestedBaseRef,
      'HEAD',
    );
    assert.equal(
      resolveBaseReference({ dirty: false, candidateRevision: 'b', resolvedBaseRevision: 'a' })
        .requestedBaseRef,
      'HEAD^',
    );
    assert.equal(
      resolveBaseReference({
        dirty: false,
        candidateRevision: 'b',
        baseRef: 'origin/main',
        resolvedBaseRevision: 'a',
      }).requestedBaseRef,
      'origin/main',
    );
    assert.throws(
      () =>
        resolveBaseReference({ dirty: false, candidateRevision: 'a', resolvedBaseRevision: 'a' }),
      /identical/,
    );
  });

  it('reports product targets without turning them into generic-host regressions', () => {
    const comparison = comparePerformanceSnapshots(
      snapshot(1_000),
      withMetrics(1_000, { 'underworld.fullRebuildMs': 1_100 }),
    );
    assert.equal(comparison.regressions.length, 0);
    assert.equal(comparison.metrics[0].exceedsProductTarget, true);
    assert.match(formatPerformanceReport(comparison), /over target/);
    const equality = comparePerformanceSnapshots(
      snapshot(1_000),
      withMetrics(1_000, { 'underworld.fullRebuildMs': 1_000 }),
    );
    assert.equal(equality.metrics[0].exceedsProductTarget, true);
  });
});

describe('performance comparison command', () => {
  it('uses the Windows command processor only for npm command scripts', () => {
    const npmArgs = ['run', 'test:performance:snapshot'];

    assert.deepEqual(
      resolveProcessInvocation('npm.cmd', npmArgs, {
        platform: 'win32',
        comSpec: 'C:\\Windows\\System32\\cmd.exe',
      }),
      {
        command: 'C:\\Windows\\System32\\cmd.exe',
        args: ['/d', '/s', '/c', 'npm.cmd', ...npmArgs],
      },
    );
    assert.deepEqual(
      resolveProcessInvocation('npm.cmd', npmArgs, {
        platform: 'win32',
        comSpec: '',
      }),
      {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npm.cmd', ...npmArgs],
      },
    );
    assert.deepEqual(resolveProcessInvocation('npm', npmArgs, { platform: 'linux' }), {
      command: 'npm',
      args: npmArgs,
    });
    assert.deepEqual(
      resolveProcessInvocation('git', ['status'], {
        platform: 'win32',
        comSpec: 'C:\\Windows\\System32\\cmd.exe',
      }),
      {
        command: 'git',
        args: ['status'],
      },
    );
  });

  it('exits nonzero for a synthetic regression', () => {
    const directory = join(tmpdir(), `run-planner-performance-test-${process.pid}-${Date.now()}`);
    temporaryDirectories.push(directory);
    mkdirSync(directory, { recursive: true });
    const basePath = join(directory, 'base.json');
    const candidatePath = join(directory, 'candidate.json');
    writeFileSync(basePath, JSON.stringify(snapshot(500)));
    writeFileSync(
      candidatePath,
      JSON.stringify(withMetrics(500, { 'underworld.fullRebuildMs': 700 })),
    );
    const result = spawnSync(
      process.execPath,
      [
        'scripts/compare-performance-snapshot.mjs',
        '--base-snapshot',
        basePath,
        '--candidate-snapshot',
        candidatePath,
      ],
      { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Relative verdict: FAIL/);
  });

  it('cleans temporary worktree/output state and leaves the caller untouched on success', async () => {
    const caller = join(tmpdir(), `run-planner-performance-caller-${process.pid}-${Date.now()}`);
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const before = readdirSync(caller);
    const calls = [];
    const baseSnapshot = snapshot(10);
    const fakeRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') return { stdout: '', stderr: '' };
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(baseSnapshot),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await runPerformanceComparison({
      cwd: caller,
      runner: fakeRunner,
      createTempDirectory: () => {
        mkdirSync(temporaryRoot, { recursive: true });
        return temporaryRoot;
      },
    });
    assert.deepEqual(readdirSync(caller), before);
    assert.ok(calls.some(({ args }) => args[0] === 'worktree' && args[1] === 'remove'));
    assert.deepEqual(
      calls.find(
        ({ command, args }) =>
          command === (process.platform === 'win32' ? 'npm.cmd' : 'npm') && args[0] === 'install',
      )?.args,
      ['install', '--ignore-scripts', '--prefer-offline'],
    );
    assert.equal(existsSync(temporaryRoot), false);
  });

  it('uses a clean parent default and explicit base refs', async () => {
    const caller = join(tmpdir(), `run-planner-performance-clean-${process.pid}-${Date.now()}`);
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-clean-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });

    const run = async (baseRef) => {
      const calls = [];
      const fakeRunner = async (command, args, options) => {
        calls.push({ command, args, options });
        if (command === 'git' && args[0] === 'status') return { stdout: '', stderr: '' };
        if (command === 'git' && args[0] === 'rev-parse') {
          return {
            stdout:
              args.at(-1) === 'HEAD^^{commit}'
                ? 'parent\n'
                : args.at(-1) === 'origin/main^{commit}'
                  ? 'explicit-base\n'
                  : 'candidate\n',
            stderr: '',
          };
        }
        if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
        if (args[0] === 'install') return { stdout: '', stderr: '' };
        if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
          writeFileSync(
            options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
            JSON.stringify(snapshot(10)),
          );
          return { stdout: '', stderr: '' };
        }
        throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
      };
      const result = await runPerformanceComparison({
        cwd: caller,
        baseRef,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          return temporaryRoot;
        },
      });
      return { calls, result };
    };

    const cleanDefault = await run(undefined);
    assert.equal(cleanDefault.result.requestedBaseRef, 'HEAD^');
    assert.ok(
      cleanDefault.calls.some(
        ({ command, args }) =>
          command === 'git' && args[0] === 'rev-parse' && args.at(-1) === 'HEAD^^{commit}',
      ),
    );
    const explicit = await run('origin/main');
    assert.equal(explicit.result.requestedBaseRef, 'origin/main');
    assert.ok(
      explicit.calls.some(
        ({ command, args }) =>
          command === 'git' && args[0] === 'rev-parse' && args.at(-1) === 'origin/main^{commit}',
      ),
    );
  });

  it('rejects a clean base that resolves to the candidate revision before creating a worktree', async () => {
    const caller = join(tmpdir(), `run-planner-performance-identical-${process.pid}-${Date.now()}`);
    const calls = [];
    mkdirSync(caller, { recursive: true });
    temporaryDirectories.push(caller);
    const fakeRunner = async (command, args) => {
      calls.push({ command, args });
      if (command === 'git' && args[0] === 'status') return { stdout: '', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: 'same-revision\n', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({ cwd: caller, runner: fakeRunner }),
      /identical to candidate/,
    );
    assert.equal(
      calls.some(({ args }) => args[0] === 'worktree'),
      false,
    );
  });

  it('cleans the temporary worktree and output state when base bootstrap fails', async () => {
    const caller = join(tmpdir(), `run-planner-performance-failure-${process.pid}-${Date.now()}`);
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-failure-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const calls = [];
    const fakeRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'add') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
        return { stdout: '', stderr: '' };
      }
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(snapshot(10)),
        );
        return { stdout: '', stderr: '' };
      }
      if (args[0] === 'install') throw new Error('synthetic npm install failure');
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({
        cwd: caller,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          return temporaryRoot;
        },
      }),
      /synthetic npm install failure/,
    );
    assert.ok(calls.some(({ args }) => args[0] === 'worktree' && args[1] === 'remove'));
    assert.equal(existsSync(temporaryRoot), false);
  });

  it('cleans temporary state when the base snapshot command fails', async () => {
    const caller = join(
      tmpdir(),
      `run-planner-performance-run-failure-${process.pid}-${Date.now()}`,
    );
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-run-failure-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const calls = [];
    const fakeRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') return { stdout: '', stderr: '' };
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        if (options.cwd.endsWith('base-worktree')) throw new Error('synthetic snapshot failure');
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(snapshot(10)),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({
        cwd: caller,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          return temporaryRoot;
        },
      }),
      /synthetic snapshot failure/,
    );
    assert.ok(calls.some(({ args }) => args[0] === 'worktree' && args[1] === 'remove'));
    assert.equal(existsSync(temporaryRoot), false);
  });

  it('recovers a failed worktree removal without touching the caller', async () => {
    const caller = join(
      tmpdir(),
      `run-planner-performance-cleanup-failure-${process.pid}-${Date.now()}`,
    );
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-cleanup-failure-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const calls = [];
    const fakeRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
        if (args[2] === '--force' && args[3] === '--force') {
          return { stdout: '', stderr: '' };
        }
        throw new Error('synthetic worktree cleanup failure');
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'list') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') return { stdout: '', stderr: '' };
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(snapshot(10)),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    const before = readdirSync(caller);
    await runPerformanceComparison({
      cwd: caller,
      runner: fakeRunner,
      createTempDirectory: () => {
        mkdirSync(temporaryRoot, { recursive: true });
        return temporaryRoot;
      },
    });
    assert.deepEqual(readdirSync(caller), before);
    assert.ok(
      calls.some(
        ({ command, args }) =>
          command === 'git' &&
          args[0] === 'worktree' &&
          args[1] === 'remove' &&
          args[2] === '--force' &&
          args[3] === '--force' &&
          args.at(-1)?.endsWith('base-worktree'),
      ),
    );
    assert.equal(
      calls.some(
        ({ command, args }) => command === 'git' && args[0] === 'worktree' && args[1] === 'prune',
      ),
      false,
    );
    assert.ok(
      calls.some(
        ({ command, args }) => command === 'git' && args[0] === 'worktree' && args[1] === 'list',
      ),
    );
    assert.equal(existsSync(temporaryRoot), false);
  });

  it('retains the operation and cleanup errors when recovery cannot clear registration', async () => {
    const caller = join(
      tmpdir(),
      `run-planner-performance-cleanup-recovery-failure-${process.pid}-${Date.now()}`,
    );
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-cleanup-recovery-failure-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const before = readdirSync(caller);
    const fakeRunner = async (command, args, options) => {
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
        if (args[2] === '--force' && args[3] === '--force') {
          throw new Error('synthetic targeted retry failure');
        }
        throw new Error('synthetic worktree cleanup failure');
      }
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'list') {
        return { stdout: `worktree ${join(temporaryRoot, 'base-worktree')}\n`, stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') throw new Error('synthetic operation failure');
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(snapshot(10)),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({
        cwd: caller,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          mkdirSync(join(temporaryRoot, 'base-worktree'), { recursive: true });
          return temporaryRoot;
        },
      }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.match(error.message, /cleanup recovery failed/);
        assert.ok(
          error.errors.some((entry) => String(entry).includes('synthetic operation failure')),
        );
        const cleanupError = error.errors.find((entry) => entry instanceof AggregateError);
        assert.ok(cleanupError);
        assert.ok(
          cleanupError.errors.some((entry) =>
            String(entry).includes('synthetic worktree cleanup failure'),
          ),
        );
        assert.ok(
          cleanupError.errors.some((entry) =>
            String(entry).includes('synthetic targeted retry failure'),
          ),
        );
        return true;
      },
    );
    assert.deepEqual(readdirSync(caller), before);
    assert.equal(existsSync(temporaryRoot), true);
    assert.equal(
      existsSync(join(temporaryRoot, 'base-worktree')),
      true,
      'registered worktree directory remains available for manual cleanup',
    );
  });

  it('reports a missing base snapshot command clearly and still cleans up', async () => {
    const caller = join(
      tmpdir(),
      `run-planner-performance-missing-command-${process.pid}-${Date.now()}`,
    );
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-missing-command-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const fakeRunner = async (command, args, options) => {
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') return { stdout: '', stderr: '' };
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        if (options.cwd.endsWith('base-worktree')) {
          throw new PerformanceCommandError(
            'npm',
            ['run', 'test:performance:snapshot'],
            1,
            'Missing script: test:performance:snapshot',
          );
        }
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(snapshot(10)),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({
        cwd: caller,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          return temporaryRoot;
        },
      }),
      /Missing script: test:performance:snapshot/,
    );
    assert.equal(existsSync(temporaryRoot), false);
  });

  it('rejects an incompatible base snapshot output and cleans up', async () => {
    const caller = join(
      tmpdir(),
      `run-planner-performance-incompatible-${process.pid}-${Date.now()}`,
    );
    const temporaryRoot = join(
      tmpdir(),
      `run-planner-performance-incompatible-root-${process.pid}-${Date.now()}`,
    );
    temporaryDirectories.push(caller, temporaryRoot);
    mkdirSync(caller, { recursive: true });
    const fakeRunner = async (command, args, options) => {
      if (command === 'git' && args[0] === 'status') return { stdout: ' M file', stderr: '' };
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: args[1] === 'HEAD' ? 'candidate\n' : 'base\n', stderr: '' };
      }
      if (command === 'git' && args[0] === 'worktree') return { stdout: '', stderr: '' };
      if (args[0] === 'install') return { stdout: '', stderr: '' };
      if (args[0] === 'run' && args[1] === 'test:performance:snapshot') {
        writeFileSync(
          options.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT,
          JSON.stringify(
            options.cwd.endsWith('base-worktree')
              ? { ...snapshot(10), format: 'incompatible' }
              : snapshot(10),
          ),
        );
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected fake command ${command} ${args.join(' ')}`);
    };
    await assert.rejects(
      runPerformanceComparison({
        cwd: caller,
        runner: fakeRunner,
        createTempDirectory: () => {
          mkdirSync(temporaryRoot, { recursive: true });
          return temporaryRoot;
        },
      }),
      /incompatible format/,
    );
    assert.equal(existsSync(temporaryRoot), false);
  });
});
