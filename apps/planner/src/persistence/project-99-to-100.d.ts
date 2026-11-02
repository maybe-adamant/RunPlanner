export const SOURCE_SCHEMA_VERSION: 99;
export const OUTPUT_SCHEMA_VERSION: 100;
export const CATALOG_VERSION: string;
export function migrateProjectDocument(value: unknown): unknown;
export const PEDESTAL_ROOMS: ReadonlySet<string>;
export const PHANTOM_EXIT_ROOMS: ReadonlySet<string>;
/** Drops a Well or Pool interaction flag in place; true when the occurrence changed. */
export function dropFeatureInteraction(occurrence: unknown): boolean;
/** Moves each Shrine purchase delay onto its item in place; true when the occurrence changed. */
export function moveShrineDelays(occurrence: unknown): boolean;
