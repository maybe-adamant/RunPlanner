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
      'dd33077c298e324d7208ab3057bf815c50f88ced53f0c29e37fbca3a12506b98',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '61bc15fe7b4814f1c7b89b649595d77643afa23d7a4fd0c5ac404b25f1a3f576',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '66866aae0e28c443243116ea7111f6b465c46457a8d825ffe525c053f3f08acc',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'da92226320e91c4a3a837f9ba3b0207b8d80a1e2bc53e5faa91d717363eafc2f',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'fc8cd096f5d22c3a1d4a1aa8be7502fb0a2fa3a7ac957469e09906bf15278c0e',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '024e93793c31111573bf52db92bf430db60a22aca4d08a0d91f4cc1b6dd601a2',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '3b8f492ef4714e26b6f21af538b6a9503c2f1f9de0e1bb569f01a594542af0be',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '752df2693fc54f3ce5f2e1ac69e36dc2402d354f9c7affbcff31f43e730f622a',
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
      '7473c4eef926fea5ce3294479b69aee8f4979665023f05a6130c9dc84cf40675',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '6f57a214f05f0fc2212f8cecdc34253c1e2c11565f8b94a6a4340ceca986a68e',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '710d6affae4553b62c0631e1f777c706e60dde47eb120b715c8e3aaa85bd0c55',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'ab952f91656fbfe67251751654d79276b112bb08ae3b0826b2961f041667e770',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
