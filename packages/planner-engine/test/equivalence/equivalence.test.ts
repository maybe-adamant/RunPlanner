import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { format, resolveConfig } from 'prettier';
import { afterAll, describe, expect, it } from 'vitest';

import { firstDifference, parseDigest, serializeDigest, type CanonicalDigest } from './canonical';
import { equivalenceCorpus } from './corpus';
import {
  entryDigest,
  equivalenceProducts,
  equivalenceSections,
  parseEntryDigest,
  type EquivalenceProducts,
} from './digest';

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, 'baseline.json');
const repositoryRoot = join(here, '..', '..', '..', '..');
/** Uncommitted full products: `baseline/` from the last write, `current/` from the last check. */
const snapshotRoot = join(repositoryRoot, 'node_modules', '.cache', 'run-planner-equivalence');
const writing = process.env.EQUIVALENCE_WRITE === '1';

const corpus = equivalenceCorpus();
const baseline: Readonly<Record<string, string>> = writing
  ? {}
  : (JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, string>);
const written = new Map<string, string>();

function snapshotPath(kind: 'baseline' | 'current', name: string, section: string): string {
  return join(
    snapshotRoot,
    kind,
    `${name.replaceAll(/[^A-Za-z0-9._()-]/g, '_')}.${section}.txt.gz`,
  );
}

function writeSnapshots(kind: 'baseline' | 'current', name: string, products: EquivalenceProducts) {
  for (const section of equivalenceSections) {
    const { digest, canonical } = products[section];
    if (canonical === undefined) continue;
    const path = snapshotPath(kind, name, section);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, gzipSync(`${digest}\n${serializeDigest(canonical)}`));
  }
}

/** The probe and query kind of the candidate record a changed path starts in. */
function candidateRecordLabel(canonical: CanonicalDigest, path: string): string {
  const index = /^\$\[(\d+)\]/.exec(path)?.[1];
  if (index === undefined) return '';
  const node = (reference: unknown) =>
    JSON.parse(canonical.nodes.get((reference as { $ref: string }).$ref) ?? 'null') as unknown;
  const record = (node({ $ref: canonical.root }) as unknown[])[Number(index)];
  const { probe, input } = node(record) as { probe: string; input: unknown };
  return ` in ${probe} ${(node(input) as { kind?: string }).kind}`;
}

/** Names each changed section and, when a matching local snapshot exists, its first changed path. */
function describeChange(name: string, expected: string, products: EquivalenceProducts): string {
  const before = parseEntryDigest(expected);
  const changes: string[] = [];
  for (const section of equivalenceSections) {
    const { digest, canonical } = products[section];
    if (digest === before[section]) continue;
    const path = snapshotPath('baseline', name, section);
    const text = existsSync(path) ? gunzipSync(readFileSync(path)).toString('utf8') : undefined;
    const separator = text?.indexOf('\n') ?? -1;
    const snapshot =
      text !== undefined && text.slice(0, separator) === before[section]
        ? parseDigest(text.slice(separator + 1))
        : undefined;
    let where =
      'no matching local baseline snapshot (EQUIVALENCE_WRITE=1 at the baseline commit records one)';
    if (snapshot !== undefined && canonical !== undefined) {
      const changed = firstDifference(snapshot, canonical) ?? '$';
      const label = section === 'candidates' ? candidateRecordLabel(canonical, changed) : '';
      where = `first difference at ${changed}${label}`;
    }
    changes.push(`  ${section}: ${before[section]} -> ${digest} (${where})`);
  }
  return `${name} changed:\n${changes.join('\n')}`;
}

describe('simulation, execution plan and candidate equivalence', () => {
  if (writing) rmSync(join(snapshotRoot, 'baseline'), { recursive: true, force: true });

  it('baseline names exactly the corpus', () => {
    if (writing) return;
    expect(Object.keys(baseline)).toEqual(corpus.map((entry) => entry.name));
  });

  it.each(corpus.map((entry) => [entry.name, entry] as const))('%s', (name, entry) => {
    const products = equivalenceProducts(entry);
    const digest = entryDigest(products);
    if (writing) {
      written.set(name, digest);
      writeSnapshots('baseline', name, products);
      return;
    }
    const expected = baseline[name];
    if (expected === undefined) throw new Error(`${name} has no baseline digest`);
    if (digest === expected) return;
    writeSnapshots('current', name, products);
    throw new Error(describeChange(name, expected, products));
  });

  afterAll(async () => {
    if (!writing || written.size !== corpus.length) return;
    const ordered = Object.fromEntries(
      corpus.map((entry) => [entry.name, written.get(entry.name)]),
    );
    const options = await resolveConfig(baselinePath);
    writeFileSync(
      baselinePath,
      await format(JSON.stringify(ordered), { ...options, filepath: baselinePath }),
    );
  });
});
