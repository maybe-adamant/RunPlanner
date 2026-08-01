/**
 * Stable application and React entry point for the structured editor
 * workspace. Construction and contract implementation remain private to this
 * directory so consumers depend on one deliberate projection boundary.
 */
export { requireWorkspaceInteraction, workspaceInteractionKey } from './contract';
export type {
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
  WorkspaceAuthoringFrontier,
  WorkspaceBatchRepairScope,
  WorkspaceBiome,
  WorkspaceBiomeField,
  WorkspaceCandidateInteraction,
  WorkspaceCandidateTakeoverBatchInteraction,
  WorkspaceCompletedHubHandoffInteraction,
  WorkspaceCommandIntent,
  WorkspaceCompletionNode,
  WorkspaceDefaultInspectorDestination,
  WorkspaceEphyraSideRoomDescriptor,
  WorkspaceEphyraSideRoomGroup,
  WorkspaceExitSelectionInteraction,
  WorkspaceFixedWidthOneTakeoverInteraction,
  WorkspaceHubDecisionNode,
  WorkspaceHubSlot,
  WorkspaceHubSlotInteraction,
  WorkspaceHubVisit,
  WorkspaceInspectorDestination,
  WorkspaceInteractionCatalog,
  WorkspaceLinkedExitNode,
  WorkspaceMarker,
  WorkspaceMissingPhysicalTarget,
  WorkspaceMixedBatchNode,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspacePhysicalTarget,
  WorkspaceRailEntry,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
  WorkspaceRoomInteraction,
  WorkspaceRoomSummary,
  WorkspaceRoute,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTakeoverBatchNode,
  WorkspaceTakeoverRepairInteraction,
  WorkspaceTopologyRemovalInteraction,
} from './contract';
export { createStructuredWorkspaceProjection } from './projector';
