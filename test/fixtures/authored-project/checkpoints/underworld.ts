import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { checkpointArtifact, type CheckpointArtifact } from './loader';

import underworldFMidshopPomRaw from './underworld-f-midshop-pom-frontier.runplanner.json';
import underworldFPoolRaw from './underworld-f-pool.runplanner.json';
import underworldFStygianWellRaw from './underworld-f-stygian-well.runplanner.json';
import underworldFGRaw from './underworld-fg.runplanner.json';
import underworldFGHRaw from './underworld-fgh.runplanner.json';
import underworldFGHIRaw from './underworld-fghi.runplanner.json';
import naturalChaosUnresolvedTrialRaw from './natural-chaos-unresolved-trial.runplanner.json';
import nemesisFTraitTradeRaw from './nemesis-f-trait-trade.runplanner.json';
import nemesisHFieldsRaw from './nemesis-h-fields.runplanner.json';
import nemesisFPomSeaStarRaw from './nemesis-f-pom-sea-star.runplanner.json';

type UnderworldCheckpointId =
  | Extract<AuthoredProjectCheckpointId, `underworld-${string}`>
  | 'natural-chaos-unresolved-trial'
  | 'nemesis-f-trait-trade'
  | 'nemesis-h-fields'
  | 'nemesis-f-pom-sea-star';

export const underworldCheckpointArtifacts = Object.freeze({
  'underworld-fg': checkpointArtifact(underworldFGRaw),
  'underworld-f-pool': checkpointArtifact(underworldFPoolRaw),
  'underworld-f-stygian-well': checkpointArtifact(underworldFStygianWellRaw),
  'underworld-fgh': checkpointArtifact(underworldFGHRaw),
  'underworld-fghi': checkpointArtifact(underworldFGHIRaw),
  'underworld-f-midshop-pom-frontier': checkpointArtifact(underworldFMidshopPomRaw),
  'natural-chaos-unresolved-trial': checkpointArtifact(naturalChaosUnresolvedTrialRaw),
  'nemesis-f-trait-trade': checkpointArtifact(nemesisFTraitTradeRaw),
  'nemesis-h-fields': checkpointArtifact(nemesisHFieldsRaw),
  'nemesis-f-pom-sea-star': checkpointArtifact(nemesisFPomSeaStarRaw),
} satisfies Readonly<Record<UnderworldCheckpointId, CheckpointArtifact>>);

export function loadUnderworldFGCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-fg'].load();
}

export function loadUnderworldFPoolCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-f-pool'].load();
}

export function loadUnderworldFStygianWellCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['underworld-f-stygian-well'].load();
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

export function loadNemesisTraitTradeCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['nemesis-f-trait-trade'].load();
}

export function loadNemesisFieldsCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['nemesis-h-fields'].load();
}

export function loadNemesisPomSeaStarCheckpoint(): ProjectDocument {
  return underworldCheckpointArtifacts['nemesis-f-pom-sea-star'].load();
}
