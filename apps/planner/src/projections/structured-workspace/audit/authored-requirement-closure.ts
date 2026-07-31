import {
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceAuthoredLeafRequirement,
} from '../contract';
import type { WorkspaceBiomeOccurrenceAssemblyFacts } from '../occurrence-facts';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceFrontierInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from '../interaction-requirements';
import { expectedDetailsActiveOccurrenceIds } from './authored-leaf-expectations';
import {
  expectedBatchInteractionRequirements,
  expectedFrontierInteractionRequirements,
  expectedHubInteractionRequirements,
  expectedStartInteractionRequirements,
  expectedTakeoverInteractionRequirements,
  expectedTopologyRemovalInteractionRequirements,
  type WorkspaceExpectedFrontierInteractionRequirement,
  type WorkspaceExpectedStartInteractionRequirement,
  type WorkspaceExpectedTakeoverInteractionRequirement,
} from './authored-interaction-expectations';
import {
  sameHubSlotClose,
  sameTakeoverReplacementImpact,
  sameTopologyRemovalInteraction,
} from './interaction-equality';

export function assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
  facts: WorkspaceBiomeOccurrenceAssemblyFacts,
  plan: AuthoredBiomePlan,
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
): void {
  const expectedDetailsActive = expectedDetailsActiveOccurrenceIds(plan);
  const authoredOccurrenceIds = new Set(
    (plan.topology?.occurrences ?? []).map((occurrence) => occurrence.occurrenceId),
  );
  for (const occurrenceId of authoredOccurrenceIds) {
    const fact = facts.occurrence(occurrenceId);
    if (fact === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has no authored occurrence assembly facts`,
      );
    }
    if (fact.detailsActive !== expectedDetailsActive.has(occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has incorrect authored detail activation`,
      );
    }
  }
  for (const fact of facts.occurrences) {
    if (!authoredOccurrenceIds.has(fact.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, fact.occurrenceId))} has no authored occurrence owner`,
      );
    }
  }
  const expected = new Set(
    requirements.map((requirement) => semanticAddressKey(requirement.address)),
  );
  for (const occurrence of facts.occurrences) {
    for (const leaf of occurrence.leaves) {
      const key = semanticAddressKey(leaf.address);
      if (leaf.lifecycle === 'active' && leaf.surface === 'published' && !expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} active authored occurrence leaf is absent from the independent closure requirements`,
        );
      }
      if (leaf.surface === 'withheld' && expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} withheld authored occurrence leaf is unexpectedly required by the independent closure`,
        );
      }
    }
  }
  for (const requirement of requirements) {
    const surface = facts.leafSurface(requirement.address);
    if (surface !== 'published') {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(requirement.address)} required authored leaf is ${surface} in occurrence assembly facts`,
      );
    }
  }
}

function assertBatchInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>,
): void {
  const expected = expectedBatchInteractionRequirements(catalog, biome, layout, plan);
  const assertAddress = (
    actual: SemanticAddress,
    expectedAddress: SemanticAddress,
    detail: string,
  ): void => {
    if (semanticAddressKey(actual) !== semanticAddressKey(expectedAddress)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} has a conflicting semantic owner`,
      );
    }
  };
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored batch interaction package is absent`,
      );
    }
    assertAddress(requirement.owner, expectation.owner, `${key} batch decision owner`);
    if (expectation.exitSelection === undefined) {
      if (requirement.exitSelection !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects an exit-selection requirement`,
        );
      }
    } else {
      if (requirement.exitSelection === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required exit-selection requirement is absent`,
        );
      }
      assertAddress(
        requirement.owner,
        expectation.exitSelection.owner,
        `${key} exit-selection decision owner`,
      );
      if (semanticAddressKey(requirement.exitSelection.owner) !== expectation.exitSelection.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} exit-selection requirement has a conflicting interaction key`,
        );
      }
    }
    if (expectation.rewardStore === undefined) {
      if (requirement.rewardStore !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects a batch reward-store requirement`,
        );
      }
    } else {
      if (requirement.rewardStore === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required batch reward-store requirement is absent`,
        );
      }
      if (semanticAddressKey(requirement.rewardStore.owner) !== expectation.rewardStore.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} batch reward-store requirement has a conflicting interaction key`,
        );
      }
      assertAddress(
        requirement.rewardStore.owner,
        expectation.rewardStore.owner,
        `${key} batch reward-store owner`,
      );
    }
    if (expectation.fieldsCageOutcome === undefined) {
      if (requirement.fieldsCageOutcome !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects a Fields cage-outcome requirement`,
        );
      }
    } else {
      if (requirement.fieldsCageOutcome === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required Fields cage-outcome requirement is absent`,
        );
      }
      if (
        semanticAddressKey(requirement.fieldsCageOutcome.owner) !==
        expectation.fieldsCageOutcome.key
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Fields cage-outcome requirement has a conflicting interaction key`,
        );
      }
      assertAddress(
        requirement.fieldsCageOutcome.owner,
        expectation.fieldsCageOutcome.owner,
        `${key} Fields cage-outcome owner`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected batch interaction package has no authored owner`,
      );
    }
  }
}

function assertHubInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>,
): void {
  const expected = expectedHubInteractionRequirements(biome, layout, plan);
  const sameKey = (actual: SemanticAddress, expectedAddress: SemanticAddress): boolean =>
    semanticAddressKey(actual) === semanticAddressKey(expectedAddress);
  const sameValues = <T>(actual: readonly T[], expectedValues: readonly T[]): boolean =>
    actual.length === expectedValues.length &&
    actual.every((value, index) => value === expectedValues[index]);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored Hub interaction package is absent`,
      );
    }
    if (!sameKey(requirement.owner, expectation.owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} Hub requirement has a conflicting semantic owner`,
      );
    }
    if (requirement.slots.length !== expectation.slots.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every declared Hub slot`,
      );
    }
    for (const slot of expectation.slots) {
      const actual = requirement.slots.find((candidate) => sameKey(candidate.owner, slot.owner));
      if (actual === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub slot ${semanticAddressKey(slot.owner)} requirement is absent`,
        );
      }
      if (
        actual.selected !== slot.selected ||
        actual.openedOccurrenceId !== slot.openedOccurrenceId ||
        actual.roomGameName !== slot.roomGameName ||
        !sameHubSlotClose(actual.close, slot.close) ||
        !sameValues(
          actual.choices.map((choice) => choice.value),
          Object.freeze([false, true]),
        )
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub slot ${semanticAddressKey(slot.owner)} requirement disagrees with authored state`,
        );
      }
    }
    if (requirement.visits.length !== expectation.visits.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every authored or structural-next Hub visit`,
      );
    }
    for (const visit of expectation.visits) {
      const actual = requirement.visits.find((candidate) => sameKey(candidate.owner, visit.owner));
      if (
        actual === undefined ||
        actual.selectedHubSlotKey !== visit.selectedHubSlotKey ||
        !sameValues(
          actual.choices.map((choice) => choice.value),
          visit.choices,
        )
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub visit ${semanticAddressKey(visit.owner)} requirement disagrees with authored state`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected Hub interaction package has no authored board owner`,
      );
    }
  }
}

function assertTopologyRemovalInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceTopologyRemovalInteractionRequirement>,
): void {
  const expected = expectedTopologyRemovalInteractionRequirements(biome, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored topology-removal interaction package is absent`,
      );
    }
    if (semanticAddressKey(requirement.owner) !== semanticAddressKey(expectation.owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} topology-removal requirement has a conflicting semantic owner`,
      );
    }
    if (requirement.removals.length !== expectation.removals.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every authored topology-removal owner`,
      );
    }
    for (const removal of expectation.removals) {
      const actual = requirement.removals.find((candidate) => candidate.key === removal.key);
      if (actual === undefined || !sameTopologyRemovalInteraction(actual, removal)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} topology-removal requirement ${removal.key} disagrees with authored state`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected topology-removal package has no authored biome owner`,
      );
    }
  }
}

function sameStartInteractionRequirement(
  actual: WorkspaceStartInteractionRequirement,
  expected: WorkspaceExpectedStartInteractionRequirement,
): boolean {
  if (semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)) return false;
  const expectedStart = expected.start;
  if (actual.start.kind !== expectedStart.kind) return false;
  if (actual.start.kind === 'fixed') {
    return expectedStart.kind === 'fixed' && actual.start.gameName === expectedStart.gameName;
  }
  if (expectedStart.kind !== 'choice') return false;
  return (
    actual.start.gameNames.length === expectedStart.gameNames.length &&
    actual.start.gameNames.every((gameName, index) => gameName === expectedStart.gameNames[index])
  );
}

function assertStartInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>,
): void {
  const expected = expectedStartInteractionRequirements(biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored start interaction is absent`,
      );
    }
    if (!sameStartInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} start interaction requirement disagrees with authored state`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected start interaction requirement has no topology-free biome owner`,
      );
    }
  }
}

function sameTakeoverExistingTargets(
  actual: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
  expected: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every(
      (target, index) =>
        target.exitKey === expected[index]?.exitKey &&
        target.occurrenceId === expected[index]?.occurrenceId,
    )
  );
}

function sameTakeoverInteractionRequirement(
  actual: WorkspaceTakeoverInteractionRequirement,
  expected: WorkspaceExpectedTakeoverInteractionRequirement,
): boolean {
  if (semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)) return false;
  if (actual.presentation !== expected.presentation || actual.action !== expected.action)
    return false;
  switch (actual.presentation) {
    case 'candidate':
      return (
        expected.presentation === 'candidate' &&
        actual.gameNames.length === expected.gameNames.length &&
        actual.gameNames.every((gameName, index) => gameName === expected.gameNames[index]) &&
        sameTakeoverExistingTargets(actual.existingTargets, expected.existingTargets) &&
        sameTakeoverReplacementImpact(actual.impact, expected.impact)
      );
    case 'repair':
      return (
        expected.presentation === 'repair' &&
        actual.gameName === expected.gameName &&
        sameTakeoverExistingTargets(actual.existingTargets, expected.existingTargets) &&
        actual.requiredExitKeys.length === expected.requiredExitKeys.length &&
        actual.requiredExitKeys.every((key, index) => key === expected.requiredExitKeys[index])
      );
    case 'fixedWidthOneTakeover':
    case 'completedHubHandoff':
      return (
        (expected.presentation === 'fixedWidthOneTakeover' ||
          expected.presentation === 'completedHubHandoff') &&
        actual.gameName === expected.gameName &&
        actual.requiredExitKeys.length === expected.requiredExitKeys.length &&
        actual.requiredExitKeys.every((key, index) => key === expected.requiredExitKeys[index])
      );
  }
}

function assertTakeoverInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
): void {
  const expected = expectedTakeoverInteractionRequirements(catalog, biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required takeover interaction requirement is absent`,
      );
    }
    if (!sameTakeoverInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} takeover interaction requirement disagrees with authored state`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected takeover interaction requirement has no authored or frontier owner`,
      );
    }
  }
}

function sameFrontierInteractionRequirement(
  actual: WorkspaceFrontierInteractionRequirement,
  expected: WorkspaceExpectedFrontierInteractionRequirement,
): boolean {
  if (
    actual.kind !== expected.kind ||
    semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)
  ) {
    return false;
  }
  if (actual.kind === 'hubDecisionFrontier') {
    return (
      expected.kind === 'hubDecisionFrontier' &&
      actual.structural.action === expected.structural.action
    );
  }
  if (expected.kind !== 'exitFrontier') return false;
  if (
    actual.capabilities.structural !== expected.capabilities.structural ||
    actual.capabilities.takeover !== expected.capabilities.takeover ||
    actual.structural?.action !== expected.structural?.action
  ) {
    return false;
  }
  if (actual.structural?.action !== 'createLinkedExit') {
    return expected.structural?.action !== 'createLinkedExit';
  }
  return (
    expected.structural?.action === 'createLinkedExit' &&
    expected.structural.targetGameName === actual.structural.targetGameName
  );
}

function assertFrontierInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  takeoverRequirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
  requirements: ReadonlyMap<string, WorkspaceFrontierInteractionRequirement>,
): void {
  const expected = expectedFrontierInteractionRequirements(catalog, biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required frontier interaction package is absent`,
      );
    }
    if (!sameFrontierInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} frontier interaction requirement disagrees with authored state`,
      );
    }
    if (requirement.kind === 'exitFrontier' && requirement.capabilities.takeover === true) {
      const takeover = takeoverRequirements.get(
        `takeoverBatch:${semanticAddressKey(requirement.owner)}`,
      );
      if (takeover?.action !== 'create') {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} advertised takeover capability has no exact create requirement`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected frontier interaction package has no active authored frontier`,
      );
    }
  }
}

export interface WorkspaceAuthoredRequirementClosureInput {
  readonly authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[];
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly layout: BiomeLayout;
  readonly occurrenceFacts: WorkspaceBiomeOccurrenceAssemblyFacts;
  readonly plan: AuthoredBiomePlan;
  readonly startInteractionRequirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTakeoverInteractionRequirement
  >;
  readonly topologyRemovalInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >;
}

/**
 * Compare every production requirement package and occurrence fact to the
 * independently derived authored contract before binding can make an omitted
 * owner self-confirming.
 */
export function assertWorkspaceAuthoredRequirementClosure(
  input: WorkspaceAuthoredRequirementClosureInput,
): void {
  const {
    authoredLeafRequirements,
    batchInteractionRequirements,
    biome,
    catalog,
    frontierInteractionRequirements,
    hubInteractionRequirements,
    layout,
    occurrenceFacts,
    plan,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
    occurrenceFacts,
    plan,
    authoredLeafRequirements,
  );
  assertBatchInteractionRequirementsMatchAuthoredState(
    catalog,
    biome,
    layout,
    plan,
    batchInteractionRequirements,
  );
  assertHubInteractionRequirementsMatchAuthoredState(
    biome,
    layout,
    plan,
    hubInteractionRequirements,
  );
  assertTopologyRemovalInteractionRequirementsMatchAuthoredState(
    biome,
    plan,
    topologyRemovalInteractionRequirements,
  );
  assertStartInteractionRequirementsMatchAuthoredState(
    biome,
    layout,
    plan,
    startInteractionRequirements,
  );
  assertTakeoverInteractionRequirementsMatchAuthoredState(
    catalog,
    biome,
    layout,
    plan,
    takeoverInteractionRequirements,
  );
  assertFrontierInteractionRequirementsMatchAuthoredState(
    catalog,
    biome,
    layout,
    plan,
    takeoverInteractionRequirements,
    frontierInteractionRequirements,
  );
}
