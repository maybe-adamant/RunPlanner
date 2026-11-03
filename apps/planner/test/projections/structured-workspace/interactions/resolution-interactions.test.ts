import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type {
  AuthoredTraitOfferTraits,
  CandidateProjectionSession,
  WorkspaceSteadyGrowthControl,
  WorkspaceTranscendentEmbryoControl,
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
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTranscendentEmbryoOutcomeAddress,
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
    const bridge = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')!
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
    const pom = interaction
      .optionDomain(pomOffer, 'option3')
      .children.find(
        (
          entry,
        ): entry is Extract<typeof entry, { readonly child: { readonly kind: 'echoPomTarget' } }> =>
          entry.child.kind === 'echoPomTarget',
      );
    expect(pom?.child.address).toEqual(child);
    const pomDomain = pom?.forOffer(pomOffer).load();
    expect(pomDomain?.emptyNoOpAllowed).toBe(false);
    expect(pomDomain?.picker.sections.flatMap((section) => section.items)).toEqual(
      // F's run-wide history equips the Hestia weapon Boon, so that is the
      // forced Pom target.
      expect.arrayContaining([
        expect.objectContaining({ label: 'Flame Strike', value: 'HestiaWeaponBoon' }),
        expect.objectContaining({ value: 'ZeusWeaponBoon', state: 'impossible' }),
      ]),
    );
    expect(pom?.child.marker.findingCount).toBe(0);
    expect(bound.assembly.preliminaryFocusDestinations.has(semanticAddressKey(child))).toBe(true);
    expect(pom?.update(pomOffer, 'HestiaWeaponBoon').options[2]).toMatchObject({
      traitKey: 'EchoDoubleLevelBoon',
      echoPomTarget: 'HestiaWeaponBoon',
    });
  });

  it('binds Steady Growth to its source-owned candidate and exact target command', () => {
    const project = createGoldenFGHIProject();
    const owner = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const outcome = createSteadyGrowthOutcomeAddress(
      createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, owner.occurrenceId),
        'source',
      ),
      1,
    );
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
            requiredInterval: 6,
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

  it('binds an automatic Embryo transformation to its exact blessing command', () => {
    const project = createGoldenFGHIProject();
    const outcome = createTranscendentEmbryoOutcomeAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      1,
    );
    const control: WorkspaceTranscendentEmbryoControl = Object.freeze({
      address: outcome,
      value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 0,
        focusKey: 'test-transcendent-embryo',
      }),
      phaseKey: 'Encounter',
    });
    const baseCandidateSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const candidateSession = Object.freeze({
      ...baseCandidateSession,
      transcendentEmbryoOutcome: () =>
        Object.freeze({
          kind: 'transcendentEmbryoOutcome' as const,
          result: Object.freeze({
            eligibleBlessingKeys: Object.freeze(['ChaosElementalBlessing']),
            emptyNoOp: false,
            selectedPossible: true,
            rarity: 'Epic' as const,
          }),
        }),
    }) as CandidateProjectionSession;
    const bound = bind(
      project,
      'Underworld',
      'F',
      undefined,
      candidateSession,
      undefined,
      undefined,
      new Map([[semanticAddressKey(outcome), control]]),
    );
    const interaction = bound.interactions.transcendentEmbryo.get(semanticAddressKey(outcome));
    if (interaction === undefined) throw new Error('Embryo interaction is missing');
    expect(
      interaction
        .forBlessing()
        .load()
        ?.picker.sections.flatMap((section) => section.items)
        .map((item) => item.value),
    ).toEqual(['ChaosElementalBlessing']);
    expect(
      interaction.intentFor({ blessingKey: 'ChaosElementalBlessing', blessingValues: {} }).command,
    ).toEqual({
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome,
      value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
    });
  });
});
