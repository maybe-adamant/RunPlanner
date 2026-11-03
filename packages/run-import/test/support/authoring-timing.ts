import type { ProjectCommand } from '@run-planner/engine/authored-project';
import type { AuthoringSession, createAuthoringSession } from '@run-planner/engine/authoring';

/** One authoring-session call the import made. */
export interface AuthoringSample {
  readonly call: 'apply' | 'probe' | 'candidates';
  readonly ms: number;
  readonly command?: ProjectCommand;
  readonly applied?: boolean;
}

let samples: AuthoringSample[] | undefined;

/** Collects the timed calls `run` makes. */
export function timedCalls<Result>(run: () => Result): {
  readonly result: Result;
  readonly samples: readonly AuthoringSample[];
} {
  const taken: AuthoringSample[] = [];
  samples = taken;
  try {
    return { result: run(), samples: taken };
  } finally {
    samples = undefined;
  }
}

/**
 * Wraps the engine's authoring session so each call is timed. Imports nothing
 * the session's own consumers import, so a module mock can load it.
 */
export function timedAuthoring(
  create: typeof createAuthoringSession,
): typeof createAuthoringSession {
  return (catalog, start) => {
    const session = create(catalog, start);
    const timed = <Result>(sample: Omit<AuthoringSample, 'ms'>, run: () => Result): Result => {
      const began = performance.now();
      try {
        return run();
      } finally {
        samples?.push({ ...sample, ms: performance.now() - began });
      }
    };
    const wrapped: AuthoringSession = {
      current: () => session.current(),
      candidates: () => timed({ call: 'candidates' }, () => session.candidates()),
      apply: (command, admission) => {
        const began = performance.now();
        const outcome = session.apply(command, admission);
        samples?.push({
          call: 'apply',
          ms: performance.now() - began,
          command,
          applied: outcome.kind === 'applied',
        });
        return outcome;
      },
      restore: (assembly) => session.restore(assembly),
      probe: (run) => timed({ call: 'probe' }, () => session.probe(run)),
    };
    return wrapped;
  };
}
