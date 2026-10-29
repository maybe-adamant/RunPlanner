import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createCompleteFGProject, goldenFStartId } from '@run-planner/test-fixtures/underworld';

/** The opening Apollo screen of the golden F route. */
export const forceApolloStartTrait = createTraitOfferAddress(
  createIncomingRewardAddress(createBiomeAddress('Underworld', 'F'), goldenFStartId),
  'source',
);

function withJudgment(
  project: ProjectDocument,
  biomeKey: string,
  arcanaKeys: readonly string[],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: project.route.routeKey,
      biomeKey,
      occurrenceId: createOccurrenceId(`golden-${biomeKey.toLowerCase()}-preboss-shop:boss`),
      phaseKey: 'Encounter',
    },
    arcanaKeys: [...arcanaKeys],
  });
}

/**
 * The golden F route opened by an Apollo screen under Apollo's force keepsake
 * (one Rarify use), with the screen card held: the screen is rerolled once per
 * entry of `earlierActions`, each engine-guessed earlier screen carrying those
 * Rarify clicks.
 */
export function forceApolloRerolledStartProject(
  earlierActions: readonly (readonly TraitOptionKey[])[],
): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys: ['ScreenReroll'],
  });
  // The screen card is held from the start, so the F Judgment draws the door card instead.
  project = withJudgment(project, 'F', [
    'DoorReroll',
    'StartingGold',
    'HealthRegen',
    'BonusDodge',
    'TradeOff',
  ]);
  project = withJudgment(project, 'G', [
    'LowManaDamageBonus',
    'CastCount',
    'SorceryRegenUpgrade',
    'CastBuff',
    'BonusHealth',
  ]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'ForceApolloBoonKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  const offer: AuthoredTraitOfferTraits = {
    kind: 'traits',
    giverKey: 'Apollo',
    options: [
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
    rarificationActions: [],
  };
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forceApolloStartTrait,
    value: offer,
  });
  if (earlierActions.length === 0) return project;
  const screens = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).rerolledTraitScreensGuess(forceApolloStartTrait, offer, earlierActions.length);
  if (screens === undefined) throw new Error('no legal chain of rerolled Apollo screens');
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forceApolloStartTrait,
    value: {
      ...offer,
      rerolledScreens: screens.map((screen, index) =>
        screen === null || !('options' in screen)
          ? null
          : {
              ...screen,
              ...((earlierActions[index] ?? []).length === 0
                ? {}
                : { rarificationActions: earlierActions[index] }),
            },
      ),
    },
  });
}
