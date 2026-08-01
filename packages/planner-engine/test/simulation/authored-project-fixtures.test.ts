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
} from '../../../../test/fixtures/authored-project';

function authoredDocumentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('canonical authored-project fixtures', () => {
  it.each([
    [
      'Underworld F/G default',
      () => createCompleteFGProject(),
      '280ddfdecb924bf90e8a242ce9a1ea4cdb38c51ce17cb8b597538d990f4fdb3d',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '22cefd4d87fd7e63113067c63d4a51937f6896430a372f12670f24e90f698d41',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'abccc31978b4561a588f5ba7be8dde9df646e6d2c4107eb979351694ade77a65',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '6229d1345e2bb2ab99fe49348c0db06927d6edeff4c927b6c48b6346d48be1a7',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'bd5ed399201828b89ac7aac79d2844e2009782f53ebad57a7043bb61af49318f',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1abb1324d499c2c94e3f9f6ff70d4ec87ba2ac0b1165a38003e8573c8be509fc',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '5c5c782f036d9009a23b0543c363d5183053e59ba6c3382ceb44d08cc6fd96a3',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '9192a89a8be20d2acef5d1faa89abb4ea55b7f44ab31739ba2fbe91daa952985',
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
      'b4b9ecaf7e7439370b902b61fdbf0f3c72a2d26362adfaf73d0ce7a448c5574d',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'bea2652216c0e6e1f78646047a154782889365bee7b4d95f21b2ce56e33ffcf1',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '1abb88291d8db32b4dd5a5656db5d9583344fe01a344bd86e0e3875331d50f7f',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'ab01ef13e40c19b916fe7437626bc420f6b9a002bfed5e2706547f05c093c57d',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
