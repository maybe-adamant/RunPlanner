import { catalog } from '@run-planner/hades2-catalog';
import {
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';

function rewards(project: ProjectDocument) {
  return simulateProjectAssembly(catalog, project).evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome && biome.rewards !== undefined ? [biome.rewards] : [],
  );
}

/** The Steady Growth outcome whose cycle lands at this encounter end. */
export function landedSteadyGrowthOutcome(
  project: ProjectDocument,
  owner: OccurrenceAddress,
  phaseKey: string,
): SteadyGrowthOutcomeAddress {
  const outcome = rewards(project)
    .flatMap((biome) => biome.steadyGrowthOutcomes)
    .find(
      (candidate) =>
        semanticAddressKey(candidate.owner) === semanticAddressKey(owner) &&
        candidate.phaseKey === phaseKey,
    );
  if (outcome === undefined)
    throw new Error(`no Steady Growth lands at ${semanticAddressKey(owner)} ${phaseKey}`);
  return outcome.address;
}

/** The Transcendent Embryo outcome whose cycle lands at this encounter end. */
export function landedTranscendentEmbryoOutcome(
  project: ProjectDocument,
  owner: OccurrenceAddress,
  phaseKey: string,
): TranscendentEmbryoOutcomeAddress {
  const outcome = rewards(project)
    .flatMap((biome) => biome.transcendentEmbryoOutcomes)
    .find(
      (candidate) =>
        semanticAddressKey(candidate.owner) === semanticAddressKey(owner) &&
        candidate.phaseKey === phaseKey,
    );
  if (outcome === undefined)
    throw new Error(`no Transcendent Embryo lands at ${semanticAddressKey(owner)} ${phaseKey}`);
  return outcome.address;
}
