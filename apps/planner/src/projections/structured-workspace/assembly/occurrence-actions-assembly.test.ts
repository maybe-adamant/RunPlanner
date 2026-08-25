import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  catalog,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createGoldenFGHIProject,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  echoLastRewardPickupEntryKey,
  goldenFBiome,
  goldenHBiome,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  roomActionKey,
  semanticAddressKey,
  withFPrebossSelection,
  type ProjectDocument,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('structured workspace actions assembly', () => {
  it('carries a reached O Ship Steady Growth effect in engine timeline order', () => {
    const occurrenceId = oOccurrenceIds.combat04;
    const owner = createOccurrenceAddress(oBiome, occurrenceId);
    const outcome = createSteadyGrowthOutcomeAddress(owner, 'Combat1');
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const assembled = assemble(
      project,
      'Surface',
      'O',
      occurrenceId,
      undefined,
      undefined,
      undefined,
      [
        Object.freeze({
          address: outcome,
          sourceTraitKey: 'BoonGrowthBoon',
          phaseKey: 'Combat1',
          requiredIntervals: Object.freeze([4]),
          progressBefore: Object.freeze([1]),
        }),
      ],
    );
    if (assembled.assembly.node.room.workbench.kind !== 'ship')
      throw new Error('O Combat04 is not a Ship workbench');
    const phase = assembled.assembly.node.room.workbench.phases.find(
      (candidate) => candidate.key === 'Combat1',
    );
    if (phase === undefined) throw new Error('O Combat04 Combat1 phase is missing');
    const endIndex = phase.timeline.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd',
    );
    const steadyIndex = phase.timeline.findIndex((entry) => entry.kind === 'automaticEffect');
    expect(endIndex).toBeGreaterThanOrEqual(0);
    expect(steadyIndex).toBe(endIndex + 1);
    expect(assembled.assembly.node.room.roomActions?.steadyGrowth).toEqual([
      expect.objectContaining({ address: outcome, targetTraitKey: 'ApolloWeaponBoon' }),
    ]);
  });

  it('labels a dormant Echo replay repair without exposing its persisted entry key', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    const echoOwner = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const replayKey = echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1');
    const replayEntry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenHBiome, bridgeId), 'roomExit'),
      replayKey,
    );
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
      trait: echoOwner,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'EchoLastReward' },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: replayEntry,
      value: { rewardType: 'HeraUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: echoOwner,
      selectedOptionKey: 'option2',
    });

    const room = assemble(project, 'Underworld', 'H', bridgeId).assembly.node.room;
    const replayRepair = room.roomActions?.repairRows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === replayKey,
    );

    expect(replayRepair?.label).toBe('Interact with Reward Reward Reward replay pickup');
    expect(replayRepair?.label).not.toContain('echoLastReward:');
  });

  it('retains published dormant Fields and Ship controls with their occurrence-owned requirements', () => {
    const fields = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    ).assembly;
    const ship = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
    ).assembly;

    expect(fields.node.room.roomLocal.kind).toBe('fields');
    if (fields.node.room.roomLocal.kind !== 'fields') throw new Error('Fields surface is missing');
    expect(Object.isFrozen(fields.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(fields.node.room.roomLocal.cages)).toBe(true);
    expect(fields.node.room.roomLocal.cages.map((cage) => [cage.key, cage.label])).toEqual([
      ['cage1', 'Cage 1'],
      ['cage2', 'Cage 2'],
    ]);
    expect(fields.node.room.roomLocal.cages[0]?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    const dormantCage = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat02'),
      'cages',
      'cage3',
    );
    expect(
      fields.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(dormantCage),
      ),
    ).toBe(false);
    expect(
      fields.node.room.localDetailMarkers.some(
        (marker) => semanticAddressKey(marker.address) === semanticAddressKey(dormantCage),
      ),
    ).toBe(false);
    expect(fields.node.room.localDetailMarkers).toContain(
      fields.node.room.roomLocal.cages[0]?.control.marker,
    );
    expect(fields.node.room.workbench).toMatchObject({
      kind: 'fields',
      fields: fields.node.room.roomLocal,
    });
    expect(
      fields.node.room.roomLocal.cages.every(
        (cage) => Object.isFrozen(cage) && Object.isFrozen(cage.control),
      ),
    ).toBe(true);
    const roomActions = fields.node.room.roomActions;
    if (roomActions === undefined) throw new Error('Fields room actions are withheld');
    expect(roomActions.rows.map((row) => row.reference.kind)).toEqual([
      'completeFieldsCage',
      'interactLocalReward',
      'completeFieldsCage',
      'interactLocalReward',
      'interactLocalReward',
      'interactLocalReward',
    ]);
    const cageOne = roomActions.rows.find(
      (row) =>
        row.reference.kind === 'interactLocalReward' &&
        row.reference.groupKey === 'cages' &&
        row.reference.slotKey === 'cage1',
    );
    expect(cageOne?.rewardPayload?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    expect(cageOne?.rewardPayload?.showOffer).toBe(false);
    expect(
      roomActions.rows.find(
        (row) => row.reference.kind === 'interactLocalReward' && row.reference.groupKey !== 'cages',
      )?.rewardPayload?.showOffer,
    ).toBe(false);
    expect(
      roomActions.optionalRows.map((row) =>
        row.reference.kind === 'interactLocalReward' ? row.reference.slotKey : row.reference.kind,
      ),
    ).toEqual(['optional1', 'optional2']);
    expect(roomActions.repairRows).toEqual([]);
    expect(roomActions.proposals.length).toBeGreaterThan(0);
    expect(
      roomActions.timeline.entries.flatMap((entry) =>
        entry.kind === 'action' && entry.presentation === 'fieldsCageAnchor'
          ? [entry.actionKey]
          : [],
      ),
    ).toEqual([
      roomActionKey({ kind: 'completeFieldsCage', phaseKey: 'Cage02' }),
      roomActionKey({ kind: 'completeFieldsCage', phaseKey: 'Cage01' }),
    ]);
    expect(
      roomActions.timeline.entries.flatMap((entry) =>
        entry.kind === 'boundary' && entry.fieldsCageSlot !== undefined
          ? [
              {
                selected: entry.fieldsCageSlot.selected,
                slotOrdinal: entry.fieldsCageSlot.slotOrdinal,
                values: entry.fieldsCageSlot.choices.map((choice) => choice.value),
              },
            ]
          : [],
      ),
    ).toEqual([
      { selected: 'Cage02', slotOrdinal: 1, values: ['Cage01', 'Cage02'] },
      { selected: 'Cage01', slotOrdinal: 2, values: ['Cage01', 'Cage02'] },
    ]);
    expect(fields.node.room.localDetailMarkers).toContain(roomActions.rows[0]?.marker);
    const fieldsEntry = roomActions.timeline.entries.find(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'roomEntered',
    );
    expect(fieldsEntry?.kind === 'boundary' && fieldsEntry.runState).toMatchObject({
      availability: 'available',
      owner: { kind: 'roomRunStateCheckpoint', checkpoint: { kind: 'roomEntered' } },
    });
    expect(fields.node.room.runStateByTab.overview).toBe(fields.node.room.runStateByTab.actions);
    expect(fields.node.room.runStateByTab.overview).toMatchObject({
      availability: 'available',
      owner: { kind: 'roomRunStateCheckpoint', checkpoint: { kind: 'roomEntered' } },
    });
    expect(fields.node.room.runStateByTab.doors).toMatchObject({
      availability: 'available',
      owner: { kind: 'roomRunStateCheckpoint', checkpoint: { kind: 'beforeRoomExit' } },
    });
    expect(fields.runStateLaunchers).toHaveLength(2);

    expect(ship.node.room.roomLocal.kind).toBe('ship');
    if (ship.node.room.roomLocal.kind !== 'ship') throw new Error('Ship surface is missing');
    expect(Object.isFrozen(ship.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(ship.node.room.roomLocal.wheels)).toBe(true);
    expect(ship.node.room.roomLocal.combatPhaseCount).toBe(2);
    expect(
      ship.node.room.roomLocal.wheels.map((wheel) => [
        wheel.key,
        wheel.encounterPhaseKey,
        wheel.label,
        wheel.active,
        wheel.offerCount,
        wheel.pickedOfferIndex,
        wheel.storeKey,
      ]),
    ).toEqual([
      ['wheel1', 'Combat1', 'Combat 1 reward', true, 1, 1, 'RunProgress'],
      ['wheel2', 'Combat2', 'Combat 2 reward', false, 1, 1, 'RunProgress'],
    ]);
    expect(ship.node.room.roomLocal.wheels[0]?.address).toEqual(
      createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
    );
    expect(ship.node.room.localDetailMarkers).toContain(ship.node.room.roomLocal.wheels[0]?.marker);
    expect(ship.node.room.workbench).toMatchObject({
      kind: 'ship',
      combatPhaseCount: 2,
      phases: [
        expect.objectContaining({
          key: 'Intro',
          label: 'Intro',
          wheel: ship.node.room.roomLocal.wheels[0],
        }),
        expect.objectContaining({
          key: 'Combat1',
          label: 'Combat 1',
        }),
      ],
      repairRows: [],
    });
    if (ship.node.room.workbench.kind !== 'ship') throw new Error('Ship workbench is missing');
    expect(ship.node.room.workbench.phases[1]?.wheel).toBeUndefined();
    const shipActions = ship.node.room.roomActions;
    if (shipActions === undefined) throw new Error('Ship room actions are withheld');
    expect(shipActions.checkpoints.map((checkpoint) => checkpoint.key)).not.toContain(
      'outgoingGeneration',
    );
    expect(
      ship.node.room.workbench.phases.flatMap((phase) => phase.actionRows.map((row) => row.key)),
    ).toEqual(shipActions.rows.filter((row) => !row.stale).map((row) => row.key));
    expect(
      ship.node.room.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).toEqual(
      expect.arrayContaining(
        shipActions.checkpoints
          .filter((checkpoint) => checkpoint.key !== 'exitUsable')
          .map((checkpoint) => checkpoint.key),
      ),
    );
    expect(
      ship.node.room.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).toHaveLength(
      shipActions.checkpoints.filter((checkpoint) => checkpoint.key !== 'exitUsable').length,
    );
    expect(
      ship.node.room.workbench.phases
        .find((phase) => phase.key === 'Intro')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).not.toContain('outgoingGeneration');
    expect(
      ship.node.room.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).not.toContain('outgoingGeneration');
    expect(ship.node.room.roomLocal.wheels[0]?.offers[0]?.control.owner.address).toEqual(
      createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
    );
    expect(
      ship.node.room.roomLocal.wheels[0]?.offers.map((offer) => [
        offer.key,
        offer.label,
        offer.active,
      ]),
    ).toEqual([
      ['offer1', 'Offer 1', true],
      ['offer2', 'Offer 2', false],
    ]);
    expect(
      ship.node.room.roomLocal.wheels.every(
        (wheel) =>
          Object.isFrozen(wheel) &&
          Object.isFrozen(wheel.offers) &&
          wheel.offers.every((offer) => Object.isFrozen(offer) && Object.isFrozen(offer.control)),
      ),
    ).toBe(true);
    const shipBoundaryLaunchers = shipActions.timeline.entries.flatMap((entry) =>
      entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
    );
    expect(shipBoundaryLaunchers.map((launcher) => launcher.owner)).toEqual(
      ship.node.room.encounterPhases.map((phase) => ({
        kind: 'roomRunStateCheckpoint',
        routeKey: oBiome.routeKey,
        biomeKey: oBiome.biomeKey,
        occurrenceId: oOccurrenceIds.combat04,
        checkpoint: { kind: 'beforeEncounterStart', phaseKey: phase.address.phaseKey },
      })),
    );
    expect(ship.node.room.runStateByTab.overview).toBe(
      ship.node.room.runStateByTab.shipIntroActions,
    );
    expect(ship.node.room.runStateByTab.shipIntroActions?.owner).toMatchObject({
      checkpoint: { kind: 'beforeEncounterStart', phaseKey: 'Intro' },
    });
    expect(ship.node.room.runStateByTab.shipCombat1Actions?.owner).toMatchObject({
      checkpoint: { kind: 'beforeEncounterStart', phaseKey: 'Combat1' },
    });
    expect(ship.node.room.runStateByTab.doors?.owner).toMatchObject({
      checkpoint: { kind: 'beforeRoomExit' },
    });
    expect(ship.node.room.runStateByTab.shipInactiveRepair).toBeUndefined();
    expect(ship.runStateLaunchers).toHaveLength(ship.node.room.encounterPhases.length + 1);
    expect(
      ship.runStateLaunchers.some(
        (launcher) =>
          launcher.owner.kind === 'roomRunStateCheckpoint' &&
          launcher.owner.checkpoint.kind === 'roomEntered',
      ),
    ).toBe(false);
  });

  it('retains a selected unavailable Infernal Contract action without inventing its editor', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const retained: ProjectDocument = {
      ...project,
      routes: project.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((biome): typeof biome =>
                biome.biomeKey !== 'F' || biome.topology === null
                  ? biome
                  : {
                      ...biome,
                      topology: {
                        ...biome.topology,
                        occurrences: biome.topology.occurrences.map(
                          (occurrence): typeof occurrence =>
                            occurrence.occurrenceId !== shopId
                              ? occurrence
                              : {
                                  ...occurrence,
                                  roomActions: {
                                    order: [
                                      ...occurrence.roomActions.order,
                                      {
                                        kind: 'interactAcquisitionEntry' as const,
                                        siteKey: 'roomExit',
                                        entryKey: 'infernalContractReward',
                                      },
                                    ],
                                  },
                                },
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const result = assemble(retained, 'Underworld', 'F', shopId, undefined, () =>
      Object.freeze([]),
    );
    const room = result.assembly.node.room;
    const isContract = (
      reference: import('@run-planner/engine/authored-project').RoomActionReference,
    ) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.entryKey === 'infernalContractReward';

    expect(room.roomLocal).toMatchObject({ kind: 'shop', supplementalOffers: [] });
    expect(room.roomActions?.rows.some((row) => isContract(row.reference))).toBe(true);
    expect(room.roomActions?.repairRows.some((row) => isContract(row.reference))).toBe(false);
    expect(room.roomActions?.proposals.some((proposal) => isContract(proposal.reference))).toBe(
      true,
    );
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    const contract = createAcquisitionEntryAddress(site, 'infernalContractReward');
    expect(result.markers.destinations().get(semanticAddressKey(contract))).toMatchObject({
      focusAddress: { kind: 'roomAction' },
      roomTab: 'actions',
    });
    expect(result.markers.destinations().get(semanticAddressKey(site))).toMatchObject({
      focusAddress: { kind: 'roomAction' },
      roomTab: 'actions',
    });
  });

  it('omits an unearned Infernal Contract from actions and repairs', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const room = assemble(project, 'Underworld', 'F', shopId, undefined, () => Object.freeze([]))
      .assembly.node.room;
    const isContract = (
      reference: import('@run-planner/engine/authored-project').RoomActionReference,
    ) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.entryKey === 'infernalContractReward';

    expect(room.roomActions?.rows.some((row) => isContract(row.reference))).toBe(false);
    expect(room.roomActions?.repairRows.some((row) => isContract(row.reference))).toBe(false);
    expect(room.roomActions?.proposals.some((proposal) => isContract(proposal.reference))).toBe(
      false,
    );
  });

  it('projects a Gold duplicate ordered after its Travel refill source', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const base = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const occurrenceAddress = createOccurrenceAddress(goldenFBiome, shopId);
    const site = createAcquisitionSiteAddress(occurrenceAddress, 'roomExit');
    const occurrence = base.routes
      .flatMap((route) => route.biomes)
      .find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      occurrence?.state.kind === 'shop' ? occurrence.state.shop?.offers.Boon?.reward : undefined;
    if (source === undefined) throw new Error('F Preboss Boon default is missing');
    const duplicate = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    const project: ProjectDocument = {
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((biome): typeof biome => {
                const topology = biome.topology;
                return biome.biomeKey !== 'F' || topology === null
                  ? biome
                  : {
                      ...biome,
                      topology: {
                        ...topology,
                        occurrences: topology.occurrences.map((candidate): typeof candidate =>
                          candidate.occurrenceId !== shopId
                            ? candidate
                            : {
                                ...candidate,
                                roomActions: {
                                  order: [
                                    { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
                                    {
                                      kind: 'interactAcquisitionEntry',
                                      siteKey: 'roomExit',
                                      entryKey: 'travelDealRefill',
                                    },
                                    {
                                      kind: 'interactAcquisitionEntry',
                                      siteKey: 'roomExit',
                                      entryKey: 'echoDoubleShopReward',
                                    },
                                  ],
                                },
                                acquisitionSites: {
                                  ...(candidate.acquisitionSites ?? {}),
                                  roomExit: {
                                    pickupEntries: {
                                      travelDealRefill: source,
                                      echoDoubleShopReward: source,
                                    },
                                  },
                                },
                              },
                        ),
                      },
                    };
              }),
            },
      ),
    };
    const result = assemble(project, 'Underworld', 'F', shopId, undefined, (candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: createAcquisitionEntryAddress(site, 'travelDealRefill'),
              kind: 'travelDealRefill' as const,
              sourceOfferKey: 'MajorNonBoon',
              slotIndex: 1,
              rewardTypes: ['RandomLoot'],
            },
            {
              address: duplicate,
              kind: 'echoDoubleShopReward' as const,
              sourceOfferKey: 'travelDealRefill',
              rewardTypes: ['RandomLoot'],
              eligibleSourceOfferKeys: ['travelDealRefill'],
            },
          ],
    ).assembly.node.room;
    expect(
      result.roomActions?.rows.flatMap((row) => {
        if (row.rank === null) return [];
        if (row.reference.kind === 'interactShopOffer') return [row.reference.offerKey];
        if (row.reference.kind === 'interactAcquisitionEntry') return [row.reference.entryKey];
        return [];
      }),
    ).toEqual(['MajorNonBoon', 'travelDealRefill', 'echoDoubleShopReward']);
  });
});
