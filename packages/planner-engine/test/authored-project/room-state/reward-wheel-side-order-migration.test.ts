import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  migrateRewardWheelOffersToSideOrder,
  type ProjectDocument,
  type WheelSideOrderBlock,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
const offer = (offerKey: 'offer1' | 'offer2') =>
  createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey);
const left = { rewardType: 'MaxHealthDrop' } as const;
const right = { rewardType: 'RoomMoneyDrop' } as const;

/** The NO checkpoint with a two-offer wheel holding Left/Right and the Right offer picked. */
function twoOfferProject(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
    kind: 'ReplaceRewardWheelOfferCount',
    wheel,
    offerCount: 2,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: offer('offer1'),
    value: left,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: offer('offer2'),
    value: right,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelPicked',
    wheel,
    pickedOfferIndex: 2,
  });
}

const raw = (project: ProjectDocument): unknown => JSON.parse(encodeProjectDocument(project));

function wheelState(project: ProjectDocument) {
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (
        occurrence.occurrenceId === oOccurrenceIds.combat04 &&
        occurrence.state.kind === 'shipCombat'
      )
        return occurrence.state.wheels.wheel1;
  throw new Error('NO checkpoint lost its first Ship');
}

/** A judge that blocks the wheel while the given reward leads it, or never. */
const blockWhileLeading =
  (leading: typeof left | typeof right | undefined) =>
  (project: ProjectDocument): WheelSideOrderBlock | undefined =>
    leading !== undefined &&
    wheelState(project)?.offers.offer1?.offer.rewardType === leading.rewardType
      ? { kind: 'invalid', owner: wheel, reasons: [{ origin: offer('offer1') }] }
      : undefined;

describe('reward wheel side-order migration', () => {
  it('exchanges a wheel valid only the other way round, with its pick', () => {
    const migrated = migrateRewardWheelOffersToSideOrder(
      raw(twoOfferProject()),
      catalog,
      blockWhileLeading(left),
    );
    const state = wheelState(decodeProjectDocument(migrated, catalog));
    expect(state?.offers.offer1?.offer).toEqual(right);
    expect(state?.offers.offer2?.offer).toEqual(left);
    expect(state?.pickedOfferIndex).toBe(1);
    // Once side-ordered, the plan no longer names the wheel and stays as it is.
    expect(migrateRewardWheelOffersToSideOrder(migrated, catalog, blockWhileLeading(left))).toBe(
      migrated,
    );
  });

  it('returns the document itself when nothing blocks or the exchange does not clear the block', () => {
    const document = raw(twoOfferProject());
    expect(
      migrateRewardWheelOffersToSideOrder(document, catalog, blockWhileLeading(undefined)),
    ).toBe(document);
    const alwaysBlocked = (): WheelSideOrderBlock => ({
      kind: 'invalid',
      owner: wheel,
      reasons: [{ origin: offer('offer2') }],
    });
    expect(migrateRewardWheelOffersToSideOrder(document, catalog, alwaysBlocked)).toBe(document);
    expect(migrateRewardWheelOffersToSideOrder('not a document', catalog, alwaysBlocked)).toBe(
      'not a document',
    );
  });
});
