import type { Catalog } from '../../catalog-schema';
import { ProjectCommandContractError } from '../../authored-project/commands/contract';
import type { ProjectCommand } from '../../authored-project/commands/types';
import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
} from '../candidates/session';
import { RerollPoolRefusal, settleProjectEdit, type SettlementFault } from '../edit-settlement';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import { findingsAddedSince } from '../finding-regions';
import type { SemanticFinding } from '../model';

/**
 * Whether a settled edit is kept: `settled` keeps any settled change;
 * `noNewFinding` also refuses one that adds a finding.
 */
export type AuthoringAdmission = 'settled' | 'noNewFinding';

export type AuthoringRefusal =
  /** The command authority refused the command before anything was evaluated. */
  | { readonly kind: 'command'; readonly error: ProjectCommandContractError }
  /** A new reroll spend the fixed pool cannot pay, judged once the edit is evaluated. */
  | { readonly kind: 'rerollPool'; readonly error: ProjectCommandContractError }
  /** Settlement left the authored project as it was. */
  | { readonly kind: 'unchanged' }
  /** Under `noNewFinding`, the findings the edit would add. */
  | { readonly kind: 'newFinding'; readonly findings: readonly SemanticFinding[] };

export type AuthoringOutcome =
  | {
      readonly kind: 'applied';
      readonly assembly: ProjectEvaluationAssembly;
      /** An engine contract failure beside the settled assembly, kept as settlement returned it. */
      readonly fault?: SettlementFault;
    }
  | { readonly kind: 'refused'; readonly refusal: AuthoringRefusal };

/** A cursor that settles programmatic edits one command at a time. */
export interface AuthoringSession {
  /** The current settled assembly; replaced, never mutated. */
  current(): ProjectEvaluationAssembly;
  /** The prepared candidate session for `current()`, kept while it is current. */
  candidates(): ProjectCandidateSession;
  /** Settles one command through edit settlement and exact evaluation. */
  apply(command: ProjectCommand, admission?: AuthoringAdmission): AuthoringOutcome;
  /** Continues from another assembly of the same catalog: a saved mark or an outside edit. */
  restore(assembly: ProjectEvaluationAssembly): void;
  /** Runs `run`, then restores the current assembly and its candidate session. */
  probe<Result>(run: () => Result): Result;
}

export function createAuthoringSession(
  catalog: Catalog,
  start: ProjectEvaluationAssembly,
): AuthoringSession {
  let assembly = start;
  let prepared:
    | { readonly assembly: ProjectEvaluationAssembly; readonly session: ProjectCandidateSession }
    | undefined;
  const refused = (refusal: AuthoringRefusal): AuthoringOutcome =>
    Object.freeze({ kind: 'refused', refusal: Object.freeze(refusal) });

  return Object.freeze({
    current: () => assembly,
    candidates: () => {
      if (prepared?.assembly !== assembly)
        prepared = { assembly, session: createPreparedProjectCandidateSession(catalog, assembly) };
      return prepared.session;
    },
    apply: (command: ProjectCommand, admission: AuthoringAdmission = 'settled') => {
      const before = assembly;
      let evaluated = false;
      let settled;
      try {
        settled = settleProjectEdit({
          catalog,
          before,
          command,
          evaluate: (project) => {
            evaluated = true;
            return simulateProjectAssembly(catalog, project);
          },
        });
      } catch (error) {
        // A refusal before anything is evaluated is the command's own, as is the
        // reroll pool's; any later one is an engine defect.
        if (error instanceof RerollPoolRefusal) return refused({ kind: 'rerollPool', error });
        if (error instanceof ProjectCommandContractError && !evaluated)
          return refused({ kind: 'command', error });
        throw error;
      }
      if (settled.assembly.project === before.project) return refused({ kind: 'unchanged' });
      if (admission === 'noNewFinding') {
        const findings = findingsAddedSince(
          before.evaluation.findings,
          settled.assembly.evaluation.findings,
        );
        if (findings.length > 0) return refused({ kind: 'newFinding', findings });
      }
      assembly = settled.assembly;
      return Object.freeze({
        kind: 'applied',
        assembly,
        ...(settled.fault === undefined ? {} : { fault: settled.fault }),
      });
    },
    restore: (next: ProjectEvaluationAssembly) => {
      assembly = next;
    },
    probe: <Result>(run: () => Result): Result => {
      const saved = assembly;
      const savedPrepared = prepared;
      try {
        return run();
      } finally {
        assembly = saved;
        if (prepared?.assembly !== saved) prepared = savedPrepared;
      }
    },
  });
}
