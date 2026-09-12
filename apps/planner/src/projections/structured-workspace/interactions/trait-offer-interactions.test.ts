import { describe, expect, it, vi } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import { candidateSupport } from '@planner/projections/candidateProjection';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { optionIndex } from '@run-planner/engine/authored-project';
import type {
  WorkspaceTraitCarrierChildInteraction,
  WorkspaceTraitOptionDomainInteraction,
} from '../contract';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOfferAddress,
  CandidateProjectionSession,
  CandidateEvaluationEvent,
} from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  reachedEchoProject,
  services,
  catalog,
  applyProjectCommand,
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createExitSelectionAddress,
  createNaturalSelectionResultAddress,
  createOccurrenceId,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  simulateProjectAssembly,
  createGoldenFGHIProject,
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
  loadSurfaceNOPProject,
  loadSurfaceNOProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  createCandidateSessionFactory,
  createReachableNaturalChaosProject,
} = support;

function childFor<K extends WorkspaceTraitCarrierChildInteraction['child']['kind']>(
  domain: WorkspaceTraitOptionDomainInteraction,
  kind: K,
):
  | Extract<WorkspaceTraitCarrierChildInteraction, { readonly child: { readonly kind: K } }>
  | undefined {
  return domain.children.find(
    (
      entry,
    ): entry is Extract<
      WorkspaceTraitCarrierChildInteraction,
      { readonly child: { readonly kind: K } }
    > => entry.child.kind === kind,
  );
}

describe('trait-offer-interactions', () => {
  it('binds the Chaos editor to the real typed domain and one complete save intent', () => {
    const project = createReachableNaturalChaosProject();
    const { interactions } = bind(project, 'Underworld', 'F');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind === 'chaos',
    );
    if (interaction?.chaos === undefined) throw new Error('Chaos interaction is missing');
    expect(interaction.choices).toEqual([]);
    const draft = interaction.chaos.startingDraft();
    if (draft === undefined) throw new Error('Chaos default draft is missing');
    expect(draft.curseOptions).toHaveLength(3);
    expect(interaction.chaos.domainFor(draft)).toMatchObject({
      curseOptions: [
        expect.objectContaining({ optionKey: 'option1' }),
        expect.objectContaining({ optionKey: 'option2' }),
        expect.objectContaining({ optionKey: 'option3' }),
      ],
      blessingPicker: expect.objectContaining({
        selected: expect.objectContaining({ value: draft.blessingKey }),
        sections: expect.arrayContaining([
          expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ value: draft.blessingKey })]),
          }),
        ]),
      }),
    });
    expect(interaction.intentFor(draft).command).toEqual({
      kind: 'ReplaceTraitOffer',
      trait: interaction.owner,
      value: draft,
    });
  });

  it('conservatively projects Rejected repair and mixed-branch rules through a bound ordinary interaction', () => {
    const { interactions } = bind(createGoldenFGHIProject(), 'Underworld', 'F');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) =>
        candidate.giver.providerKind === 'olympian' && candidate.value?.kind === 'traits',
    );
    if (interaction?.rejectedBlockDomain === undefined)
      throw new Error('ordinary Rejected interaction is missing');
    const required = Object.freeze({
      rejectedBlockRequired: true,
      rejectedBlockableOptionKeys: Object.freeze(['option2', 'option3'] as const),
      rejectedBlockNeedsRepair: true,
    });
    expect(interaction.rejectedBlockDomain([required])).toEqual({
      required: true,
      canClear: false,
      needsRepair: true,
      optionKeys: ['option2', 'option3'],
    });
    expect(
      interaction.rejectedBlockDomain([
        Object.freeze({ ...required, rejectedBlockNeedsRepair: false }),
      ]),
    ).toEqual({
      required: true,
      canClear: false,
      needsRepair: false,
      optionKeys: ['option2', 'option3'],
    });
    expect(
      interaction.rejectedBlockDomain([
        Object.freeze({
          ...required,
          rejectedBlockableOptionKeys: Object.freeze(['option3'] as const),
        }),
        Object.freeze({ ...required, rejectedBlockRequired: false }),
      ]),
    ).toEqual({
      required: false,
      canClear: false,
      needsRepair: true,
      optionKeys: ['option3'],
    });
  });

  it('projects the selected Spell Hex tree with layout and identity exclusion', () => {
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const reward = createIncomingRewardAddress(goldenFBiome, occurrenceId);
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    let authored = project;
    const trait = createTraitOfferAddress(reward, 'self');
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'SpellDrop',
        options: [
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
          { traitKey: 'SpellTransformTrait' },
        ],
        selectedOptionKey: 'option2',
        rarificationActions: [],
      },
    });
    const { interactions } = bind(authored, 'Underworld', 'F');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind === 'spell' && candidate.value?.kind === 'traits',
    );
    if (interaction === undefined || interaction.value?.kind !== 'traits')
      throw new Error('Spell Hex interaction is missing');
    const optionDomain = interaction.optionDomain(
      interaction.value,
      interaction.value.selectedOptionKey,
    );
    const hex = childFor(optionDomain, 'hexTree');
    if (hex === undefined) throw new Error('selected Spell Hex editor is missing');
    const declaration =
      catalog.hexes.byKey[
        interaction.value.options[optionIndex(interaction.value.selectedOptionKey)]!.traitKey
      ];
    if (declaration === undefined) throw new Error('selected Spell Hex declaration is missing');
    const domain = hex.forOffer(interaction.value).load();
    if (domain === undefined) throw new Error('selected Spell Hex domain is missing');
    expect(domain.layoutPicker.sections.flatMap((section) => section.items)).toHaveLength(4);
    expect(domain.godSent.providerKey).toBeDefined();
    const selectedRare = domain.value.rareTalentKeys[0]!;
    expect(domain.rarePickerFor(domain.value.rareTalentKeys, selectedRare).selected?.value).toBe(
      selectedRare,
    );
    expect(
      domain
        .rarePickerFor(domain.value.rareTalentKeys, domain.value.rareTalentKeys[1])
        .sections.flatMap((section) => section.items)
        .find((item) => item.value === selectedRare)?.disabled,
    ).toBe(true);

    const expectedLayouts = [
      ['Lung', 2, 1],
      ['Pyramid', 3, 1],
      ['Maze', 3, 2],
      ['Nacelle', 3, 2],
    ] as const;
    for (const [layoutKey, rareCount, epicCount] of expectedLayouts) {
      const transitioned = hex.transitionFor(interaction.value, layoutKey);
      expect(transitioned.rareTalentKeys).toHaveLength(rareCount);
      expect(transitioned.epicTalentKeys).toHaveLength(epicCount);
      const transitionedDomain = hex
        .forOffer({ ...interaction.value, hexTree: transitioned })
        .load();
      if (transitionedDomain === undefined) throw new Error(`${layoutKey} Hex domain is missing`);
      expect(transitionedDomain.layoutPicker.selected?.value).toBe(layoutKey);
      expect(
        transitionedDomain
          .rarePickerFor(transitioned.rareTalentKeys, transitioned.rareTalentKeys[0])
          .sections.flatMap((section) => section.items),
      ).toHaveLength(declaration.rareCandidates.values.length);
      expect(
        transitionedDomain
          .epicPickerFor(transitioned.epicTalentKeys, transitioned.epicTalentKeys[0])
          .sections.flatMap((section) => section.items),
      ).toHaveLength(declaration.epicCandidates.values.length);
      if (transitioned.rareTalentKeys.length > 1) {
        expect(
          transitionedDomain
            .rarePickerFor(transitioned.rareTalentKeys, transitioned.rareTalentKeys[1])
            .sections.flatMap((section) => section.items)
            .find((item) => item.value === transitioned.rareTalentKeys[0])?.disabled,
        ).toBe(true);
      }
      if (transitioned.epicTalentKeys.length > 1) {
        expect(
          transitionedDomain
            .epicPickerFor(transitioned.epicTalentKeys, transitioned.epicTalentKeys[1])
            .sections.flatMap((section) => section.items)
            .find((item) => item.value === transitioned.epicTalentKeys[0])?.disabled,
        ).toBe(true);
      }
    }

    const transitioned = hex.transitionFor(interaction.value, 'Maze');
    const saved = applyProjectCommand(
      authored,
      catalog,
      Object.freeze({
        kind: 'ReplaceTraitOffer' as const,
        trait,
        value: hex.update(interaction.value, transitioned),
      }),
    );
    const reloaded = bind(saved, 'Underworld', 'F').interactions.traitOffers.get(interaction.key);
    expect(reloaded?.value?.kind === 'traits' ? reloaded.value.hexTree?.layoutKey : undefined).toBe(
      'Maze',
    );
  });

  it('binds the Gorgon child editor to author decisions only', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
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
    if (interaction === undefined) throw new Error('Gorgon Athena interaction is missing');
    expect(interaction.value).toBeNull();
    expect(interaction.resetIntent).toBeUndefined();
    expect(interaction.rarityEditable).toBe(false);
    const draft = interaction.traitsStartingDraft?.();
    if (draft?.kind !== 'traits') throw new Error('Gorgon Athena draft is missing');
    expect(draft.options.every((option) => option.rarity === 'Epic')).toBe(true);

    const changed = {
      ...draft,
      options: [draft.options[2]!, draft.options[0]!, draft.options[1]!],
      selectedOptionKey: 'option2' as const,
      rarificationActions: ['option1' as const],
    } satisfies AuthoredTraitOfferTraits;
    expect(interaction.intentFor(changed).command).toEqual({
      kind: 'ReplaceGorgonAthenaOffer',
      trait: interaction.owner,
      value: {
        traitKeys: changed.options.map((option) => option.traitKey),
        selectedOptionKey: 'option2',
      },
    });
    const authored = applyProjectCommand(project, catalog, interaction.intentFor(changed).command);
    const completed = [...bind(authored, 'Surface', 'P').interactions.traitOffers.values()].find(
      (candidate) => candidate.owner.owner.kind === 'gorgonPhase',
    );
    expect(completed?.resetIntent?.command).toEqual({
      kind: 'ResetEncounterTraitOffer',
      trait: interaction.owner,
    });
  });

  it('publishes immediate engine-backed whole-offer feedback for remove, add, and Fallback Gold', () => {
    const { interactions } = bind(createGoldenFGHIProject(), 'Underworld', 'F');
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) =>
        candidate.giver.providerKind === 'olympian' && candidate.value?.kind === 'traits',
    );
    if (interaction === undefined || interaction.value?.kind !== 'traits') {
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

    expect(interaction.nextOptionalHighTierDraft?.(removed)).toBeUndefined();

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

  it('saves and reloads a Persephone row through the complete whole-offer intent', () => {
    const project = createGoldenFGHIProject();
    const initial = bind(project, 'Underworld', 'F');
    const interaction = [...initial.interactions.traitOffers.values()].find(
      (candidate) =>
        candidate.giver.providerKind === 'olympian' && candidate.value?.kind === 'traits',
    );
    if (interaction === undefined || interaction.value?.kind !== 'traits') {
      throw new Error('Olympian trait interaction is missing');
    }
    const original = interaction.value;
    const changed = Object.freeze({
      ...original,
      options: Object.freeze([
        Object.freeze({ ...original.options[0], persephoneLevelBonus: 5 }),
        original.options[1],
        original.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2' as const,
    });
    const saved = applyProjectCommand(project, catalog, interaction.intentFor(changed).command);
    const reloaded = bind(saved, 'Underworld', 'F').interactions.traitOffers.get(interaction.key);
    expect(reloaded?.value).toEqual(changed);
    expect(reloaded?.value?.kind === 'traits' ? reloaded.value.options[1] : undefined).toEqual(
      original.options[1],
    );
    expect(reloaded?.value?.kind === 'traits' ? reloaded.value.selectedOptionKey : undefined).toBe(
      'option2',
    );
  });

  it('binds Circe draft switches and the blocking finding to the exact resolution child', () => {
    let project = loadSurfaceNOProject();
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
    const red = childFor(interaction.optionDomain(redDraft, 'option2'), 'circeResolution');
    expect(red?.child.address).toEqual(createCirceResolutionAddress(trait, 'option2'));
    expect(red?.forOffer(redDraft).load()).toMatchObject({
      effect: 'activateArcana',
      requiredCount: 1,
    });
    const redValue = red?.update(redDraft, {
      kind: 'activateArcana',
      arcanaKeys: ['ChanneledCast'],
    });
    expect(
      (redValue?.kind === 'traits' ? redValue.options[2] : undefined)?.circeResolution,
    ).toEqual(directOffer.options[2]?.circeResolution);

    const blackDraft = Object.freeze({ ...directOffer, selectedOptionKey: 'option3' as const });
    const black = childFor(interaction.optionDomain(blackDraft, 'option3'), 'circeResolution');
    expect(black?.child.address).toEqual(createCirceResolutionAddress(trait, 'option3'));
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
    const invalidInteraction = invalid.interactions.traitOffers.get(semanticAddressKey(trait));
    expect(
      invalidInteraction === undefined
        ? undefined
        : childFor(invalidInteraction.optionDomain(invalidOffer, 'option2'), 'circeResolution')
            ?.child.marker.findingCount,
    ).toBeGreaterThan(0);
  });

  it('binds four active All Together children and keeps retained detail dormant off-selection', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const trait = createTraitOfferAddress(reward, 'source');
    const authored: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        Object.freeze({
          traitKey: 'AllElementalBoon',
          rarity: 'Legendary' as const,
          allTogetherResult: Object.freeze({
            earth: 'ElementalDamageBoon',
            fire: 'ElementalBaseDamageBoon',
            air: 'ElementalDamageFloorBoon',
            water: 'ElementalHealthBoon',
          }),
        }),
        Object.freeze({ traitKey: 'HeraManaBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: authored,
    });
    const baseSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const real = bind(project, 'Underworld', 'F', undefined, baseSession);
    const realInteraction = real.interactions.traitOffers.get(semanticAddressKey(trait));
    if (realInteraction === undefined) throw new Error('real All Together interaction is missing');
    const realOffer = realInteraction.load(authored)[0];
    if (realOffer === undefined) throw new Error('real All Together outer candidate is missing');
    expect(candidateSupport(realOffer)).toBe('impossible');
    const realSets = realInteraction
      .optionDomain(authored, 'option1')
      .children.filter(
        (
          child,
        ): child is Extract<
          typeof child,
          { readonly child: { readonly kind: 'allTogetherSet' } }
        > => child.child.kind === 'allTogetherSet',
      );
    expect(realSets.map((set) => set.child.address)).toEqual([
      createAllTogetherSetAddress(trait, 'option1', 'earth'),
      createAllTogetherSetAddress(trait, 'option1', 'fire'),
      createAllTogetherSetAddress(trait, 'option1', 'air'),
      createAllTogetherSetAddress(trait, 'option1', 'water'),
    ]);
    const realEarth = realSets[0];
    if (realEarth === undefined) throw new Error('real earth set is missing');
    expect(realEarth.forOffer(authored).load()).toBeDefined();
    const repaired = realEarth.update(authored, {
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: 'ElementalHealthBoon',
    });
    expect(repaired.options[0]?.allTogetherResult?.earth).toBe('ElementalOlympianDamageBoon');
    expect(candidateSupport(realInteraction.load(repaired)[0])).toBe('impossible');
    expect(
      realInteraction
        .optionDomain(repaired, 'option1')
        .children.filter((child) => child.child.kind === 'allTogetherSet')
        .map((child) => child.child.address),
    ).toEqual(realSets.map((set) => set.child.address));
    const allTogetherSet = vi.fn(
      (
        _owner: unknown,
        _value: unknown,
        _optionKey: unknown,
        setKey: 'earth' | 'fire' | 'air' | 'water',
      ) => ({
        kind: 'allTogetherSetDomain' as const,
        result: {
          setKey,
          candidates:
            setKey === 'earth'
              ? Object.freeze([
                  Object.freeze({
                    value: 'ElementalDamageBoon',
                    support: 'possible' as const,
                    branchSupport: Object.freeze([true]),
                    selected: true,
                  }),
                  Object.freeze({
                    value: 'ElementalOlympianDamageBoon',
                    support: 'possible' as const,
                    branchSupport: Object.freeze([true]),
                    selected: false,
                  }),
                ])
              : ([] as const),
        },
      }),
    );
    const candidateSession = Object.freeze({
      ...baseSession,
      traitCarrierChildDomain: (
        _owner: unknown,
        _value: unknown,
        child: { readonly kind: string; readonly setKey?: 'earth' | 'fire' | 'air' | 'water' },
      ) =>
        child.kind === 'allTogetherSet' && child.setKey !== undefined
          ? allTogetherSet(undefined, undefined, undefined, child.setKey)
          : baseSession.traitCarrierChildDomain(_owner as never, _value as never, child as never),
    });
    const active = bind(project, 'Underworld', 'F', undefined, candidateSession);
    const interaction = active.interactions.traitOffers.get(semanticAddressKey(trait));
    if (interaction === undefined) throw new Error('All Together interaction is missing');
    const sets = interaction
      .optionDomain(authored, 'option1')
      .children.filter(
        (
          child,
        ): child is Extract<
          typeof child,
          { readonly child: { readonly kind: 'allTogetherSet' } }
        > => child.child.kind === 'allTogetherSet',
      );
    expect(sets.map((set) => set.child.setKey)).toEqual(['earth', 'fire', 'air', 'water']);
    const earth = sets?.[0];
    if (earth === undefined || earth.child.kind !== 'allTogetherSet')
      throw new Error('earth set missing');
    expect(earth.child.address).toEqual(createAllTogetherSetAddress(trait, 'option1', 'earth'));
    expect(
      earth
        .forOffer(authored)
        .load()
        ?.picker.sections.flatMap((section) => section.items),
    ).toEqual([
      expect.objectContaining({ label: 'Martial Art', value: 'ElementalDamageBoon' }),
      expect.objectContaining({ label: 'Rallying Cry', value: 'ElementalOlympianDamageBoon' }),
    ]);
    expect(
      active.assembly.preliminaryFocusDestinations.has(semanticAddressKey(earth.child.address)),
    ).toBe(true);

    const dormantProject = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait,
      selectedOptionKey: 'option2',
    });
    const dormant = bind(dormantProject, 'Underworld', 'F', undefined, candidateSession);
    const dormantInteraction = dormant.interactions.traitOffers.get(semanticAddressKey(trait));
    if (dormantInteraction?.value?.kind !== 'traits') throw new Error('dormant offer is missing');
    expect(
      dormantInteraction
        .optionDomain(dormantInteraction.value, 'option1')
        .children.some((child) => child.child.kind === 'allTogetherSet'),
    ).toBe(false);
    expect(dormantInteraction.value.options[0]?.allTogetherResult).toEqual(
      authored.options[0]?.allTogetherResult,
    );
    expect(
      dormant.assembly.preliminaryFocusDestinations.has(
        semanticAddressKey(createAllTogetherSetAddress(trait, 'option1', 'earth')),
      ),
    ).toBe(false);
  });

  it('binds Natural Selection to one exact child command and retains its engine-backed domain', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    });
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Demeter',
      options: Object.freeze([
        Object.freeze({ traitKey: 'GoodStuffBoon', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Epic' as const }),
        Object.freeze({ traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value,
    });
    const baseCandidateSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const candidateSession = Object.freeze({
      ...baseCandidateSession,
      traitCarrierChildDomain: () =>
        Object.freeze({
          kind: 'naturalSelectionResult' as const,
          result: Object.freeze({
            branchSupport: Object.freeze([false]),
            complete: false,
            findings: Object.freeze([]),
            nextTargetTraitKeys: Object.freeze(['ApolloWeaponBoon']),
            supported: false,
          }),
        }),
    }) as CandidateProjectionSession;
    const bound = bind(project, 'Underworld', 'F', undefined, candidateSession);
    const interaction = bound.interactions.traitOffers.get(semanticAddressKey(trait));
    if (interaction === undefined) throw new Error('Natural Selection interaction is missing');
    const natural = interaction
      .optionDomain(value, 'option1')
      .children.find(
        (
          child,
        ): child is Extract<
          typeof child,
          { readonly child: { readonly kind: 'naturalSelectionResult' } }
        > => child.child.kind === 'naturalSelectionResult',
      );
    if (natural === undefined) throw new Error('Natural Selection child is missing');
    expect(natural.child.address).toEqual(createNaturalSelectionResultAddress(trait, 'option1'));
    const domain = natural.forOffer(value).load();
    expect(domain?.complete).toBe(false);
    const retained = natural.forOffer(value, 'HestiaWeaponBoon').load();
    const retainedItem = retained?.picker.sections
      .flatMap((section) => section.items)
      .find((item) => item.value === 'HestiaWeaponBoon');
    expect(retainedItem).toMatchObject({ selected: true, state: 'impossible' });
    const nextValue = Object.freeze({
      ...value,
      options: Object.freeze([
        Object.freeze({ ...value.options[0]!, naturalSelectionTargets: ['ApolloWeaponBoon'] }),
        ...value.options.slice(1),
      ]) as unknown as AuthoredTraitOfferTraits['options'],
    });
    const command = interaction.intentFor(nextValue).command;
    expect(command).toMatchObject({
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        options: [
          { naturalSelectionTargets: ['ApolloWeaponBoon'] },
          expect.anything(),
          expect.anything(),
        ],
      },
    });
  });

  it('projects Natural Selection targets from an unsaved selected draft', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const trait = createTraitOfferAddress(reward, 'source');
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    });
    const interaction = bind(project, 'Underworld', 'F').interactions.traitOffers.get(
      semanticAddressKey(trait),
    );
    if (interaction === undefined) throw new Error('Demeter interaction is missing');
    const draft: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Demeter',
      options: Object.freeze([
        Object.freeze({ traitKey: 'GoodStuffBoon', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Epic' as const }),
        Object.freeze({ traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    expect(
      interaction
        .optionDomain(draft, 'option1')
        .children.find((child) => child.child.kind === 'naturalSelectionResult')?.child,
    ).toMatchObject({
      address: createNaturalSelectionResultAddress(trait, 'option1'),
      optionKey: 'option1',
      slotCount: 8,
    });
  });

  it('adapts engine-owned Echo Boon distinctness into contextual row domains', () => {
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
      ...authoredOffer,
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastRunBoon', echoLastRunBoon: child }),
        authoredOffer.options[1],
        authoredOffer.options[2],
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
    const boon =
      interaction === undefined
        ? undefined
        : childFor(interaction.optionDomain(boonOffer, 'option1'), 'echoLastRunBoon');
    expect(boon?.child.address).toEqual(createEchoLastRunBoonAddress(trait, 'option1'));
    const domain = boon?.forOffer(boonOffer).load();
    const firstRow = domain?.traitPickerFor(
      ['ApolloWeaponBoon'],
      Object.freeze({ giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon' }),
    );
    const firstItems = firstRow?.sections.flatMap((section) => section.items) ?? [];
    expect(firstItems.find((item) => item.value.traitKey === 'ZeusWeaponBoon')).toMatchObject({
      selected: true,
    });
    expect(firstItems.find((item) => item.value.traitKey === 'ApolloWeaponBoon')).toMatchObject({
      state: 'impossible',
      disabled: true,
    });
    const selectableRarities = domain?.rarityPickerFor({
      giverKey: 'Zeus',
      traitKey: 'ZeusWeaponBoon',
    });
    expect(
      selectableRarities?.sections.flatMap((section) => section.items).map((item) => item.value),
    ).toEqual(expect.arrayContaining(['Common', 'Rare', 'Epic', 'Heroic']));
    const fixedDuo = domain?.rarityPickerFor({
      giverKey: 'Aphrodite',
      traitKey: 'SprintEchoBoon',
    });
    expect(
      fixedDuo?.sections.flatMap((section) => section.items).map((item) => item.value),
    ).toEqual(['Duo']);
  });

  it('summarizes a floor-active BBB row as cached rarity to granted rarity', () => {
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
    const child = Object.freeze({
      options: Object.freeze([
        Object.freeze({
          giverKey: 'Aphrodite',
          traitKey: 'AphroditeWeaponBoon',
          rarity: 'Common' as const,
        }),
      ] as const),
      selectedOptionKey: 'option1' as const,
    });
    const boonOffer = Object.freeze({
      ...authoredOffer,
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastRunBoon', echoLastRunBoon: child }),
        authoredOffer.options[1],
        authoredOffer.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: boonOffer,
    });
    const baseSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const traitCarrierChildDomain = vi.fn(
      (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        carrier: Parameters<typeof baseSession.traitCarrierChildDomain>[2],
      ) => {
        const evaluated = baseSession.traitCarrierChildDomain(owner, value, carrier);
        if (evaluated.kind !== 'echoLastRunBoonDomain') return evaluated;
        return Object.freeze({
          ...evaluated,
          result: Object.freeze({
            candidates: Object.freeze(
              evaluated.result.candidates.map((candidate) =>
                candidate.option.giverKey === 'Aphrodite' &&
                candidate.option.traitKey === 'AphroditeWeaponBoon' &&
                candidate.option.rarity === 'Common'
                  ? Object.freeze({ ...candidate, effectiveRarity: 'Rare' as const })
                  : candidate,
              ),
            ),
          }),
        });
      },
    );
    const candidateSession = Object.freeze({ ...baseSession, traitCarrierChildDomain });
    const interaction = bind(
      project,
      'Underworld',
      'H',
      undefined,
      candidateSession,
    ).interactions.traitOffers.get(semanticAddressKey(trait));
    const boon =
      interaction === undefined
        ? undefined
        : childFor(interaction.optionDomain(boonOffer, 'option1'), 'echoLastRunBoon');
    expect(traitCarrierChildDomain).not.toHaveBeenCalled();
    const loadable = boon?.forOffer(boonOffer);
    const domain = loadable?.load();
    expect(traitCarrierChildDomain).toHaveBeenCalledTimes(1);
    expect(domain?.summaryFor(child)).toBe('Flutter Strike · Common → Rare');
    expect(domain?.labelFor(child.options[0])).toBe('Flutter Strike');
    expect(domain?.effectiveRarityFor(child.options[0])).toBe('Rare');
    expect(domain?.effectiveLevelFor(child.options[0])).toBe(1);
    expect(traitCarrierChildDomain).toHaveBeenCalledTimes(1);
  });

  it('binds the exact Echo replay owner to existing acquisition candidate products', () => {
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
    const bridge = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const authoredOffer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (authoredOffer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const rewardOffer = Object.freeze({
      ...authoredOffer,
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastReward' }),
        authoredOffer.options[1],
        authoredOffer.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: rewardOffer,
    });

    const bound = bind(project, 'Underworld', 'H');
    const interaction = bound.interactions.traitOffers.get(semanticAddressKey(trait));
    const replay = interaction
      ?.feedbackFor(interaction.value!)
      .find((entry) => entry.kind === 'echoLastReward')?.control;
    const replayOwner = createEchoLastRewardAddress(trait, 'option1');
    expect(replay?.address).toEqual(replayOwner);
    expect(replay?.acquisitionEntry).toMatchObject({
      kind: 'acquisitionEntry',
      site: { kind: 'acquisitionSite', pointKey: 'roomExit' },
    });
    expect(bound.assembly.preliminaryFocusDestinations.has(semanticAddressKey(replayOwner))).toBe(
      true,
    );
    expect(interaction?.optionDomain(rewardOffer, 'option1')).not.toHaveProperty('echoLastReward');
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
      interaction.value?.kind !== 'traits' ||
      sibling.value?.kind !== 'traits'
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
        kind: 'traitAcquisitionTargetDomain' as const,
        result: Object.freeze({
          sourceTraitKey: 'BoonDecayBoon',
          candidates: Object.freeze([
            Object.freeze({
              kind: 'traitAcquisitionTarget' as const,
              result: Object.freeze({
                branchSupport: Object.freeze([true]),
                findings: Object.freeze([]),
                supported: true,
                traitKey: 'ApolloCastBoon',
              }),
            }),
          ]),
        }),
      }),
    });
    const traitCarrierChildDomain = vi.fn(() => target.evaluation);
    const candidateSession = Object.freeze({
      ...baseSession,
      traitCarrierChildDomain,
    }) as unknown as CandidateProjectionSession;
    const { interactions } = bind(project, 'Underworld', 'F', undefined, candidateSession);
    const interaction = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined || interaction.value?.kind !== 'traits')
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
    const targetChild = domain.children.find(
      (
        child,
      ): child is Extract<
        typeof child,
        { readonly child: { readonly kind: 'traitAcquisitionTarget' } }
      > => child.child.kind === 'traitAcquisitionTarget',
    );
    if (targetChild === undefined) throw new Error('target child is missing');
    expect(targetChild.child.address).toMatchObject({
      kind: 'traitAcquisitionTarget',
      trait: interaction.owner,
      optionKey: 'option1',
    });
    expect(traitCarrierChildDomain).not.toHaveBeenCalled();
    const projected = await targetChild.forOffer(draft).load();
    expect(traitCarrierChildDomain).toHaveBeenCalledWith(
      interaction.owner,
      draft,
      targetChild.child,
    );
    expect(
      projected?.targetPicker.sections.flatMap((section) =>
        section.items.map((item) => item.value),
      ),
    ).toEqual(['ApolloCastBoon']);
    const dormant = interaction.optionDomain(draft, 'option2');
    expect(dormant.children).toEqual([]);
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
    if (hammer?.value?.kind !== 'traits')
      throw new Error('Hammer trait interaction fixture is missing');
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
});
