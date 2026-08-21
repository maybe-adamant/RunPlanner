import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { checkpointArtifact, type CheckpointArtifact } from './loader';

import underworldFMidshopPomRaw from './underworld-f-midshop-pom-frontier.runplanner.json';
import underworldFGRaw from './underworld-fg.runplanner.json';
import underworldFGHRaw from './underworld-fgh.runplanner.json';
import underworldFGHIRaw from './underworld-fghi.runplanner.json';

type UnderworldCheckpointId = Extract<AuthoredProjectCheckpointId, `underworld-${string}`>;

export const underworldCheckpointArtifacts = Object.freeze({
  'underworld-fg': checkpointArtifact(underworldFGRaw),
  'underworld-fgh': checkpointArtifact(underworldFGHRaw),
  'underworld-fghi': checkpointArtifact(underworldFGHIRaw),
  'underworld-f-midshop-pom-frontier': checkpointArtifact(underworldFMidshopPomRaw),
} satisfies Readonly<Record<UnderworldCheckpointId, CheckpointArtifact>>);

export function loadUnderworldFGCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-fg'].load();
}

export function loadUnderworldFGHCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-fgh'].load();
}

export function loadUnderworldFGHICheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-fghi'].load();
}

export function loadUnderworldFMidshopPomFrontierCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-f-midshop-pom-frontier'].load();
}
