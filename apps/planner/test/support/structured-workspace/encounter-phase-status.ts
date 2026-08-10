import type { EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import type { EncounterPhaseSequenceStatus } from '@run-planner/engine/simulation';

/** Test-only source capability for projections that intentionally lack exact simulation coverage. */
export const noEncounterPhaseStatusCoverage: (
  phase: EncounterPhaseAddress,
) => EncounterPhaseSequenceStatus | undefined = () => undefined;
