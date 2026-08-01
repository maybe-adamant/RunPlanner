import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceId,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const nBiome = createBiomeAddress('Surface', 'N');

export function createCompleteNProject(): ProjectDocument {
  let document = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'authored-complete-n',
      name: 'Authored Complete N',
      configuredBiomeCounts: { Surface: 1 },
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('round-trip-n-opening'),
    },
  );
  const openingDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('round-trip-n-opening'),
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateLinkedExit',
    decision: openingDecision,
    occurrenceId: createOccurrenceId('round-trip-n-prehub'),
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateHubDecision',
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (let index = 1; index <= 9; index += 1) {
    const slotKey = `combat${String(index).padStart(2, '0')}`;
    document = applyProjectCommand(document, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', slotKey),
      occurrenceId: createOccurrenceId(`round-trip-n-${slotKey}`),
    });
  }
  for (let index = 1; index <= 6; index += 1) {
    document = applyProjectCommand(document, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, 'hub', index),
      hubSlotKey: `combat${String(index).padStart(2, '0')}`,
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('round-trip-n-preboss') },
  });
}
