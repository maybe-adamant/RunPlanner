import type { Catalog } from '../../catalog-schema';
import {
  ProjectCommandContractError,
  semanticAddressKey,
  type ProjectCommand,
} from '../../authored-project';
import { settleProjectEdit } from '../edit-settlement';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import type { SemanticFinding } from '../model';

/** Settles one command; undefined when the command authority refuses it or it changes nothing. */
export function settleDraftCommand(
  catalog: Catalog,
  before: ProjectEvaluationAssembly,
  command: ProjectCommand,
): ProjectEvaluationAssembly | undefined {
  let settled: ReturnType<typeof settleProjectEdit>;
  let evaluated = false;
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
    // A refusal before anything is evaluated is the command's own; later ones are engine defects.
    if (error instanceof ProjectCommandContractError && !evaluated) return undefined;
    throw error;
  }
  return settled.assembly.project === before.project ? undefined : settled.assembly;
}

/**
 * Settles one command unless it is refused or adds a finding. A partly walked
 * route keeps its later frontier finding; an earlier block would replace it.
 */
export function settleDraftCommandWithoutNewFinding(
  catalog: Catalog,
  before: ProjectEvaluationAssembly,
  command: ProjectCommand,
): ProjectEvaluationAssembly | undefined {
  const settled = settleDraftCommand(catalog, before, command);
  if (settled === undefined) return undefined;
  const key = (finding: SemanticFinding) => `${finding.code} ${semanticAddressKey(finding.origin)}`;
  const known = new Set(before.evaluation.findings.map(key));
  return settled.evaluation.findings.every((finding) => known.has(key(finding)))
    ? settled
    : undefined;
}
