import type { ProjectDocument } from '../authored-project/model';
import type { Catalog } from '../catalog-schema';
import type { ProjectEvaluation } from '../simulation/evaluation/evaluation-products';
import { authoredStartPointEligibility } from '../simulation/start-installation/eligibility';
import type { StartInstallationUnavailableReason } from '../simulation/start-installation/model';

/** Why an authored start point keeps the plan from publishing. */
export interface StartPointPublicationBlock {
  readonly code: 'startPointIneligible';
  readonly reason: StartInstallationUnavailableReason;
}

/** An ineligible start point blocks by its reason; an eligible one publishes its start state. */
export function startPointPublicationBlock(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): StartPointPublicationBlock | undefined {
  const eligibility = authoredStartPointEligibility(catalog, project, evaluation);
  return eligibility.kind === 'ineligible'
    ? Object.freeze({ code: 'startPointIneligible', reason: eligibility.reason })
    : undefined;
}
