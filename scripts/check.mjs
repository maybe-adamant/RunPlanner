// Runs the independent steps of the complete gate concurrently. Each step's output is
// buffered and printed labelled when it finishes; failed steps print last, then a summary.
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const steps = [
  'typecheck',
  'test:fixtures:check',
  'test',
  'test:game-host',
  'test:game-module',
  'test:release',
  'lint',
  'format:check',
  'build',
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();

function runStep(step) {
  const started = performance.now();
  return new Promise((resolve) => {
    const child = spawn(npm, ['run', step], {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    const finish = (code, error) => {
      children.delete(child);
      const output = Buffer.concat(chunks).toString() + (error ? `\n${String(error)}\n` : '');
      const result = {
        step,
        passed: code === 0,
        seconds: (performance.now() - started) / 1000,
        output,
      };
      if (result.passed) printStep(result);
      resolve(result);
    };
    child.on('error', (error) => finish(1, error));
    child.on('close', (code) => finish(code ?? 1));
  });
}

function printStep({ step, passed, seconds, output }) {
  const status = passed ? 'PASS' : 'FAIL';
  process.stdout.write(`\n===== ${status} ${step} (${seconds.toFixed(1)} s) =====\n`);
  process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  process.stdout.write(`===== end ${step} =====\n`);
}

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(1);
  });

const started = performance.now();
process.stdout.write(`check: running ${steps.length} steps concurrently: ${steps.join(', ')}\n`);
const results = await Promise.all(steps.map(runStep));
const failed = results.filter((result) => !result.passed);
for (const result of failed) printStep(result);

const width = Math.max(...steps.map((step) => step.length));
process.stdout.write(`\ncheck summary\n${'step'.padEnd(width)}  result  seconds\n`);
for (const { step, passed, seconds } of results)
  process.stdout.write(
    `${step.padEnd(width)}  ${(passed ? 'pass' : 'FAIL').padEnd(6)}  ${seconds.toFixed(1).padStart(7)}\n`,
  );
const wall = (performance.now() - started) / 1000;
process.stdout.write(
  failed.length === 0
    ? `\ncheck passed in ${wall.toFixed(1)} s\n`
    : `\ncheck FAILED in ${wall.toFixed(1)} s: ${failed.map((result) => result.step).join(', ')}\n`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
