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
      '888435a6f4c19a73b5baf22c877d8c882534d454c6ab419900ce13d05fecf3e0',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '45b796eac6c195ea1b75307f40b7cb6adfd1857fa26df3f3c7315a96206f7343',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '4ac3e8ede999ae74e18df65d553723f0ae405188688a601086d30881c04a48f7',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '9df4446ac77854dd3d8d580c5d52ef8a24bd19b24e51a552b04acc708270c735',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '03ba06c7e05139310df3d0de0d27ecd557b77134ffdfaf84f7f4103af9cb8b6a',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '658101997735268c274b04ccb9a81c15fa894cfa1d90be44bd54110c1c576303',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'fb32f8e1a7b4cefb6d76030b9366d53654a323553b9cb552cbddd33d02642aa9',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'e39230d2473a2556f07513ea3a19349b9b3d1766bcd3122ad61b634a3f6bf112',
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
      '55271285f3487678c46dd66eff31a55e542fd14d4b5f3eab62f5eb2d56c87628',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '4f57827416a614ebe8489f64477fdeac7cffe091115622c2560ad13ee7fdc621',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '8c5e39e884c7bf07e55f094728868c8b7d78d89c02c486401bbd3109559d128f',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '992822e846565c42855d24db478e66c4003a8d83a3a3698782d754d97a6c844b',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
