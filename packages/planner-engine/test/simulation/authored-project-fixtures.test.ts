/// <reference types="node" />

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nFixedOccurrenceIds,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures';

function authoredDocumentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('canonical authored-project fixtures', () => {
  it.each([
    [
      'Underworld F/G default',
      () => createCompleteFGProject(),
      'e52414956aaef3d4939202064e384d968705f1828303b7abfd0c9c87e4c38ba3',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '0cb82e936774a3e8ef99aa5bf68274051d5854b841586bd6cf185b90d5bcaaec',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '66287033661937d2f7bbf4fad5c399cf11b4cf2c765405d6020f574f6655b448',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '1449d09d860d9965c5d640b66a99fea418bacd78086336b27c7479aeaec5ca10',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '5eab17514fa0e2e494cf562aa2eed14fafe246ce37eb993ee0c6aefae436bd50',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '0b3b6ee98d1d56e5ca09c7f3f732ac1af52fc1e288b42800bd18a5049ef86790',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '925bb5b00de356ae027a516667b71fb40c5e114dc704c02821043249aa15eeff',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '5e12fe290e0dc10138eb9054056aa63465554fc7c03bbe61f4825ff3063642be',
    ],
    [
      'Surface N alternate open Hub slot',
      () =>
        createRepresentativeNProject({
          openSlotKeys: [
            'combat11',
            'combat10',
            'combat09',
            'combat05',
            'story',
            'combat02',
            'combat01',
            'miniBoss01',
            'combat23',
          ],
          visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
        }),
      'd72390553b214d0b8bc4dccfcd69521b745658ea48140b5d61e144b0f12e0db1',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '38473e0d3080dfb38431fab6542c7b65eb63205316c946237fb09da2f569ad84',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '8f4f0f8fc88d912552f5f09923547bc43530f3f3725f7612585e117ddd12d105',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '851ffc0f9aca1d2a5f2a4ae5daf88691e5d55239ddff8a40f79418a9fcde50d2',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
