import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  createTraitHistoryState,
  simulateProject,
} from '@run-planner/engine/simulation';
import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures';

/** Bounded Golden H reauthoring that truthfully acquires Gold before its reached Preboss Shop. */
export function createEchoGoldHPrebossProject(): ProjectDocument {
  const combat09 = createOccurrenceId('golden-h-combat09');
  const bridge = createOccurrenceId('golden-h-bridge01');
  const forcedTarget = createOccurrenceId('golden-h-combat05');
  let project = createGoldenFGHIProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: combat09,
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTarget),
    gameName: 'H_MiniBoss02',
  });
  const h = simulateProject(catalog, project).routes[0]?.biomes.find(
    (biome) => biome.biomeKey === 'H',
  );
  if (h?.authoring !== 'complete' || h.rewards.branches[0] === undefined)
    throw new Error('expected reached forced H miniboss frontier');
  const before = h.rewards.branches[0].traitHistory ?? createTraitHistoryState();
  const loadout = project.routes[0]!.loadout;
  const replacement = catalog.traitGivers.values
    .filter((giver) => giver.providerKind === 'olympian' && giver.key !== 'Apollo')
    .map((giver) => ({
      giver,
      traitKeys: giver.traitKeys.filter((traitKey) => {
        const trait = catalog.traits.byKey[traitKey];
        return (
          trait?.rarityDomain.kind === 'ranked' &&
          trait.rarityDomain.freshOfferRarities.includes('Common') &&
          trait.targetedAcquisition === undefined &&
          assessTraitOption(
            catalog,
            traitKey,
            before,
            { ...loadout, resolvedProviderKey: giver.key, deathDefianceConditionMet: false },
            'Common',
          ).legal
        );
      }),
    }))
    .find((candidate) => candidate.traitKeys.length >= 3);
  const [first, second, third] = replacement?.traitKeys ?? [];
  if (
    replacement === undefined ||
    first === undefined ||
    second === undefined ||
    third === undefined
  )
    throw new Error('no truthful forced-miniboss Boon leaf');
  const forcedReward = createIncomingRewardAddress(goldenHBiome, forcedTarget);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: forcedReward,
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: `${replacement.giver.key}Upgrade` },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(forcedReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: replacement.giver.key,
      options: [
        { traitKey: first, rarity: 'Common' },
        { traitKey: second, rarity: 'Common' },
        { traitKey: third, rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridge },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'EchoDoubleShop' },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
      deathDefianceConditionMet: false,
    },
  });
}
