import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { checkpointArtifact, type CheckpointArtifact } from './loader';

import dreamMixedHandoffRaw from './dream-mixed-handoff.runplanner.json';

type DreamCheckpointId = Extract<AuthoredProjectCheckpointId, `dream-${string}`>;

export const dreamCheckpointArtifacts = Object.freeze({
  'dream-mixed-handoff': checkpointArtifact(dreamMixedHandoffRaw),
} satisfies Readonly<Record<DreamCheckpointId, CheckpointArtifact>>);

export function loadDreamMixedHandoffCheckpoint(): ProjectDocument {
  return dreamCheckpointArtifacts['dream-mixed-handoff'].load();
}
