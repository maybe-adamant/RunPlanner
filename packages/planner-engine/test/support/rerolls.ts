import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
  type HubRerollAddress,
  type ProjectDocument,
  type AuthoredTraitOffer,
  type RoomActionAddress,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createCompleteFGProject, goldenFStartId } from '@run-planner/test-fixtures/underworld';

/** Replaces the route's manual Arcana selection. */
export function withArcana(
  project: ProjectDocument,
  arcanaKeys: readonly string[],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

/** Authors one Boss Judgment draw, which a held card makes due. */
export function withJudgment(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  arcanaKeys: readonly string[],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: project.route.routeKey,
      biomeKey,
      occurrenceId: occurrenceId as never,
      phaseKey: 'Encounter',
    },
    arcanaKeys,
  });
}

/** Underworld F and G Boss Judgment draws valid for the golden route. */
export function withGoldenUnderworldJudgments(project: ProjectDocument): ProjectDocument {
  return withJudgment(
    withJudgment(project, 'F', 'golden-f-preboss-shop:boss', [
      'ScreenReroll',
      'StartingGold',
      'HealthRegen',
      'BonusDodge',
      'TradeOff',
    ]),
    'G',
    'golden-g-preboss-shop:boss',
    ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth'],
  );
}

/** Every reward of the given types the exact candidate session accepts for a press. */
export function supportedRerollRewards(
  project: ProjectDocument,
  reroll: RoomActionAddress | HubRerollAddress,
  rewardTypes: readonly string[],
): readonly ResolvedRewardOffer[] {
  const session = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  );
  return rewardTypes
    .flatMap((type) => locallyValidRewardOffers(catalog.rewards, type))
    .filter((value) => {
      const result = session.evaluate({ kind: 'rerollReward', reroll, value });
      return result.kind === 'rerollReward' && result.result.supported;
    });
}

/** The first reward of a store the exact candidate session accepts for a press. */
export function firstSupportedReroll(
  project: ProjectDocument,
  reroll: RoomActionAddress | HubRerollAddress,
  storeKey: string,
): ResolvedRewardOffer {
  const types = [
    ...new Set(catalog.rewards.stores.byKey[storeKey]!.entries.map((entry) => entry.rewardType)),
  ];
  const [first] = supportedRerollRewards(project, reroll, types);
  if (first === undefined)
    throw new Error(`no reward is supported for ${semanticAddressKey(reroll)}`);
  return first;
}

/** The offer with `count` guessed legal screens rerolled away before its final rows. */
export function withGuessedRerolledScreens(
  project: ProjectDocument,
  trait: TraitOfferAddress,
  offer: AuthoredTraitOffer,
  count: number,
): AuthoredTraitOffer {
  if (count === 0) return { ...offer, rerolledScreens: [] } as AuthoredTraitOffer;
  const screens = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).rerolledTraitScreensGuess(trait, offer, count);
  if (screens === undefined) throw new Error(`no legal chain of ${count} rerolled screens`);
  return { ...offer, rerolledScreens: screens } as AuthoredTraitOffer;
}

/** The opening Apollo screen of the golden F route. */
export const forceApolloStartTrait = createTraitOfferAddress(
  createIncomingRewardAddress(createBiomeAddress('Underworld', 'F'), goldenFStartId),
  'source',
);

/**
 * The golden F route opened by an Apollo screen under Apollo's force keepsake,
 * with the screen card held: the screen is rerolled once per entry of
 * `earlierActions`, each guessed earlier screen carrying those Rarify clicks.
 */
export function forceApolloRerolledStartProject(
  earlierActions: readonly (readonly TraitOptionKey[])[],
  finalActions: readonly TraitOptionKey[] = [],
): ProjectDocument {
  // The screen card is held from the start, so the F Judgment draws the door card instead.
  let project = withJudgment(
    withJudgment(
      withArcana(createCompleteFGProject(), ['ScreenReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['DoorReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    ),
    'G',
    'golden-g-preboss-shop:boss',
    ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth'],
  );
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
  const guessed = withGuessedRerolledScreens(
    project,
    forceApolloStartTrait,
    offer,
    earlierActions.length,
  );
  if (guessed.kind !== 'traits') throw new Error('expected guessed Apollo screens');
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forceApolloStartTrait,
    value: {
      ...guessed,
      rarificationActions: finalActions,
      rerolledScreens: (guessed.rerolledScreens ?? []).map((screen, index) =>
        screen === null ? null : { ...screen, rarificationActions: earlierActions[index] ?? [] },
      ),
    },
  });
}
