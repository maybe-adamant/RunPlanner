import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createCompleteFGProject, goldenFStartId } from '@run-planner/test-fixtures/underworld';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { simulateProject } from '../../src/simulation';

const biome = createBiomeAddress('Underworld', 'F');
const reward = createIncomingRewardAddress(biome, goldenFStartId);
const trait = createTraitOfferAddress(reward, 'source');

function projectWithCallingCard(actions: readonly ('option1' | 'option2' | 'option3')[]) {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'RarifyKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait,
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: actions,
    },
  });
}

function rewards(project: ReturnType<typeof projectWithCallingCard>) {
  const f = simulateProject(catalog, project).routes.find(
    (route) => route.routeKey === 'Underworld',
  )?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F');
  return f.rewards;
}

function callingCardCandidate(before = createTraitHistoryState()) {
  return createTraitOfferCandidateArtifacts(
    catalog,
    new Map([
      [
        semanticAddressKey(trait),
        Object.freeze([
          Object.freeze({
            before,
            context: Object.freeze({ resolvedProviderKey: 'Apollo' }),
            keepsakes: createKeepsakeState(catalog, 'RarifyKeepsake'),
          }),
        ]),
      ],
    ]),
  ).at(trait)!;
}

describe('Calling Card offer settlement', () => {
  it('starts with zero Calling Card charges when the initial Arcana loadout is Unfated', () => {
    const arcanaFear = createArcanaFearState(catalog, {
      ...createDefaultRouteLoadout(catalog),
      manualArcanaKeys: ['DoorReroll'],
    });
    expect(createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear)).toMatchObject({
      fatedStatus: 'Unfated',
      callingCard: { remainingCharges: 0 },
    });
  });

  it('consumes an unselected row action while acquiring a different selected option', () => {
    const result = rewards(projectWithCallingCard(['option2']));
    const branch = result.branches[0]!;
    expect(branch.keepsakes.callingCard?.remainingCharges).toBe(5);
    expect(branch.traitHistory?.events).toContainEqual(
      expect.objectContaining({ kind: 'traitOffer', selectedOptionKey: 'option1' }),
    );
    const event = branch.traitHistory?.events.find((entry) => entry.kind === 'traitOffer');
    expect(event?.kind === 'traitOffer' ? event.options[0]?.rarity : undefined).toBe('Common');
    expect(event?.kind === 'traitOffer' ? event.options[1]?.rarity : undefined).toBe('Rare');
  });

  it('replays one row Common through Rare, Epic, and Heroic', () => {
    const result = rewards(projectWithCallingCard(['option1', 'option1', 'option1']));
    const branch = result.branches[0]!;
    const event = branch.traitHistory?.events.find((entry) => entry.kind === 'traitOffer');
    expect(branch.keepsakes.callingCard?.remainingCharges).toBe(3);
    expect(event?.kind === 'traitOffer' ? event.options[0]?.rarity : undefined).toBe('Heroic');
  });

  it('exhausts exactly six real actions across two rows', () => {
    const result = rewards(
      projectWithCallingCard(['option1', 'option1', 'option1', 'option2', 'option2', 'option2']),
    );
    const branch = result.branches[0]!;
    expect(branch.keepsakes.callingCard?.remainingCharges).toBe(0);
  });

  it('does not spend an inactive Calling Card action and preserves a later valid action', () => {
    let inactive = projectWithCallingCard(['option1']);
    inactive = applyProjectCommand(inactive, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'ManaOverTimeRefundKeepsake',
    });
    const inactiveResult = rewards(inactive);
    expect(inactiveResult.branches[0]?.keepsakes.callingCard).toBeUndefined();
    expect(inactiveResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'callingCardRarificationUnavailable',
        evidence: expect.objectContaining({ actionIndex: 0, optionKey: 'option1' }),
      }),
    );

    const valid = rewards(projectWithCallingCard(['option1']));
    expect(valid.branches[0]?.keepsakes.callingCard?.remainingCharges).toBe(5);
    expect(valid.branches[0]?.traitHistory?.events[0]).toEqual(
      expect.objectContaining({
        kind: 'traitOffer',
        options: expect.arrayContaining([expect.objectContaining({ rarity: 'Rare' })]),
      }),
    );
  });

  it('keeps an invalid composed offer unchanged and attributes its row action exactly', () => {
    let project = projectWithCallingCard(['option2']);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        options: [
          { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
          { traitKey: 'BoonDecayBoon', rarity: 'Common' },
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
        rarificationActions: ['option1'],
      },
    });
    const result = rewards(project);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.callingCard?.remainingCharges).toBe(6);
    expect(branch.traitHistory?.events).toHaveLength(0);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'callingCardRarificationUnavailable',
        origin: trait,
        evidence: expect.objectContaining({ actionIndex: 0, optionKey: 'option1' }),
      }),
    );
  });

  it('publishes candidate effective rarities, remaining charges, and row support from the selected replay', () => {
    const project = projectWithCallingCard(['option2']);
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits' as const,
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
      ],
      selectedOptionKey: 'option1' as const,
      rarificationActions: ['option2'] as const,
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const result = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'traitOffer',
      trait,
      value,
    });
    if (result.kind !== 'traitOffer') throw new Error('expected trait offer candidate');
    expect(result.result.callingCard).toEqual([
      expect.objectContaining({
        effectiveRarities: ['Common', 'Rare', 'Common'],
        remainingCharges: 5,
        rarifiableOptionKeys: ['option1', 'option2', 'option3'],
      }),
    ]);
  });

  it('attributes fourth-row-ceiling and seventh-charge actions exactly in the candidate product', () => {
    const project = projectWithCallingCard([]);
    const assembly = simulateProjectAssembly(catalog, project);
    const result = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'traitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [
          'option1',
          'option1',
          'option1',
          'option1',
          'option2',
          'option2',
          'option2',
        ],
      },
    });
    if (result.kind !== 'traitOffer') throw new Error('expected trait offer candidate');
    expect(result.result.callingCard?.[0]).toMatchObject({
      effectiveRarities: ['Heroic', 'Heroic', 'Common'],
      remainingCharges: 0,
      invalidActionIndexes: [3],
    });
    expect(result.result.findings).toContainEqual(
      expect.objectContaining({
        code: 'callingCardRarificationUnavailable',
        actionIndex: 3,
        optionKey: 'option1',
      }),
    );
  });

  it('keeps a Calling Card-derived Heroic row candidate-legal through its base offer', () => {
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: ['option1', 'option1', 'option1'],
    };
    const result = callingCardCandidate().evaluateOffer(value)[0]!;
    const callingCard = callingCardCandidate().callingCard(value)[0]!;

    expect(result.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(result.composition.legal).toBe(true);
    expect(
      callingCard.effectiveOffer.kind === 'traits' && callingCard.effectiveOffer.options[0]?.rarity,
    ).toBe('Heroic');
  });

  it('keeps a Calling Card-rarified replacement candidate-legal through its base offer', () => {
    const before = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer' as const,
        owner: { kind: 'project' as const },
        acquisitionRole: 'seed',
        sequence: 0,
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      },
    ]);
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: ['option1'],
    };
    const candidate = callingCardCandidate(before);
    const result = candidate.evaluateOffer(value)[0]!;
    const callingCard = candidate.callingCard(value)[0]!;

    expect(result.assessments[0]).toMatchObject({ legal: true });
    expect(result.replacementComposition.legal).toBe(true);
    expect(
      callingCard.effectiveOffer.kind === 'traits' && callingCard.effectiveOffer.options[0]?.rarity,
    ).toBe('Epic');
  });
});
