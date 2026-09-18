import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

/** Public application admission stays separate from engine structural decoding. */
export function assertPublicProjectAdmission(catalog: Catalog, project: ProjectDocument): void {
  const route = catalog.routes.byKey[project.route.routeKey];
  if (route === undefined || (route.key !== 'Underworld' && route.key !== 'Surface')) {
    throw new Error('This application only supports opening Underworld and Surface projects');
  }
}
