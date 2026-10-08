import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  createOccurrenceId,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  authorLegalTraitOffers,
  prepareLegalPomTraitOffers,
  replaceTestRoomActionOrder,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  createRepresentativeNOPQShopTraitProject,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { fieldsGorgonBarrierProject } from './occurrence-workbench';

/** An Anomaly whose source selected Artemis, which the Anomaly cannot follow. */
export function artemisSourceAnomalyProject(): ProjectDocument {
  const source = { kind: 'occurrence' as const, occurrenceId: goldenGOccurrenceId(4, 1) };
  const project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(goldenGBiome, source, 'Encounter'),
    encounterKey: 'ArtemisCombatG',
  });
  return applyProjectCommand(authorLegalTraitOffers(project), catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(goldenGBiome, source, 'exit2'),
  });
}

/** A Fields cage cleared before the Athena interaction it must follow. */
export function cageBeforeAthenaProject(): ProjectDocument {
  return replaceTestRoomActionOrder(
    fieldsGorgonBarrierProject(),
    catalog,
    goldenHBiome,
    createOccurrenceId('golden-h-combat02'),
    [
      { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional2' },
      { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      { kind: 'interactGorgon', phaseKey: 'Cage01' },
      { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional1' },
      { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
      { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
    ],
  );
}

/** A Sea Star proc retained on a P Preboss Shop Pom that can no longer duplicate. */
export function staleSeaStarProject(): ProjectDocument {
  const shopId = pOccurrenceIds.prebossShop;
  const offer = createShopOfferAddress(pBiome, shopId, 'Minor');
  let project = applyProjectCommand(createRepresentativeNOPQShopTraitProject(), catalog, {
    kind: 'ReplaceShopOffer',
    offer,
    value: { rewardType: 'StackUpgrade' },
  });
  project = replaceTestShopOfferActions(project, catalog, createOccurrenceAddress(pBiome, shopId), [
    'Minor',
  ]);
  project = prepareLegalPomTraitOffers(project).project;
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceSeaStarResult',
    acquisition: createAcquisitionRoleAddress(offer, 'self'),
    procced: true,
  });
}

/** An unresolved All Together or Natural Selection pick after the boons it requires. */
export function groupedOutcomeProject(
  effect: 'All Together' | 'Natural Selection',
): ProjectDocument {
  const [giverKey, prerequisites, options] =
    effect === 'All Together'
      ? ([
          'Hera',
          [
            ['HeraWeaponBoon', 'HeraSpecialBoon', 'HeraCastBoon'],
            ['BoonDecayBoon', 'HeraManaBoon', 'HeraSprintBoon'],
            ['DamageSharePotencyBoon', 'HeraManaBoon', 'HeraSprintBoon'],
          ],
          ['HeraSpecialBoon', 'AllElementalBoon', 'HeraCastBoon'],
        ] as const)
      : ([
          'Demeter',
          [
            ['PoseidonWeaponBoon', 'PoseidonSpecialBoon', 'PoseidonCastBoon'],
            ['DemeterSpecialBoon', 'DemeterCastBoon', 'DemeterSprintBoon'],
            ['PlantHealthBoon', 'DemeterCastBoon', 'DemeterSprintBoon'],
          ],
          ['DemeterCastBoon', 'GoodStuffBoon', 'DemeterManaBoon'],
        ] as const);
  const sites = [goldenFStartId, goldenFOccurrenceId(2, 1), goldenFOccurrenceId(4, 1)];
  let project = createGoldenFGHIProject();
  for (const [index, traits] of prerequisites.entries()) {
    const giver = traits[0].startsWith('Poseidon') ? 'Poseidon' : giverKey;
    const reward = createIncomingRewardAddress(goldenFBiome, sites[index]!);
    const value = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: `${giver}Upgrade` },
    } as const;
    project = applyProjectCommand(
      project,
      catalog,
      index === 0
        ? {
            kind: 'ReplaceStartingReward',
            reward: createStartingRewardAddress('Underworld'),
            value,
          }
        : { kind: 'ReplaceIncomingReward', reward, value },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'source'),
      value: {
        kind: 'traits',
        giverKey: giver,
        selectedOptionKey: 'option1',
        options: [
          {
            traitKey: traits[0],
            rarity: 'Common',
            ...(traits[0] === 'BoonDecayBoon' ? { targetTraitKey: 'HeraWeaponBoon' } : {}),
          },
          { traitKey: traits[1], rarity: 'Common' },
          { traitKey: traits[2], rarity: 'Common' },
        ],
      },
    });
  }
  const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: `${giverKey}Upgrade` } },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(reward, 'source'),
    value: {
      kind: 'traits',
      giverKey,
      selectedOptionKey: 'option2',
      options: [
        { traitKey: options[0], rarity: 'Common' },
        { traitKey: options[1], rarity: effect === 'All Together' ? 'Legendary' : 'Duo' },
        { traitKey: options[2], rarity: 'Common' },
      ],
    },
  });
}

/** An Echo Boon Boon Boon choice whose first row the reached run cannot grant. */
export function unavailableEchoOptionProject(): ProjectDocument {
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-combat09'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
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
        {
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: {
            options: [
              { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
              { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option2',
          },
        },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  return project;
}
