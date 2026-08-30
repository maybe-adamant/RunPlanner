import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  nemesisRandomEventCandidateSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type NemesisRandomEventBranchAssessment,
} from '@run-planner/engine/simulation';

import { goldenFBiome, goldenFOccurrenceId, goldenHBiome } from './underworld';
import {
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
} from '../checkpoints/underworld';

function sharedCandidate(
  branches: readonly NemesisRandomEventBranchAssessment[],
  key: 'traitTradeTraitKeys' | 'freeItemRewardTypes' | 'goldTradeRewardTypes',
): string {
  const first = branches[0]?.[key];
  if (first === undefined) throw new Error(`Nemesis candidate domain ${key} is missing`);
  const value = first.find((candidate) =>
    branches.every((branch) => branch[key].includes(candidate)),
  );
  if (value === undefined) throw new Error(`Nemesis candidate branches disagree about ${key}`);
  return value;
}

function candidateBranches(
  project: ProjectDocument,
  phase: ReturnType<typeof createEncounterPhaseAddress>,
) {
  const capability = nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    createNemesisRandomEventAddress(phase),
  );
  if (capability === undefined)
    throw new Error('selected Nemesis event has no reached candidate support');
  return capability.branches;
}

function selectedNemesis(
  project: ProjectDocument,
  phase: ReturnType<typeof createEncounterPhaseAddress>,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase,
    encounterKey: 'NemesisRandomEvent',
  });
}

function reachedFreeItemRewardType(): string {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  return sharedCandidate(
    candidateBranches(selectedNemesis(loadUnderworldFGHICheckpoint(), phase), phase),
    'freeItemRewardTypes',
  );
}

function insertGeneratedResult(
  project: ProjectDocument,
  biome: typeof goldenFBiome | typeof goldenHBiome,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
  phaseKey: string,
  index: number,
): ProjectDocument {
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: `nemesisGenerated:${encodeURIComponent(phaseKey)}`,
    entryKey: 'result',
  };
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
    reference,
    index,
  });
}

/** F/G accepted trait trade, using the reached shared candidate rather than a fixture guess. */
export function createNemesisTraitTradeCheckpoint(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  let project = selectedNemesis(loadUnderworldFGHICheckpoint(), phase);
  const traitKey = sharedCandidate(candidateBranches(project, phase), 'traitTradeTraitKeys');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceNemesisRandomEventOutcome',
    event: createNemesisRandomEventAddress(phase),
    value: { kind: 'traitTrade', traitKey, response: 'accept' },
    reward: { rewardType: 'RoomMoneyTripleDrop' },
  });
  return project;
}

/** H's physical-four Fields room with one reserved Nemesis position and a freely ordered free result. */
export function createNemesisFieldsCheckpoint(): ProjectDocument {
  const occurrenceId = createOccurrenceId('golden-h-combat05');
  const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
  const passive = createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId },
    'Passive',
  );
  let project = applyProjectCommand(loadUnderworldFGHCheckpoint(), catalog, {
    kind: 'ReplaceFieldsOptionalRewardCount',
    occurrence,
    optionalRewardCount: 3,
  });
  project = selectedNemesis(project, passive);
  // The complete F/G/H checkpoint intentionally retains an earlier unresolved
  // frontier, so H is not reached by simulation yet. Reuse the exact F reached
  // event candidate domain for this declaration-owned free-item pool.
  const rewardType = reachedFreeItemRewardType();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceNemesisRandomEventOutcome',
    event: createNemesisRandomEventAddress(passive),
    value: { kind: 'freeItem' },
    reward: { rewardType },
  });
  const selected = project.route.biomes
    .find((biome) => biome.biomeKey === 'H')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (selected === undefined) throw new Error('H Nemesis fixture occurrence is missing');
  const firstCageIndex = selected.roomActions.order.findIndex(
    (action) => action.kind === 'completeFieldsCage',
  );
  if (firstCageIndex < 0) throw new Error('H Nemesis fixture has no cage action');
  return insertGeneratedResult(project, goldenHBiome, occurrenceId, 'Passive', firstCageIndex + 1);
}

/** Accepted Pom/Hammer event result before one of its mutually exclusive acquisition dispositions. */
export function createNemesisPomCheckpoint(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  let project = selectedNemesis(loadUnderworldFGHICheckpoint(), phase);
  const rewardTypes = candidateBranches(project, phase)[0]?.goldTradeRewardTypes ?? [];
  const rewardType = rewardTypes.find(
    (candidate) => candidate === 'StackUpgrade' || candidate === 'WeaponUpgrade',
  );
  if (rewardType === undefined)
    throw new Error('Nemesis Gold trade has no Pom or Hammer candidate');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceNemesisRandomEventOutcome',
    event: createNemesisRandomEventAddress(phase),
    value: { kind: 'goldTrade', response: 'accept' },
    reward: { rewardType },
  });
  return project;
}

/** Accepted Pom/Hammer event result with its Sea Star duplicate child authored on the ordinary pickup path. */
export function createNemesisPomSeaStarCheckpoint(): ProjectDocument {
  return applyProjectCommand(createNemesisPomCheckpoint(), catalog, {
    kind: 'ReplaceSeaStarResult',
    acquisition: nemesisPomResultAcquisition(),
    procced: true,
  });
}

export function nemesisPomResultAcquisition() {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  return createAcquisitionRoleAddress(
    createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenFBiome, occurrenceId),
        'nemesisGenerated:Encounter',
      ),
      'result',
    ),
    'self',
  );
}
