import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createKeepsakeEquipResultAddress,
  createTraitOfferAddress,
  echoLastRewardPickupEntryKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { authorLegalTraitOffers, editTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import {
  authorFreshFileRoomIssues,
  createFreshFileRouteProject,
  newHFieldsRoomId,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createUnderworldFPoolCheckpoint,
} from '@run-planner/test-fixtures/underworld';

import { assessTraitOption, createTraitHistoryState } from '../../src/simulation/traits';
import { traitFrontierState } from '../support/simulation-state';

const goldenFBiome = createBiomeAddress('Underworld', 'F');
const goldenHBiome = createBiomeAddress('Underworld', 'H');

/**
 * Echo captures Experimental Hammer in H and the Postboss rack unequips it,
 * so I starts with an unauthored Hammer replay result.
 */
export function createEchoHammerReplayMissingProject(): ProjectDocument {
  const forcedTargetId = createOccurrenceId('golden-h-combat05');
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'TempHammerKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceExperimentalHammerEquipResult',
    result: createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'experimentalHammer',
    ),
    value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-combat09'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  const reachedH = simulateProject(catalog, project).route?.biomes.find(
    (biome) => biome.biomeKey === 'H',
  );
  if (reachedH === undefined || !('rewards' in reachedH) || reachedH.rewards === undefined)
    throw new Error('expected reached forced H miniboss frontier');
  const before = reachedH.rewards.branches[0]?.state.traitHistory ?? createTraitHistoryState();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTargetId),
    gameName: 'H_MiniBoss02',
  });
  const loadout = project.route.loadout;
  const apollo = catalog.traitGivers.byKey.Apollo!;
  const [first, second, third] = apollo.traitKeys.filter((traitKey) => {
    const trait = catalog.traits.byKey[traitKey];
    return (
      trait?.rarityDomain.kind === 'ranked' &&
      trait.rarityDomain.freshOfferRarities.includes('Common') &&
      trait.targetedAcquisition === undefined &&
      assessTraitOption(
        catalog,
        traitKey,
        traitFrontierState(before),
        { ...loadout, resolvedProviderKey: apollo.key },
        'Common',
      ).legal
    );
  });
  if (first === undefined || second === undefined || third === undefined)
    throw new Error('forced-miniboss Boon leaf is incomplete');
  const forcedReward = createIncomingRewardAddress(goldenHBiome, forcedTargetId);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: forcedReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(forcedReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: first, rarity: 'Common' },
        { traitKey: second, rarity: 'Common' },
        { traitKey: third, rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'EchoRepeatKeepsakeBoon' },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-preboss-shop:postboss')),
    ),
    keepsakeKey: 'ManaOverTimeRefundKeepsake',
  });
}

/** The F Pool checkpoint with its sold left slot cleared, so the Pool assessment reports it. */
export function createFPoolSaleClearedProject(): ProjectDocument {
  return applyProjectCommand(createUnderworldFPoolCheckpoint(), catalog, {
    kind: 'ReplacePurgingPoolSlot',
    occurrence: createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    ),
    slotKey: 'left',
    traitKey: null,
  });
}

/** Every intermediate project while the new Fresh H Fields room's issues are authored. */
export function freshFileHFieldsIssueSteps(): readonly ProjectDocument[] {
  const steps: ProjectDocument[] = [];
  authorFreshFileRoomIssues(
    withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
    'H',
    newHFieldsRoomId,
    (assembly) => {
      steps.push(assembly.project);
      return '';
    },
  );
  return steps;
}

/**
 * Echo Last Reward replays a Hammer at the H Bridge exit with its trait offer
 * unresolved. The Echo encounter's trait child attaches to the Bridge's later
 * exit-decision Run State capture.
 */
export function createEchoReplayUnresolvedHammerProject(): ProjectDocument {
  const bridge = createOccurrenceId('golden-h-bridge01');
  const echo = createTraitOfferAddress(
    createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: bridge },
      'Encounter',
    ),
    'selection',
  );
  const echoOffer = (
    options: readonly { readonly traitKey: string; readonly echoPomTarget?: null }[],
  ) => ({
    kind: 'traits' as const,
    giverKey: 'Echo',
    options: options as unknown as readonly [{ readonly traitKey: string }],
    selectedOptionKey: 'option1' as const,
    rarificationActions: [],
  });
  let project = authorLegalTraitOffers(
    applyProjectCommand(authorLegalTraitOffers(createGoldenFGHProject()), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    }),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: echo,
    value: echoOffer([
      { traitKey: 'EchoLastReward' },
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
    ]),
  });
  project = editTestRoomActionOrder(
    project,
    catalog,
    createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat09')),
    (order) => {
      const cage2 = order.find(
        (reference) =>
          reference.kind === 'interactLocalReward' &&
          reference.groupKey === 'cages' &&
          reference.slotKey === 'cage2',
      );
      if (cage2 === undefined) throw new Error('Combat09 Cage 2 action is missing');
      return [...order.filter((reference) => reference !== cage2), cage2];
    },
  );
  const forced = createOccurrenceId('golden-h-combat05');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forced),
    gameName: 'H_MiniBoss02',
  });
  project = authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, forced),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    }),
  );
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenHBiome, bridge), 'roomExit'),
      echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1'),
    ),
    value: { rewardType: 'MaxHealthDrop' },
  });
}
