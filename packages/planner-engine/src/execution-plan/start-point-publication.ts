import type { ProjectDocument } from '../authored-project/model';
import type { Catalog } from '../catalog-schema';
import type { ProjectEvaluation } from '../simulation/evaluation/evaluation-products';
import { authoredStartPointEligibility } from '../simulation/start-installation/eligibility';
import type { StartInstallationUnavailableReason } from '../simulation/start-installation/model';

/** Why an authored start point keeps the plan from publishing. */
export type StartPointPublicationBlock =
  | {
      readonly code: 'startPointIneligible';
      readonly reason: StartInstallationUnavailableReason;
    }
  | { readonly code: 'startPointUnpublished' };

/** Every set start point blocks: an ineligible one by its reason, an eligible one as unpublished. */
export function startPointPublicationBlock(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): StartPointPublicationBlock | undefined {
  const eligibility = authoredStartPointEligibility(catalog, project, evaluation);
  switch (eligibility.kind) {
    case 'unset':
      return undefined;
    case 'ineligible':
      return Object.freeze({ code: 'startPointIneligible', reason: eligibility.reason });
    case 'eligible':
      return Object.freeze({ code: 'startPointUnpublished' });
  }
}
