import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createAllTogetherSetAddress,
  createEchoLastRunBoonAddress,
  createNaturalSelectionResultAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { expect, it } from 'vitest';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace/contracts/navigation';
import {
  echoLastRunOptionControl,
  findingControlKey,
  findingRepairTarget,
  indexFindingsByRepairTarget,
} from '@planner/projections/structured-workspace/navigation/finding-highlights';

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

it('marks grouped trait outcome and Boon Boon Boon findings on the row control that repairs them', () => {
  const biome = createBiomeAddress('Underworld', 'F');
  const trait = createTraitOfferAddress(
    createIncomingRewardAddress(biome, createOccurrenceId('outcome-room')),
    'source',
  );
  const natural = createNaturalSelectionResultAddress(trait, 'option1');
  const fire = createAllTogetherSetAddress(trait, 'option1', 'fire');
  const echo = createEchoLastRunBoonAddress(trait, 'option1');
  const finding = (
    code: SemanticFinding['code'],
    origin: SemanticAddress,
    evidence: SemanticFinding['evidence'] = {},
  ): SemanticFinding => ({ code, origin, evidence, phase: 'rewardGeneration', severity: 'error' });
  const destinations = new Map<string, WorkspaceInspectorDestination>(
    [natural, fire, echo].map((address) => [
      semanticAddressKey(address),
      {
        biomeKey: 'F',
        routeKey: 'Underworld',
        ownerAddress: address,
        focusAddress: address,
        focusKey: semanticAddressKey(address),
        region: 'structure',
        nodeKey: 'room',
        inspectorSubject: { kind: 'node', nodeKey: 'room' },
      },
    ]),
  );
  const target = (entry: SemanticFinding) => findingRepairTarget(entry, destinations);
  // Natural Selection names no position, so its first first-pass row carries the mark.
  expect(target(finding('naturalSelectionResultUnavailable', natural))).toBe(
    findingControlKey(natural, 'outcomeFirstRow'),
  );
  // All Together already names the set whose picker repairs it.
  expect(target(finding('allTogetherResultUnavailable', fire))).toBe(semanticAddressKey(fire));
  expect(
    target(
      finding('echoLastRunBoonOptionUnavailable', echo, {
        detail: 'Hera:BoonDecayBoon:Heroic',
      }),
    ),
  ).toBe(
    findingControlKey(
      echo,
      echoLastRunOptionControl({ giverKey: 'Hera', traitKey: 'BoonDecayBoon', rarity: 'Heroic' }),
    ),
  );
  expect(target(finding('targetedAcquisitionTargetMissing', echo))).toBe(
    findingControlKey(echo, 'echoLastRunTarget'),
  );
  expect(target(finding('allTogetherResultMissing', echo))).toBe(
    findingControlKey(echo, 'outcomeFirstRow'),
  );
  // A missing choice is repaired by the Boon Boon Boon launcher itself.
  expect(target(finding('echoLastRunBoonMissing', echo))).toBe(semanticAddressKey(echo));
  // A child marked at its trait launcher keeps the launcher's own mark.
  const launcher = new Map([
    [
      semanticAddressKey(natural),
      { ...destinations.get(semanticAddressKey(natural))!, markAddress: trait },
    ],
  ]);
  expect(findingRepairTarget(finding('naturalSelectionResultMissing', natural), launcher)).toBe(
    semanticAddressKey(trait),
  );
});
