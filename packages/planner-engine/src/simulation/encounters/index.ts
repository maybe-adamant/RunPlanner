export {
  alwaysActiveEncounterSlotKeys,
  encounterResolutionContext,
  EncounterResolutionContractError,
  materializeEncounterPhases,
  resolveEncounterAuthoringProfile,
  resolveMaterializedEncounterPhase,
  resolveMaterializedEncounterPhases,
} from './resolve';
export type { EncounterResolutionContext, EncounterResolutionRoomFacts } from './resolve';
export type { ResolvedEncounterPhase } from './model';
export type { GeneratedEncounterCandidateCapability } from './generation-preparation';
export {
  assessGeneratedEncounter,
  initializeGeneratedEncounter,
  type GeneratedEncounterAssessment,
  type GeneratedEncounterOperands,
} from './generation';
export { assessFangs, type FangsAssessment } from './fangs';
export type {
  EncounterCandidateExclusion,
  EncounterRequirementEvidence,
} from './requirement-evidence';
export {
  assessFigLeafSkip,
  type FigLeafSkipAssessment,
  type FigLeafSkipAssessmentInput,
  type FigLeafSkipUnavailableReason,
} from './fig-leaf';
export {
  prepareRoomEncounterPhases,
  type EncounterAuthoringRoom,
  type EncounterPhaseCandidateSupport,
  type EncounterPhaseSequenceStatus,
  type EncounterPhaseSequenceStatusEntry,
  type PreparedEncounterPhases,
} from './preparation';
export {
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
