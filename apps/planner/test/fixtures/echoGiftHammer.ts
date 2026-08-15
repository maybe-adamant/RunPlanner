import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createCompletionRoomAddress,
  createEncounterPhaseAddress,
  createEchoKeepsakeReplayAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures';

export const echoGiftHammerReplayAddress = createKeepsakeEquipResultAddress(
  createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
  'experimentalHammer',
);

/**
 * A narrow product fixture for the reached H -> I Gift Hammer repair path.
 * Echo extends the characterized H route into its forced-miniboss window, so
 * the replaced room also receives a fresh, frontier-legal Aphrodite Boon leaf
 * instead of retaining the Golden fixture's chronologically stale Apollo leaf.
 */
export function createGoldenEchoGiftHammerPendingProject(): ProjectDocument {
  const forcedTargetId = createOccurrenceId('golden-h-combat05');
  const echo = createTraitOfferAddress(
    createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
      'Encounter',
    ),
    'selection',
  );
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
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTargetId),
    gameName: 'H_MiniBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenHBiome, forcedTargetId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenHBiome, forcedTargetId),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Aphrodite',
      options: [
        { traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
        { traitKey: 'HealthRewardBonusBoon', rarity: 'Common' },
        { traitKey: 'ManaBurstBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: echo,
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
      deathDefianceConditionMet: false,
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(goldenHBiome, 'postboss'),
    ),
    value: { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
  });
}
