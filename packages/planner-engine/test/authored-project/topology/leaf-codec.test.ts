import { describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  catalog,
  completeHProject,
  completeOProject,
  completeQProject,
  contextInvalidOverflowProject,
  createBatchTargets,
  createCompleteNProject,
  createOccurrenceAddress,
  createOccurrenceId,
  decodeProjectDocument,
  type EncodedTopology,
  encodedProject,
  expectDocumentError,
  fBiome,
  planFor,
  project,
  rewardWheelProject,
  selectedFTakeoverProject,
  unresolvedFProject,
} from '../support/topology-codec-fixtures';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';

describe('topology leaf codecs', () => {
  it('keeps optional Well absence and rejects non-host, unknown-item, and missing forced Well shapes', () => {
    let document = applyProjectCommand(project('codec-stygian-well', 'Underworld', 1), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('well-codec-opening'),
      gameName: 'F_Opening01',
    });
    document = createBatchTargets(document, {
      biome: fBiome,
      sourceOccurrenceId: 'well-codec-opening',
      rewardStoreKey: 'RunProgress',
      targets: [{ exitKey: 'exit1', occurrenceId: 'well-codec-host', gameName: 'F_Combat01' }],
    });
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    document = applyProjectCommand(document, catalog, {
      kind: 'AddStygianWell',
      occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('well-codec-host')),
    });
    const encoded = encodedProject(document);
    const fPlan = encoded.route!.biomes[0]! as unknown as { topology: EncodedTopology };
    const hostIndex = fPlan.topology.occurrences.findIndex(
      (room) => room.occurrenceId === 'well-codec-host',
    );
    const openingIndex = fPlan.topology.occurrences.findIndex(
      (room) => room.occurrenceId === 'well-codec-opening',
    );
    if (hostIndex < 0 || openingIndex < 0) throw new Error('missing Well codec rooms');
    fPlan.topology.occurrences[openingIndex]!.stygianWell =
      fPlan.topology.occurrences[hostIndex]!.stygianWell;
    expectDocumentError(encoded, {
      path: `$.route.biomes[0].topology.occurrences[${openingIndex}].stygianWell`,
      detail: 'requires an eligible ordinary RoomShop Well host',
    });

    const unknown = encodedProject(document);
    const unknownF = unknown.route!.biomes[0]! as unknown as { topology: EncodedTopology };
    const unknownHost = unknownF.topology.occurrences.find(
      (room) => room.occurrenceId === 'well-codec-host',
    )!;
    (
      unknownHost.stygianWell as { offerKeyBySlot: { healing: string | null } }
    ).offerKeyBySlot.healing = 'UnknownWellItem';
    expectDocumentError(unknown, {
      path: `$.route.biomes[0].topology.occurrences[${hostIndex}].stygianWell.offerKeyBySlot.healing`,
      detail: 'unknown RoomShop item UnknownWellItem',
    });

    const uninteractedPurchase = encodedProject(document);
    const uninteractedF = uninteractedPurchase.route!.biomes[0]! as unknown as {
      topology: EncodedTopology;
    };
    const uninteractedHost = uninteractedF.topology.occurrences.find(
      (room) => room.occurrenceId === 'well-codec-host',
    )!;
    const rawWell = uninteractedHost.stygianWell as {
      offerKeyBySlot: { healing: string | null };
      purchasedGenerationKeys?: string[];
    };
    rawWell.offerKeyBySlot.healing = 'ArmorBoostStore';
    rawWell.purchasedGenerationKeys = ['initial:healing'];
    (uninteractedHost.roomActions as { order: Array<Record<string, unknown>> }).order.push({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:healing',
    });
    expectDocumentError(uninteractedPurchase, {
      path: `$.route.biomes[0].topology.occurrences[${hostIndex}].roomActions.order`,
      detail: 'an uninteracted Well must not retain purchase intent or purchase actions',
    });

    const missingForced = encodedProject(createCompleteFGProject());
    const missingF = missingForced.route!.biomes[0]! as unknown as {
      topology: EncodedTopology;
    };
    const postbossIndex = missingF.topology.occurrences.findIndex(
      (room) => room.gameName === 'F_PostBoss01',
    );
    delete missingF.topology.occurrences[postbossIndex]!.stygianWell;
    expectDocumentError(missingForced, {
      path: `$.route.biomes[0].topology.occurrences[${postbossIndex}].stygianWell`,
      detail: 'must be an object',
    });
  });

  it('round-trips retained purchased Well generations after their initial or refill source is cleared', () => {
    let document = applyProjectCommand(
      project('codec-retained-well-purchase', 'Underworld', 1),
      catalog,
      {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('retained-well-opening'),
        gameName: 'F_Opening01',
      },
    );
    document = createBatchTargets(document, {
      biome: fBiome,
      sourceOccurrenceId: 'retained-well-opening',
      rewardStoreKey: 'RunProgress',
      targets: [{ exitKey: 'exit1', occurrenceId: 'retained-well-host', gameName: 'F_Combat01' }],
    });
    const occurrence = createOccurrenceAddress(fBiome, createOccurrenceId('retained-well-host'));
    for (const command of [
      { kind: 'AddStygianWell' as const, occurrence },
      { kind: 'SetStygianWellInteraction' as const, occurrence, interacted: true },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence,
        slotKey: 'secondLeft' as const,
        itemKey: 'RandomStoreItem',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence,
        generationKey: 'initial:secondLeft' as const,
        purchased: true,
      },
      {
        kind: 'ReplaceStygianWellTwistResult' as const,
        occurrence,
        generationKey: 'initial:secondLeft' as const,
        itemKey: 'HealDropRange',
      },
      {
        kind: 'ReplaceStygianWellTravelDealRefill' as const,
        occurrence,
        itemKey: 'RandomStoreItem',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence,
        generationKey: 'travelDealRefill' as const,
        purchased: true,
      },
      {
        kind: 'ReplaceStygianWellTwistResult' as const,
        occurrence,
        generationKey: 'travelDealRefill' as const,
        itemKey: 'HealDropRange',
      },
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence,
        slotKey: 'secondLeft' as const,
        itemKey: null,
      },
      {
        kind: 'ReplaceStygianWellTravelDealRefill' as const,
        occurrence,
        itemKey: null,
      },
    ])
      document = applyProjectCommand(document, catalog, command);

    const well = planFor(document, 'Underworld', 'F').topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
    )?.stygianWell;
    expect(well).toMatchObject({
      offerKeyBySlot: { secondLeft: null },
      travelDealRefillKey: null,
      purchasedGenerationKeys: ['initial:secondLeft', 'travelDealRefill'],
      twistResultKeyBySlot: { secondLeft: 'HealDropRange', travelDealRefill: 'HealDropRange' },
    });
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
  });
  it.each([
    ['an unresolved authored-store batch', unresolvedFProject],
    ['derived and selected multi-door takeover batches', selectedFTakeoverProject],
    ['Fields batch state at its ordinary bounds', completeHProject],
    ['source-offer-point Ship batches at their ordinary bounds', completeOProject],
    ['staged no-store batches at their ordinary bounds', completeQProject],
    [
      'normal PreHub, source-bearing Hub, and completed-Hub handoff decisions',
      createCompleteNProject,
    ],
    ['a command-produced Ship wheel leaf', rewardWheelProject],
    [
      'a structurally representable overflow after source replacement',
      contextInvalidOverflowProject,
    ],
  ] as const)(
    'round trips %s without changing occurrence identity or authored state',
    (_name, build) => {
      const document = build();
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    },
  );
});
