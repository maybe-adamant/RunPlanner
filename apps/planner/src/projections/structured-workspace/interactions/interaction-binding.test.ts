import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createRewardWheelOfferAddress,
  createRewardWheelAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  createRepresentativeNOPQProject,
  createRepresentativeNOPProject,
  createRepresentativeNProject,
  createRepresentativeNOPQShopTraitProject,
  createRepresentativeNOProject,
  appendCompleteN,
  appendNEntry,
  authorLegalTraitOffers,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createCandidateSessionFactory } from '@planner/projections/candidateProjection';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { createTraitDomainProjection } from '@planner/projections/traitDomainProjection';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex } from '../source-index';
import { bindWorkspaceInteractions } from './interaction-binding';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const services = {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker,
  rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
  traitDomain: createTraitDomainProjection(catalog, contextualPicker),
};

function bind(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  allocateOccurrenceId = () => createOccurrenceId('interaction-binding-start'),
  candidateSession?: CandidateProjectionSession,
) {
  const projectAssembly = simulateProjectAssembly(catalog, project);
  const evaluation = projectAssembly.evaluation;
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    evaluation,
    (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(projectAssembly, phase),
    (phase) => encounterPhaseFigLeafSupportForProjectEvaluationAssembly(projectAssembly, phase),
    (phase) => encounterPhaseGorgonSupportForProjectEvaluationAssembly(projectAssembly, phase),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
  const traitControls = new Map(
    [...assembly.rewardControls.values()]
      .flatMap((control) => control.traitOffers ?? [])
      .map((control) => [semanticAddressKey(control.address), control] as const),
  );
  const appendEncounterTraits = (
    rooms: readonly {
      readonly encounterPhases: readonly {
        readonly traitOffer?: import('../contract').WorkspaceTraitOfferControl;
        readonly gorgonAthena?: import('../contract').WorkspaceTraitOfferControl;
      }[];
    }[],
  ) => {
    for (const room of rooms) {
      for (const phase of room.encounterPhases) {
        if (phase.traitOffer !== undefined)
          traitControls.set(semanticAddressKey(phase.traitOffer.address), phase.traitOffer);
        if (phase.gorgonAthena !== undefined)
          traitControls.set(semanticAddressKey(phase.gorgonAthena.address), phase.gorgonAthena);
      }
    }
  };
  for (const node of assembly.nodes) {
    if (node.kind === 'occurrenceWorkbench') appendEncounterTraits([node.room]);
    else if (
      node.kind === 'ordinaryBatch' ||
      node.kind === 'takeoverBatch' ||
      node.kind === 'mixedBatch'
    )
      appendEncounterTraits(node.targets.map((target) => target.room));
    else if (node.kind === 'hubDecision') {
      appendEncounterTraits(
        node.slots.flatMap((slot) => (slot.room === undefined ? [] : [slot.room])),
      );
      appendEncounterTraits(
        node.visits.flatMap((visit) => (visit.room === undefined ? [] : [visit.room])),
      );
    }
  }
  const interactionServices =
    candidateSession === undefined
      ? services
      : Object.freeze({
          ...services,
          candidateSessions: Object.freeze({ bind: () => candidateSession }),
        });
  return {
    assembly,
    interactions: bindWorkspaceInteractions({
      allocateOccurrenceId,
      assembly: projectAssembly,
      batchInteractionRequirements: assembly.batchInteractionRequirements,
      catalog,
      frontierInteractionRequirements: assembly.frontierInteractionRequirements,
      hubInteractionRequirements: assembly.hubInteractionRequirements,
      hubTakeoverInteractionRequirements: assembly.hubTakeoverInteractionRequirements,
      occurrenceInteractionRequirements: assembly.occurrenceInteractionRequirements,
      rewardControls: assembly.rewardControls,
      traitControls,
      roomControls: assembly.roomControls,
      services: interactionServices,
      startInteractionRequirements: assembly.startInteractionRequirements,
      takeoverInteractionRequirements: assembly.takeoverInteractionRequirements,
      topologyRemovalInteractionRequirements: assembly.topologyRemovalInteractionRequirements,
    }),
  };
}

describe('structured workspace interaction binding', () => {
  it('binds the exact Gorgon condition replacement command', () => {
    const project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    const { interactions } = bind(project, 'Surface', 'P');
    const interaction = interactions.gorgonConditions.get(semanticAddressKey(phase));
    expect(interaction?.supported).toBe(true);
    expect(interaction?.intentFor(true).command).toEqual({
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
  });

  it('binds the Gorgon child editor to author decisions only', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const { interactions } = bind(project, 'Surface', 'P');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.owner.owner.kind === 'gorgonPhase',
    );
    if (interaction === undefined || interaction.value.kind !== 'traits')
      throw new Error('Gorgon Athena interaction is missing');
    expect(interaction.rarityEditable).toBe(false);
    expect(interaction.value.options.every((option) => option.rarity === 'Epic')).toBe(true);

    const changed = {
      ...interaction.value,
      options: [
        interaction.value.options[2]!,
        interaction.value.options[0]!,
        interaction.value.options[1]!,
      ],
      selectedOptionKey: 'option2' as const,
      rarificationActions: ['option1' as const],
      deathDefianceConditionMet: true,
    } satisfies AuthoredTraitOfferTraits;
    expect(interaction.intentFor(changed).command).toEqual({
      kind: 'ReplaceGorgonAthenaOffer',
      trait: interaction.owner,
      value: {
        traitKeys: changed.options.map((option) => option.traitKey),
        selectedOptionKey: 'option2',
      },
    });
  });

  it('publishes immediate engine-backed whole-offer feedback for remove, add, and Fallback Gold', () => {
    const { interactions } = bind(createGoldenFGHIProject(), 'Underworld', 'F');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) =>
        candidate.giver.providerKind === 'olympian' && candidate.value.kind === 'traits',
    );
    if (interaction === undefined || interaction.value.kind !== 'traits') {
      throw new Error('Olympian trait interaction is missing');
    }
    const removed = Object.freeze({
      ...interaction.value,
      options: Object.freeze(
        interaction.value.options.slice(0, -1),
      ) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    const [removedCandidate] = interaction.load(removed);
    if (removedCandidate?.evaluation.kind !== 'traitOffer') {
      throw new Error('removed trait offer did not receive an engine evaluation');
    }
    expect(removedCandidate.evaluation.result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'fullTraitOfferWidthRequired' })]),
    );

    const repaired = interaction.nextTraitOfferDraft?.(removed);
    if (repaired === undefined) throw new Error('engine did not provide an append draft');
    const [repairedCandidate] = interaction.load(repaired);
    expect(repairedCandidate?.evaluation).toMatchObject({
      kind: 'traitOffer',
      result: { supported: true },
    });

    const [fallbackCandidate] = interaction.load({
      kind: 'fallbackGold',
      giverKey: interaction.value.giverKey,
    });
    if (fallbackCandidate?.evaluation.kind !== 'traitOffer') {
      throw new Error('Fallback Gold did not receive an engine evaluation');
    }
    expect(fallbackCandidate.evaluation.result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'fallbackGoldUnavailable' })]),
    );
  });

  it('binds Circe draft switches and the blocking finding to the exact resolution child', () => {
    let project = createRepresentativeNOProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 1,
    });
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        oBiome,
        { kind: 'occurrence', occurrenceId: oOccurrenceIds.story },
        'Encounter',
      ),
      'selection',
    );
    const directOffer: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Circe',
      options: Object.freeze([
        Object.freeze({ traitKey: 'CirceShrinkTrait' }),
        Object.freeze({
          traitKey: 'RandomArcanaTrait',
          circeResolution: Object.freeze({
            kind: 'activateArcana' as const,
            arcanaKeys: Object.freeze(['ChanneledCast']),
          }),
        }),
        Object.freeze({
          traitKey: 'RemoveShrineTrait',
          circeResolution: Object.freeze({
            kind: 'disableFear' as const,
            vowKey: 'EnemyDamageShrineUpgrade',
          }),
        }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: directOffer,
    });
    const interaction = bind(project, 'Surface', 'O').interactions.traitOffers.get(
      semanticAddressKey(trait),
    );
    if (interaction === undefined) throw new Error('Circe interaction is missing');

    const redDraft = Object.freeze({ ...directOffer, selectedOptionKey: 'option2' as const });
    const red = interaction.optionDomain(redDraft, 'option2').circeResolution;
    expect(red?.control.address).toEqual(createCirceResolutionAddress(trait, 'option2'));
    expect(red?.forOffer(redDraft).load()).toMatchObject({
      effect: 'activateArcana',
      requiredCount: 1,
    });
    const redIntent = red?.intentFor(redDraft, {
      kind: 'activateArcana',
      arcanaKeys: ['ChanneledCast'],
    });
    expect(
      (redIntent?.command.value as AuthoredTraitOfferTraits | undefined)?.options[2]
        ?.circeResolution,
    ).toEqual(directOffer.options[2]?.circeResolution);

    const blackDraft = Object.freeze({ ...directOffer, selectedOptionKey: 'option3' as const });
    const black = interaction.optionDomain(blackDraft, 'option3').circeResolution;
    expect(black?.control.address).toEqual(createCirceResolutionAddress(trait, 'option3'));
    expect(black?.forOffer(blackDraft).load()).toMatchObject({
      effect: 'disableFear',
      requiredCount: 1,
    });

    const invalidOffer = Object.freeze({
      ...directOffer,
      options: Object.freeze([
        directOffer.options[0],
        Object.freeze({ traitKey: 'RandomArcanaTrait' }),
        directOffer.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2' as const,
    });
    const invalidProject = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: invalidOffer,
    });
    const invalid = bind(invalidProject, 'Surface', 'O');
    const child = createCirceResolutionAddress(trait, 'option2');
    expect(invalid.assembly.preliminaryFocusDestinations.has(semanticAddressKey(child))).toBe(true);
    expect(
      invalid.interactions.traitOffers
        .get(semanticAddressKey(trait))
        ?.optionDomain(invalidOffer, 'option2').circeResolution?.control.marker.findingCount,
    ).toBeGreaterThan(0);
  });

  it('binds the real H Bridge Pom draft and its invalid authored target to the exact child', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHIProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const bridge = project.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const defaultOffer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (defaultOffer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const pomOffer = Object.freeze({
      ...defaultOffer,
      selectedOptionKey: 'option3' as const,
      options: Object.freeze([
        defaultOffer.options[0],
        defaultOffer.options[1],
        Object.freeze({
          ...defaultOffer.options[2],
          echoPomTarget: 'ZeusWeaponBoon',
        }),
      ]) as AuthoredTraitOfferTraits['options'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: pomOffer,
    });

    const bound = bind(project, 'Underworld', 'H');
    const interaction = bound.interactions.traitOffers.get(semanticAddressKey(trait));
    if (interaction === undefined) throw new Error('Echo interaction is missing');
    const child = createEchoPomTargetAddress(trait, 'option3');
    const pom = interaction.optionDomain(pomOffer, 'option3').echoPomTarget;
    expect(pom?.control.address).toEqual(child);
    expect(pom?.forOffer(pomOffer).load()).toEqual({
      choices: [{ label: 'Nova Strike', value: 'ApolloWeaponBoon' }],
      emptyNoOpAllowed: false,
    });
    expect(pom?.control.marker.findingCount).toBeGreaterThan(0);
    expect(bound.assembly.preliminaryFocusDestinations.has(semanticAddressKey(child))).toBe(true);
    expect(
      (pom?.intentFor(pomOffer, 'ApolloWeaponBoon').command.value as AuthoredTraitOfferTraits)
        .options[2],
    ).toMatchObject({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: 'ApolloWeaponBoon' });
  });

  it('adapts the engine-owned Echo Boon row and append domains without recomputing distinctness', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHIProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const bridge = project.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const defaultOffer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (defaultOffer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const child = Object.freeze({
      options: Object.freeze([
        Object.freeze({
          giverKey: 'Zeus',
          traitKey: 'ZeusWeaponBoon',
          rarity: 'Common' as const,
        }),
        Object.freeze({
          giverKey: 'Apollo',
          traitKey: 'ApolloWeaponBoon',
          rarity: 'Rare' as const,
        }),
      ] as const),
      selectedOptionKey: 'option1' as const,
    });
    const boonOffer = Object.freeze({
      ...defaultOffer,
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastRunBoon', echoLastRunBoon: child }),
        defaultOffer.options[1],
        defaultOffer.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: boonOffer,
    });

    const interaction = bind(project, 'Underworld', 'H').interactions.traitOffers.get(
      semanticAddressKey(trait),
    );
    const boon = interaction?.optionDomain(boonOffer, 'option1').echoLastRunBoon;
    expect(boon?.control.address).toEqual(createEchoLastRunBoonAddress(trait, 'option1'));
    const domain = boon?.forOffer(boonOffer).load();
    expect(
      domain?.candidatesByOption[0]?.some(
        (candidate) => candidate.value.traitKey === 'ZeusWeaponBoon',
      ),
    ).toBe(true);
    expect(
      domain?.candidatesByOption[0]?.some(
        (candidate) => candidate.value.traitKey === 'ApolloWeaponBoon',
      ),
    ).toBe(false);
    expect(
      domain?.candidatesByOption[1]?.some(
        (candidate) => candidate.value.traitKey === 'ApolloWeaponBoon',
      ),
    ).toBe(true);
    expect(
      domain?.candidatesByOption[1]?.some(
        (candidate) => candidate.value.traitKey === 'ZeusWeaponBoon',
      ),
    ).toBe(false);
    expect(['ZeusWeaponBoon', 'ApolloWeaponBoon']).not.toContain(
      domain?.appendCandidate?.value.traitKey,
    );
  });

  it('binds one exact-address focused batch per unique option draft and reuses unchanged domains', async () => {
    const events: CandidateEvaluationEvent[] = [];
    const project = createGoldenFGHIProject();
    const observedCandidates = createCandidateSessionFactory(catalog, {
      observeCandidateEvaluation: (event) => events.push(event),
    });
    const observedSession = observedCandidates.bind(simulateProjectAssembly(catalog, project));
    const { interactions } = bind(project, 'Underworld', 'F', undefined, observedSession);
    const options = [...interactions.traitOffers.values()].filter(
      (interaction) => interaction.giver.providerKind !== 'hammer',
    );
    const interaction = options[0];
    const sibling = options[1];
    if (
      interaction === undefined ||
      sibling === undefined ||
      interaction.value.kind !== 'traits' ||
      sibling.value.kind !== 'traits'
    ) {
      throw new Error('focused trait interaction fixtures are missing');
    }
    const prepared = services.traitDomain.prepare(interaction.giver, interaction.value, 'option1');

    const initial = interaction.optionDomain(interaction.value, 'option1');
    expect(events).toEqual([]);
    const first = await initial.load();
    const firstBatch = events.filter((event) => event.kind === 'queryBatch');
    expect(first.candidates).toHaveLength(prepared.variants.length);
    expect(firstBatch).toEqual([expect.objectContaining({ queryCount: prepared.variants.length })]);

    events.length = 0;
    expect(interaction.optionDomain(interaction.value, 'option1')).toBe(initial);
    expect(await initial.load()).toBe(first);
    expect(events).toEqual([]);

    const secondOption = interaction.value.options[1];
    if (secondOption?.rarity === undefined) throw new Error('ranked sibling option is missing');
    const changedDraft = Object.freeze({
      ...interaction.value,
      options: Object.freeze([
        interaction.value.options[0],
        Object.freeze({
          ...secondOption,
          rarity: secondOption.rarity === 'Common' ? 'Rare' : 'Common',
        }),
        interaction.value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const changed = interaction.optionDomain(changedDraft, 'option1');
    expect(changed).not.toBe(initial);
    await changed.load();
    expect(events).toEqual([expect.objectContaining({ queryCount: prepared.variants.length })]);

    events.length = 0;
    await sibling.optionDomain(sibling.value, 'option1').load();
    expect(events).toEqual([expect.objectContaining({ queryCount: expect.any(Number) })]);
  });

  it('binds the selected targeted option to its exact engine target domain', async () => {
    const project = createGoldenFGHIProject();
    const baseSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const target = Object.freeze({
      evaluation: Object.freeze({
        kind: 'traitAcquisitionTarget' as const,
        result: Object.freeze({
          branchSupport: Object.freeze([true]),
          findings: Object.freeze([]),
          supported: true,
          traitKey: 'ApolloCastBoon',
        }),
      }),
      value: 'ApolloCastBoon',
    });
    const traitAcquisitionTargets = vi.fn(() => Object.freeze([target]));
    const candidateSession = Object.freeze({ ...baseSession, traitAcquisitionTargets });
    const { interactions } = bind(project, 'Underworld', 'F', undefined, candidateSession);
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined || interaction.value.kind !== 'traits')
      throw new Error('ranked trait interaction is missing');
    const draft = Object.freeze({
      ...interaction.value,
      options: Object.freeze([
        Object.freeze({ traitKey: 'BoonDecayBoon', rarity: 'Common' as const }),
        interaction.value.options[1],
        interaction.value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });

    const domain = interaction.optionDomain(draft, 'option1');
    expect(domain.hasTargetPicker).toBe(true);
    expect(traitAcquisitionTargets).not.toHaveBeenCalled();
    const projected = await domain.load();
    expect(traitAcquisitionTargets).toHaveBeenCalledWith(
      interaction.owner,
      draft,
      'option1',
      undefined,
    );
    expect(
      projected.targetPicker?.sections.flatMap((section) =>
        section.items.map((item) => item.value),
      ),
    ).toEqual(['ApolloCastBoon']);

    expect(interaction.optionDomain(draft, 'option2').hasTargetPicker).toBe(false);
  });

  it('bounds the largest declared Hammer domain to one focused query batch', async () => {
    const events: CandidateEvaluationEvent[] = [];
    const project = createGoldenFGHIProject();
    const observedCandidates = createCandidateSessionFactory(catalog, {
      observeCandidateEvaluation: (event) => events.push(event),
    });
    const observedSession = observedCandidates.bind(simulateProjectAssembly(catalog, project));
    const { interactions } = bind(project, 'Underworld', 'F', undefined, observedSession);
    const hammer = [...interactions.traitOffers.values()].find(
      (interaction) => interaction.giver.providerKind === 'hammer',
    );
    if (hammer === undefined) throw new Error('Hammer trait interaction fixture is missing');
    const largestDeclaredHammer = Object.values(catalog.traitGivers.byKey)
      .filter((giver) => giver.providerKind === 'hammer')
      .sort((left, right) => right.traitKeys.length - left.traitKeys.length)[0];
    if (largestDeclaredHammer === undefined) throw new Error('Hammer declaration is missing');
    expect(hammer.giver.key).toBe(largestDeclaredHammer.key);
    const prepared = services.traitDomain.prepare(hammer.giver, hammer.value, 'option1');

    expect(events).toEqual([]);
    const domain = await hammer.optionDomain(hammer.value, 'option1').load();
    expect(domain.candidates).toHaveLength(prepared.variants.length);
    expect(events).toEqual([
      expect.objectContaining({ queryCount: prepared.variants.length, kind: 'queryBatch' }),
    ]);
    await hammer.optionDomain(hammer.value, 'option1').load();
    expect(events).toHaveLength(1);
  });

  it('binds one provisional Hub-slot identity per explicit opening attempt', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: nVisitSlotKeys.slice(0, 5),
      kind: 'ReplaceHubVisitOrder',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const { interactions } = bind(project, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-opening-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    });
    const slot = [...interactions.hubSlots.values()].find((candidate) => !candidate.selected);
    if (slot === undefined) throw new Error('closed Hub-slot interaction is missing');

    expect(allocated).toEqual([]);
    const firstAttempt = slot.beginOpeningAttempt();
    expect(allocated).toEqual([createOccurrenceId('bound-hub-opening-1')]);
    const firstCandidates = firstAttempt.load();
    expect(firstAttempt.load()).toBe(firstCandidates);
    expect(firstAttempt.intentFor(true)).toEqual({
      command: {
        kind: 'OpenHubSlot',
        occurrenceId: createOccurrenceId('bound-hub-opening-1'),
        slot: slot.owner,
      },
    });
    expect(allocated).toHaveLength(1);

    const secondAttempt = slot.beginOpeningAttempt();
    expect(secondAttempt).not.toBe(firstAttempt);
    expect(allocated).toEqual([
      createOccurrenceId('bound-hub-opening-1'),
      createOccurrenceId('bound-hub-opening-2'),
    ]);
    expect(secondAttempt.key).toContain('bound-hub-opening-2');
  });

  it('binds Hub closure and complete visit-order proposals to exact commands', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: nVisitSlotKeys.slice(0, 5),
      kind: 'ReplaceHubVisitOrder',
    });
    const { interactions } = bind(project, 'Surface', 'N');
    const opened = [...interactions.hubSlots.values()].find(
      (candidate) => candidate.selected && candidate.close !== undefined,
    );
    if (opened?.selected !== true || opened.close === undefined) {
      throw new Error('closable Hub-slot interaction is missing');
    }
    const closeCandidate = opened.close.load().find((candidate) => !candidate.value);
    if (closeCandidate === undefined) throw new Error('Hub closure candidate is missing');
    expect(opened.close.intentFor(false)).toEqual({
      command: { kind: 'CloseHubSlot', slot: opened.owner },
    });

    const hub = createHubDecisionAddress(nBiome, 'hub');
    const visitOrder = interactions.hubVisitOrders.get(semanticAddressKey(hub));
    if (visitOrder === undefined) throw new Error('Hub visit-order interaction is missing');
    expect(interactions.hubVisitOrders).toHaveLength(1);
    const reordered = [
      visitOrder.selectedHubSlotKeys[0]!,
      visitOrder.selectedHubSlotKeys[2]!,
      visitOrder.selectedHubSlotKeys[1]!,
      ...visitOrder.selectedHubSlotKeys.slice(3),
    ];
    const replacement = visitOrder.proposalFor(reordered);

    expect(visitOrder.proposalFor(reordered)).toBe(replacement);
    expect(replacement.selected).toEqual(reordered);
    expect(replacement.intent()).toEqual({
      command: {
        hub,
        hubSlotKeys: reordered,
        kind: 'ReplaceHubVisitOrder',
      },
    });
    const shortened = visitOrder.proposalFor(visitOrder.selectedHubSlotKeys.slice(0, 3));
    expect(shortened.intent()).toEqual({
      command: {
        hub,
        hubSlotKeys: visitOrder.selectedHubSlotKeys.slice(0, 3),
        kind: 'ReplaceHubVisitOrder',
      },
    });
  });

  it('binds topology removals to exact commands with before-focus policy', () => {
    const { interactions } = bind(createRepresentativeNOPQProject(), 'Surface', 'N');
    const clear = interactions.topologyRemovals.get(semanticAddressKey(nBiome));
    const openingOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const remove = interactions.topologyRemovals.get(semanticAddressKey(openingOwner));
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const removeHub = interactions.topologyRemovals.get(semanticAddressKey(hub));

    expect(clear).toEqual({
      intent: {
        command: { biome: nBiome, kind: 'ClearTopology' },
        focus: { owner: nBiome, timing: 'before' },
      },
      key: semanticAddressKey(nBiome),
      owner: nBiome,
    });
    expect(remove).toEqual({
      intent: {
        command: { decision: openingOwner, kind: 'RemoveExitDecision' },
        focus: { owner: openingOwner, timing: 'before' },
      },
      key: semanticAddressKey(openingOwner),
      owner: openingOwner,
    });
    expect(removeHub).toEqual({
      intent: {
        command: { hub, kind: 'RemoveHubDecision' },
        focus: { owner: hub, timing: 'before' },
      },
      key: semanticAddressKey(hub),
      owner: hub,
    });
  });

  it('binds the terminal Hub takeover and completed handoff to exact commands', () => {
    const boardProject = authorLegalTraitOffers(
      appendNEntry(
        createProjectDocument(catalog, {
          configuredBiomeCounts: { Surface: 1 },
          name: 'Bound Hub board',
          projectId: 'bound-hub-board',
        }),
      ),
    );
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const takeover = bind(boardProject, 'Surface', 'N').interactions.hubTakeovers.get(
      semanticAddressKey(terminalOwner),
    );
    if (takeover === undefined) throw new Error('terminal Hub takeover interaction is missing');
    expect(takeover.owner).toEqual(terminalOwner);
    expect(takeover.hub).toEqual(hub);
    expect(takeover.load().evaluation).toMatchObject({ kind: 'hubTerminalTakeover' });
    expect(takeover.intent()).toEqual({
      command: { decision: terminalOwner, hub, kind: 'ReplaceWithHubDecision' },
      focus: { owner: hub, timing: 'after' },
    });

    const handoffProject = appendCompleteN(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Bound Hub handoff',
        projectId: 'bound-hub-handoff',
      }),
      { includePreboss: false },
    );
    const handoffOwner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const handoff = bind(handoffProject, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-handoff-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.takeoverBatches.get(semanticAddressKey(handoffOwner));
    if (handoff?.presentation !== 'completedHubHandoff') {
      throw new Error('completed Hub handoff interaction is missing');
    }
    expect(allocated).toEqual([]);
    expect(handoff.intent()).toEqual({
      command: {
        decision: handoffOwner,
        gameName: 'N_PreBoss01',
        kind: 'CreateTakeoverBatch',
        targetOccurrenceIds: { preboss: createOccurrenceId('bound-hub-handoff-1') },
      },
      focus: { owner: handoffOwner, timing: 'before' },
    });
    expect(allocated).toHaveLength(1);
  });

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

  it('rejects an out-of-domain start choice before allocating an occurrence', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Invalid start binding',
      projectId: 'invalid-start-binding',
    });
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('invalid-start-binding');
    }).interactions.starts.get(semanticAddressKey(biome));
    if (interaction?.kind !== 'choice') throw new Error('F choice start interaction is missing');
    const combat = catalog.rooms.byKey.F_Combat01;
    if (combat === undefined) throw new Error('F Combat 01 is missing');

    expect(() => interaction.intentFor(combat)).toThrow(
      `F_Combat01 is outside the declared start domain for ${semanticAddressKey(biome)}`,
    );
    expect(allocations).toBe(0);
  });

  it('binds normal-batch creation to an exact before-focus intent', () => {
    const startId = createOccurrenceId('structural-batch-start');
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Structural batch binding',
        projectId: 'structural-batch-binding',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: startId,
      },
    );
    let allocations = 0;
    const structural = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('unused-structural-batch-id');
    }).interactions.structural.get(semanticAddressKey(owner));
    if (structural?.action !== 'createBatch') {
      throw new Error('F normal-batch structural interaction is missing');
    }

    expect(allocations).toBe(0);
    expect(structural.intent).toEqual({
      command: { decision: owner, kind: 'CreateBatch' },
      focus: { owner, timing: 'before' },
    });
    expect(allocations).toBe(0);
  });

  it('binds existing and missing targets to exact replacement and lazy creation intents', () => {
    const startId = createOccurrenceId('target-binding-start');
    const firstCombatId = createOccurrenceId('target-binding-first-combat');
    const existingId = createOccurrenceId('target-binding-existing');
    const createdId = createOccurrenceId('target-binding-created');
    const firstSource = { kind: 'occurrence' as const, occurrenceId: startId };
    const source = { kind: 'occurrence' as const, occurrenceId: firstCombatId };
    const decision = createExitDecisionAddress(goldenFBiome, source);
    const existingTarget = createTargetAddress(goldenFBiome, source, 'exit1');
    const missingTarget = createTargetAddress(goldenFBiome, source, 'exit2');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Target interaction binding',
        projectId: 'target-interaction-binding',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: startId,
      },
    );
    project = applyProjectCommand(project, catalog, {
      decision: createExitDecisionAddress(goldenFBiome, firstSource),
      kind: 'CreateBatch',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, firstSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat03',
      kind: 'CreateTarget',
      occurrenceId: firstCombatId,
      target: createTargetAddress(goldenFBiome, firstSource, 'exit1'),
    });
    project = applyProjectCommand(project, catalog, { decision, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat04',
      kind: 'CreateTarget',
      occurrenceId: existingId,
      target: existingTarget,
    });
    let allocations = 0;
    const interactions = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createdId;
    }).interactions.rooms;
    const existing = interactions.get(semanticAddressKey(existingTarget));
    const missing = interactions.get(semanticAddressKey(missingTarget));
    if (existing?.kind !== 'targetRoom' || missing?.kind !== 'targetRoom') {
      throw new Error('existing and missing target-room interactions are required');
    }

    expect(allocations).toBe(0);
    expect(existing.owner).toEqual(existingTarget);
    expect(missing.owner).toEqual(missingTarget);
    existing.load();
    missing.load();
    expect(allocations).toBe(0);
    expect(existing.intentFor('F_Combat05')).toEqual({
      command: {
        gameName: 'F_Combat05',
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenFBiome, existingId),
      },
    });
    expect(allocations).toBe(0);
    expect(() => missing.intentFor('F_Opening01')).toThrow(
      `F_Opening01 is outside the target-room domain for ${semanticAddressKey(missingTarget)}`,
    );
    expect(allocations).toBe(0);
    expect(missing.intentFor('F_Combat05')).toEqual({
      command: {
        gameName: 'F_Combat05',
        kind: 'CreateTarget',
        occurrenceId: createdId,
        target: missingTarget,
      },
      focus: { owner: missingTarget, timing: 'after' },
    });
    expect(allocations).toBe(1);
  });

  it('binds all four reward owners to their exact no-focus replacement intents', () => {
    const project = createRepresentativeNOPQProject();
    const surfaceInteractions = {
      N: bind(project, 'Surface', 'N').interactions,
      O: bind(project, 'Surface', 'O').interactions,
      P: bind(project, 'Surface', 'P').interactions,
    };
    const replacement = { rewardType: 'MaxHealthDrop' } as const;
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
    const local = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const wheel = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const shop = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');

    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(incoming))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceIncomingReward', reward: incoming, value: replacement },
    });
    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(local))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceLocalReward', reward: local, value: replacement },
    });
    expect(
      surfaceInteractions.O.rewards.get(semanticAddressKey(wheel))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceRewardWheelOffer', offer: wheel, value: replacement },
    });
    expect(
      surfaceInteractions.P.rewards.get(semanticAddressKey(shop))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceShopOffer', offer: shop, value: replacement },
    });
  });

  it('binds a picked Narcissus pickup payload to its entry replacement command', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusI' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      'roomExit',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site,
      entryKeys: ['mysteryBoon'],
    });
    const entry = createAcquisitionEntryAddress(site, 'mysteryBoon');
    const interaction = bind(project, 'Underworld', 'G').interactions.rewards.get(
      semanticAddressKey(entry),
    );
    expect(
      interaction?.intentFor({
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      }),
    ).toEqual({
      command: {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
    });
  });

  it('withholds an ungenerated Ephyra reward binding while retaining its side controls', () => {
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const localReward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom,
      generation: 'notGenerated',
    });
    const { assembly, interactions } = bind(project, 'Surface', 'N');
    const combat = assembly.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceId('combat02'),
    );
    if (
      combat?.kind !== 'occurrenceWorkbench' ||
      combat.room.roomLocal.kind !== 'ephyra' ||
      combat.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('Ephyra ungenerated-side binding fixture is missing');
    }
    const slot = combat.room.roomLocal.sideRooms.group.slots.find(
      (candidate) => candidate.key === 'sideDoor2',
    );
    if (slot?.generation !== 'notGenerated') {
      throw new Error('Ephyra sideDoor2 was not projected as ungenerated');
    }

    expect(interactions.rewards.has(semanticAddressKey(localReward))).toBe(false);
    expect(interactions.sideRoomGenerations.get(semanticAddressKey(sideRoom))).toMatchObject({
      owner: sideRoom,
      selected: 'notGenerated',
    });
    expect(interactions.sideRoomEntryOrders.get(slot.entryOrder.interactionKey)).toBeDefined();
  });

  it('binds the only terminal Door 1 takeover choice to its exact replacement command', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const withoutDecision = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const interaction = bind(project, 'Underworld', 'F', () => {
      const occurrenceId = createOccurrenceId(`bound-takeover-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F terminal Door 1 decision-entry interaction is missing');
    }
    expect(allocated).toEqual([]);
    expect(interaction.owner).toEqual(target);
    expect(interaction.decisionOwner).toEqual(owner);
    const model = interaction.load();
    expect(allocated).toEqual([]);
    const items = model.sections.flatMap((section) => section.items);
    const preboss = items.find((item) => item.value.gameName === 'F_PreBoss01');
    if (preboss === undefined) throw new Error('F terminal Preboss choice is missing');
    expect(preboss).toMatchObject({ disabled: false, state: 'forced' });
    expect(items.map((item) => item.value.gameName)).toEqual(['F_PreBoss01']);
    expect(() => interaction.intentFor('F_Combat01')).toThrow(
      /outside the decision-entry room domain/,
    );
    expect(allocated).toEqual([]);

    const intent = interaction.intentFor('F_PreBoss01');
    expect(intent.focus).toEqual({ owner, timing: 'before' });
    const command = intent.command;
    if (command.kind !== 'ReplaceWithTakeoverBatch') {
      throw new Error('F terminal Preboss selection did not bind a takeover replacement');
    }
    expect(command).toMatchObject({
      decision: owner,
      gameName: 'F_PreBoss01',
      kind: 'ReplaceWithTakeoverBatch',
    });
    expect(Object.values(command.targetOccurrenceIds)).toEqual(allocated);
    expect(allocated).not.toHaveLength(0);
    expect(Object.keys(command.targetOccurrenceIds)).toHaveLength(allocated.length);
  });

  it('keeps unresolved ordinary decision entry choices visible but non-executable', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const started = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Unresolved direct F entry',
        projectId: 'unresolved-direct-f-entry',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: goldenFStartId,
      },
    );
    const project = applyProjectCommand(started, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('impossible-takeover-allocation');
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F unresolved Door 1 decision-entry interaction is missing');
    }
    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName !== 'F_PreBoss01');
    if (ordinary === undefined) throw new Error('F unresolved ordinary choice is missing');
    expect(ordinary).toMatchObject({ disabled: true, state: 'unassessed' });
    expect(allocations).toBe(0);
    expect(() => interaction.intentFor(ordinary.value.gameName)).toThrow(
      /not currently authorable/,
    );
    expect(allocations).toBe(0);
  });

  it('blocks a locally unresolved Fields Door 1 even when its ordinary room stays eligible', () => {
    const occurrenceId = createOccurrenceId('binding-h-fields-start');
    const owner = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId,
    });
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      configuredBiomeCount: 3,
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenHBiome,
      kind: 'CreateStart',
      occurrenceId,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenHBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'H', () => {
      allocations += 1;
      return createOccurrenceId(`binding-h-fields-allocation-${allocations}`);
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('H Fields Door 1 decision-entry interaction is missing');
    }

    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'H_Combat02');
    if (ordinary === undefined) throw new Error('H eligible ordinary Door 1 choice is missing');
    expect(ordinary).toMatchObject({ disabled: true, state: 'possible' });
    expect(() => interaction.intentFor('H_Combat02')).toThrow(/not currently authorable/);
    expect(allocations).toBe(0);
  });

  it('binds I’s empty-decision Preboss through the ordinary target path', () => {
    let project = createGoldenFGHIProject();
    const iPlan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    const prebossOccurrenceId = iPlan?.topology?.occurrences.find(
      (occurrence) => occurrence.gameName === 'I_PreBoss02',
    )?.occurrenceId;
    const prebossDecision = iPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.some((target) => target.occurrenceId === prebossOccurrenceId),
    );
    if (prebossOccurrenceId === undefined || prebossDecision?.kind !== 'exit') {
      throw new Error('I mixed Preboss decision fixture is missing');
    }
    const owner = createExitDecisionAddress(goldenIBiome, prebossDecision.source);
    project = applyProjectCommand(project, catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenIBiome, owner.source, 'exit1');
    const occurrenceId = createOccurrenceId('bound-i-ordinary-preboss');
    const interaction = bind(project, 'Underworld', 'I', () => occurrenceId).interactions.rooms.get(
      semanticAddressKey(target),
    );
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('I ordinary Preboss decision-entry interaction is missing');
    }

    const preboss = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'I_PreBoss02');
    if (preboss === undefined) throw new Error('I ordinary Preboss choice is missing');
    expect(preboss.disabled).toBe(false);
    expect(interaction.choices.some((choice) => choice.gameName !== 'I_PreBoss02')).toBe(true);
    expect(interaction.intentFor('I_PreBoss02')).toEqual({
      command: {
        gameName: 'I_PreBoss02',
        kind: 'CreateTarget',
        occurrenceId,
        target,
      },
      focus: { owner: target, timing: 'after' },
    });
  });

  it('binds O’s fixed terminal Preboss through Door 1 rather than a standalone action', () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const withoutDecision = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const target = createTargetAddress(oBiome, owner.source, 'exit1');
    const occurrenceId = createOccurrenceId('bound-fixed-takeover');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'O', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('O terminal Door 1 decision-entry interaction is missing');
    }
    const preboss = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'O_PreBoss01');
    expect(preboss).toMatchObject({ disabled: false, state: 'forced' });
    expect(allocations).toBe(0);
    expect(interaction.intentFor('O_PreBoss01')).toEqual({
      command: {
        decision: owner,
        gameName: 'O_PreBoss01',
        kind: 'ReplaceWithTakeoverBatch',
        targetOccurrenceIds: { exit1: occurrenceId },
      },
      focus: { owner, timing: 'before' },
    });
    expect(allocations).toBe(1);
  });

  it('does not publish ordinary room candidates beyond Q’s terminal decision envelope', () => {
    const owner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(qBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'Q', () => {
      allocations += 1;
      return createOccurrenceId(`q-terminal-ordinary-${allocations}`);
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('Q terminal Door 1 decision-entry interaction is missing');
    }
    const items = interaction.load().sections.flatMap((section) => section.items);
    expect(items.map((item) => item.value.gameName)).toEqual(['Q_PreBoss01']);
    expect(() => interaction.intentFor('Q_Combat01')).toThrow(
      /outside the decision-entry room domain/,
    );
    expect(allocations).toBe(0);
  });

  it('keeps a structurally valid unassessed ordinary Door 1 authorable behind a retained prefix', () => {
    const start = createOccurrenceId('retained-prefix-direct-start');
    const firstTarget = createOccurrenceId('retained-prefix-direct-first-target');
    const startOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    });
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Retained prefix direct entry',
        projectId: 'retained-prefix-direct-entry',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: start,
      },
    );
    project = applyProjectCommand(project, catalog, { decision: startOwner, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, startOwner.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat03',
      kind: 'CreateTarget',
      occurrenceId: firstTarget,
      target: createTargetAddress(goldenFBiome, startOwner.source, 'exit1'),
    });
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: firstTarget,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, owner.source),
      storeKey: 'RunProgress',
    });
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    const interaction = bind(project, 'Underworld', 'F').interactions.rooms.get(
      semanticAddressKey(target),
    );
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('retained-prefix Door 1 decision-entry interaction is missing');
    }
    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'F_Combat02');
    if (ordinary === undefined) throw new Error('retained-prefix ordinary choice is missing');
    expect(ordinary).toMatchObject({ disabled: false, state: 'unassessed' });
    expect(interaction.intentFor('F_Combat02').command).toMatchObject({
      gameName: 'F_Combat02',
      kind: 'CreateTarget',
      target,
    });
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

  it('binds customizable encounter phases lazily to exact top-level and local-child commands', () => {
    const project = createGoldenFGHIProject();
    const candidateSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const encounterPhases = vi.fn(candidateSession.encounterPhases);
    const observedSession = Object.freeze({ ...candidateSession, encounterPhases });
    const topLevelInteractions = bind(
      project,
      'Underworld',
      'I',
      undefined,
      observedSession,
    ).interactions;
    const localInteractions = bind(createRepresentativeNOPQProject(), 'Surface', 'N').interactions;
    const topLevel = [...topLevelInteractions.encounterPhases.values()].find(
      (interaction) =>
        interaction.owner.kind === 'encounterPhase' &&
        interaction.owner.owner.kind === 'occurrence',
    );
    const localChild = [...localInteractions.encounterPhases.values()].find(
      (interaction) =>
        interaction.owner.kind === 'encounterPhase' &&
        interaction.owner.owner.kind === 'localChild',
    );
    if (
      topLevel === undefined ||
      localChild === undefined ||
      topLevel.owner.kind !== 'encounterPhase' ||
      topLevel.owner.owner.kind !== 'occurrence' ||
      localChild.owner.kind !== 'encounterPhase' ||
      localChild.owner.owner.kind !== 'localChild'
    ) {
      throw new Error('active top-level and local-child encounter interactions are missing');
    }
    const selected = topLevel.selected;

    expect(encounterPhases).not.toHaveBeenCalled();
    const model = topLevel.load();
    expect(encounterPhases).toHaveBeenCalledOnce();
    expect(topLevel.load()).toBe(model);
    expect(model.selected?.value).toBe(selected);
    expect(model.sections.flatMap((section) => section.items).map((item) => item.value)).toContain(
      selected,
    );
    expect(topLevel.intentFor(selected).command).toEqual({
      encounterKey: selected,
      kind: 'SelectEncounter',
      phase: topLevel.owner,
    });
    expect(topLevel.resetIntent.command).toEqual({
      kind: 'ResetEncounter',
      phase: topLevel.owner,
    });
    expect(localChild.owner.owner).toMatchObject({
      kind: 'localChild',
      occurrenceId: expect.any(String),
    });
  });

  it('binds Fig Leaf as a separate phase-local command for fixed support and exact local children', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    const { interactions } = bind(project, 'Surface', 'N');
    const fixed = [...interactions.figLeafSkips.values()].find(
      (interaction) =>
        interaction.owner.kind === 'encounterPhase' &&
        interaction.owner.owner.kind === 'occurrence' &&
        interaction.owner.owner.occurrenceId === nOccurrenceIds.preHub,
    );
    expect(fixed).toBeDefined();
    expect(fixed?.intentFor(true).command).toMatchObject({
      kind: 'ReplaceFigLeafSkip',
      value: true,
      phase: fixed?.owner,
    });
    expect(
      [...interactions.encounterPhases.values()].some(
        (interaction) =>
          interaction.owner.kind === 'encounterPhase' &&
          interaction.owner.owner.kind === 'occurrence' &&
          interaction.owner.owner.occurrenceId === nOccurrenceIds.preHub,
      ),
    ).toBe(false);
    expect(
      [...interactions.figLeafSkips.values()].some(
        (interaction) =>
          interaction.owner.kind === 'encounterPhase' &&
          interaction.owner.owner.kind === 'localChild',
      ),
    ).toBe(false);
  });

  it('retains a selected invalid local-child Fig Leaf control for repair without publishing a candidate', () => {
    const parent = nOccurrenceId('combat02');
    const phase = createEncounterPhaseAddress(
      nBiome,
      { kind: 'localChild', occurrenceId: parent, groupKey: 'sideRooms', slotKey: 'sideDoor1' },
      'Encounter',
    );
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const { interactions } = bind(project, 'Surface', 'N');
    const interaction = interactions.figLeafSkips.get(semanticAddressKey(phase));
    expect(interaction).toMatchObject({ selected: true, supported: false });
    expect(interaction?.intentFor(false).command).toEqual({
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: false,
    });
  });

  it('withholds dormant Ship Combat2 and binds its active declaration-invalid multi-choice semantic', () => {
    const initial = createRepresentativeNOPQProject();
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const combat2 = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );

    expect(
      bind(initial, 'Surface', 'O').interactions.encounterPhases.has(semanticAddressKey(combat2)),
    ).toBe(false);

    const expanded = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const { assembly, interactions } = bind(expanded, 'Surface', 'O');
    const interaction = interactions.encounterPhases.get(semanticAddressKey(combat2));
    const node = assembly.nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === oOccurrenceIds.combat04,
    );

    expect(interaction).toMatchObject({
      owner: combat2,
      selected: 'GeneratedO',
    });
    expect(node).toMatchObject({
      kind: 'occurrenceWorkbench',
      room: {
        encounterPhases: expect.arrayContaining([
          expect.objectContaining({
            address: combat2,
            customizable: true,
            marker: expect.any(Object),
          }),
        ]),
      },
    });
    expect(assembly.preliminaryFocusDestinations.has(semanticAddressKey(combat2))).toBe(true);
  });

  it('binds Ship-wheel and Shop-purchase authored values from occurrence requirements', () => {
    const surface = createRepresentativeNOPQProject();
    const ship = bind(surface, 'Surface', 'O').interactions;
    const shop = bind(surface, 'Surface', 'N').interactions;
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const purchase = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(nBiome, nOccurrenceIds.preboss),
        'roomExit',
      ),
      'MajorNonBoon',
    );

    expect(
      ship.shipCombatPhaseCounts.get(
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
    expect(shop.acquisitionOrders.get(semanticAddressKey(purchase.site))).toMatchObject({
      owner: purchase.site,
      selected: [],
    });
  });

  it('retains an invalid paid-Shop Time Piece conversion as an engine-backed repair control', () => {
    const shopOffer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon');
    const acquisition = createAcquisitionRoleAddress(shopOffer, 'weaponUpgrade');
    let project = applyProjectCommand(createRepresentativeNOPQShopTraitProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionConversion',
      acquisition,
      value: 'gold',
    });

    const candidate = services.candidateSessions
      .bind(simulateProjectAssembly(catalog, project))
      .acquisitionConversion(acquisition);
    if (candidate.kind !== 'acquisitionConversion') {
      throw new Error(`expected acquisition conversion candidate, received ${candidate.kind}`);
    }
    expect(candidate.result).toMatchObject({
      goldSupported: false,
      goldConvertible: false,
      branchCount: expect.any(Number),
    });
    expect(candidate.result.unsupportedEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceProvenance: 'paid', goldConversionEligible: true }),
      ]),
    );
    const interaction = bind(project, 'Surface', 'P').interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    expect(interaction).toMatchObject({ owner: acquisition, visible: true, goldSupported: false });
    expect(interaction?.intentFor('normal')).toEqual({
      command: { kind: 'ReplaceAcquisitionConversion', acquisition, value: 'normal' },
    });
  });

  it('publishes Time Piece conversion controls only at supported acquisition frontiers', () => {
    const withoutTimePiece = bind(createCompleteFGProject(), 'Underworld', 'F').interactions;
    expect(
      [...withoutTimePiece.acquisitionConversions.values()].filter(
        (interaction) => interaction.visible,
      ),
    ).toEqual([]);

    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    const withTimePiece = bind(project, 'Underworld', 'F').interactions;
    const supported = [...withTimePiece.acquisitionConversions.values()].find(
      (interaction) => interaction.visible && interaction.goldSupported,
    );
    expect(supported).toBeDefined();
    if (supported === undefined) throw new Error('Time Piece conversion interaction is missing');
    expect(supported?.intentFor('gold')).toEqual({
      command: {
        kind: 'ReplaceAcquisitionConversion',
        acquisition: supported.owner,
        value: 'gold',
      },
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

    expect(repair.intent()).toEqual({
      command: {
        decision: repair.owner,
        gameName: requirement.gameName,
        kind: 'ReconcileTakeoverBatch',
        targetOccurrenceIds: Object.fromEntries(
          requirement.existingTargets.map((target) => [target.exitKey, target.occurrenceId]),
        ),
      },
      focus: { owner: repair.owner, timing: 'before' },
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
    expect(interaction.intent()).toEqual({
      command: {
        decision: owner,
        gameName: requirement.gameName,
        kind: 'ReconcileTakeoverBatch',
        targetOccurrenceIds: Object.fromEntries(
          requirement.existingTargets
            .filter((target) => requirement.requiredExitKeys.includes(target.exitKey))
            .map((target) => [target.exitKey, target.occurrenceId]),
        ),
      },
      focus: { owner, timing: 'before' },
    });
  });
});
