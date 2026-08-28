import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createEchoKeepsakeReplayAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTranscendentEmbryoOutcomeAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

export const echoGiftHammerReplayAddress = createKeepsakeEquipResultAddress(
  createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
  'experimentalHammer',
);

export const echoGiftEmbryoReplayAddress = createKeepsakeEquipResultAddress(
  createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
  'transcendentEmbryo',
);

/**
 * A narrow product fixture for the reached H -> I Gift Hammer repair path.
 * Echo extends the characterized H route into its forced-miniboss window, so
 * the replaced room also receives a fresh, frontier-legal Aphrodite Boon leaf
 * instead of retaining the Golden fixture's chronologically stale Apollo leaf.
 */
function createGoldenEchoGiftKeepsakePendingProject(
  keepsakeKey: 'TempHammerKeepsake' | 'RandomBlessingKeepsake',
): ProjectDocument {
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
    keepsakeKey,
  });
  project =
    keepsakeKey === 'TempHammerKeepsake'
      ? applyProjectCommand(project, catalog, {
          kind: 'ReplaceExperimentalHammerEquipResult',
          result: createKeepsakeEquipResultAddress(
            createRouteStartKeepsakeSelectionAddress('Underworld'),
            'experimentalHammer',
          ),
          value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
        })
      : applyProjectCommand(project, catalog, {
          kind: 'ReplaceTranscendentEmbryoEquipResult',
          result: createKeepsakeEquipResultAddress(
            createRouteStartKeepsakeSelectionAddress('Underworld'),
            'transcendentEmbryo',
          ),
          value: { blessingKey: 'ChaosElementalBlessing' },
        });
  if (keepsakeKey === 'RandomBlessingKeepsake') {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(
        createOccurrenceAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b7-e1'),
        ),
        'Encounter',
      ),
      blessingKey: 'ChaosElementalBlessing',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(
        createOccurrenceAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-b4-e1'),
        ),
        'Encounter',
      ),
      blessingKey: 'ChaosElementalBlessing',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(
        createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-bridge01')),
        'Encounter',
      ),
      blessingKey: 'ChaosElementalBlessing',
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-combat09'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = authorLegalTraitOffers(project);
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
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTargetId),
    gameName: 'H_MiniBoss02',
  });
  const forcedReward = createIncomingRewardAddress(goldenHBiome, forcedTargetId);
  const rewardSession = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  );
  const supportedSource = catalog.traitGivers.values
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
  if (supportedSource === undefined) throw new Error('no candidate-supported H miniboss Boon');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: forcedReward,
    value: supportedSource.offer,
  });
  const forcedTrait = createTraitOfferAddress(forcedReward, 'source');
  const traitDraft = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).traitOfferStartingDraft(forcedTrait, supportedSource.giver.key);
  if (traitDraft === undefined) throw new Error('no candidate-supported H miniboss trait offer');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forcedTrait,
    value: traitDraft,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(goldenHBiome, createOccurrenceId('completion:H:postboss')),
    ),
    keepsakeKey: 'ManaOverTimeRefundKeepsake',
  });
}

export function createGoldenEchoGiftHammerPendingProject(): ProjectDocument {
  return createGoldenEchoGiftKeepsakePendingProject('TempHammerKeepsake');
}

/** The same reached Echo recipe, with Embryo's Common one-shot replay pending in I. */
export function createGoldenEchoGiftEmbryoPendingProject(): ProjectDocument {
  return createGoldenEchoGiftKeepsakePendingProject('RandomBlessingKeepsake');
}
