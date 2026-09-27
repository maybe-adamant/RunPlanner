import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { checkpointArtifact, type CheckpointArtifact } from './loader';

import dreamMixedHandoffRaw from './dream-mixed-handoff.runplanner.json';
import dreamHeraArtificerEchoRaw from './dream-h-artificer-echo.runplanner.json';

type DreamCheckpointId = Extract<AuthoredProjectCheckpointId, `dream-${string}`>;

export const dreamCheckpointArtifacts = Object.freeze({
  'dream-h-artificer-echo': checkpointArtifact(dreamHeraArtificerEchoRaw),
  'dream-mixed-handoff': checkpointArtifact(dreamMixedHandoffRaw),
} satisfies Readonly<Record<DreamCheckpointId, CheckpointArtifact>>);

export function loadDreamMixedHandoffCheckpoint(): ProjectDocument {
  return dreamCheckpointArtifacts['dream-mixed-handoff'].load();
}

export function loadDreamHeraArtificerEchoCheckpoint(): ProjectDocument {
  return dreamCheckpointArtifacts['dream-h-artificer-echo'].load();
}
