import { catalog } from '@run-planner/hades2-catalog';
import {
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  applyProjectCommand,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createLevelResolutionAddress,
  createLocalVisitOrderAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  type AcquisitionEntryAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  clockedTraitPickupPlacementForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  hermesShrineDeliveryPlacementForPurchaseReschedule,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../../src/simulation';

const nPostboss = createOccurrenceAddress(nBiome, createOccurrenceId('surface-n-preboss:postboss'));
const oPostboss = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));

function settleReachedAutomaticOutcomes(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const assembly = simulateProjectAssembly(catalog, next);
    const finding = assembly.evaluation.findings.find(
      (candidate) =>
        candidate.code === 'steadyGrowthOutcomeMissing' ||
        candidate.code === 'transcendentEmbryoOutcomeMissing',
    );
    if (finding === undefined) return next;
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    if (finding.origin.kind === 'steadyGrowthOutcome') {
      const candidate = session.evaluate({
        kind: 'steadyGrowthOutcome',
        outcome: finding.origin,
        targetTraitKey: undefined,
      });
      const targetTraitKey =
        candidate.kind === 'steadyGrowthOutcome'
          ? candidate.result.eligibleTargetKeys[0]
          : undefined;
      if (targetTraitKey === undefined)
        throw new Error('scheduled lifecycle fixture lacks a Steady Growth target');
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: finding.origin,
        targetTraitKey,
      });
      continue;
    }
    if (finding.origin.kind !== 'transcendentEmbryoOutcome')
      throw new Error('scheduled lifecycle fixture found an unexpected automatic outcome');
    const candidate = session.evaluate({
      kind: 'transcendentEmbryoOutcome',
      outcome: finding.origin,
      value: undefined,
    });
    if (candidate.kind !== 'transcendentEmbryoOutcome')
      throw new Error('scheduled lifecycle fixture lost its Embryo candidate');
    const blessingKey = candidate.result.eligibleBlessingKeys.find(
      (key) => catalog.chaos.blessings.byKey[key]?.operands.length === 0,
    );
    if (blessingKey === undefined)
      throw new Error('scheduled lifecycle fixture lacks a zero-operand Embryo blessing');
    const value = { blessingKey, blessingValues: {} } as const;
    const selected = session.evaluate({
      kind: 'transcendentEmbryoOutcome',
      outcome: finding.origin,
      value,
    });
    if (selected.kind !== 'transcendentEmbryoOutcome' || !selected.result.selectedPossible)
      throw new Error('scheduled lifecycle fixture could not attest its Embryo result');
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: finding.origin,
      value,
    });
  }
  throw new Error('scheduled lifecycle fixture exceeded its automatic-outcome bound');
}

function placeDelayedShrineDeliveries(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (const source of [nPostboss, oPostboss]) {
    const assembly = simulateProjectAssembly(catalog, next);
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      assembly,
      source,
      'initial:secondLeft',
    );
    if (placement === undefined)
      throw new Error(
        `scheduled lifecycle fixture lacks ${source.biomeKey} Shrine delivery: ${JSON.stringify(
          assembly.evaluation.findings.map((finding) => ({
            code: finding.code,
            origin: finding.origin,
            evidence: finding.evidence,
          })),
        )}`,
      );
    next = applyProjectCommand(next, catalog, placement);
    next = settleReachedAutomaticOutcomes(next);
  }
  return next;
}

function acceptOneSupplyChainSlice(project: ProjectDocument): ProjectDocument {
  const assembly = simulateProjectAssembly(catalog, project);
  const entries = project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
      derivedAcquisitionEntriesForProjectEvaluationAssembly(
        assembly,
        createAcquisitionSiteAddress(
          createOccurrenceAddress(
            {
              kind: 'biome',
              routeKey: project.route.routeKey,
              biomeKey: biome.biomeKey,
            },
            occurrence.occurrenceId,
          ),
          'roomExit',
        ),
      ).filter((entry) => entry.kind === 'clockedTraitPickup'),
    ),
  );
  const entry = entries[0];
  if (entry === undefined)
    throw new Error('scheduled lifecycle fixture never matured Supply Chain');
  const placement = clockedTraitPickupPlacementForProjectEvaluationAssembly(
    assembly,
    entry.address,
  );
  if (placement === undefined)
    throw new Error('scheduled lifecycle fixture lacks an attested Supply Chain placement');
  let next = applyProjectCommand(project, catalog, placement);
  const levelResolution = createLevelResolutionAddress(entry.address, 'self');
  const levelCandidate = levelResolutionCandidateForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, next),
    levelResolution,
  );
  const targetTraitKey = levelCandidate?.branches[0]?.eligibleTargetTraitKeys[0];
  if (targetTraitKey === undefined)
    throw new Error('scheduled lifecycle fixture lacks a Supply Chain Pom target');
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution,
    value: { kind: 'random', targetTraitKey },
  });
  return settleReachedAutomaticOutcomes(next);
}

function acceptSupplyChainSliceAtAddress(
  project: ProjectDocument,
  entry: AcquisitionEntryAddress,
): ProjectDocument {
  const assembly = simulateProjectAssembly(catalog, project);
  const placement = clockedTraitPickupPlacementForProjectEvaluationAssembly(assembly, entry);
  if (placement === undefined)
    throw new Error(
      `scheduled lifecycle fixture lacks an attested Supply Chain placement for ${entry.entryKey}`,
    );
  let next = applyProjectCommand(project, catalog, placement);
  const levelResolution = createLevelResolutionAddress(entry, 'self');
  const levelCandidate = levelResolutionCandidateForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, next),
    levelResolution,
  );
  const targetTraitKey = levelCandidate?.branches[0]?.eligibleTargetTraitKeys[0];
  if (targetTraitKey === undefined)
    throw new Error(
      `scheduled lifecycle fixture lacks a Supply Chain Pom target for ${entry.entryKey}`,
    );
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution,
    value: { kind: 'random', targetTraitKey },
  });
  return settleReachedAutomaticOutcomes(next);
}

function acceptQSupplyChainSlices(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (const pickupKey of ['pom1', 'pom2']) {
    const assembly = simulateProjectAssembly(catalog, next);
    const entry = next.route.biomes
      .flatMap((biome) =>
        (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
          derivedAcquisitionEntriesForProjectEvaluationAssembly(
            assembly,
            createAcquisitionSiteAddress(
              createOccurrenceAddress(
                { kind: 'biome', routeKey: next.route.routeKey, biomeKey: biome.biomeKey },
                occurrence.occurrenceId,
              ),
              'roomExit',
            ),
          ),
        ),
      )
      .find(
        (candidate) =>
          candidate.kind === 'clockedTraitPickup' &&
          candidate.address.biomeKey === 'Q' &&
          candidate.address.entryKey.endsWith(`:${pickupKey}`),
      );
    if (entry === undefined || entry.kind !== 'clockedTraitPickup')
      throw new Error(`scheduled lifecycle fixture lacks Q Supply Chain ${pickupKey}`);
    next = acceptSupplyChainSliceAtAddress(next, entry.address);
  }
  return next;
}

/**
 * One complete Surface route which exercises fixed encounter-end outcomes and
 * both scheduler-produced acquisition families through ordinary authoring.
 */
function buildSurfaceScheduledLifecycleProject(clearLocalVisits = false): ProjectDocument {
  let project = authorLegalTraitOffers(
    applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat03'],
    }),
  );
  if (clearLocalVisits) {
    for (const occurrenceId of ['combat05', 'combat02', 'combat11']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order: createLocalVisitOrderAddress(nBiome, nOccurrenceId(occurrenceId), 'sideRooms'),
        occurrenceIds: [],
      });
    }
  }

  const keepsake = createRouteStartKeepsakeSelectionAddress('Surface');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: keepsake,
    keepsakeKey: 'RandomBlessingKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoEquipResult',
    result: createKeepsakeEquipResultAddress(keepsake, 'transcendentEmbryo'),
    value: { blessingKey: 'ChaosWeaponBlessing', blessingValues: { damageBonus: 0.7 } },
  });

  const growthReward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat23'));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: growthReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(growthReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'BoonGrowthBoon', rarity: 'Epic' },
        { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
        { traitKey: 'PlantHealthBoon', rarity: 'Epic' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(pBiome, pOccurrenceId('P_MiniBoss01', 5, 1)),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  const icarusPhase = createEncounterPhaseAddress(
    oBiome,
    { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat01 },
    'Combat1',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: icarusPhase,
    encounterKey: 'IcarusCombatO',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(icarusPhase, 'selection'),
    value: {
      kind: 'traits',
      giverKey: 'Icarus',
      options: [
        { traitKey: 'SupplyDropBoon' },
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'CastHazardBoon' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = authorLegalTraitOffers(project);

  for (const source of [nPostboss, oPostboss]) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 2, rushed: false },
    });
  }

  project = authorLegalTraitOffers(settleReachedAutomaticOutcomes(project));
  project = settleReachedAutomaticOutcomes(project);
  project = placeDelayedShrineDeliveries(project);
  project = acceptOneSupplyChainSlice(project);
  project = settleReachedAutomaticOutcomes(authorLegalTraitOffers(project));
  const finalAssembly = simulateProjectAssembly(catalog, project);
  if (!finalAssembly.evaluation.route.summary.eligibleForExecutionPlan)
    throw new Error(
      `scheduled lifecycle fixture remains incomplete: ${JSON.stringify(
        finalAssembly.evaluation.findings.map((finding) => ({
          code: finding.code,
          origin: finding.origin,
          evidence: finding.evidence,
        })),
      )}`,
    );
  return project;
}

export function surfaceScheduledLifecycleProject(): ProjectDocument {
  return buildSurfaceScheduledLifecycleProject();
}

/** The long scheduled-effects route with both Q Supply Chain Pom Slices authored. */
export function surfaceScheduledLifecycleWithQSupplyChainSlicesProject(): ProjectDocument {
  return acceptQSupplyChainSlices(buildSurfaceScheduledLifecycleProject(true));
}
