export {
  alwaysActiveEncounterSlotKeys,
  EncounterResolutionContractError,
  resolveEncounterPhases,
} from './resolve';
export type { ResolvedEncounterPhase } from './model';
export {
  prepareRoomEncounterPhases,
  type EncounterAuthoringRoom,
  type EncounterPhaseCandidateSupport,
  type PreparedEncounterPhases,
} from './preparation';
export {
  evaluateEncounterCandidates,
  type EncounterCandidateArtifacts,
  type EncounterCandidateEvaluation,
  type EncounterCandidateBoundary,
  type EncounterRoomCandidateCapability,
} from './candidates';
export {
  encounterPhaseAuthoringDomainForRoom,
  type EncounterPhaseAuthoringDomain,
  type EncounterPhaseAuthoringOwner,
  type EncounterPhaseAuthoringRoomOptions,
} from './authoring-domain';
export {
  structurallyActiveEncounterRooms,
  type EncounterStructuralRoom,
  type EncounterStructuralSnapshot,
} from './structural';
