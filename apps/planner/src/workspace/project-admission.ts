import {
  assessPublicDreamItinerary,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

/** Public application admission stays separate from engine structural decoding. */
export function assertPublicProjectAdmission(catalog: Catalog, project: ProjectDocument): void {
  const route = catalog.routes.byKey[project.route.routeKey];
  if (route === undefined) throw new Error(`Unknown route ${project.route.routeKey}`);
  if (route.key === 'Dream') {
    const assessment = assessPublicDreamItinerary(catalog, project.route.itineraryBiomeKeys);
    if (!assessment.legal) {
      throw new Error('Dream Dive requires four biomes in a valid route order');
    }
    return;
  }
  if (route.key !== 'Underworld' && route.key !== 'Surface') {
    throw new Error(`This application does not support opening ${route.label} projects`);
  }
}
