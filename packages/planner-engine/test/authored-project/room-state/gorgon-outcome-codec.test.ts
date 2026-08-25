import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNOPProject, pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';

import { encoded, gorgonResults, occurrence, type JsonRecord } from '../support/project-codec-json';

describe('Gorgon phase-result decoder', () => {
  it('round-trips a strict Gorgon phase map and rejects malformed or misplaced children', () => {
    const project = loadSurfaceNOPProject();
    const document = encoded(project);
    const state = occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1));
    expect(gorgonResults(state)).toEqual({ Combat: { athenaTriggerConditionMet: false } });
    const decoded = decodeProjectDocument(document, catalog);
    expect(decoded).toEqual(project);

    const missing = encoded(project);
    delete (occurrence(missing, 'P', pOccurrenceId('P_Combat03', 1, 1)).encounters as JsonRecord)
      .gorgonResultByPhase;
    expect(() => decodeProjectDocument(missing, catalog)).toThrow(
      'gorgonResultByPhase: must be an object',
    );

    const extra = encoded(project);
    gorgonResults(occurrence(extra, 'P', pOccurrenceId('P_Combat03', 1, 1))).Unexpected = {
      athenaTriggerConditionMet: false,
    };
    expect(() => decodeProjectDocument(extra, catalog)).toThrow(
      'gorgonResultByPhase.Unexpected: is not a project document field',
    );

    const nonBoolean = encoded(project);
    gorgonResults(occurrence(nonBoolean, 'P', pOccurrenceId('P_Combat03', 1, 1))).Combat = {
      athenaTriggerConditionMet: 'true',
    };
    expect(() => decodeProjectDocument(nonBoolean, catalog)).toThrow(
      'athenaTriggerConditionMet: must be a boolean',
    );

    const trueWithoutChild = encoded(project);
    gorgonResults(occurrence(trueWithoutChild, 'P', pOccurrenceId('P_Combat03', 1, 1))).Combat = {
      athenaTriggerConditionMet: true,
    };
    expect(() => decodeProjectDocument(trueWithoutChild, catalog)).toThrow(
      'athenaOffer: is required while the Gorgon condition is active',
    );

    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    const enabled = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    expect(
      (
        gorgonResults(occurrence(encoded(enabled), 'P', pOccurrenceId('P_Combat03', 1, 1)))
          .Combat as JsonRecord
      ).athenaOffer,
    ).toBeNull();
    const withOffer = applyProjectCommand(enabled, catalog, {
      kind: 'ReplaceGorgonAthenaOffer',
      trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
      value: {
        traitKeys: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
        selectedOptionKey: 'option1',
      },
    });
    const encodedOffer = gorgonResults(
      occurrence(encoded(withOffer), 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    expect(encodedOffer.athenaOffer).toEqual({
      traitKeys: ['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon'],
      selectedOptionKey: 'option1',
    });

    const malformedOffer = encoded(withOffer);
    const offerResult = gorgonResults(
      occurrence(malformedOffer, 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    const offer = offerResult.athenaOffer as JsonRecord;
    offer.traitKeys = (offer.traitKeys as unknown[]).slice(0, 1);
    expect(() => decodeProjectDocument(malformedOffer, catalog)).toThrow(
      'must contain exactly three distinct Athena trait identities',
    );

    const duplicateTraits = encoded(withOffer);
    const duplicateResult = gorgonResults(
      occurrence(duplicateTraits, 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    (duplicateResult.athenaOffer as JsonRecord).traitKeys = [
      'InvulnerabilityDashBoon',
      'InvulnerabilityDashBoon',
      'FocusLastStandBoon',
    ];
    expect(() => decodeProjectDocument(duplicateTraits, catalog)).toThrow(
      'must contain exactly three distinct Athena trait identities',
    );

    for (const extraField of [
      'giverKey',
      'kind',
      'options',
      'rarificationActions',
      'deathDefianceConditionMet',
    ]) {
      const legacyField = encoded(withOffer);
      const result = gorgonResults(occurrence(legacyField, 'P', pOccurrenceId('P_Combat03', 1, 1)))
        .Combat as JsonRecord;
      (result.athenaOffer as JsonRecord)[extraField] =
        extraField === 'rarificationActions' || extraField === 'options' ? [] : 'legacy';
      expect(() => decodeProjectDocument(legacyField, catalog)).toThrow(
        `athenaOffer.${extraField}: is not a project document field`,
      );
    }
  });
});
