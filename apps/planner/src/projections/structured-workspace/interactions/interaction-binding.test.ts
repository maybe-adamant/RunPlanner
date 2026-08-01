import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelAddress,
  createShopPurchaseAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createCandidateSessionFactory } from '@planner/projections/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex } from '../source-index';
import { bindWorkspaceInteractions } from './interaction-binding';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const services = {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker,
  rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
};

function bind(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  allocateOccurrenceId = () => createOccurrenceId('interaction-binding-start'),
) {
  const projectAssembly = simulateProjectAssembly(catalog, project);
  const evaluation = projectAssembly.evaluation;
  const source = createWorkspaceProjectSourceIndex(catalog, project, evaluation)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
  return {
    assembly,
    interactions: bindWorkspaceInteractions({
      allocateOccurrenceId,
      assembly: projectAssembly,
      batchInteractionRequirements: assembly.batchInteractionRequirements,
      catalog,
      frontierInteractionRequirements: assembly.frontierInteractionRequirements,
      hubInteractionRequirements: assembly.hubInteractionRequirements,
      occurrenceInteractionRequirements: assembly.occurrenceInteractionRequirements,
      rewardControls: assembly.rewardControls,
      roomControls: assembly.roomControls,
      services,
      startInteractionRequirements: assembly.startInteractionRequirements,
      takeoverInteractionRequirements: assembly.takeoverInteractionRequirements,
      topologyRemovalInteractionRequirements: assembly.topologyRemovalInteractionRequirements,
    }),
  };
}

describe('structured workspace interaction binding', () => {
  it('lazily binds the fixed start to one complete command and after-focus intent', () => {
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      name: 'Fixed start binding',
      projectId: 'fixed-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-fixed-start');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'N', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(nBiome));
    if (interaction?.kind !== 'fixed') throw new Error('N fixed start interaction is missing');

    expect(allocations).toBe(0);
    interaction.load();
    expect(allocations).toBe(0);
    expect(interaction).not.toHaveProperty('fixedGameName');
    expect(interaction.intent()).toEqual({
      command: { biome: nBiome, kind: 'CreateStart', occurrenceId },
      focus: {
        owner: createOccurrenceAddress(nBiome, occurrenceId),
        timing: 'after',
      },
    });
    expect(allocations).toBe(1);
  });

  it('lazily binds an authored start choice to one complete command and after-focus intent', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Choice start binding',
      projectId: 'choice-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-choice-start');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(biome));
    if (interaction?.kind !== 'choice') throw new Error('F choice start interaction is missing');

    expect(allocations).toBe(0);
    const room = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'F_Opening02')?.value;
    if (room === undefined) throw new Error('F Opening 02 start choice is missing');
    expect(allocations).toBe(0);
    expect(interaction.intentFor(room)).toEqual({
      command: {
        biome,
        gameName: 'F_Opening02',
        kind: 'CreateStart',
        occurrenceId,
      },
      focus: {
        owner: createOccurrenceAddress(biome, occurrenceId),
        timing: 'after',
      },
    });
    expect(allocations).toBe(1);
  });

  it('binds candidate takeovers to declaration labels and their exact create command', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const interaction = bind(project, 'Underworld', 'F').interactions.takeoverBatches.get(
      semanticAddressKey(owner),
    );
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F candidate takeover interaction is missing');
    }
    const candidates = interaction.load();
    const selected = candidates.find(
      (candidate) =>
        candidate.evaluation.kind === 'takeoverPrebossBatch' &&
        candidate.evaluation.result.selectedPossible,
    );
    if (selected === undefined || selected.evaluation.kind !== 'takeoverPrebossBatch') {
      throw new Error('F candidate takeover has no currently applicable declaration');
    }

    expect(candidates).not.toHaveLength(0);
    expect(candidates.every((candidate) => candidate.value.gameName.startsWith('F_'))).toBe(true);
    expect(selected.value).toEqual({
      gameName: selected.value.gameName,
      label: catalog.rooms.byKey[selected.value.gameName]?.label,
    });
    const command = interaction.commandFor(selected.value);
    expect(command).toMatchObject({
      decision: owner,
      gameName: selected.value.gameName,
      kind: 'CreateTakeoverBatch',
    });
    expect(Object.keys(command.targetOccurrenceIds)).toEqual(
      selected.evaluation.result.requiredExitKeys,
    );
    expect(Object.values(command.targetOccurrenceIds)).toEqual(
      selected.evaluation.result.requiredExitKeys.map(() => expect.any(String)),
    );
  });

  it('binds selected exit choices in canonical physical order after authored serialization reorders', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): ProjectDocument => ({
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: (reverse
                          ? [...plan.topology.decisions].reverse()
                          : plan.topology.decisions
                        ).map((decision) => {
                          if (decision.kind !== 'exit') return decision;
                          const normal =
                            decision.normal.kind !== 'batch' || !reverse
                              ? decision.normal
                              : {
                                  ...decision.normal,
                                  targets: [...decision.normal.targets].reverse(),
                                };
                          if (
                            decision.source.kind === 'occurrence' &&
                            decision.source.occurrenceId === forkSource
                          ) {
                            return {
                              ...decision,
                              normal,
                              selection: { kind: 'normal' as const, exitKey: 'exit2' },
                            };
                          }
                          if (
                            decision.source.kind === 'occurrence' &&
                            decision.source.occurrenceId === movedDecisionSource
                          ) {
                            return {
                              ...decision,
                              normal,
                              source: {
                                kind: 'occurrence' as const,
                                occurrenceId: selectedChildSource,
                              },
                            };
                          }
                          return normal === decision.normal ? decision : { ...decision, normal };
                        }),
                      },
                    },
              ),
            },
      ),
    });
    const interactionFor = (
      project: ProjectDocument,
      owner: ReturnType<typeof createExitDecisionAddress>,
    ) => {
      const interaction = [
        ...bind(project, 'Underworld', 'F').interactions.exitSelections.values(),
      ].find((candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner));
      if (interaction === undefined) {
        throw new Error(`exit-selection interaction for ${semanticAddressKey(owner)} is missing`);
      }
      return interaction;
    };
    const forkOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: forkSource,
    });
    const selectedChildOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: selectedChildSource,
    });
    const normalFork = interactionFor(withSelectedSpine(false), forkOwner);
    const reversedFork = interactionFor(withSelectedSpine(true), forkOwner);
    const normalSelectedChild = interactionFor(withSelectedSpine(false), selectedChildOwner);
    const reversedSelectedChild = interactionFor(withSelectedSpine(true), selectedChildOwner);

    expect(normalFork).toEqual({
      key: semanticAddressKey(createExitSelectionAddress(goldenFBiome, forkOwner.source)),
      owner: forkOwner,
      selectedExitKey: 'exit2',
      targets: [
        { label: 'exit1', value: 'exit1' },
        { label: 'exit2', value: 'exit2' },
      ],
    });
    expect(reversedFork).toEqual(normalFork);
    expect(reversedSelectedChild.targets).toEqual(normalSelectedChild.targets);
    expect(reversedSelectedChild.targets.map((target) => target.value)).toEqual(['exit1', 'exit2']);
  });

  it('binds Ephyra side-room proposals by exact local-child and group ownership', () => {
    const { assembly, interactions } = bind(createRepresentativeNOPQProject(), 'Surface', 'N');
    const combat = assembly.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    if (
      combat?.kind !== 'occurrenceWorkbench' ||
      combat.room.roomLocal.kind !== 'ephyra' ||
      combat.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('active Ephyra binding fixture is missing');
    }
    const group = combat.room.roomLocal.sideRooms.group;
    const sideDoor3 = group.slots.find((slot) => slot.key === 'sideDoor3');
    if (sideDoor3 === undefined) throw new Error('Ephyra sideDoor3 is missing');

    expect(
      interactions.sideRoomGenerations.get(semanticAddressKey(sideDoor3.address)),
    ).toMatchObject({ owner: sideDoor3.address, selected: sideDoor3.generation });
    expect(interactions.sideRoomEntryOrders.get(sideDoor3.entryOrder.interactionKey)).toMatchObject(
      {
        choices: sideDoor3.entryOrder.options.map((option) => ({
          label: option.label,
          value: option.proposedEnteredSlotKeys,
        })),
        owner: group.address,
        selected: sideDoor3.entryOrder.options.find(
          (option) => option.key === sideDoor3.entryOrder.selectedKey,
        )?.proposedEnteredSlotKeys,
      },
    );
  });

  it('binds Ship-wheel and Shop-purchase authored values from occurrence requirements', () => {
    const surface = createRepresentativeNOPQProject();
    const ship = bind(surface, 'Surface', 'O').interactions;
    const shop = bind(surface, 'Surface', 'N').interactions;
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const purchase = createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon');

    expect(
      ship.shipEncounterCounts.get(
        semanticAddressKey(createOccurrenceAddress(oBiome, oOccurrenceIds.combat04)),
      ),
    ).toMatchObject({ selected: 2 });
    expect(ship.rewardWheelOfferCounts.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(ship.rewardWheelStores.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 'RunProgress',
    });
    expect(ship.rewardWheelPicks.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(shop.shopPurchases.get(semanticAddressKey(purchase))).toMatchObject({
      owner: purchase,
      selected: false,
    });
  });

  it('constructs takeover repair commands from bound existing target identities', () => {
    const { assembly, interactions } = bind(createGoldenFGHIProject(), 'Underworld', 'F');
    const repair = [...interactions.takeoverBatches.values()].find(
      (interaction) => interaction.presentation === 'repair',
    );
    if (repair?.presentation !== 'repair') throw new Error('F takeover repair binding is missing');
    const requirement = [...assembly.takeoverInteractionRequirements.values()].find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(repair.owner),
    );
    if (requirement?.presentation !== 'repair') {
      throw new Error('F takeover repair requirement is missing');
    }

    expect(repair.execute()).toEqual({
      decision: repair.owner,
      gameName: requirement.gameName,
      kind: 'ReconcileTakeoverBatch',
      targetOccurrenceIds: Object.fromEntries(
        requirement.existingTargets.map((target) => [target.exitKey, target.occurrenceId]),
      ),
    });
  });

  it('retains a blocked takeover repair binding at its exact decision owner', () => {
    const base = createGoldenFGHIProject();
    const gPlan = base.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    const gTakeover = gPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (gTakeover?.kind !== 'exit' || gTakeover.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const owner = createExitDecisionAddress(goldenGBiome, gTakeover.source);
    let project = applyProjectCommand(base, catalog, {
      gameName: 'G_MiniBoss02',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const { assembly, interactions } = bind(project, 'Underworld', 'G');
    const requirement = [...assembly.takeoverInteractionRequirements.values()].find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
    );
    const interaction = interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (requirement?.presentation !== 'repair' || interaction?.presentation !== 'repair') {
      throw new Error('blocked G takeover repair binding is missing');
    }

    expect(interaction).toMatchObject({ action: 'reconcile', owner, presentation: 'repair' });
    expect(interaction.execute()).toEqual({
      decision: owner,
      gameName: requirement.gameName,
      kind: 'ReconcileTakeoverBatch',
      targetOccurrenceIds: Object.fromEntries(
        requirement.existingTargets
          .filter((target) => requirement.requiredExitKeys.includes(target.exitKey))
          .map((target) => [target.exitKey, target.occurrenceId]),
      ),
    });
  });
});
