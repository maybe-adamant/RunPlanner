import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { expect, it } from 'vitest';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace/contracts/navigation';
import { indexFindingsByRepairTarget } from '@planner/projections/structured-workspace/navigation/finding-highlights';

it('groups exact, redirected child, and per-slot findings by the same completed destination used for navigation', () => {
  const biome = createBiomeAddress('Underworld', 'F');
  const id = createOccurrenceId('feedback-room');
  const reward = createIncomingRewardAddress(biome, id);
  const child = createTraitOfferAddress(reward, 'source');
  const action = createRoomActionAddress(biome, id, 'pickup');
  const wellSlot = createRoomFeatureAddress(createOccurrenceAddress(biome, id), {
    kind: 'stygianWellOffer',
    generationKey: 'initial:secondRight',
  });
  const findings: readonly SemanticFinding[] = [
    {
      code: 'rewardMissing',
      origin: reward,
      evidence: {},
      phase: 'rewardGeneration',
      severity: 'error',
    },
    {
      code: 'rewardAcquisitionUnavailable',
      origin: child,
      evidence: {},
      phase: 'rewardGeneration',
      severity: 'error',
    },
    {
      code: 'rewardAcquisitionUnavailable',
      origin: action,
      evidence: {},
      phase: 'rewardGeneration',
      severity: 'error',
    },
    {
      code: 'stygianWellDuplicate',
      origin: wellSlot,
      evidence: {},
      phase: 'rewardGeneration',
      severity: 'error',
    },
  ];
  const destinations = new Map<string, WorkspaceInspectorDestination>(
    findings.map((finding) => {
      const focusAddress = finding.origin === child ? action : finding.origin;
      return [
        semanticAddressKey(finding.origin),
        {
          biomeKey: 'F',
          routeKey: 'Underworld',
          ownerAddress: finding.origin,
          focusAddress,
          focusKey: semanticAddressKey(focusAddress),
          region: 'structure',
          nodeKey: 'room',
          inspectorSubject: { kind: 'node', nodeKey: 'room' },
        },
      ];
    }),
  );
  const index = indexFindingsByRepairTarget(findings, destinations);
  expect(index.get(semanticAddressKey(reward))).toEqual([findings[0]]);
  expect(index.get(semanticAddressKey(action))).toEqual([findings[1], findings[2]]);
  expect(index.has(semanticAddressKey(child))).toBe(false);
  expect(index.get(semanticAddressKey(wellSlot))).toEqual([findings[3]]);
  expect(Object.isFrozen(index.get(semanticAddressKey(action)))).toBe(true);
  expect(
    indexFindingsByRepairTarget(findings.slice(2), destinations).get(semanticAddressKey(action)),
  ).toEqual([findings[2]]);
});

it('groups a finding at its marked control when that differs from its navigation focus', () => {
  const biome = createBiomeAddress('Underworld', 'F');
  const id = createOccurrenceId('marked-room');
  const trait = createTraitOfferAddress(createIncomingRewardAddress(biome, id), 'self');
  const action = createRoomActionAddress(biome, id, 'pickup');
  const finding: SemanticFinding = {
    code: 'traitOfferMissing',
    origin: trait,
    evidence: {},
    phase: 'rewardGeneration',
    severity: 'error',
  };
  const index = indexFindingsByRepairTarget(
    [finding],
    new Map([
      [
        semanticAddressKey(trait),
        {
          biomeKey: 'F',
          routeKey: 'Underworld',
          ownerAddress: trait,
          focusAddress: action,
          focusKey: semanticAddressKey(action),
          markAddress: trait,
          region: 'structure',
          nodeKey: 'room',
          inspectorSubject: { kind: 'node', nodeKey: 'room' },
        },
      ],
    ]),
  );
  expect(index.get(semanticAddressKey(trait))).toEqual([finding]);
  expect(index.has(semanticAddressKey(action))).toBe(false);
});
