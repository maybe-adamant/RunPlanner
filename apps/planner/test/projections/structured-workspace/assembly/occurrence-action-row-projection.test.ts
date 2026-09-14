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
  goldenFStartId,
  goldenHBiome,
  hermesShrineDeliveryEntryKey,
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  oBiome,
  oOccurrenceIds,
  roomActionKey,
  semanticAddressKey,
  withFPrebossSelection,
  type ProjectDocument,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';
import {
  clockedTraitGeneratedPickupEntryKey,
  createShopOfferAddress,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { occurrenceActionLabel } from '@planner/projections/structured-workspace/assembly/occurrence-action-label';
import type { WorkspaceExplicitRewardControl } from '@planner/projections/structured-workspace/contracts/rewards';
import type { WorkspaceRoomLocal } from '@planner/projections/structured-workspace/contracts/locals';

function labelRewardControl(offer: ResolvedRewardOffer): WorkspaceExplicitRewardControl {
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(createOccurrenceAddress(goldenFBiome, goldenFStartId), 'roomExit'),
    'pickup',
  );
  return {
    kind: 'explicitReward',
    owner: { kind: 'acquisitionEntry', address: entry },
    marker: {
      address: entry,
      assessment: 'unassessed',
      findingCount: 0,
      focusKey: semanticAddressKey(entry),
    },
    offer,
    offerEditVisibility: 'hidden',
    retainedSourceMismatch: false,
    rewardTypes: [offer.rewardType],
  };
}

describe('timeline action labels', () => {
  it.each([
    [{ rewardType: 'StackUpgrade' }, 'Interact Pom'],
    [{ rewardType: 'StackUpgradeBig' }, 'Interact Double Pom'],
    [{ rewardType: 'StackUpgradeTriple' }, 'Interact Triple Pom'],
    [{ rewardType: 'StoreRewardRandomStack' }, 'Interact Pom Slice'],
    [{ rewardType: 'MaxHealthDrop' }, 'Interact Max Health'],
    [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
      'Interact Demeter boon',
    ],
    [{ rewardType: 'BlindBoxLoot' }, 'Interact Mystery Boon'],
    [
      { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
      'Interact Mystery Boon',
    ],
  ] as const)('describes %j concisely', (offer, expected) => {
    expect(
      occurrenceActionLabel(
        catalog,
        { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: 'pickup' },
        { kind: 'none' },
        [],
        labelRewardControl(offer),
        {},
      ),
    ).toBe(expected);
  });

  it('names only the corresponding Trial god while retaining Chosen and Spurned roles', () => {
    const control = labelRewardControl({
      rewardType: 'Devotion',
      payload: { kind: 'DevotionPair', chosenSource: 'ZeusUpgrade', spurnedSource: 'HeraUpgrade' },
    });
    const labels = (['chosenSource', 'spurnedSource'] as const).map((acquisitionRole) =>
      occurrenceActionLabel(
        catalog,
        { kind: 'interactIncomingReward', producerPoint: 'IncomingReward', acquisitionRole },
        { kind: 'none' },
        [],
        control,
        {},
      ),
    );
    expect(labels).toEqual(['Interact Chosen boon · Zeus', 'Interact Spurned boon · Hera']);
  });

  it('distinguishes paid, boosted, Contract, refill, and Echo actions in the same Shop', () => {
    const control = labelRewardControl({
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    });
    const entry = control.owner.address;
    if (entry.kind !== 'acquisitionEntry') throw new Error('Expected an acquisition entry');
    const purchase = { address: entry, marker: control.marker };
    const roomLocal: WorkspaceRoomLocal = {
      kind: 'shop',
      materialized: true,
      offers: (
        [
          ['Major', control],
          [
            'BoostedBoon',
            {
              ...control,
              shopOption: {
                selectedOptionKey: 'BoostedRandomLoot',
                options: [
                  { key: 'BoostedRandomLoot', label: 'Boosted Boon', rewardType: 'RandomLoot' },
                ],
              },
            },
          ],
          ['infernalContractReward', labelRewardControl({ rewardType: 'StackUpgradeBig' })],
        ] as const
      ).map(([key, rewardControl]) => ({
        key,
        label: key,
        purchase,
        participation: {
          interactionKey: key,
          owner: createShopOfferAddress(goldenFBiome, goldenFStartId, key),
          purchased: true,
        },
        rewardControl,
      })),
      supplementalOffers: [
        {
          kind: 'travelDealRefill',
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill after Offer 1',
          materialized: true,
          sourceOfferKey: 'Major',
          rewardControl: control,
          purchase: {
            ...purchase,
            purchased: true,
            reference: {
              kind: 'interactAcquisitionEntry',
              siteKey: 'roomExit',
              entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
            },
          },
        },
        {
          kind: 'echoDoubleShopReward',
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate of Offer 1',
          materialized: true,
          sourceOfferKey: 'Major',
          eligibleSourceOfferKeys: ['Major'],
          rewardControl: control,
          purchase: {
            ...purchase,
            purchased: true,
            reference: {
              kind: 'interactAcquisitionEntry',
              siteKey: 'roomExit',
              entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
            },
          },
        },
      ],
    };
    expect(
      roomLocal.offers.map(({ key }) =>
        occurrenceActionLabel(
          catalog,
          { kind: 'interactShopOffer', offerKey: key },
          roomLocal,
          [],
          undefined,
          {},
        ),
      ),
    ).toEqual([
      'Purchase Slot 1 Offer · Demeter boon',
      'Purchase Slot 2 Offer · Demeter boosted boon',
      'Interact Contract Item · Double Pom',
    ]);
    expect(
      roomLocal.supplementalOffers.map(({ key }) =>
        occurrenceActionLabel(
          catalog,
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: key },
          roomLocal,
          [],
          control,
          {},
        ),
      ),
    ).toEqual([
      'Purchase Travel Deal Offer · Demeter boon',
      'Interact Gold Gold Gold duplicate of Offer 1 · Demeter boon',
    ]);
  });

  it.each([
    ['initial:healing', 'Purchase Slot 1 Offer · Splintered Shield'],
    ['initial:secondLeft', 'Purchase Slot 2 Offer · Fateful Twist'],
    ['initial:secondRight', 'Purchase Slot 3 Offer · Yarn of Ariadne'],
    ['travelDealRefill', 'Purchase Travel Deal Offer · Splintered Shield'],
  ] as const)('includes the slot and item for Well generation %s', (generationKey, expected) => {
    expect(
      occurrenceActionLabel(
        catalog,
        { kind: 'purchaseStygianWellOffer', generationKey },
        { kind: 'none' },
        [],
        undefined,
        {
          stygianWell: {
            interacted: true,
            offerKeyBySlot: {
              healing: 'ArmorBoostStore',
              secondLeft: 'RandomStoreItem',
              secondRight: 'TemporaryBoonRarityTrait',
            },
            travelDealRefillKey: 'ArmorBoostStore',
          },
        },
      ),
    ).toBe(expected);
  });
});

describe('structured workspace actions assembly', () => {
  it('projects two matured clocked trait pickups through the existing optional-action surface', () => {
    const owner = createOccurrenceAddress(goldenFBiome, goldenFStartId);
    const site = createAcquisitionSiteAddress(owner, 'roomExit');
    const entries = ['pom1', 'pom2'].map((pickupKey) => ({
      address: createAcquisitionEntryAddress(
        site,
        clockedTraitGeneratedPickupEntryKey('icarus-supply', pickupKey),
      ),
      kind: 'clockedTraitPickup' as const,
      rewardTypes: ['StoreRewardRandomStack'],
      producerLifecycleKey: 'GeneratedTraitPickup',
      encounterPhaseKey: 'Encounter',
      participation: 'optional' as const,
    }));
    const { assembly } = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      goldenFStartId,
      undefined,
      (candidateSite) =>
        semanticAddressKey(candidateSite) === semanticAddressKey(site) ? entries : [],
    );
    const rows = assembly.node.room.roomActions?.optionalRows.filter(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.entryKey.startsWith('clockedTraitGenerated:'),
    );
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participation: 'optional',
          rank: null,
          window: { kind: 'encounterEnd', phaseKey: 'Encounter' },
          placement: {
            command: expect.objectContaining({
              kind: 'PlaceClockedTraitPickup',
              producerLifecycleKey: 'GeneratedTraitPickup',
              rewardType: 'StoreRewardRandomStack',
            }),
            focus: expect.any(Object),
          },
        }),
      ]),
    );
  });

  it('labels an authored clocked pickup from its reward without exposing its persisted key', () => {
    const owner = createOccurrenceAddress(goldenFBiome, goldenFStartId);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(owner, 'roomExit'),
      clockedTraitGeneratedPickupEntryKey('icarus-supply', 'pom2'),
    );
    const label = occurrenceActionLabel(
      catalog,
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: entry.entryKey,
        encounterPhaseKey: 'Encounter',
      },
      { kind: 'none' },
      [],
      Object.freeze({
        kind: 'explicitReward' as const,
        marker: Object.freeze({
          address: entry,
          assessment: 'unassessed' as const,
          findingCount: 0,
          focusKey: semanticAddressKey(entry),
        }),
        offer: Object.freeze({ rewardType: 'StoreRewardRandomStack' }),
        offerEditVisibility: 'hidden' as const,
        owner: Object.freeze({ kind: 'acquisitionEntry' as const, address: entry }),
        retainedSourceMismatch: false,
        rewardTypes: Object.freeze([]),
      }),
      {},
    );

    expect(label).toBe('Interact Supply Chain Pom Slice');
    expect(label).not.toContain('clockedTraitGenerated:');
  });

  it('shows the simulation-neutral Boss pickup as a required end-encounter action', () => {
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const { assembly } = assemble(
      project,
      'Underworld',
      'F',
      createOccurrenceId('golden-f-preboss-shop:boss'),
    );
    const roomActions = assembly.node.room.roomActions;
    const collect = roomActions?.rows.find((row) => row.reference.kind === 'collectRequiredReward');
    const entries = roomActions?.timeline.entries ?? [];
    const entryKeys = entries.map((entry) =>
      entry.kind === 'boundary' ? entry.label : entry.kind === 'action' ? entry.actionKey : '',
    );

    expect(collect).toMatchObject({
      label: 'Interact Boss Reward',
      participation: 'required',
      window: { kind: 'standard', phase: 'afterCombat' },
    });
    if (collect === undefined) throw new Error('expected the Boss reward action');
    expect(entryKeys.indexOf('End encounter')).toBeLessThan(entryKeys.indexOf(collect.key));
    expect(entryKeys.indexOf(collect.key)).toBeLessThan(entryKeys.indexOf('Cleanup · Doors open'));
  });

  it('labels a stale Shrine delivery without exposing its persisted entry key', () => {
    const entryKey = hermesShrineDeliveryEntryKey(
      createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      'initial:secondLeft',
    );

    const label = occurrenceActionLabel(
      catalog,
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey,
        encounterPhaseKey: 'Encounter',
      },
      { kind: 'none' },
      [],
      undefined,
      {},
    );

    expect(label).toBe('Interact Hermes delivery');
    expect(label).not.toContain('hermesShrineDelivery:');
  });

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
    const encounterEnd = phase.timeline.find(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd',
    );
    expect(endIndex).toBeGreaterThanOrEqual(0);
    const pickupIndex = phase.timeline.findIndex(
      (entry) =>
        entry.kind === 'action' &&
        entry.actionKey ===
          roomActionKey({
            kind: 'interactWheelReward',
            wheelKey: 'wheel1',
          }),
    );
    expect(pickupIndex).toBeGreaterThan(endIndex);
    expect(steadyIndex).toBe(pickupIndex + 1);
    expect(encounterEnd).toMatchObject({
      checkpointKey: 'combat:Combat1',
      label: 'End encounter',
    });
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

    expect(replayRepair?.label).toBe('Interact Echo reward');
    expect(replayRepair?.label).not.toContain('echoLastReward:');
  });

  it('places a due delayed Shrine delivery at its engine-published encounter end', () => {
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = loadSurfaceNOPProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: { rewardType },
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 3, rushed: false },
    });

    const hostId = oOccurrenceIds.devotion;
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(oBiome, hostId), 'hermesShrineDelivery'),
      entryKey,
    );
    const dueRoom = assemble(project, 'Surface', 'O', hostId).assembly.node.room;
    const dueRow = dueRoom.roomActions?.repairRows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'hermesShrineDelivery' &&
        row.reference.entryKey === entryKey,
    );

    expect(dueRow).toMatchObject({
      label: 'Interact Max Health',
      participation: 'required',
      rank: null,
      reference: { encounterPhaseKey: 'Encounter' },
      window: { kind: 'encounterEnd', phaseKey: 'Encounter' },
    });
    expect(dueRow?.placement?.command).toEqual({
      kind: 'PlaceHermesShrineDelivery',
      encounterPhaseKey: 'Encounter',
      entry,
    });
    expect(dueRow?.proposalKeys).toEqual([]);
    expect(dueRow?.rewardPayload).toBeUndefined();

    const command = dueRow?.placement?.command;
    if (command === undefined) throw new Error('Due Shrine delivery placement is missing');
    const placed = applyProjectCommand(project, catalog, command);
    const placedRoom = assemble(placed, 'Surface', 'O', hostId).assembly.node.room;
    const placedRow = placedRoom.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'hermesShrineDelivery' &&
        row.reference.entryKey === entryKey,
    );
    expect(placedRow).toMatchObject({
      label: 'Interact Max Health',
      participation: 'required',
      window: { kind: 'encounterEnd', phaseKey: 'Encounter' },
    });
    expect(placedRow?.rank).not.toBeNull();
    expect(placedRow?.placement).toBeUndefined();
    expect(placedRow?.rewardPayload).toBeDefined();
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

  it('projects the Contract slot as initial inventory with an Overview repair owner', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const address = createShopOfferAddress(goldenFBiome, shopId, 'infernalContractReward');
    const result = assemble(project, 'Underworld', 'F', shopId);
    expect(result.assembly.node.room.roomLocal).toMatchObject({
      kind: 'shop',
      offers: expect.arrayContaining([
        expect.objectContaining({
          key: 'infernalContractReward',
          rewardControl: expect.objectContaining({
            offer: null,
            owner: { kind: 'shopOffer', address },
          }),
        }),
      ]),
    });
    expect(result.markers.destinations().get(semanticAddressKey(address))).toMatchObject({
      focusAddress: address,
    });
  });

  it('projects a Gold duplicate ordered after its Travel refill source', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    let base = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const occurrenceAddress = createOccurrenceAddress(goldenFBiome, shopId);
    const site = createAcquisitionSiteAddress(occurrenceAddress, 'roomExit');
    const occurrence = base.route.biomes
      .find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      occurrence?.state.kind === 'shop' ? occurrence.state.shop?.offers.Boon?.reward : undefined;
    if (source == null) throw new Error('F Preboss Boon default is missing');
    base = applyProjectCommand(base, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, shopId, 'travelDealRefill'),
      value: source.offer,
    });
    const duplicate = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    const project: ProjectDocument = {
      ...base,
      route: {
        ...base.route,
        biomes: base.route.biomes.map((biome): typeof biome => {
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
    expect(
      result.roomActions?.rows
        .filter((row) => row.rank !== null)
        .map((row) => row.participationOwnedByOverview),
    ).toEqual([true, true, true]);
    expect(
      result.roomActions?.rows
        .filter((row) => row.rank !== null)
        .map((row) => row.rewardPayload?.showOffer),
    ).toEqual([false, false, false]);
  });

  it('proposes an unranked Travel refill immediately after its source purchase', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    let base = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const occurrenceAddress = createOccurrenceAddress(goldenFBiome, shopId);
    const site = createAcquisitionSiteAddress(occurrenceAddress, 'roomExit');
    const occurrence = base.route.biomes
      .find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      occurrence?.state.kind === 'shop' ? occurrence.state.shop?.offers.Boon?.reward : undefined;
    if (source == null) throw new Error('F Preboss Boon default is missing');
    base = applyProjectCommand(base, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, shopId, 'travelDealRefill'),
      value: source.offer,
    });
    const project: ProjectDocument = {
      ...base,
      route: {
        ...base.route,
        biomes: base.route.biomes.map((biome): typeof biome => {
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
                                entryKey: 'echoDoubleShopReward',
                              },
                            ],
                          },
                          acquisitionSites: {
                            ...(candidate.acquisitionSites ?? {}),
                            roomExit: {
                              pickupEntries: {
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
              address: createAcquisitionEntryAddress(site, 'echoDoubleShopReward'),
              kind: 'echoDoubleShopReward' as const,
              sourceOfferKey: 'travelDealRefill',
              rewardTypes: ['RandomLoot'],
              eligibleSourceOfferKeys: ['travelDealRefill'],
            },
          ],
    ).assembly.node.room;
    const travelReference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit' as const,
      entryKey: 'travelDealRefill' as const,
    };
    const travelRow = result.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.entryKey === 'travelDealRefill',
    );
    const travelProposals = result.roomActions?.proposals.filter(
      (proposal) =>
        proposal.reference.kind === 'interactAcquisitionEntry' &&
        proposal.reference.entryKey === 'travelDealRefill',
    );
    expect(travelRow?.rank).toBeNull();
    expect(travelProposals).toHaveLength(3);
    expect(
      travelProposals?.map((proposal) => [
        proposal.kind,
        proposal.toIndex,
        proposal.structurallyAuthorable,
      ]),
    ).toEqual([
      ['insert', 0, false],
      ['insert', 1, true],
      ['insert', 2, true],
    ]);
    expect(travelProposals?.find((proposal) => proposal.structurallyAuthorable)).toMatchObject({
      kind: 'insert',
      reference: travelReference,
      toIndex: 1,
    });
  });
});
