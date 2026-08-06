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
      '95209559c04119e653d2eb61ff017ae419043aa9c653b43bd709e84b845ac626',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '6cfdc686a6d33a3e9d9e0f05381d82ab00da228aacf22078ef6550a289d50cc6',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '8d5353efb14685731b753c085c3215562c83d7adc675beba2031c60a23a17f22',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '6764e515ffec71bab296d55321fd5b0fb7a740ec0e22e5c79c1b1024477b8b1e',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '8b85044251119e3bf61fbe2e60651b3116484957e038a4c9bd3c9620ad22ebbf',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'df43508dadf465e3e23281b56ab8f7dde9e6740d702d5656dd36023c7778773e',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '75a3c8c886fac5920e476f9ba5ea2d90e383e3e2719f09f4d2fa0d4ea1c05794',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '3c71705a79fa779d55dee99c1db0323fcbb01c25a1a56a5c46bf8a2148f19050',
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
      '33fe4a44caedf22e3bb6e4e90d25c08e86891eb1db2c663b2e2917700eec1f71',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '394ea860e507a53bf8dd2b857d03d5d2bc0e9dd28b383f936b117cbd1138d88d',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'c7114dc0b8457b42514b17fa63c9f59f751aa4cf6b636ee4de53d75fe0cade4e',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '41e262036674d80a1c1440bead8884ca4bdd75526fe02403b89562ef64eaea01',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
