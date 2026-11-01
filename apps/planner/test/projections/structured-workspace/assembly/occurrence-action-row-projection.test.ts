import {
  authorLegalTraitOffers,
  purchaseTestHermesShrineOffer,
  testHermesShrinePurchaseAction,
} from '@run-planner/test-fixtures/shared';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { loadSurfaceNOProject as loadSurfaceNO, nBiome } from '@run-planner/test-fixtures/surface';
import {
  loadUnderworldFStygianWellCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';
import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  catalog,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createCompleteFGProject,
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
  decodeProjectDocument,
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
  createAcquisitionRoleAddress,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  createRoomFeatureAddress,
  createRouteStartKeepsakeSelectionAddress,
  type RoomActionReference,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  goldenFOccurrenceId,
  goldenGBiome,
  replaceNemesisRandomEventInteraction,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  qBiome,
  qOccurrenceIds,
  surfaceTravelDealRefillAnvilProject,
  surfaceTravelDealRefillAnvilResult,
} from '@run-planner/test-fixtures/surface';
import { bind } from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  goldLedgerForProjectEvaluationAssembly,
  type GoldAmount,
  type GoldLedger,
  type GoldPurchasePrice,
  type GoldRoomAvailability,
} from '@run-planner/engine/simulation';
import {
  occurrenceActionLabel,
  occurrenceActionLabelParts,
} from '@planner/projections/structured-workspace/assembly/occurrence-action-label';
import {
  goldBalanceLabel,
  purchaseAffordability,
} from '@planner/projections/structured-workspace/assembly/occurrence-action-row-projection';
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
    ['quickBuckGold', 'RoomMoneyDrop', 'Gold', 'Quick Buck', 'MoneyMultiplierBoon'],
    ['bones', 'MetaCurrencyDrop', 'Bones', 'Buried Treasure', 'RoomRewardBonusBoon'],
  ] as const)('identifies the source of %s', (entryKey, rewardType, name, trait, traitKey) => {
    // The reward names the row; its source trait is told as its origin, not in the label.
    expect(
      occurrenceActionLabelParts(
        catalog,
        { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey },
        { kind: 'none' },
        [],
        labelRewardControl({ rewardType }),
        {},
        undefined,
        { kind: 'trait', traitKey },
      ),
    ).toMatchObject({
      label: `Collect ${name}`,
      verb: 'Collect',
      name,
      origin: `Created by ${trait}`,
      reward: { offer: { rewardType } },
    });
  });
  it.each([
    ['artificer', 'Collect Bones'],
    ['timePiece', 'Collect Bones'],
  ] as const)('keeps the plain verb when %s converts the reward', (kind, expected) => {
    // The conversion is the row's verb choice, not part of its label.
    const control = labelRewardControl({ rewardType: 'MetaCurrencyDrop' });
    const owner = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenFBiome, goldenFStartId),
        'roomExit',
      ),
      'pickup',
    );
    expect(
      occurrenceActionLabel(
        catalog,
        { kind: 'interactIncomingReward', producerPoint: 'roomReward', acquisitionRole: 'primary' },
        { kind: 'none' },
        [],
        {
          ...control,
          conversions: [
            {
              acquisitionRoleLabel: 'Reward',
              address: createAcquisitionRoleAddress(owner, 'primary'),
              marker: control.marker,
              rewardOwner: control.owner.address,
              value: { kind },
            },
          ],
        },
        {},
      ),
    ).toBe(expected);
  });
  it.each([
    [{ rewardType: 'StackUpgrade' }, 'Collect Pom'],
    [{ rewardType: 'StackUpgradeBig' }, 'Collect Double Pom'],
    [{ rewardType: 'StackUpgradeTriple' }, 'Collect Triple Pom'],
    [{ rewardType: 'StoreRewardRandomStack' }, 'Collect Pom Slice'],
    [{ rewardType: 'MaxHealthDrop' }, 'Collect Max Health'],
    [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
      'Collect Demeter',
    ],
    [{ rewardType: 'BlindBoxLoot' }, 'Collect Mystery Boon'],
    [
      { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
      'Collect Mystery Boon',
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
    expect(labels).toEqual(['Collect Chosen boon · Zeus', 'Collect Spurned boon · Hera']);
  });

  it('distinguishes paid, boosted, refill, and Echo actions in the same Shop', () => {
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
    // The slot is a badge and the boosted variant a mark on the reward icon.
    expect(
      roomLocal.offers.map(({ key }) => {
        const parts = occurrenceActionLabelParts(
          catalog,
          { kind: 'interactShopOffer', offerKey: key },
          roomLocal,
          [],
          undefined,
          {},
        );
        return [parts.label, parts.slot, parts.reward?.boosted];
      }),
    ).toEqual([
      ['Buy Demeter', 1, false],
      ['Buy Boosted Demeter', 2, true],
    ]);
    // The engine's source family tells a Travel Deal restock from an Echo duplicate.
    const families = {
      [TRAVEL_DEAL_REFILL_ENTRY_KEY]: { kind: 'shopTravelDealRefill' },
      [ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY]: { kind: 'echo' },
    } as const;
    expect(
      roomLocal.supplementalOffers.map(({ key }) => {
        const parts = occurrenceActionLabelParts(
          catalog,
          { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: key },
          roomLocal,
          [],
          control,
          {},
          undefined,
          families[key as keyof typeof families],
        );
        return [parts.shownLabel ?? parts.label, parts.travelDeal ?? false];
      }),
    ).toEqual([
      ['Buy Demeter', true],
      ['Collect Demeter · Gold Gold Gold duplicate of Offer 1', false],
    ]);
  });

  it('names the Pedestal collect by its item', () => {
    const label = (offer?: { readonly rewardType: string }) =>
      occurrenceActionLabel(
        catalog,
        { kind: 'interactInfernalContractPedestal' },
        { kind: 'none' },
        [],
        undefined,
        {
          infernalContractPedestal: {
            optionKey: offer?.rewardType ?? null,
            reward:
              offer === undefined
                ? null
                : {
                    offer,
                    traitOffersByAcquisitionRole: {},
                    dispositionByAcquisitionRole: {},
                  },
          },
        },
      );
    // The Pedestal is the row's icon; the label names only its item.
    expect(label({ rewardType: 'StackUpgradeBig' })).toBe('Collect Double Pom');
    expect(label({ rewardType: 'BlindBoxLoot' })).toBe('Collect Mystery Boon');
    expect(label()).toBe('Collect Pedestal item');
  });

  it.each([
    ['initial:healing', 'Buy Splintered Shield', { slot: 1 }],
    ['initial:secondLeft', 'Buy Fateful Twist', { slot: 2 }],
    ['initial:secondRight', 'Buy Yarn of Ariadne', { slot: 3 }],
    ['travelDealRefill', 'Buy Splintered Shield', { travelDeal: true }],
  ] as const)('names the item and slot for Well generation %s', (generationKey, shown, mark) => {
    const parts = occurrenceActionLabelParts(
      catalog,
      { kind: 'purchaseStygianWellOffer', generationKey },
      { kind: 'none' },
      [],
      undefined,
      {
        stygianWell: {
          offerKeyBySlot: {
            healing: 'ArmorBoostStore',
            secondLeft: 'RandomStoreItem',
            secondRight: 'TemporaryBoonRarityTrait',
          },
          travelDealRefillKey: 'ArmorBoostStore',
        },
      },
    );
    // The slot is a badge and a Travel Deal refill a mark on the row icon.
    expect(parts.shownLabel ?? parts.label).toBe(shown);
    expect(parts).toMatchObject(mark);
  });
});

describe('structured workspace actions assembly', () => {
  it.each([
    [{ kind: 'freeItem' }, { rewardType: 'ArmorBoost' }, 'Collect Armor'],
    [
      { kind: 'damageContest', result: 'success' },
      { rewardType: 'MaxHealthDrop' },
      'Collect Max Health',
    ],
    [
      { kind: 'damageContest', result: 'failure' },
      { rewardType: 'RoomRewardConsolationPrize' },
      'Collect Red Onion',
    ],
  ] as const)(
    'names an optional Nemesis pickup before and after placement: %s',
    (value, reward, label) => {
      const occurrenceId = goldenFOccurrenceId(5, 1);
      const phase = createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      );
      const selected = applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'NemesisRandomEvent',
      });
      const project = replaceNemesisRandomEventInteraction(
        selected,
        createNemesisRandomEventAddress(phase),
        value,
        reward,
      );
      const reference = {
        kind: 'interactAcquisitionEntry' as const,
        siteKey: 'nemesisGenerated:Encounter',
        entryKey: 'result',
      };
      const key = roomActionKey(reference);
      const actions = assemble(project, 'Underworld', 'F', occurrenceId).assembly.node.room
        .roomActions;
      const optional = actions?.optionalRows.find((row) => row.key === key);
      expect(optional).toMatchObject({ label, participation: 'optional', rank: null });
      expect(optional?.rewardPayload?.control.offer).toBeNull();
      expect(optional?.rewardPayload?.inlineLevelResolutions).toEqual([]);
      const insertion = actions?.proposals.find(
        (proposal) =>
          proposal.kind === 'insert' &&
          roomActionKey(proposal.reference) === key &&
          proposal.structurallyAuthorable,
      );
      if (insertion?.toIndex === undefined) throw new Error('Optional pickup insertion is missing');
      const placed = applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(goldenFBiome, occurrenceId, key),
        reference,
        index: insertion.toIndex,
      });
      const row = assemble(
        placed,
        'Underworld',
        'F',
        occurrenceId,
      ).assembly.node.room.roomActions?.rows.find((candidate) => candidate.key === key);
      expect(row?.label).toBe(label);
      expect(row?.rewardPayload?.control.offer).toEqual(reward);
    },
  );

  it('places a contest Pom as a required row rather than an optional pickup', () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const project = replaceNemesisRandomEventInteraction(
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'NemesisRandomEvent',
      }),
      createNemesisRandomEventAddress(phase),
      { kind: 'damageContest', result: 'success' },
      { rewardType: 'StackUpgrade' },
    );
    const key = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Encounter',
      entryKey: 'result',
    });
    const actions = assemble(project, 'Underworld', 'F', occurrenceId).assembly.node.room
      .roomActions;
    expect(actions?.optionalRows.some((row) => row.key === key)).toBe(false);
    expect(actions?.rows.find((row) => row.key === key)).toMatchObject({
      label: 'Collect Pom',
      participation: 'required',
    });
  });

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
    const parts = occurrenceActionLabelParts(
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
      undefined,
      { kind: 'trait', traitKey: 'SupplyDropBoon' },
    );

    expect(parts).toMatchObject({ label: 'Collect Pom Slice', origin: 'Created by Supply Chain' });
    expect(parts.label).not.toContain('clockedTraitGenerated:');
  });

  it('publishes a pending Phial control on a fountain use that lacks a rarity assessment', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const { assembly } = assemble(createCompleteFGProject(), 'Underworld', 'F', postbossId);
    const fountain = assembly.node.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'useFountain',
    );
    if (fountain === undefined) throw new Error('expected the Postboss fountain action');
    const outcome = createFountainRarityOutcomeAddress(
      createRoomActionAddress(goldenFBiome, postbossId, roomActionKey({ kind: 'useFountain' })),
    );
    expect(fountain.fountainRarity).toEqual({
      address: outcome,
      marker: expect.objectContaining({ address: outcome }),
      pending: 'unreached',
    });
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
      label: 'Collect Boss Reward',
      participation: 'required',
      window: { kind: 'standard', phase: 'afterCombat' },
    });
    if (collect === undefined) throw new Error('expected the Boss reward action');
    expect(entryKeys.indexOf('Encounter ended')).toBeLessThan(entryKeys.indexOf(collect.key));
    expect(entryKeys.indexOf(collect.key)).toBeLessThan(entryKeys.indexOf('Doors open'));
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
      undefined,
      { kind: 'hermesShrineDelivery' },
    );

    expect(label).toBe('Collect Delivery');
    expect(label).not.toContain('hermesShrineDelivery:');
    // Without a source family the persisted key still never shows.
    expect(
      occurrenceActionLabel(
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
      ),
    ).not.toContain('hermesShrineDelivery:');
  });

  it('carries a reached O Ship Steady Growth effect in engine timeline order', () => {
    const occurrenceId = oOccurrenceIds.combat04;
    const owner = createOccurrenceAddress(oBiome, occurrenceId);
    const outcome = createSteadyGrowthOutcomeAddress(
      createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat23')),
        'source',
      ),
      1,
    );
    const project = loadSurfaceNOPQProject();
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
          owner,
          sourceTraitKey: 'BoonGrowthBoon',
          phaseKey: 'Combat1',
          targetTraitKey: 'ApolloWeaponBoon',
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
      label: 'Encounter ended',
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

    expect(replayRepair?.label).toBe('Collect Hera');
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
    project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:secondLeft', {
      delay: 3,
      rushed: false,
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
      label: 'Collect Max Health',
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
    // Placed, the delivery tells its Shrine origin beside its reward name.
    expect(placedRow).toMatchObject({
      label: 'Collect Max Health',
      sourceFamily: { kind: 'hermesShrineDelivery' },
      labelParts: { origin: 'Delivered from the Hermes Shrine' },
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
        entry.kind === 'boundary' && entry.fieldsCage !== undefined
          ? [
              {
                phaseKey: entry.boundary.kind === 'encounterStart' ? entry.boundary.phaseKey : '',
                label: entry.fieldsCage.label,
              },
            ]
          : [],
      ),
    ).toEqual([
      { phaseKey: 'Cage02', label: expect.stringMatching(/^Cage 2 \(/) },
      { phaseKey: 'Cage01', label: expect.stringMatching(/^Cage 1 \(/) },
    ]);
    expect(roomActions.timeline.fieldsCageOrder).toEqual({
      phaseKeys: ['Cage02', 'Cage01'],
      choices: [
        // The combat order names its cages; each keeps its reward for the banner.
        {
          phaseKey: 'Cage01',
          label: 'Cage 1',
          fullLabel: expect.stringMatching(/^Cage 1 \(/),
          offer: expect.objectContaining({ rewardType: expect.any(String) }),
        },
        {
          phaseKey: 'Cage02',
          label: 'Cage 2',
          fullLabel: expect.stringMatching(/^Cage 2 \(/),
          offer: expect.objectContaining({ rewardType: expect.any(String) }),
        },
      ],
    });
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
    expect(
      shipActions.timeline.entries.filter(
        (entry) =>
          entry.kind === 'action' &&
          entry.actionKey === roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' }),
      ),
    ).toEqual([expect.objectContaining({ kind: 'action', presentation: 'rewardWheelAnchor' })]);
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

  it('reads the Fields cage order and its blocked state from the engine product', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const authored = createGoldenFGHIProject();
    const missing = decodeProjectDocument(
      {
        ...authored,
        route: {
          ...authored.route,
          biomes: authored.route.biomes.map((biome) =>
            biome.biomeKey !== 'H' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId !== occurrenceId
                        ? occurrence
                        : {
                            ...occurrence,
                            roomActions: {
                              order: occurrence.roomActions.order.filter(
                                (reference) =>
                                  reference.kind !== 'completeFieldsCage' ||
                                  reference.phaseKey !== 'Cage02',
                              ),
                            },
                          },
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    const roomActions = assemble(missing, 'Underworld', 'H', occurrenceId).assembly.node.room
      .roomActions;
    expect(roomActions?.timeline.fieldsCageOrder).toEqual({
      phaseKeys: ['Cage01'],
      choices: [
        // The combat order names its cages; each keeps its reward for the banner.
        {
          phaseKey: 'Cage01',
          label: 'Cage 1',
          fullLabel: expect.stringMatching(/^Cage 1 \(/),
          offer: expect.objectContaining({ rewardType: expect.any(String) }),
        },
        {
          phaseKey: 'Cage02',
          label: 'Cage 2',
          fullLabel: expect.stringMatching(/^Cage 2 \(/),
          offer: expect.objectContaining({ rewardType: expect.any(String) }),
        },
      ],
      unavailableReason: 'Restore missing cage actions before changing their order.',
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
              fixedReward: source,
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
    // Purchases are deleted on their rows; the Gold duplicate follows its purchase.
    expect(
      result.roomActions?.rows
        .filter((row) => row.rank !== null)
        .map((row) => row.purchaseRemoval !== undefined),
    ).toEqual([true, true, false]);
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

describe('shop-like purchase rows', () => {
  const shrineId = createOccurrenceId('surface-n-preboss:postboss');
  const shrineOwner = createOccurrenceAddress(nBiome, shrineId);

  function travelDealShrine(rushed: boolean): ProjectDocument {
    let project = applyProjectCommand(loadSurfaceNO(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat05')),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
    });
    const hermes = createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat09'));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: hermes,
      value: { rewardType: 'HermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(hermes, 'self'),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'RestockBoon', rarity: 'Epic' },
          { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
          { traitKey: 'SprintShieldBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: shrineOwner,
      value: { rewardType: 'ArmorBoost' },
    });
    for (const generationKey of ['initial:first', 'initial:secondLeft'] as const)
      project = purchaseTestHermesShrineOffer(project, catalog, shrineOwner, generationKey, {
        delay: 2,
        rushed,
      });
    // Timeline order, not slot order, decides which rushed purchase triggers the refill.
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: testHermesShrinePurchaseAction(shrineOwner, 'initial:secondLeft'),
      toIndex: 1,
    });
    return authorLegalTraitOffers({
      ...project,
      route: { ...project.route, biomes: project.route.biomes.slice(0, 1) },
    });
  }

  /** Purchase rows in timeline order from the composed workspace. */
  function purchaseRows(
    project: ProjectDocument,
    occurrenceId: string,
    kind: 'purchaseHermesShrineOffer' | 'purchaseStygianWellOffer',
  ) {
    const node = projectStructuredWorkspaceFixture(project)
      .workspace.route.biomes.flatMap((biome) => biome.nodes)
      .find(
        (candidate) =>
          candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
      );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${occurrenceId} is missing`);
    return (node.room.roomActions?.rows ?? [])
      .filter((row) => row.reference.kind === kind)
      .sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity));
  }
  const shrineRows = (project: ProjectDocument) =>
    purchaseRows(project, shrineId, 'purchaseHermesShrineOffer');

  it('reads Shrine rush on the row and carries the refill line on the first rushed purchase in timeline order', () => {
    const rows = shrineRows(travelDealShrine(true));
    expect(
      rows.map((row) => [
        row.reference.kind === 'purchaseHermesShrineOffer' && row.reference.generationKey,
        row.label.startsWith('Rush '),
        row.travelDealLine?.kind,
      ]),
    ).toEqual([
      ['initial:secondLeft', true, 'hermesShrine'],
      ['initial:first', true, undefined],
    ]);
    expect(rows[0]?.travelDealLine).toMatchObject({
      refill: { rewardType: 'ArmorBoost', sourceGenerationKey: 'initial:secondLeft' },
    });
  });

  it('omits the Shrine refill line without a rushed purchase and removes a stranded refill', () => {
    let project = travelDealShrine(false);
    expect(shrineRows(project).some((row) => row.travelDealLine !== undefined)).toBe(false);
    project = purchaseTestHermesShrineOffer(project, catalog, shrineOwner, 'travelDealRefill', {
      delay: 3,
      rushed: false,
    });
    const refill = shrineRows(project).find(
      (row) =>
        row.reference.kind === 'purchaseHermesShrineOffer' &&
        row.reference.generationKey === 'travelDealRefill',
    );
    expect(refill).toMatchObject({
      purchaseRemoval: {
        command: {
          kind: 'SetHermesShrinePurchase',
          occurrence: shrineOwner,
          generationKey: 'travelDealRefill',
          purchased: false,
        },
      },
    });
    expect(refill?.travelDealLine).toBeUndefined();
  });

  it('hosts the Well refill on its first purchase and removes a refill without one', () => {
    const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const wellOwner = createOccurrenceAddress(goldenFBiome, wellId);
    const wellRows = (project: ProjectDocument) =>
      purchaseRows(project, wellId, 'purchaseStygianWellOffer');
    const checkpoint = authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint());
    const hosted = wellRows(checkpoint).filter((row) => row.travelDealLine !== undefined);
    expect(hosted).toHaveLength(1);
    const source = hosted[0]!.reference;
    expect(hosted[0]!.travelDealLine).toMatchObject({
      kind: 'stygianWell',
      refill: {
        sourceGenerationKey: source.kind === 'purchaseStygianWellOffer' && source.generationKey,
      },
    });
    // Each purchase, the hosted refill included, is removed on its own row.
    expect(wellRows(checkpoint).every((row) => row.purchaseRemoval !== undefined)).toBe(true);

    let stranded = checkpoint;
    for (const generationKey of [
      'initial:healing',
      'initial:secondLeft',
      'initial:secondRight',
    ] as const)
      stranded = applyProjectCommand(stranded, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: wellOwner,
        generationKey,
        purchased: false,
      });
    const rows = wellRows(stranded);
    expect(rows.map((row) => row.travelDealLine)).toEqual([undefined]);
    expect(rows[0]).toMatchObject({
      reference: { generationKey: 'travelDealRefill' },
      purchaseRemoval: {
        command: {
          kind: 'SetStygianWellPurchase',
          occurrence: wellOwner,
          generationKey: 'travelDealRefill',
          purchased: false,
        },
      },
    });
  });

  /** A hosted refill finding opens the line's own control on the room's timeline. */
  function expectLineDestination(
    project: ProjectDocument,
    occurrenceId: string,
    refill: SemanticAddress,
  ) {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(project);
    expect(evaluation.findings).toContainEqual(expect.objectContaining({ origin: refill }));
    const node = workspace.route.biomes
      .flatMap((biome) => biome.nodes)
      .find(
        (candidate) =>
          candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
      );
    expect(workspace.focusByOwner.get(semanticAddressKey(refill))).toMatchObject({
      focusAddress: refill,
      nodeKey: node?.key,
      roomTab: 'actions',
    });
  }

  it('routes a hosted Shrine refill finding to its Travel Deal line', () => {
    const project = applyProjectCommand(travelDealShrine(true), catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: shrineOwner,
      // A visible initial identity is never a refill candidate.
      value: { rewardType: 'HealBigDrop' },
    });
    expectLineDestination(
      project,
      shrineId,
      createRoomFeatureAddress(shrineOwner, {
        kind: 'hermesShrineOffer',
        generationKey: 'travelDealRefill',
      }),
    );
  });

  it('routes a hosted Well refill finding to its Travel Deal line', () => {
    const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const wellOwner = createOccurrenceAddress(goldenFBiome, wellId);
    const project = applyProjectCommand(
      authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint()),
      catalog,
      { kind: 'ReplaceStygianWellTravelDealRefill', occurrence: wellOwner, itemKey: null },
    );
    expectLineDestination(
      project,
      wellId,
      createRoomFeatureAddress(wellOwner, {
        kind: 'stygianWellOffer',
        generationKey: 'travelDealRefill',
      }),
    );
  });

  it('hosts the World Shop refill on its source purchase and removes it without one', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    const travel = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    };
    const withOrder = (order: readonly RoomActionReference[]): ProjectDocument => {
      const base = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
      return {
        ...base,
        route: {
          ...base.route,
          biomes: base.route.biomes.map((biome): typeof biome =>
            biome.biomeKey !== 'F' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((candidate) =>
                      candidate.occurrenceId === shopId
                        ? { ...candidate, roomActions: { order } }
                        : candidate,
                    ),
                  },
                },
          ),
        },
      };
    };
    const rows = assemble(
      withOrder([{ kind: 'interactShopOffer', offerKey: 'MajorNonBoon' }]),
      'Underworld',
      'F',
      shopId,
      undefined,
      (candidate) =>
        semanticAddressKey(candidate) !== semanticAddressKey(site)
          ? []
          : [
              {
                address: createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY),
                kind: 'travelDealRefill' as const,
                sourceOfferKey: 'MajorNonBoon',
                slotIndex: 1,
                rewardTypes: ['RandomLoot'],
              },
            ],
    ).assembly.node.room.roomActions?.rows;
    expect(
      rows?.find((row) => row.reference.kind === 'interactShopOffer')?.travelDealLine,
    ).toMatchObject({ kind: 'worldShop', offer: { sourceOfferKey: 'MajorNonBoon' } });

    const stranded = assemble(withOrder([travel]), 'Underworld', 'F', shopId).assembly.node.room
      .roomActions?.rows;
    const refill = stranded?.find((row) => row.key === roomActionKey(travel));
    expect(refill?.purchaseRemoval).toEqual({
      command: { kind: 'RemoveRoomAction', action: refill?.address },
    });
    expect(stranded?.some((row) => row.travelDealLine !== undefined)).toBe(false);
  });
});

describe('room Timeline block', () => {
  const shopId = createOccurrenceId('golden-f-preboss-shop');
  const shop = createOccurrenceAddress(goldenFBiome, shopId);
  const boon = createShopOfferAddress(goldenFBiome, shopId, 'Boon');
  const refill = createShopOfferAddress(goldenFBiome, shopId, 'travelDealRefill');
  const refillReference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'roomExit' as const,
    entryKey: 'travelDealRefill',
  };

  /** A purchased Boon, then a Travel Deal refill Boon whose offer is missing. */
  function missingRefillOffer(): ProjectDocument {
    let project = replaceTestShopOfferActions(
      underworldWorldShopTravelDealProject(),
      catalog,
      shop,
      ['Boon'],
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, shopId, roomActionKey(refillReference)),
      toIndex: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: refill,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = authorLegalTraitOffers(project);
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: refill,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
  }

  function shopRows(project: ProjectDocument) {
    const node = projectStructuredWorkspaceFixture(project)
      .workspace.route.biomes.flatMap((biome) => biome.nodes)
      .find(
        (candidate) =>
          candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === shopId,
      );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('F Shop workbench is missing');
    return node.room.roomActions?.rows ?? [];
  }

  it('keeps earlier rows reached and marks the blocking product rows with their findings', () => {
    const rows = shopRows(missingRefillOffer());
    const purchase = rows.find(
      (row) => row.key === roomActionKey({ kind: 'interactShopOffer', offerKey: 'Boon' }),
    );
    const blocked = rows.find((row) => row.key === roomActionKey(refillReference));

    // The earlier purchase keeps its reached offer control and is not the repair region.
    expect(purchase?.blockingProduct).toBeUndefined();
    expect(purchase?.rewardPayload?.inlineTraitOffers).toContainEqual(
      expect.objectContaining({
        address: createTraitOfferAddress(boon, 'source'),
        contextReached: true,
      }),
    );
    // The blocking row is the repair region, editable from its own reached contact.
    expect(blocked?.blockingProduct).toBe(true);
    expect(blocked?.rewardPayload?.inlineTraitOffers).toContainEqual(
      expect.objectContaining({
        address: createTraitOfferAddress(refill, 'source'),
        contextReached: true,
        offer: null,
      }),
    );
  });

  it('keeps the room Exit read-only behind a blocking reward offer', () => {
    const minibossId = createOccurrenceId('golden-h-miniboss01');
    let project = authorLegalTraitOffers(createGoldenFGHIProject());
    const before = projectStructuredWorkspaceFixture(project).evaluation.route.biomes.find(
      (biome) => biome.biomeKey === 'H',
    );
    const selected =
      before !== undefined && 'rewards' in before
        ? before.rewards.selectedTraitOffers.find(
            (offer) =>
              offer.address.owner.kind === 'incomingReward' &&
              offer.address.owner.occurrenceId === minibossId,
          )
        : undefined;
    if (selected?.offer.kind !== 'traits') throw new Error('H miniboss has no trait offer');
    const [first, second, third] = selected.offer.options;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('H miniboss trait offer is incomplete');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: selected.address,
      value: { ...selected.offer, options: [{ ...first, rarity: 'Heroic' }, second, third] },
    });
    const nodes = projectStructuredWorkspaceFixture(project).workspace.route.biomes.flatMap(
      (biome) => biome.nodes,
    );
    const room = nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === minibossId,
    );
    const exit = nodes.find(
      (candidate) =>
        candidate.kind === 'ordinaryBatch' &&
        semanticAddressKey(candidate.owner) ===
          semanticAddressKey(
            createExitDecisionAddress(goldenHBiome, {
              kind: 'occurrence',
              occurrenceId: minibossId,
            }),
          ),
    );
    if (room?.kind !== 'occurrenceWorkbench') throw new Error('H miniboss workbench is missing');
    const pickup = room.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    );
    // The reward pickup is the repair region; the doors never opened, so the Exit is unassessed.
    expect(pickup?.blockingProduct).toBe(true);
    expect(exit?.marker.assessment).toBe('unassessed');
  });
  it('keeps existing row-level edits on a Shop purchase after the blocking purchase', () => {
    const shopId = qOccurrenceIds.preboss;
    const shop = createOccurrenceAddress(qBiome, shopId);
    const refillOffer = createShopOfferAddress(qBiome, shopId, 'travelDealRefill');
    const refillRow = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit' as const,
      entryKey: 'travelDealRefill',
    };
    let project = replaceTestShopOfferActions(
      surfaceTravelDealRefillAnvilProject(),
      catalog,
      shop,
      ['PremiumProgress', 'MixedProgress1'],
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(qBiome, shopId, roomActionKey(refillRow)),
      toIndex: 1,
    });
    // Removing a Hammer the run does not hold makes the refill's Anvil illegal.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAnvilResult',
      acquisition: createAcquisitionRoleAddress(refillOffer, 'self'),
      value: { ...surfaceTravelDealRefillAnvilResult, removedTraitKey: 'StaffTripleShotTrait' },
    });
    const { assembly, interactions } = bind(project, 'Surface', 'Q');
    const node = assembly.nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === shopId,
    );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('Q Shop workbench is missing');
    const rows = node.room.roomActions?.rows ?? [];
    const later = rows.find(
      (row) => row.key === roomActionKey({ kind: 'interactShopOffer', offerKey: 'MixedProgress1' }),
    );
    const refill = rows.find((row) => row.key === roomActionKey(refillRow));
    expect([...rows].sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0))[2]).toBe(later);
    // Each purchase is its own product: only the failing refill is the repair region.
    expect(refill?.blockingProduct).toBe(true);
    // The later purchase is after the block; its row-level order and participation stay bound.
    expect(later?.blockingProduct).toBeUndefined();
    expect(later?.proposalKeys.length).toBeGreaterThan(0);
    expect(interactions.roomActions.get(semanticAddressKey(shop))).toMatchObject({ owner: shop });
    expect(later?.purchaseRemoval?.command).toMatchObject({
      kind: 'ReplaceShopPurchaseParticipation',
      purchased: false,
    });
  });
});

describe('room Timeline block in opening, fixed and Hub rooms', () => {
  function workbenches(project: ProjectDocument) {
    return projectStructuredWorkspaceFixture(project)
      .workspace.route.biomes.flatMap((biome) => biome.nodes)
      .flatMap((node) => (node.kind === 'occurrenceWorkbench' ? [node] : []));
  }

  function workbench(project: ProjectDocument, occurrenceId: string) {
    const node = workbenches(project).find(
      (candidate) => candidate.room.occurrenceId === occurrenceId,
    );
    if (node === undefined) throw new Error(`${occurrenceId} workbench is missing`);
    return node;
  }

  function skipEncounter(project: ProjectDocument, occurrenceId: string): ProjectDocument {
    const withFigLeaf = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    return applyProjectCommand(withFigLeaf, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
        'Encounter',
      ),
      value: true,
    });
  }

  it('keeps the opening reward reached before its blocking encounter start', () => {
    const project = skipEncounter(loadSurfaceNOPQProject(), 'surface-n-opening');
    const pickup = workbench(project, 'surface-n-opening').room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    );

    expect(pickup?.rewardPayload?.inlineTraitOffers.map((offer) => offer.contextReached)).toEqual([
      true,
    ]);
    // The opening never opens its doors, so the next room is never assessed.
    expect(workbench(project, 'surface-n-prehub').marker.assessment).toBe('unassessed');
  });

  it('marks the blocking Boss delivery and leaves the Postboss unassessed', () => {
    const project = createSurfaceNUnresolvedBossHermesDeliveryCheckpoint();
    const rows = workbench(project, 'surface-n-preboss:boss').room.roomActions?.rows ?? [];

    expect(
      rows.find((row) => row.reference.kind === 'collectRequiredReward')?.blockingProduct,
    ).toBe(undefined);
    expect(
      rows.find(
        (row) =>
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.siteKey === 'hermesShrineDelivery',
      )?.blockingProduct,
    ).toBe(true);
    expect(workbench(project, 'surface-n-preboss').marker.assessment).toBe('assessed');
    expect(workbench(project, 'surface-n-preboss:postboss').marker.assessment).toBe('unassessed');
  });

  it('enters a Hub visit target whose reward offer blocks its Timeline', () => {
    const base = authorLegalTraitOffers(loadSurfaceNOPQProject());
    const n = projectStructuredWorkspaceFixture(base).evaluation.route.biomes.find(
      (biome) => biome.biomeKey === 'N',
    );
    const selected =
      n !== undefined && 'rewards' in n
        ? n.rewards.selectedTraitOffers.find(
            (offer) =>
              offer.address.owner.kind === 'incomingReward' &&
              offer.address.owner.occurrenceId === 'surface-n-combat11',
          )
        : undefined;
    if (selected?.offer.kind !== 'traits') throw new Error('N combat11 has no trait offer');
    const [first, ...rest] = selected.offer.options;
    if (first === undefined) throw new Error('N combat11 trait offer is empty');
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: selected.address,
      value: { ...selected.offer, options: [{ ...first, rarity: 'Heroic' }, ...rest] },
    });
    const pickup = (occurrenceId: string) =>
      workbench(project, occurrenceId).room.roomActions?.rows.find(
        (row) => row.reference.kind === 'interactIncomingReward',
      );

    // The stopped visit's target is entered and its reward pickup is the repair region.
    expect(workbench(project, 'surface-n-combat11').marker.assessment).toBe('assessed');
    expect(pickup('surface-n-combat11')?.blockingProduct).toBe(true);
    // An earlier visit keeps its reached offer; a later visit is read-only.
    expect(
      pickup('surface-n-combat05')?.rewardPayload?.inlineTraitOffers.map(
        (offer) => offer.contextReached,
      ),
    ).toEqual([true]);
    expect(
      pickup('surface-n-combat23')?.rewardPayload?.inlineTraitOffers.map(
        (offer) => offer.contextReached,
      ),
    ).toEqual([false]);
  });
});

describe('purchase gold', () => {
  const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
  const wellOwner = createOccurrenceAddress(goldenFBiome, wellId);
  const checkpoint = () => authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint());
  // A Combat room Well buying both side slots and its Travel Deal refill.
  const combatWellId = createOccurrenceId('d476f7b4-5302-4e1a-9876-7f0dcbd17654');
  const fixed = (amount: number): GoldAmount => ({
    mean: amount,
    variance: 0,
    min: amount,
    max: amount,
  });
  const rolled: GoldAmount = { mean: 30, variance: 30, min: 21, max: 39 };
  const unreached = { availability: 'unavailable', reason: 'coverageNotReached' } as const;
  // Balances stay out of these price witnesses.
  const noBalance = { availability: 'unavailable', reason: 'priorFault' } as const;

  /** A ledger pricing each Well purchase by its generation key. */
  function ledger(
    prices: Readonly<Record<string, { venue: GoldPurchasePrice['venue']; price: GoldAmount }>>,
    room: GoldRoomAvailability,
  ): GoldLedger {
    return {
      purchaseAt: (owner) => {
        const key = semanticAddressKey(owner);
        const entry = Object.entries(prices).find(([generationKey]) =>
          key.includes(generationKey),
        )?.[1];
        return entry === undefined
          ? unreached
          : {
              availability: 'available',
              purchase: {
                owner,
                room: wellOwner,
                venue: entry.venue,
                price: entry.price,
                balanceBefore: noBalance,
              },
            };
      },
      roomAt: () => room,
      runStart: () => ({ gains: [], balance: noBalance }),
    };
  }

  function wellActions(gold: GoldLedger) {
    const { assembly } = assemble(
      underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load(),
      goldenFBiome.routeKey,
      goldenFBiome.biomeKey,
      combatWellId,
      undefined,
      undefined,
      undefined,
      undefined,
      catalog,
      (source) => ({ ...source, gold }),
    );
    const actions = assembly.node.room.roomActions;
    if (actions === undefined) throw new Error('The Well room has no timeline');
    const priceOf = (generationKey: string) =>
      actions.rows.find(
        (row) =>
          row.reference.kind === 'purchaseStygianWellOffer' &&
          row.reference.generationKey === generationKey,
      )?.price;
    return { actions, priceOf };
  }

  const spending = (purchases: readonly GoldAmount[], venue: GoldPurchasePrice['venue']) =>
    ({
      availability: 'available',
      room: {
        room: wellOwner,
        purchases: purchases.map((price) => ({
          owner: wellOwner,
          room: wellOwner,
          venue,
          price,
          balanceBefore: noBalance,
        })),
        gains: [],
        doorsOpenBalance: noBalance,
        balanceAfter: noBalance,
        spending: {
          mean: purchases.reduce((sum, price) => sum + price.mean, 0),
          variance: 0,
          min: purchases.reduce((sum, price) => sum + price.min, 0),
          max: purchases.reduce((sum, price) => sum + price.max, 0),
        },
      },
    }) as const;

  const label = (amount: GoldAmount) =>
    amount.min === amount.max ? `${amount.min}` : `${amount.min}–${amount.max}`;

  it.each([
    ['Stygian Well', () => checkpoint(), goldenFBiome, wellId],
    [
      'World Shop with its Travel Deal refill',
      underworldWorldShopTravelDealProject,
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop'),
    ],
    [
      'Hermes Shrine',
      () => surfaceCheckpointArtifacts['surface-scheduled-lifecycle'].load(),
      nBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    ],
  ] as const)(
    'prices each %s purchase row and the room from the evaluated ledger',
    (_, load, biome, id) => {
      const room = createOccurrenceAddress(biome, id);
      const { assembly, workspace } = projectStructuredWorkspaceFixture(load());
      const gold = goldLedgerForProjectEvaluationAssembly(catalog, assembly);
      const node = workspace.route.biomes
        .flatMap((biome) => biome.nodes)
        .find(
          (candidate) =>
            candidate.kind === 'occurrenceWorkbench' &&
            candidate.room.occurrenceId === room.occurrenceId,
        );
      if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${room.occurrenceId} is missing`);
      const rows = node.room.roomActions?.rows ?? [];
      // The ledger names a World Shop purchase, its Travel Deal refill included, by its offer.
      const ownerKey = (row: (typeof rows)[number]) =>
        semanticAddressKey(
          row.reference.kind === 'interactShopOffer'
            ? createShopOfferAddress(biome, id, row.reference.offerKey)
            : row.reference.kind === 'interactAcquisitionEntry' &&
                row.reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
              ? createShopOfferAddress(biome, id, TRAVEL_DEAL_REFILL_ENTRY_KEY)
              : row.address,
        );
      const spent = gold.roomAt(room);
      if (spent.availability !== 'available') throw new Error('The room is not priced');
      const paid = spent.room.purchases.filter((purchase) => purchase.venue !== 'free');
      expect(paid.length).toBeGreaterThan(0);
      const priced = new Map(
        rows.flatMap((row) =>
          row.price === undefined ? [] : [[ownerKey(row), row.price] as const],
        ),
      );
      expect(Object.fromEntries(priced)).toEqual(
        Object.fromEntries(
          paid.map((purchase) => [
            semanticAddressKey(purchase.owner),
            { label: label(purchase.price) },
          ]),
        ),
      );
    },
  );

  it('shows a fixed price, a rolled range, and nothing for a free or unavailable purchase', () => {
    const { actions, priceOf } = wellActions(
      ledger(
        {
          'initial:secondLeft': { venue: 'stygianWell', price: rolled },
          'initial:secondRight': { venue: 'free', price: fixed(0) },
        },
        spending([rolled], 'stygianWell'),
      ),
    );
    expect(priceOf('initial:secondLeft')).toEqual({ label: '21–39' });
    expect(priceOf('initial:secondRight')).toBeUndefined();
    // The Travel Deal refill is bought but this ledger cannot price it.
    expect(
      actions.rows.some(
        (row) =>
          row.reference.kind === 'purchaseStygianWellOffer' &&
          row.reference.generationKey === 'travelDealRefill',
      ),
    ).toBe(true);
    expect(priceOf('travelDealRefill')).toBeUndefined();
    const fixedPrices = wellActions(
      ledger(
        {
          'initial:secondLeft': { venue: 'stygianWell', price: rolled },
          'initial:secondRight': { venue: 'stygianWell', price: fixed(45) },
        },
        spending([rolled, fixed(45)], 'stygianWell'),
      ),
    );
    expect(fixedPrices.priceOf('initial:secondRight')).toEqual({ label: '45' });
  });
});

describe('Doors open room gold', () => {
  const plain = (gold: number) => (gold < 0 ? `−${-gold}` : `${gold}`);

  function roomGoldWitness(
    project: ProjectDocument,
    room: ReturnType<typeof createOccurrenceAddress>,
  ) {
    const { assembly, workspace } = projectStructuredWorkspaceFixture(project);
    const node = workspace.route.biomes
      .flatMap((biome) => biome.nodes)
      .find(
        (candidate) =>
          candidate.kind === 'occurrenceWorkbench' &&
          candidate.room.occurrenceId === room.occurrenceId,
      );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${room.occurrenceId} is missing`);
    const priced = goldLedgerForProjectEvaluationAssembly(catalog, assembly).roomAt(room);
    if (priced.availability !== 'available') throw new Error('The room is not priced');
    return { actions: node.room.roomActions, room: priced.room };
  }

  it('shows the estimated gold held when the doors open', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const { actions, room } = roomGoldWitness(
      authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint()),
      well,
    );
    const balance = room.doorsOpenBalance;
    if (balance.availability !== 'available') throw new Error('The Well balance is unavailable');
    expect(balance.balance.variance).toBeGreaterThan(0);
    // A spread balance reads as its rounded mean and its one-deviation spread.
    expect(actions?.current?.label).toMatch(
      new RegExp(`^${plain(Math.round(balance.balance.mean))} ±\\d+$`),
    );
    expect(actions?.current).toEqual(goldBalanceLabel(balance.balance));
  });

  it('marks a spread balance approximate', () => {
    const intro = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-intro'));
    const { actions, room } = roomGoldWitness(
      underworldCheckpointArtifacts['underworld-f-pool'].load(),
      intro,
    );
    const balance = room.doorsOpenBalance;
    if (balance.availability !== 'available') throw new Error('The G intro balance is unavailable');
    expect(balance.balance.variance).toBeGreaterThan(0);
    // A spread balance reads as its rounded mean and its one-deviation spread.
    expect(actions?.current?.label).toMatch(
      new RegExp(`^${plain(Math.round(balance.balance.mean))} ±\\d+$`),
    );
    expect(actions?.current).toEqual(goldBalanceLabel(balance.balance));
  });

  it('keeps a rolled purchase price as its range', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = applyProjectCommand(
      authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint()),
      catalog,
      {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey: 'healing',
        itemKey: 'HealDropRange',
      },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const { actions, room } = roomGoldWitness(project, well);
    expect(room.spending.min).toBeLessThan(room.spending.max);
    expect(
      actions?.rows.find(
        (row) =>
          row.reference.kind === 'purchaseStygianWellOffer' &&
          row.reference.generationKey === 'initial:healing',
      )?.price,
    ).toEqual({ label: '21–39' });
  });
});

describe('Purchase affordability', () => {
  /** Each paid purchase's chance from the ledger beside its projected row, in room order. */
  function affordabilityWitness(
    project: ProjectDocument,
    room: ReturnType<typeof createOccurrenceAddress>,
  ) {
    const { assembly, workspace } = projectStructuredWorkspaceFixture(project);
    const node = workspace.route.biomes
      .flatMap((biome) => biome.nodes)
      .find(
        (candidate) =>
          candidate.kind === 'occurrenceWorkbench' &&
          candidate.room.occurrenceId === room.occurrenceId,
      );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${room.occurrenceId} is missing`);
    const ledger = goldLedgerForProjectEvaluationAssembly(catalog, assembly);
    const priced = ledger.roomAt(room);
    if (priced.availability !== 'available') throw new Error('The room is not priced');
    const purchases = priced.room.purchases
      .filter((purchase) => purchase.venue !== 'free')
      .map((purchase) => {
        const quote = ledger.purchaseAt(purchase.owner);
        if (quote.availability !== 'available') throw new Error('The purchase is not priced');
        const { affordableProbability, balanceBefore, price } = quote.purchase;
        if (affordableProbability === undefined || balanceBefore.availability !== 'available')
          throw new Error('The purchase has no chance to afford');
        return {
          probability: affordableProbability,
          exact: balanceBefore.balance.variance === 0 && price.variance === 0,
        };
      });
    const rows = (node.room.roomActions?.rows ?? []).filter((row) => row.price !== undefined);
    expect(rows).toHaveLength(purchases.length);
    return rows.map((row, index) => ({ ...purchases[index]!, affordability: row.affordability }));
  }

  /** The percent a chance reads as: whole, and never certain unless exact. */
  function expectedAffordability(probability: number, exact: boolean) {
    const percent = Math.round(probability * 100);
    const label = exact
      ? `${percent}%`
      : percent === 100
        ? '>99%'
        : percent === 0
          ? '<1%'
          : `${percent}%`;
    const tone = percent < 50 ? 'low' : percent < 90 ? 'medium' : 'high';
    return { label, tone };
  }

  it('grades each purchase by its chance to afford from the ledger', () => {
    const rooms = [
      {
        project: underworldCheckpointArtifacts['underworld-world-shop-travel-deal'].load(),
        room: createOccurrenceAddress(
          goldenFBiome,
          createOccurrenceId('golden-f-preboss-shop:postboss'),
        ),
      },
      {
        project: surfaceCheckpointArtifacts['surface-scheduled-lifecycle'].load(),
        room: createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss')),
      },
      {
        project: underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load(),
        room: createOccurrenceAddress(
          goldenFBiome,
          createOccurrenceId('e157e3cb-37ae-40d9-92b0-f22621b672c3'),
        ),
      },
    ];
    const witnessed = rooms.flatMap(({ project, room }) => affordabilityWitness(project, room));
    expect(witnessed.length).toBeGreaterThan(0);
    for (const { probability, exact, affordability } of witnessed) {
      expect(affordability).toEqual(expectedAffordability(probability, exact));
      expect(affordability!.label).toMatch(/^(>99%|<1%|\d{1,3}%)$/);
    }
  });

  it('tones by the whole percent shown and is certain only for an exact balance and price', () => {
    const cases: readonly [number, boolean, string, string][] = [
      [1, true, '100%', 'high'],
      [0, true, '0%', 'low'],
      [1, false, '>99%', 'high'],
      [0.997, false, '>99%', 'high'],
      [0.993, false, '99%', 'high'],
      [0.897, false, '90%', 'high'],
      [0.893, false, '89%', 'medium'],
      [0.497, false, '50%', 'medium'],
      [0.493, false, '49%', 'low'],
      [0.007, false, '1%', 'low'],
      [0.003, false, '<1%', 'low'],
      [0, false, '<1%', 'low'],
    ];
    for (const [probability, exact, label, tone] of cases)
      expect(purchaseAffordability(probability, exact)).toEqual({ label, tone });
  });

  it('shows a balance as its mean with a rounded one-deviation spread', () => {
    const cases: readonly [mean: number, variance: number, label: string][] = [
      // An exact balance is its plain value.
      [323, 0, '323'],
      [-12, 0, '\u221212'],
      // Below 50 the spread rounds to the nearest 5.
      [323.4, 17 ** 2, '323 ±15'],
      [323, 18 ** 2, '323 ±20'],
      [100, 47 ** 2, '100 ±45'],
      // From 50 up it rounds to the nearest 10.
      [100, 50 ** 2, '100 ±50'],
      [100, 64 ** 2, '100 ±60'],
      [100, 66 ** 2, '100 ±70'],
      // A balance below zero keeps the typographic minus.
      [-40.6, 30 ** 2, '\u221241 ±30'],
      // A spread never rounds away: it shows at least one step.
      [323, 2 ** 2, '323 ±5'],
    ];
    for (const [mean, variance, label] of cases)
      expect(goldBalanceLabel({ mean, variance })).toEqual({ label });
  });
});
