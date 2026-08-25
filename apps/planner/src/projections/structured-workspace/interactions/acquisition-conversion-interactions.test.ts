import { describe, expect, it, vi } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOfferAddress,
  TraitOptionKey,
  CandidateProjectionSession,
  CandidateEvaluationEvent,
  WorkspaceSteadyGrowthControl,
} from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  reachedEchoProject,
  services,
  catalog,
  applyProjectCommand,
  activeRoomActionReferences,
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  simulateProjectAssembly,
  prepareLegalPomTraitOffers,
  replaceTestShopOfferActions,
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  createRepresentativeNOPQShopTraitProject,
  loadSurfaceNOProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  createCandidateSessionFactory,
} = support;


describe('acquisition-conversion-interactions', () => {
  it('retains an invalid paid-Shop Time Piece conversion as an engine-backed repair control', () => {
    const shopOffer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon');
    const acquisition = createAcquisitionRoleAddress(shopOffer, 'weaponUpgrade');
    let project = applyProjectCommand(createRepresentativeNOPQShopTraitProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'timePiece' },
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const candidate = services.candidateSessions.bind(assembly).acquisitionConversion(acquisition);
    if (candidate.kind !== 'acquisitionConversion') {
      throw new Error(`expected acquisition conversion candidate, received ${candidate.kind}`);
    }
    expect(candidate.result).toMatchObject({
      timePieceSupported: false,
      timePieceConvertible: false,
      branchCount: expect.any(Number),
    });
    expect(candidate.result.unsupportedEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceProvenance: 'paid', goldConversionEligible: true }),
      ]),
    );
    const interaction = bind(project, 'Surface', 'P').interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    expect(interaction).toMatchObject({
      owner: acquisition,
      visible: true,
      timePieceSupported: false,
    });
    expect(interaction?.intentFor({ kind: 'normal' })).toEqual({
      command: {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition,
        value: { kind: 'normal' },
      },
    });
  });

  it('publishes Time Piece conversion controls only at supported acquisition frontiers', () => {
    const withoutTimePiece = bind(createCompleteFGProject(), 'Underworld', 'F').interactions;
    expect(
      [...withoutTimePiece.acquisitionConversions.values()].filter(
        (interaction) => interaction.visible,
      ),
    ).toEqual([]);

    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    const withTimePiece = bind(project, 'Underworld', 'F').interactions;
    const supported = [...withTimePiece.acquisitionConversions.values()].find(
      (interaction) => interaction.visible && interaction.timePieceSupported,
    );
    expect(supported).toBeDefined();
    if (supported === undefined) throw new Error('Time Piece conversion interaction is missing');
    expect(supported?.intentFor({ kind: 'timePiece' })).toEqual({
      command: {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: supported.owner,
        value: { kind: 'timePiece' },
      },
    });
  });

  it('publishes an eligible Sea Star row without Time Piece or Artificer support', () => {
    const project = createCompleteFGProject();
    const baseCandidateSession = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const candidateSession = Object.freeze({
      ...baseCandidateSession,
      acquisitionConversion: () =>
        Object.freeze({
          kind: 'acquisitionConversion' as const,
          result: Object.freeze({
            timePieceSupported: false,
            timePieceConvertible: false,
            artificerSupported: false,
            artificerConvertible: false,
            seaStarSupported: true,
            branchCount: 1,
            unsupportedEvidence: Object.freeze([]),
          }),
        }),
    }) as CandidateProjectionSession;
    const interactions = bind(project, 'Underworld', 'F', undefined, candidateSession).interactions;
    const seaStarOnly = [...interactions.acquisitionConversions.values()].find(
      (interaction) =>
        interaction.visible &&
        interaction.seaStarSupported &&
        !interaction.timePieceSupported &&
        !interaction.artificerSupported,
    );
    expect(seaStarOnly).toBeDefined();
    if (seaStarOnly === undefined) throw new Error('Sea Star-only interaction is missing');
    expect(seaStarOnly.seaStarIntentFor(true)).toMatchObject({
      command: {
        kind: 'ReplaceSeaStarResult',
        acquisition: seaStarOnly.owner,
        procced: true,
      },
    });
  });

  it('retains a paid shop Pom Sea Star result as an exact repair control', () => {
    const shopId = pOccurrenceIds.prebossShop;
    const offer = createShopOfferAddress(pBiome, shopId, 'Minor');
    const acquisition = createAcquisitionRoleAddress(offer, 'self');
    let project = applyProjectCommand(createRepresentativeNOPQShopTraitProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'StackUpgrade' },
    });
    project = replaceTestShopOfferActions(
      project,
      catalog,
      createOccurrenceAddress(pBiome, shopId),
      ['Minor'],
    );
    project = prepareLegalPomTraitOffers(project).project;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    const shop = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId);
    if (shop === undefined) throw new Error('paid shop source occurrence is missing');
    expect(activeRoomActionReferences(catalog, pBiome, shop)).not.toContainEqual(
      expect.objectContaining({
        kind: 'interactAcquisitionEntry',
        entryKey: 'seaStarDuplicate',
      }),
    );
    const assembly = simulateProjectAssembly(catalog, project);
    const candidate = services.candidateSessions.bind(assembly).acquisitionConversion(acquisition);
    if (candidate.kind !== 'acquisitionConversion')
      throw new Error(`expected shop Pom conversion candidate, received ${candidate.kind}`);
    expect(candidate.result).toMatchObject({ seaStarSupported: false });
    expect(candidate.result.unsupportedEvidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ instanceProvenance: 'paid' })]),
    );
    const p = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    if (p === undefined || !('rewards' in p)) throw new Error('missing evaluated paid shop');
    expect(p.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'seaStarDuplicationUnavailable', origin: acquisition }),
    );
    const interaction = bind(project, 'Surface', 'P').interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    expect(interaction).toMatchObject({
      owner: acquisition,
      seaStarProcced: true,
      seaStarSupported: false,
      visible: true,
    });
    expect(interaction?.seaStarIntentFor(false)).toEqual({
      command: { kind: 'ReplaceSeaStarResult', acquisition, procced: false },
      focus: { owner: acquisition, timing: 'after' },
    });
  }, 10_000);

  it.each(['GiftDrop', 'MetaCurrencyDrop', 'MetaCardPointsCommonDrop'] as const)(
    'keeps the reached %s conversion interaction visible at a later incomplete frontier',
    (rewardType) => {
      const occurrenceId = goldenFOccurrenceId(1, 1);
      const acquisition = createAcquisitionRoleAddress(
        createIncomingRewardAddress(goldenFBiome, occurrenceId),
        'self',
      );
      const { interactions } = bind(
        createFConversionFrontierProject(rewardType).project,
        'Underworld',
        'F',
      );
      expect(
        interactions.acquisitionConversions.get(semanticAddressKey(acquisition)),
      ).toMatchObject({
        owner: acquisition,
        visible: true,
        timePieceSupported: true,
        artificerSupported: true,
      });
      expect(
        interactions.acquisitionConversions
          .get(semanticAddressKey(acquisition))
          ?.intentFor({ kind: 'artificer' }),
      ).toEqual({
        command: {
          kind: 'ReplaceAcquisitionDisposition',
          acquisition,
          value: { kind: 'artificer' },
        },
      });
      const unreached = createAcquisitionRoleAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
        'self',
      );
      expect(
        interactions.acquisitionConversions.get(semanticAddressKey(unreached))?.visible ?? false,
      ).toBe(false);
    },
  );
});
