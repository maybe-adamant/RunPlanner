import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

export const fBiome = createBiomeAddress('Underworld', 'F');
export const fStartId = createOccurrenceId('f-takeover-start');
export const fCombatId = createOccurrenceId('f-takeover-combat');

export function createFProject(projectId = 'f-takeover-project'): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    name: projectId,
    configuredBiomeCounts: { Underworld: 1 },
  });
}

export function createFStart(project = createFProject()): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: fStartId,
    gameName: 'F_Opening01',
  });
}

export function fDecision(occurrenceId = fStartId) {
  return createExitDecisionAddress(fBiome, { kind: 'occurrence', occurrenceId });
}

export function createFOpeningBatch(
  project = createFStart(),
  storeKey: 'MetaProgress' | 'RunProgress' | undefined = 'MetaProgress',
): ProjectDocument {
  const decision = fDecision();
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey,
    });
  }
  return next;
}

export function createUnresolvedFOpeningBatch(project = createFStart()): ProjectDocument {
  return applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: fDecision() });
}

export function createFOpeningTarget(
  project = createFOpeningBatch(),
  gameName = 'F_Combat02',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, fDecision().source, 'exit1'),
    occurrenceId: fCombatId,
    gameName,
  });
}

export function createFCombatBatch(
  project = createFOpeningTarget(),
  storeKey: 'MetaProgress' | 'RunProgress' | undefined = 'RunProgress',
): ProjectDocument {
  const decision = fDecision(fCombatId);
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey,
    });
  }
  return next;
}

export function createFCombatTarget(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
  occurrenceId: string,
  gameName: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, fDecision(fCombatId).source, exitKey),
    occurrenceId: createOccurrenceId(occurrenceId),
    gameName,
  });
}

export function selectFCombatExit(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(fBiome, fDecision(fCombatId).source),
    value: { kind: 'normal', exitKey },
  });
}

export function createCompleteFTakeoverProject(
  selectedExitKey: 'exit1' | 'exit2' = 'exit1',
): ProjectDocument {
  let project = createFOpeningTarget();
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: fDecision(fCombatId),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-takeover-preboss-shop'),
      exit2: createOccurrenceId('f-takeover-preboss-free'),
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution: createLevelResolutionAddress(
      createIncomingRewardAddress(fBiome, fCombatId),
      'self',
    ),
    value: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
  });
  return selectFCombatExit(project, selectedExitKey);
}

/** A complete physical takeover batch whose normal exit remains unselected. */
export function createUnselectedFTakeoverProject(): ProjectDocument {
  let project = createFOpeningTarget();
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: fDecision(fCombatId),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-takeover-preboss-shop'),
      exit2: createOccurrenceId('f-takeover-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution: createLevelResolutionAddress(
      createIncomingRewardAddress(fBiome, fCombatId),
      'self',
    ),
    value: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
  });
}
