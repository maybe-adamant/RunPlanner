import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionRoleAddress,
  createProjectHistory,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

function shipState(project: ProjectDocument, occurrenceId = oOccurrenceIds.combat04) {
  const state = project.route.biomes
    .find((biome) => biome.biomeKey === 'O')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)?.state;
  if (state?.kind !== 'shipCombat') throw new Error(`missing Ship state ${occurrenceId}`);
  return state;
}

describe('authored-project Ship occurrence commands', () => {
  it('preserves customized wheel trait children when the parent offer is unchanged', () => {
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const value = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer,
      value,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(offer, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });

    expect(
      applyProjectCommand(project, catalog, { kind: 'ReplaceRewardWheelOffer', offer, value }),
    ).toBe(project);
  });

  it('replaces the encounter count and preserves identity for an unchanged count', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const initial = loadSurfaceNOProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });

    expect(shipState(changed, oOccurrenceIds.combat07).encounterCount).toBe(3);
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceShipEncounterCount',
        occurrence,
        encounterCount: 3,
      }),
    ).toBe(changed);
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceShipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.story),
        encounterCount: 3,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShipEncounterCount',
        detail: 'O_Story01 has no ShipCombat encounter count',
      }),
    );
  });

  it('replaces wheel offer count and picked index while clamping the active pick', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 2,
    });
    expect(shipState(project).wheels.wheel1).toMatchObject({
      offerCount: 2,
      pickedOfferIndex: 2,
    });

    const clamped = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 1,
    });
    expect(shipState(clamped).wheels.wheel1).toMatchObject({
      offerCount: 1,
      pickedOfferIndex: 1,
    });
    expect(
      applyProjectCommand(clamped, catalog, {
        kind: 'ReplaceRewardWheelPicked',
        wheel,
        pickedOfferIndex: 1,
      }),
    ).toBe(clamped);
  });

  it('replaces the exact wheel store and offer leaves', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer,
      value: { rewardType: 'RoomMoneyDrop' },
    });

    expect(shipState(project).wheels.wheel1).toMatchObject({
      storeKey: 'MetaProgress',
      offers: { offer1: { offer: { rewardType: 'RoomMoneyDrop' } } },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer,
        value: { rewardType: 'RoomMoneyDrop' },
      }),
    ).toBe(project);
  });

  it('rejects wheel values outside declaration and active-offer bounds', () => {
    const project = loadSurfaceNOProject();
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOfferCount',
        wheel,
        offerCount: 0,
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceRewardWheelOfferCount' }));
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelStore',
        wheel,
        storeKey: 'HubRewards',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceRewardWheelStore',
        detail: 'HubRewards is not available from wheel1',
      }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelPicked',
        wheel,
        pickedOfferIndex: 2,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceRewardWheelPicked',
        detail: 'pickedOfferIndex must address an active offer',
      }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer3'),
        value: { rewardType: 'RoomMoneyDrop' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceRewardWheelOffer',
        detail: 'unknown wheel offer offer3',
      }),
    );
  });

  it('creates a counted target after a Ship room by deriving the wheel store', () => {
    const decision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat07,
    });
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    const wheel1 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel1,
      storeKey: 'MetaProgress',
    });

    // The batch derives its store from the source's last active wheel, so a
    // counted room with no declaration-owned store is authorable here.
    const fountainId = createOccurrenceId('occurrence-ship-fountain');
    const created = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, decision.source, 'exit1'),
      occurrenceId: fountainId,
      gameName: 'O_Reprieve01',
    });
    const fountain = created.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === fountainId);
    expect(fountain?.state.kind).toBe('counted');

    // A three-phase ship derives wheel2 instead; the target stays authorable.
    let threePhase = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      encounterCount: 3,
    });
    threePhase = applyProjectCommand(threePhase, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, decision.source, 'exit1'),
      occurrenceId: fountainId,
      gameName: 'O_Reprieve01',
    });
    const wheel2Fountain = threePhase.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === fountainId);
    expect(wheel2Fountain?.state.kind).toBe('counted');
  });

  describe('swapping a two-offer wheel', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const offer = (offerKey: string) =>
      createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey);
    const swap: ProjectCommand = { kind: 'SwapRewardWheelOffers', wheel };

    /** The left offer picked with its boon screen answered, the right one pressed once. */
    function pickedLeft(): ProjectDocument {
      const steps: ProjectCommand[] = [
        { kind: 'ReplaceRewardWheelOfferCount', wheel, offerCount: 2 },
        {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer('offer1'),
          value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
        },
        {
          kind: 'ReplaceTraitOffer',
          trait: createTraitOfferAddress(offer('offer1'), 'source'),
          value: {
            kind: 'traits',
            giverKey: 'Apollo',
            options: [
              { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
              { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
              { traitKey: 'ApolloCastBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option2',
          },
        },
        {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer('offer2'),
          value: { rewardType: 'RoomMoneyDrop' },
        },
        {
          kind: 'InsertReroll',
          occurrence,
          target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer2' },
          reward: { rewardType: 'MaxManaDrop' },
          index: 0,
        },
      ];
      return steps.reduce(
        (project, command) => applyProjectCommand(project, catalog, command),
        loadSurfaceNOProject(),
      );
    }

    const actions = (project: ProjectDocument) =>
      project.route.biomes
        .find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === oOccurrenceIds.combat04,
        )?.roomActions.order;

    it("moves each offer's draw, acquisition, rerolled reward and presses to the other side", () => {
      const before = pickedLeft();
      const left = shipState(before).wheels.wheel1!;
      expect(left.offers.offer1?.traitOffersByAcquisitionRole.source).toMatchObject({
        selectedOptionKey: 'option2',
      });
      expect(left.rerolledOffers?.offer2?.offer).toEqual({ rewardType: 'MaxManaDrop' });
      expect(actions(before)?.some((action) => action.kind === 'reroll')).toBe(true);
      const swapped = applyProjectCommand(before, catalog, swap);
      expect(shipState(swapped).wheels.wheel1).toEqual({
        ...left,
        pickedOfferIndex: 2,
        offers: { offer1: left.offers.offer2, offer2: left.offers.offer1 },
        rerolledOffers: { offer1: left.rerolledOffers!.offer2 },
      });
      expect(actions(swapped)).toEqual(
        actions(before)!.map((action) =>
          action.kind === 'reroll'
            ? { ...action, target: { ...action.target, offerKey: 'offer1' } }
            : action,
        ),
      );
      // Swapping back restores the plan.
      expect(applyProjectCommand(swapped, catalog, swap)).toEqual(before);
    });

    it('is one history step', () => {
      const history = applyProjectHistoryCommand(createProjectHistory(pickedLeft()), catalog, swap);
      expect(history.past).toHaveLength(1);
      expect(shipState(history.present).wheels.wheel1?.pickedOfferIndex).toBe(2);
    });

    it('refuses a one-offer wheel, an unknown wheel and an offer with generated pickups', () => {
      expect(() => applyProjectCommand(loadSurfaceNOProject(), catalog, swap)).toThrowError(
        expect.objectContaining({
          commandKind: 'SwapRewardWheelOffers',
          detail: 'wheel1 has no two offers to swap',
        }),
      );
      expect(() =>
        applyProjectCommand(pickedLeft(), catalog, {
          kind: 'SwapRewardWheelOffers',
          wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel9'),
        }),
      ).toThrowError(expect.objectContaining({ detail: 'O_Combat04 has no wheel wheel9' }));
      // Artificer's replacement is stored under its source offer's identity.
      const converted = applyProjectCommand(
        applyProjectCommand(pickedLeft(), catalog, {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer('offer1'),
          value: { rewardType: 'StackUpgrade' },
        }),
        catalog,
        {
          kind: 'ReplaceAcquisitionDisposition',
          acquisition: createAcquisitionRoleAddress(offer('offer1'), 'self'),
          value: { kind: 'artificer' },
        },
      );
      expect(() => applyProjectCommand(converted, catalog, swap)).toThrowError(
        expect.objectContaining({
          detail: 'pickups or results generated from offer1 cannot follow a swap',
        }),
      );
    });
  });
});
