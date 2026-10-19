import type { ProjectDocument } from '../../authored-project/model';
import { RUN_START_POINTS, type RunStartPoint } from '../../authored-project/practice-start';
import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import type { StartInstallation, StartInstallationUnavailableReason } from './model';
import { startInstallationAt } from './start-point';

export type StartPointAvailability =
  | { readonly availability: 'available' }
  | {
      readonly availability: 'unavailable';
      readonly reason: StartInstallationUnavailableReason;
    };

export interface StartPointOption {
  readonly biomeKey: string;
  readonly point: RunStartPoint['point'];
  readonly status: StartPointAvailability;
}

export type AuthoredStartPointEligibility =
  | { readonly kind: 'unset' }
  | {
      readonly kind: 'eligible';
      readonly startPoint: RunStartPoint;
      readonly installation: StartInstallation;
    }
  | {
      readonly kind: 'ineligible';
      readonly startPoint: RunStartPoint;
      readonly reason: StartInstallationUnavailableReason;
    };

function installationFor(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  biomeKey: string,
  point: RunStartPoint['point'],
) {
  return startInstallationAt(catalog, project, evaluation, { biomeKey, kind: point });
}

/** Every Opening, Preboss and Boss on the route's itinerary, in route order. */
export function startPointDomain(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): readonly StartPointOption[] {
  return Object.freeze(
    project.route.itineraryBiomeKeys.flatMap((biomeKey) =>
      RUN_START_POINTS.map((point) => {
        const result = installationFor(catalog, project, evaluation, biomeKey, point);
        return Object.freeze({
          biomeKey,
          point,
          status: Object.freeze(
            result.availability === 'available'
              ? { availability: 'available' as const }
              : { availability: 'unavailable' as const, reason: result.reason },
          ),
        });
      }),
    ),
  );
}

/** The authored start point's eligibility; a dangling biome is `notOnItinerary`. */
export function authoredStartPointEligibility(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): AuthoredStartPointEligibility {
  const startPoint = project.route.practiceStart;
  if (startPoint === undefined) return Object.freeze({ kind: 'unset' });
  const result = installationFor(
    catalog,
    project,
    evaluation,
    startPoint.biomeKey,
    startPoint.point,
  );
  return Object.freeze(
    result.availability === 'available'
      ? { kind: 'eligible', startPoint, installation: result.installation }
      : { kind: 'ineligible', startPoint, reason: result.reason },
  );
}
