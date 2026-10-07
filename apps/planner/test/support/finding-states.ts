import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
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
