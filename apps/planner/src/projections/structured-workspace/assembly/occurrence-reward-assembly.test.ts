import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  authorTestArtificerReplacement,
  catalog,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createCompleteFGProject,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createFConversionFrontierProject,
  createGorgonPhaseAddress,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenIBiome,
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNOPProject,
  loadSurfaceNOPQProject,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  simulateProjectAssembly,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('structured workspace reward assembly', () => {
  it('projects a selected SpellDrop child from exact engine candidate capability', () => {
    const predecessor = goldenFOccurrenceId(9, 1);
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: predecessor,
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const assembled = assemble(project, 'Underworld', 'F', occurrenceId);
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    expect(assembled.source.isActiveTraitOffer(address)).toBe(true);
    expect(
      assembled.assembly.rewardControls.flatMap((control) => control.traitOffers ?? []),
    ).toContainEqual(expect.objectContaining({ address }));
  });

  it('retains the reached unresolved SpellDrop child as the exact repair control', () => {
    const predecessor = goldenFOccurrenceId(9, 1);
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const selected = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: predecessor,
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    // Commands deliberately have no reset-to-null path. Keep this malformed-but-editable
    // fixture at the strict document boundary so the projection is tested against the
    // persisted recovery state rather than a fabricated command.
    const raw = JSON.parse(encodeProjectDocument(selected)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            occurrences: Array<{
              occurrenceId: string;
              state: { reward?: { traitOffersByAcquisitionRole?: { self?: unknown } } };
            }>;
          } | null;
        }>;
      }>;
    };
    const rawOccurrence = raw.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    if (rawOccurrence?.state.reward?.traitOffersByAcquisitionRole === undefined) {
      throw new Error('SpellDrop fixture has no self child to unset');
    }
    rawOccurrence.state.reward.traitOffersByAcquisitionRole.self = null;
    const project = decodeProjectDocument(raw, catalog);
    const assembled = assemble(project, 'Underworld', 'F', occurrenceId);
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    expect(assembled.source.isActiveTraitOffer(address)).toBe(true);
    expect(
      assembled.assembly.rewardControls.flatMap((control) => control.traitOffers ?? []),
    ).toContainEqual(expect.objectContaining({ address, offer: null, status: 'unspecified' }));
  });

  it('withholds a retained SpellDrop child under Selene through the route loadout', () => {
    const predecessor = goldenFOccurrenceId(9, 1);
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const reached = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: predecessor,
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const selene = applyProjectCommand(reached, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: { kind: 'route', routeKey: 'Underworld' },
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    });
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const dormant = assemble(selene, 'Underworld', 'F', occurrenceId);
    expect(dormant.source.isActiveTraitOffer(address)).toBe(false);
    expect(
      dormant.assembly.rewardControls.flatMap((control) => control.traitOffers ?? []),
    ).not.toContainEqual(expect.objectContaining({ address }));
  });

  it('publishes pending Gorgon support and retains a context-invalid child for repair', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    let engineAssembly = simulateProjectAssembly(catalog, project);
    expect(
      encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, phase)?.supported,
    ).toBe(true);
    const support = (
      candidate: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
    ) => encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, candidate);
    const pending = assemble(
      project,
      'Surface',
      'P',
      pOccurrenceId('P_Combat12', 8, 1),
      support,
    ).assembly;
    const pendingPhase = pending.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Combat',
    );
    expect(pendingPhase?.gorgonCondition).toMatchObject({ supported: true, selected: false });
    expect(pendingPhase?.gorgonAthena).toBeUndefined();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonAthenaOffer',
      trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
      value: {
        traitKeys: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
        selectedOptionKey: 'option1',
      },
    });
    engineAssembly = simulateProjectAssembly(catalog, project);
    const consumed = assemble(
      project,
      'Surface',
      'P',
      pOccurrenceId('P_Combat12', 8, 1),
      (candidate) =>
        encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, candidate),
    ).assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Combat',
    );
    expect(consumed?.gorgonCondition).toMatchObject({ supported: true, selected: true });
    expect(consumed?.gorgonAthena).toMatchObject({ status: 'valid' });

    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    engineAssembly = simulateProjectAssembly(catalog, project);
    const retained = assemble(
      project,
      'Surface',
      'P',
      pOccurrenceId('P_Combat12', 8, 1),
      (candidate) =>
        encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, candidate),
    ).assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Combat',
    );
    expect(retained?.gorgonCondition).toMatchObject({ supported: false, selected: true });
    expect(retained?.gorgonAthena).toMatchObject({
      rarityEditable: false,
      offer: {
        kind: 'traits',
        giverKey: 'Athena',
        selectedOptionKey: 'option1',
      },
    });
    if (retained?.gorgonAthena?.offer?.kind !== 'traits')
      throw new Error('retained Gorgon Athena offer is missing');
    expect(retained.gorgonAthena.offer.options.every((option) => option.rarity === undefined)).toBe(
      true,
    );
  });

  it('publishes authored encounter choices without candidate support', () => {
    const nCombat = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    ).assembly;
    const nPhase = nCombat.node.room.encounterPhases.find((phase) => phase.label === 'Encounter');
    expect(nPhase?.selectedEncounter.key).toBe('GeneratedN');
    expect(nPhase?.candidateChoices.length).toBeGreaterThan(1);
  });

  it('publishes the selected Artemis phase offer as an encounter-owned trait control', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    const assembly = assemble(project, 'Underworld', 'F', goldenFOccurrenceId(5, 1)).assembly;
    const encounter = assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Encounter',
    );
    expect(encounter?.traitOffer).toMatchObject({
      acquisitionRoleLabel: 'Selection',
      giver: { key: 'Artemis' },
      offer: null,
    });
    expect(encounter?.traitOffer?.address.owner).toEqual(phase);
  });

  it('exposes a picked Arachne Story offer through the direct Encounter surface', () => {
    const occurrenceId = goldenFOccurrenceId(7, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, occurrenceId),
      gameName: 'F_Story01',
    });
    const assembly = assemble(project, 'Underworld', 'F', occurrenceId).assembly;
    const encounter = assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Encounter',
    );

    expect(encounter).toMatchObject({
      customizable: false,
      selectedEncounter: { key: 'Story_Arachne_01' },
      traitOffer: {
        address: createTraitOfferAddress(phase, 'selection'),
        acquisitionRoleLabel: 'Selection',
        giver: { key: 'Arachne' },
      },
    });
    expect(assembly.node.room.workbench).toMatchObject({
      kind: 'standard',
      encounterPhases: [expect.objectContaining({ traitOffer: encounter?.traitOffer })],
    });
  });

  it('projects acquisition-time trait editing only while the exact reward role is picked up', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const fixture = createFConversionFrontierProject('GiftDrop');
    const normal = assemble(
      fixture.project,
      'Underworld',
      'F',
      occurrenceId,
    ).assembly.node.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    );
    expect(normal?.rewardPayload).toMatchObject({
      inlineLevelResolutions: [expect.any(Object)],
      inlineTraitOffers: [],
    });

    const converted = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: fixture.acquisition,
      value: { kind: 'artificer' },
    });
    const artificer = assemble(
      converted,
      'Underworld',
      'F',
      occurrenceId,
    ).assembly.node.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    );
    expect(artificer?.rewardPayload).toMatchObject({
      inlineLevelResolutions: [],
      inlineTraitOffers: [],
    });
    expect(artificer?.artificerOutput).toBeDefined();
  });

  it('projects Forfeit as a realized Red Onion pickup without a trait launcher', () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const assembledForfeit = assemble(project, 'Underworld', 'F', goldenFStartId);
    const room = assembledForfeit.assembly.node.room;
    const row = room.roomActions?.rows.find(
      (candidate) => candidate.reference.kind === 'interactIncomingReward',
    );
    expect(row?.label).toContain('Red Onion');
    expect(row?.rewardPayload).toMatchObject({
      control: {
        realizedAcquisition: { rewardType: 'RoomRewardConsolationPrize', label: 'Red Onion' },
        traitOffers: [],
        levelResolutions: [],
      },
    });
  });

  it('projects an Artificer-forfeited Boon as a nested Red Onion without a trait launcher', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const fixture = createFConversionFrontierProject('GiftDrop');
    let project = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFStartId),
        'self',
      ),
      value: {
        kind: 'traits',
        giverKey: 'WeaponUpgrade',
        options: [
          { traitKey: 'StaffDoubleAttackTrait' },
          { traitKey: 'StaffLongAttackTrait' },
          { traitKey: 'StaffDashAttackTrait' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const candidate = assemble(
      project,
      'Underworld',
      'F',
      occurrenceId,
    ).source.acquisitionConversionCandidate(fixture.acquisition);
    const replacement = candidate?.artificerReplacementOptions?.find(
      (option) => option.offer.rewardType === 'Boon',
    );
    if (replacement === undefined) throw new Error('Boon Artificer replacement is missing');
    project = authorTestArtificerReplacement(project, catalog, fixture.acquisition, replacement);

    const row = assemble(
      project,
      'Underworld',
      'F',
      occurrenceId,
    ).assembly.node.room.roomActions?.rows.find(
      (candidateRow) => candidateRow.reference.kind === 'interactIncomingReward',
    );
    expect(row?.artificerOutput?.control).toMatchObject({
      realizedAcquisition: {
        rewardType: 'RoomRewardConsolationPrize',
        label: 'Red Onion',
      },
      traitOffers: [],
      levelResolutions: [],
    });
  });

  it('projects the active Narcissus reward editor before its independent pickup choice', () => {
    const project = createGoldenFGHIProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    const result = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly;
    const action = result.node.room.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === 'pom',
    );
    expect(action?.rewardPayload?.control).toMatchObject({
      kind: 'explicitReward',
      offer: { rewardType: 'StoreRewardRandomStack' },
      rewardTypes: ['StoreRewardRandomStack'],
    });
  });

  it('projects Psyche and Max Magick as distinct Narcissus action payloads', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const actions = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly.node.room
      .roomActions;
    expect(
      actions?.rows
        .filter((row) => row.reference.kind === 'interactAcquisitionEntry')
        .map((row) => [
          row.reference.kind === 'interactAcquisitionEntry' ? row.reference.entryKey : '',
          row.label,
        ])
        .sort(([left], [right]) => left!.localeCompare(right!)),
    ).toEqual([
      ['maxMana', 'Interact with Max Magick pickup'],
      ['psyche', 'Interact with Psyche pickup'],
    ]);
    expect(
      actions?.rows
        .flatMap((row) =>
          row.reference.kind === 'interactAcquisitionEntry'
            ? [[row.reference.entryKey, row.rewardPayload?.control.offer] as const]
            : [],
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, offer]) => offer),
    ).toEqual([{ rewardType: 'MaxManaDrop' }, { rewardType: 'MemPointsCommonDrop' }]);
  });

  it('projects one picked Narcissus pickup with its fixed type and unresolved payload', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusI' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const current = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      );
    const siteKey = Object.entries(current?.acquisitionSites ?? {}).find(([, state]) =>
      Object.hasOwn(state.pickupEntries ?? {}, 'mysteryBoon'),
    )?.[0];
    if (siteKey === undefined) throw new Error('Narcissus has no source-scoped mystery pickup');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      siteKey,
    );
    const result = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly;
    const entry = result.node.room.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.entryKey === 'mysteryBoon',
    );
    expect(entry?.rewardPayload?.control).toMatchObject({
      owner: {
        kind: 'acquisitionEntry',
        address: createAcquisitionEntryAddress(site, 'mysteryBoon'),
      },
      offer: null,
      rewardTypes: ['BlindBoxLoot'],
      authoringStartStep: 'source',
      authoringSeed: { rewardType: 'BlindBoxLoot' },
    });
    expect(entry?.rewardPayload?.control.traitOffers).toEqual([]);
  });

  it('projects manifest-backed Quick Buck and Buried Treasure through ordinary acquisition rows', () => {
    const quick = assemble(
      loadSurfaceNQuickBuckCheckpoint(),
      'Surface',
      'N',
      nOccurrenceId('opening'),
    ).assembly.node.room.roomActions;
    const buried = assemble(
      loadSurfaceNBuriedTreasureCheckpoint(),
      'Surface',
      'N',
      nOccurrenceIds.preHub,
    ).assembly.node.room.roomActions;
    const pickupKeys = (rows: typeof quick) =>
      rows?.rows.flatMap((row) =>
        row.reference.kind === 'interactAcquisitionEntry' ? [row.reference.entryKey] : [],
      );
    expect(pickupKeys(quick)).toContain('quickBuckGold');
    expect(pickupKeys(buried)).toEqual(
      expect.arrayContaining([
        'smallGold',
        'tinyGold1',
        'tinyGold2',
        'minorHeal1',
        'minorHeal2',
        'bones',
      ]),
    );
  });

  it('publishes fixed Devotion and Story payloads without inventing editable controls', () => {
    const project = loadSurfaceNOPQProject();
    const devotion = assemble(project, 'Surface', 'O', oOccurrenceIds.devotion).assembly.node.room;
    const story = assemble(project, 'Surface', 'P', pOccurrenceId('P_Story01', 7, 1)).assembly.node
      .room;

    expect(devotion.roomLocal.kind).toBe('fixed');
    if (devotion.roomLocal.kind !== 'fixed') throw new Error('Devotion fixed payload is missing');
    expect(devotion.roomLocal.offer).toEqual({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    });
    expect(devotion.roomLocal.control).toMatchObject({
      kind: 'explicitReward',
      owner: { address: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion) },
      rewardTypes: ['Devotion'],
    });
    expect(story.roomLocal.kind).toBe('fixed');
    if (story.roomLocal.kind !== 'fixed') throw new Error('Story fixed payload is missing');
    expect(story.roomLocal.marker.address).toEqual(
      createIncomingRewardAddress(pBiome, pOccurrenceId('P_Story01', 7, 1)),
    );
    expect(story.roomLocal.control).toBeUndefined();
  });

  it('does not project the retired Shop Death Defiance condition capability', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.gameName === 'I_PreBoss02');
    if (shopOccurrence === undefined) throw new Error('missing I shop fixture');
    const assembled = assemble(
      project,
      'Underworld',
      goldenIBiome.biomeKey,
      shopOccurrence.occurrenceId,
    ).assembly;
    expect(assembled.node.room.roomLocal).toMatchObject({ kind: 'shop' });
    expect(assembled.node.room.roomLocal).not.toHaveProperty('deathDefianceCondition');
  });
});
