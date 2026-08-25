import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type {
  AuthoredTraitOfferTraits,
  CandidateProjectionSession,
  WorkspaceSteadyGrowthControl,
} from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  reachedEchoProject,
  catalog,
  applyProjectCommand,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  simulateProjectAssembly,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  createCandidateSessionFactory,
  createGoldenFGHIProject,
} = support;

describe('resolution-interactions', () => {
  it('binds the real H Bridge Pom draft and its invalid authored target to the exact child', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = reachedEchoProject();
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
    const authoredOffer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (authoredOffer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const pomOffer = Object.freeze({
      ...authoredOffer,
      selectedOptionKey: 'option3' as const,
      options: Object.freeze([
        authoredOffer.options[0],
        authoredOffer.options[1],
        Object.freeze({
          ...authoredOffer.options[2],
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
    const pomDomain = pom?.forOffer(pomOffer).load();
    expect(pomDomain?.emptyNoOpAllowed).toBe(false);
    expect(pomDomain?.picker.sections.flatMap((section) => section.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Nova Strike', value: 'ApolloWeaponBoon' }),
        expect.objectContaining({ value: 'ZeusWeaponBoon', disabled: true, selected: true }),
      ]),
    );
    expect(pom?.control.marker.findingCount).toBeGreaterThan(0);
    expect(bound.assembly.preliminaryFocusDestinations.has(semanticAddressKey(child))).toBe(true);
    const pomCommand = pom?.intentFor(pomOffer, 'ApolloWeaponBoon').command;
    expect(
      pomCommand?.kind === 'ReplaceTraitOffer' && pomCommand.value.kind === 'traits'
        ? pomCommand.value.options[2]
        : undefined,
    ).toMatchObject({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: 'ApolloWeaponBoon' });
  });

  it('binds Steady Growth to its phase-owned candidate and exact target command', () => {
    const project = createGoldenFGHIProject();
    const owner = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const outcome = createSteadyGrowthOutcomeAddress(owner, 'Encounter');
    const control: WorkspaceSteadyGrowthControl = Object.freeze({
      address: outcome,
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 0,
        focusKey: 'test-steady-growth',
      }),
      phaseKey: 'Encounter',
    });
    const baseCandidateSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const candidateSession = Object.freeze({
      ...baseCandidateSession,
      steadyGrowthOutcome: () =>
        Object.freeze({
          kind: 'steadyGrowthOutcome' as const,
          result: Object.freeze({
            requiredIntervals: Object.freeze([6]),
            branchSupport: Object.freeze([true]),
            eligibleTargetKeys: Object.freeze(['ApolloWeaponBoon']),
            emptyNoOp: false,
            findings: Object.freeze([]),
            selectedPossible: true,
          }),
        }),
    }) as CandidateProjectionSession;
    const bound = bind(
      project,
      'Underworld',
      'F',
      undefined,
      candidateSession,
      new Map([[semanticAddressKey(outcome), control]]),
    );
    const interaction = bound.interactions.steadyGrowth.get(semanticAddressKey(outcome));
    if (interaction === undefined) throw new Error('Steady Growth interaction is missing');
    expect(
      interaction
        .forTarget()
        .load()
        ?.picker.sections.flatMap((section) => section.items)
        .map((item) => item.value),
    ).toEqual(['ApolloWeaponBoon']);
    const retainedDomain = interaction.forTarget('HestiaWeaponBoon').load();
    expect(
      retainedDomain?.picker.sections
        .flatMap((section) => section.items)
        .find((item) => item.value === 'HestiaWeaponBoon'),
    ).toMatchObject({ selected: true, state: 'impossible' });
    expect(interaction.intentFor('ApolloWeaponBoon').command).toEqual({
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
  });
});
