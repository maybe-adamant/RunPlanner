import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  semanticAddressKey,
  type HubRerollAddress,
  type ProjectDocument,
  type RoomActionAddress,
} from '@run-planner/engine/authored-project';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

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
