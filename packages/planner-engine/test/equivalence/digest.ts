import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { canonicalDigest, sha256, type CanonicalDigest } from './canonical';
import { probeCandidates } from './candidate-probe';
import type { EquivalenceEntry } from './corpus';

export const equivalenceSections = ['simulation', 'plan', 'candidates'] as const;
export type EquivalenceSection = (typeof equivalenceSections)[number];

export interface SectionProduct {
  readonly digest: string;
  /** The canonical tree behind the digest; absent for a plan refusal. */
  readonly canonical?: CanonicalDigest;
}

export type EquivalenceProducts = Readonly<Record<EquivalenceSection, SectionProduct>>;

function planSection(
  catalog: EquivalenceEntry['catalog'],
  assembly: ReturnType<typeof simulateProjectAssembly>,
): SectionProduct {
  try {
    const encoded = encodeExecutionPlan(
      compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) }),
    );
    // The digest covers the exact wire bytes; the canonical tree only locates a change.
    return { digest: sha256(encoded), canonical: canonicalDigest(JSON.parse(encoded)) };
  } catch (error) {
    if (!(error instanceof ExecutionCompilerError)) throw error;
    return { digest: `refused:${error.code}` };
  }
}

export function equivalenceProducts(entry: EquivalenceEntry): EquivalenceProducts {
  const project = entry.project();
  const assembly = simulateProjectAssembly(entry.catalog, project);
  // `simulateProject` publishes exactly this assembly's evaluation.
  const simulation = canonicalDigest(assembly.evaluation);
  const plan = planSection(entry.catalog, assembly);
  const session = createPreparedProjectCandidateSession(entry.catalog, assembly);
  const candidates = canonicalDigest(probeCandidates(entry.catalog, project, session));
  return Object.freeze({
    simulation: { digest: simulation.root, canonical: simulation },
    plan,
    candidates: { digest: candidates.root, canonical: candidates },
  });
}

/** One baseline line: the three section digests in section order. */
export function entryDigest(products: EquivalenceProducts): string {
  return equivalenceSections.map((section) => products[section].digest).join(' ');
}

export function parseEntryDigest(line: string): Readonly<Record<EquivalenceSection, string>> {
  const parts = line.split(' ');
  if (parts.length !== equivalenceSections.length)
    throw new Error(`malformed equivalence baseline line: ${line}`);
  return Object.freeze(
    Object.fromEntries(equivalenceSections.map((section, index) => [section, parts[index]!])),
  ) as Readonly<Record<EquivalenceSection, string>>;
}
