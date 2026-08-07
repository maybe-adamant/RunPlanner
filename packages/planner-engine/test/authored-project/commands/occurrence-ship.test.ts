import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createRepresentativeNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures';

function shipState(project: ProjectDocument, occurrenceId = oOccurrenceIds.combat04) {
  const state = project.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'O')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)?.state;
  if (state?.kind !== 'shipCombat') throw new Error(`missing Ship state ${occurrenceId}`);
  return state;
}

describe('authored-project Ship occurrence commands', () => {
  it('replaces the encounter count and preserves identity for an unchanged count', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const initial = createRepresentativeNOProject();
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
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
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
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
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
    const project = createRepresentativeNOProject();
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
});
