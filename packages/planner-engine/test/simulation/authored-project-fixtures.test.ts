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
      'ca6073bb6beedd6852b46d1b78eaca398a7f2696465597de0b8226165add7356',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '34ec542e2b6ec036bfe0adcb2855ee62a6eaddacbf634680f28ba2de6786284e',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '6b124492e459aacfc1aa276c26606da9ba0466dcd7730e0e12b9d2ab65084717',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '564c9e735cc9db8862c954ab4cf47900125fce4a7a6a8779f124bd79014385cc',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '25c8df88752d07020e5be8b29abaf0012cb4a32c45646852dfcc0519123810b4',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'b9380393644ce113b09cc7a6cb51726eb152b1279b853b2ecddcde0501cd4d68',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '9c90ba13e78d27857d65663bb56d159b0f518cf34aae1706468f9c25f8e71ef3',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '6ead479a8dec673ced18518e4e09b79b9b978f2cf9eadf1b37205fe6dda615bc',
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
      'b1ced268f976a9752cf7c5b7cd64af31d55d4b95caad0fde8838484e72aa61ba',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '95bb34c0539049bbacaaf9edf52200184bfbaf5e86e68d4adcbbc15f007988f7',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'e2578c09ce6f722f19954be4961454e42c3a59bd5688c563535111bcd20f0b98',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '6ac05951590c82703b102310337edc550a9fbad20e4e9ba99e0d6f730e5940c0',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
