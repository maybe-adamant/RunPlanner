import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { checkpointArtifact, type CheckpointArtifact } from './loader';

import surfaceNRaw from './surface-n.runplanner.json';
import surfaceNNaturalSelectionRaw from './surface-n-natural-selection-frontier.runplanner.json';
import surfaceNQueensRansomRaw from './surface-n-queens-ransom.runplanner.json';
import surfaceNSteadyGrowthRaw from './surface-n-steady-growth-frontier.runplanner.json';
import surfaceNQuickBuckRaw from './surface-n-quick-buck.runplanner.json';
import surfaceNBuriedTreasureRaw from './surface-n-buried-treasure.runplanner.json';
import surfaceNResourcesRaw from './surface-n-resources.runplanner.json';
import surfaceNORaw from './surface-no.runplanner.json';
import surfaceNOPRaw from './surface-nop.runplanner.json';
import surfaceNOPQRaw from './surface-nopq.runplanner.json';
import surfaceNCompleteHubRaw from './surface-n-complete-hub-frontier.runplanner.json';
import surfaceNEntryResolvedRaw from './surface-n-entry-frontier-resolved.runplanner.json';
import surfaceNEntryRaw from './surface-n-entry-frontier.runplanner.json';
import surfaceNPartialHubRaw from './surface-n-partial-hub.runplanner.json';
import surfaceNStoryBoardRaw from './surface-n-story-board.runplanner.json';
import surfaceNTenOpenInvalidRaw from './surface-n-ten-open-invalid.runplanner.json';

type SurfaceCheckpointId = Extract<AuthoredProjectCheckpointId, `surface-${string}`>;

export const surfaceCheckpointArtifacts = Object.freeze({
  'surface-n': checkpointArtifact(surfaceNRaw),
  'surface-n-natural-selection-frontier': checkpointArtifact(surfaceNNaturalSelectionRaw),
  'surface-n-queens-ransom': checkpointArtifact(surfaceNQueensRansomRaw),
  'surface-n-steady-growth-frontier': checkpointArtifact(surfaceNSteadyGrowthRaw),
  'surface-n-quick-buck': checkpointArtifact(surfaceNQuickBuckRaw),
  'surface-n-buried-treasure': checkpointArtifact(surfaceNBuriedTreasureRaw),
  'surface-n-resources': checkpointArtifact(surfaceNResourcesRaw),
  'surface-no': checkpointArtifact(surfaceNORaw),
  'surface-nop': checkpointArtifact(surfaceNOPRaw),
  'surface-nopq': checkpointArtifact(surfaceNOPQRaw),
  'surface-n-entry-frontier': checkpointArtifact(surfaceNEntryRaw),
  'surface-n-entry-frontier-resolved': checkpointArtifact(surfaceNEntryResolvedRaw),
  'surface-n-complete-hub-frontier': checkpointArtifact(surfaceNCompleteHubRaw),
  'surface-n-partial-hub': checkpointArtifact(surfaceNPartialHubRaw),
  'surface-n-story-board': checkpointArtifact(surfaceNStoryBoardRaw),
  'surface-n-ten-open-invalid': checkpointArtifact(surfaceNTenOpenInvalidRaw),
} satisfies Readonly<Record<SurfaceCheckpointId, CheckpointArtifact>>);

export function loadSurfaceNCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n'].load();
}

export function loadSurfaceNNaturalSelectionFrontierCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-natural-selection-frontier'].load();
}

export function loadSurfaceNQueensRansomCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-queens-ransom'].load();
}

export function loadSurfaceNSteadyGrowthFrontierCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-steady-growth-frontier'].load();
}

export function loadSurfaceNQuickBuckCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-quick-buck'].load();
}

export function loadSurfaceNBuriedTreasureCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-buried-treasure'].load();
}

export function loadSurfaceNResourcesCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-resources'].load();
}

export function loadSurfaceNOCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-no'].load();
}

export function loadSurfaceNOPCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-nop'].load();
}

export function loadSurfaceNOPQCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-nopq'].load();
}

export function loadSurfaceNEntryFrontierCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-entry-frontier'].load();
}

export function loadSurfaceNEntryFrontierResolvedCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-entry-frontier-resolved'].load();
}

export function loadSurfaceNCompleteHubFrontierCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-complete-hub-frontier'].load();
}

export function loadSurfaceNPartialHubCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-partial-hub'].load();
}

export function loadSurfaceNStoryBoardCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-story-board'].load();
}

export function loadSurfaceNTenOpenInvalidCheckpoint(): ProjectDocument {
  return surfaceCheckpointArtifacts['surface-n-ten-open-invalid'].load();
}
