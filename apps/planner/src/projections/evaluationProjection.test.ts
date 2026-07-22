import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubRoomAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  type FindingCode,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  findingDestinationLabel,
  indexFindingsByOwner,
  presentBiomeStatus,
  presentFinding,
  presentProjectStatus,
  presentRouteStatus,
} from './evaluationProjection';

const allFindingCodes = [
  'fieldsCageOutcomeUnavailable',
  'hubOpenSlotUnavailable',
  'biomeTopologyMissing',
  'continuationMissing',
  'pickedShopStateMissing',
  'pickedTargetMissing',
  'targetMissing',
  'targetRoomSupportEmpty',
  'targetRoomUnavailable',
  'sideRoomGenerationUnavailable',
  'baseRewardStoreUnavailable',
  'rewardAcquisitionUnavailable',
  'rewardBagSupportEmpty',
  'rewardBagEntryUnavailable',
  'rewardPayloadInvalid',
  'rewardSourceUnavailable',
  'shopOfferUnavailable',
  'shopPurchaseUnavailable',
] as const satisfies readonly FindingCode[];

const biome = createBiomeAddress('Underworld', 'F');

function finding(code: FindingCode, origin: SemanticAddress = biome): SemanticFinding {
  return {
    code,
    severity: 'error',
    phase: 'completeness',
    origin,
    evidence: { internalGameName: 'F_Combat01' },
  };
}

describe('evaluation presentation', () => {
  it('provides explicit player copy for every Phase 3 finding code', () => {
    expect(allFindingCodes).toHaveLength(18);
    for (const code of allFindingCodes) {
      const presentation = presentFinding(finding(code));
      expect(presentation.title).not.toBe(code);
      expect(presentation.description).not.toContain(code);
      expect(presentation.title).not.toContain('F_Combat01');
      expect(presentation.description).not.toContain('F_Combat01');
    }
  });

  it('indexes every finding directly under its semantic owner', () => {
    const target = createTargetAddress(biome, createOccurrenceId('parent'), 2);
    const room = createOccurrenceAddress(biome, createOccurrenceId('room'));
    const targetFindings = [
      finding('targetRoomSupportEmpty', target),
      finding('targetRoomUnavailable', target),
    ];
    const roomFinding = finding('pickedShopStateMissing', room);

    const index = indexFindingsByOwner([...targetFindings, roomFinding]);

    expect(index.size).toBe(2);
    expect(index.get(semanticAddressKey(target))).toEqual(targetFindings);
    expect(index.get(semanticAddressKey(room))).toEqual([roomFinding]);
  });

  it('projects scope-specific status language without changing evaluation state', () => {
    expect(presentProjectStatus({ status: 'empty' } as ProjectEvaluation)).toEqual({
      label: 'Empty project',
      tone: 'empty',
    });
    expect(presentRouteStatus({ status: 'empty' } as ProjectRouteEvaluation)).toEqual({
      label: 'Not configured',
      tone: 'empty',
    });
    expect(presentBiomeStatus(undefined)).toEqual({
      label: 'Blocked',
      tone: 'blocked',
    });
    expect(presentBiomeStatus({ authoring: 'incomplete' })).toEqual({
      label: 'Incomplete',
      tone: 'incomplete',
    });
    expect(
      presentBiomeStatus({
        authoring: 'complete',
        validity: 'valid',
      }),
    ).toEqual({ label: 'Complete · Valid', tone: 'valid' });
    expect(
      presentBiomeStatus({
        authoring: 'complete',
        validity: 'invalid',
      }),
    ).toEqual({ label: 'Complete · Invalid', tone: 'invalid' });
  });

  it('uses declaration labels and structural roles without exposing occurrence identity', () => {
    const target = createTargetAddress(biome, createOccurrenceId('private-parent'), 2);
    const room = createOccurrenceAddress(biome, createOccurrenceId('private-room'));

    expect(findingDestinationLabel(catalog, createProjectAddress())).toBe('Project');
    expect(findingDestinationLabel(catalog, target)).toBe('Erebus · Exit 2');
    expect(findingDestinationLabel(catalog, room)).toBe('Erebus · Room');
    expect(
      findingDestinationLabel(catalog, createHubRoomAddress(createBiomeAddress('Surface', 'N'))),
    ).toBe('City of Ephyra · Hub');
  });
});
