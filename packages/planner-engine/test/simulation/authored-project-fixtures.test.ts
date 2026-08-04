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
      '35f9050af24d44ac4476610d777d64acca47833e01ae7fe196f5206891059cb7',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'e6941fb76a37dd9e3931c16c21d04adbe4d6ba0003d67a3a26e9810f342b415f',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e669aa052f0ed1fd1c1c77bb3565db5b5ff678b0d499fe28f60bfb0c96029e8b',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '1e216b153eff717466a91d3a9e4ff5296025d4a73dca37277dd92b4a188efe67',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'a3b7d242c478e7ccf647f3a3bce93e3eaadc7ec4188dbb885ca2b75a8c39a5d0',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'ef8d5f3b756e05293df5c5b30c8e62d719636bcb2cc7f006bc5ce8725ba3fd37',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '12c086a15fd69d723743ee6f132b0981086885cfa3cc78f6e6e2d70ab4bf2c4a',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '8ec59cff87a612c89751bebd62170004f0b53280d4b2d35fb72aecbaf823f78a',
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
      'f0338beb650562b6c89933d187afbdc1ef47396c918ccc83ed341c96608786ae',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '715b4120595373030710481f307b7addefdc99aeef011f131398efa79a485cae',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'ccd697e77c29bc23d5f24b1ad59394827a2b1216273030e6d6841c4e2d72e7b2',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'e832bbc4f2d352b0b456f112047adf643705f927e5943f81dcee0ffa26cc4d7e',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
