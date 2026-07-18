export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface LinearBiomePlan {
  readonly kind: 'LinearBiome';
  readonly biomeStepKey: string;
  readonly topology: null;
}

export type AuthoredBiomePlan = LinearBiomePlan;

export interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly biomes: readonly AuthoredBiomePlan[];
}

export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly catalogVersion: string;
  readonly routes: readonly AuthoredRoutePlan[];
}
