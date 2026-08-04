import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import type { EncounterOccurrenceCommand } from './types';

/**
 * Narrow engine capability injected at the authored-command contact for
 * encounter edits. The authored model owns persistence and immutable mutation;
 * the simulator owns the current structural/candidate proof needed to admit a
 * new selection. It intentionally exposes no broader session or UI state.
 */
export interface EncounterCommandAuthorization {
  readonly assertAuthorized: (
    document: ProjectDocument,
    catalog: Catalog,
    command: EncounterOccurrenceCommand,
  ) => void;
}

export interface ProjectCommandApplyOptions {
  readonly encounterAuthorization?: EncounterCommandAuthorization;
}
