import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointManifest, type AuthoredProjectCheckpointId } from './manifest';
import { surfaceCheckpointArtifacts } from './surface';
import { underworldCheckpointArtifacts } from './underworld';

const artifactsById = Object.freeze({
  ...underworldCheckpointArtifacts,
  ...surfaceCheckpointArtifacts,
});

const completeArtifacts: Readonly<
  Record<AuthoredProjectCheckpointId, (typeof artifactsById)[AuthoredProjectCheckpointId]>
> = artifactsById;

export const checkpointRegistry = Object.freeze(
  checkpointManifest.map((entry) => {
    const artifact = completeArtifacts[entry.id];
    return Object.freeze({ entry, load: artifact.load, raw: artifact.raw });
  }),
);

export function loadCheckpoint(id: AuthoredProjectCheckpointId): ProjectDocument {
  return completeArtifacts[id].load();
}
