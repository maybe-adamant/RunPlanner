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
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  authorRequiredTestRoomActions,
} from '@run-planner/test-fixtures/shared';
import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';

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
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
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
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTarget),
    gameName: 'H_MiniBoss02',
  });
  project = authorRequiredTestRoomActions(project, catalog);
  const forcedReward = createIncomingRewardAddress(goldenHBiome, forcedTarget);
  const rewardSession = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  );
  const replacement = catalog.traitGivers.values
    .filter((giver) => giver.providerKind === 'olympian')
    .map((giver) => ({
      giver,
      offer: {
        rewardType: 'Boon' as const,
        payload: { kind: 'BoonSource' as const, source: `${giver.key}Upgrade` },
      },
    }))
    .find(({ offer }) => {
      const evaluation = rewardSession.evaluate({
        kind: 'incomingReward',
        reward: forcedReward,
        value: offer,
      });
      return evaluation.kind === 'incomingReward' && evaluation.result.supported;
    });
  if (replacement === undefined) throw new Error('no candidate-supported H miniboss Boon');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: forcedReward,
    value: replacement.offer,
  });
  project = authorRequiredTestRoomActions(project, catalog);
  const forcedTrait = createTraitOfferAddress(forcedReward, 'source');
  const traitDraft = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).traitOfferStartingDraft(forcedTrait, replacement.giver.key);
  if (traitDraft === undefined) throw new Error('no candidate-supported H miniboss trait offer');
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forcedTrait,
    value: traitDraft,
  });
}
