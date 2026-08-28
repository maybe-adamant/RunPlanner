import { describe, expect, it } from 'vitest';

import {
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createJudgmentArcanaAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalVisitDecisionAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

const fBiome = createBiomeAddress('Underworld', 'F');
const nBiome = createBiomeAddress('Surface', 'N');
const fOccurrenceId = createOccurrenceId('address-f');
const nOccurrenceId = createOccurrenceId('address-n');
const fSource = { kind: 'occurrence' as const, occurrenceId: fOccurrenceId };
const nHubSource = { kind: 'hubDecision' as const, decisionKey: 'hub' };

const addressCases: readonly { readonly name: string; readonly address: SemanticAddress }[] = [
  { name: 'project', address: createProjectAddress() },
  { name: 'route', address: createRouteAddress('Underworld') },
  { name: 'biome', address: fBiome },
  { name: 'biome field', address: createBiomeFieldAddress(fBiome, 'field') },
  { name: 'occurrence', address: createOccurrenceAddress(fBiome, fOccurrenceId) },
  { name: 'incoming reward', address: createIncomingRewardAddress(fBiome, fOccurrenceId) },
  {
    name: 'room Run State checkpoint',
    address: createRoomRunStateCheckpointAddress(createOccurrenceAddress(fBiome, fOccurrenceId), {
      kind: 'beforeEncounterStart',
      phaseKey: 'Combat1',
    }),
  },
  {
    name: 'fixed Boss occurrence',
    address: createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:boss')),
  },
  {
    name: 'Boss Judgment Arcana child',
    address: createJudgmentArcanaAddress(
      createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:boss')),
      'Encounter',
    ),
  },
  {
    name: 'fixed Postboss occurrence',
    address: createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:postboss')),
  },
  { name: 'occurrence exit decision', address: createExitDecisionAddress(fBiome, fSource) },
  { name: 'Hub exit decision', address: createExitDecisionAddress(nBiome, nHubSource) },
  { name: 'exit selection', address: createExitSelectionAddress(fBiome, fSource) },
  { name: 'batch reward store', address: createBatchRewardStoreAddress(fBiome, fSource) },
  { name: 'ordinary target', address: createTargetAddress(fBiome, fSource, 'exit2') },
  {
    name: 'additional exit',
    address: createAdditionalExitAddress(fBiome, fSource.occurrenceId, 'zagreusContract'),
  },
  { name: 'Hub target', address: createTargetAddress(nBiome, nHubSource, 'preboss') },
  { name: 'Hub decision', address: createHubDecisionAddress(nBiome, 'hub') },
  { name: 'Hub slot', address: createHubSlotAddress(nBiome, 'hub', 'combat01') },
  { name: 'Hub open set', address: createHubOpenSetAddress(nBiome, 'hub') },
  { name: 'Hub room', address: createHubRoomAddress(nBiome, 'hub') },
  { name: 'Hub visit', address: createHubVisitAddress(nBiome, 'hub', 1) },
  {
    name: 'local reward',
    address: createLocalRewardAddress(nBiome, nOccurrenceId, 'side', 'slot1'),
  },
  {
    name: 'local visit decision',
    address: createLocalVisitDecisionAddress(nBiome, nOccurrenceId, 'side'),
  },
  {
    name: 'local visit slot',
    address: createLocalVisitSlotAddress(nBiome, nOccurrenceId, 'side', 'slot1'),
  },
  {
    name: 'local visit order',
    address: createLocalVisitOrderAddress(nBiome, nOccurrenceId, 'side'),
  },
  { name: 'reward wheel', address: createRewardWheelAddress(fBiome, fOccurrenceId, 'wheel1') },
  {
    name: 'reward wheel offer',
    address: createRewardWheelOfferAddress(fBiome, fOccurrenceId, 'wheel1', 'offer1'),
  },
  { name: 'shop offer', address: createShopOfferAddress(fBiome, fOccurrenceId, 'Boon') },
  { name: 'second ordinary target', address: createTargetAddress(fBiome, fSource, 'exit1') },
  { name: 'Hub exit selection', address: createExitSelectionAddress(nBiome, nHubSource) },
  { name: 'Hub batch reward store', address: createBatchRewardStoreAddress(nBiome, nHubSource) },
];

describe('semantic addresses', () => {
  it.each(addressCases)('keeps the %s address semantic and position-free', ({ address }) => {
    const key = semanticAddressKey(address);
    expect(JSON.parse(key)[0]).toBe(address.kind);
    expect(key).not.toContain('renderedIndex');
  });

  it('keys occurrence- and Hub-sourced decisions by semantic source', () => {
    expect(semanticAddressKey(createExitDecisionAddress(fBiome, fSource))).toBe(
      '["exitDecision","Underworld","F",{"kind":"occurrence","occurrenceId":"address-f"}]',
    );
    expect(semanticAddressKey(createExitSelectionAddress(fBiome, fSource))).toBe(
      '["exitSelection","Underworld","F",{"kind":"occurrence","occurrenceId":"address-f"}]',
    );
    expect(semanticAddressKey(createBatchRewardStoreAddress(fBiome, fSource))).toBe(
      '["batchRewardStore","Underworld","F",{"kind":"occurrence","occurrenceId":"address-f"}]',
    );
    expect(semanticAddressKey(createTargetAddress(fBiome, fSource, 'exit2'))).toBe(
      '["target","Underworld","F",{"kind":"occurrence","occurrenceId":"address-f"},"exit2"]',
    );
    expect(
      semanticAddressKey(
        createAdditionalExitAddress(fBiome, fSource.occurrenceId, 'zagreusContract'),
      ),
    ).toBe('["additionalExit","Underworld","F","address-f","zagreusContract"]');
    expect(semanticAddressKey(createExitDecisionAddress(nBiome, nHubSource))).toBe(
      '["exitDecision","Surface","N",{"kind":"hubDecision","decisionKey":"hub"}]',
    );
  });

  it('keys derived room checkpoints by their closed lifecycle discriminator', () => {
    expect(
      semanticAddressKey(
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(fBiome, fOccurrenceId), {
          kind: 'beforeEncounterStart',
          phaseKey: 'Combat1',
        }),
      ),
    ).toBe(
      '["roomRunStateCheckpoint","Underworld","F","address-f","beforeEncounterStart","Combat1"]',
    );
  });

  it('owns Judgment beneath the exact fixed Boss occurrence and phase', () => {
    const boss = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:boss'));
    const judgment = createJudgmentArcanaAddress(boss, 'Encounter');
    expect(judgment.occurrenceId).toBe(boss.occurrenceId);
    expect(JSON.parse(semanticAddressKey(judgment)).slice(-2)).toEqual([
      'golden-f-preboss-shop:boss',
      'Encounter',
    ]);
  });
});
