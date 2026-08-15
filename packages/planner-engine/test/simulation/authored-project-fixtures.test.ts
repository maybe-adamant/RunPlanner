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
      '2e803eae396753449e3563bf2ba469e8bd5ffb1cf003d2f75bcf114685063c95',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '3b8643464db51f17f91263cb049d6436e2c3aa7ea77638ae7feb028cac96354e',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'ac1ffd33d6f51389a92ed359f883d47a35fb74da817fbf0e20f462ff92dcc68c',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'e1a75e11bf4ebb15577f7a2fd91525a8f2256a78e3623c67fb19e7ed048e4866',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'e886d3e9dc9f5aedd466fdbbad4f370c558c6bbcf647e68a8fd6287e027bb424',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1098ef09fd1c3a997a6d517b799f155407f22a6446bfd9fa9304cbd3652fc440',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'e37216dad181a2598d8eb1e490a9670ce06bcbb6f56840730f4d81db3c501874',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '27d2b6d2f5dab12aaf63c767f579c733919fae926f6111bd13e7a6e43847c7ea',
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
      'ab6ca372cc3a90730960d86c1e7970ef4f00a547cf73c6fbb8d436c0799b9dd2',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'e2565ad5f47531a824b5787a2c0e3438e58eb7c23367e19874fde6936de045db',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'd74b31da14fd1c438027bce2466157f404ae86a8716875360dc04ff5d4b549dc',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'fe4777378d57ad2167696557645255365732d2a50851539cbb1d78b0aee52b20',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
