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
      'c5b0944b57502d02e2a9ef881b90501216627877f44099d9b40e908eb3ace359',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '2c974ca5f9a254e55c900c800913cab744fc76cf9917a6d39cfc07afd930956f',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '26097aeb8f58a735ae22912aabd4adc4f332f2d69961534190d164847a5a8059',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'dc4edafc38c019f85a00c1ffb8aeadbf7f7e69dd57ed06f874f8f8654a21c732',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '60c0c346169d3a988a6f5b38034a6be2e22280b4c942c355479a8869f016d943',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '6d51a0e8965b28bdc6fee800714ece22df91d9af6d61302f06cc756ecfa30ca5',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'df3e5ef1a2c948809ebb973c034831fe710ec9bbd93dcfe1f8d4134bbe8ee862',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '24b8a8667969ae65aba1d43f5f3b9fc0fb90df16d253e29c4e9a68c39c460307',
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
      '351262ec51c98a57d8f963ebfd7305f7d74d5965959137d238ec48b5439b9bfd',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '5421694a075a482eb9aeb35ea80f05da2cdd715d0b3cfe8ec793330e4e09f75f',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '81fd2265735c893e49743aea05cac596cfcc54f93da60fefd40731319fd379ca',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '3ed6cbf92de9ebc213bc9992c30def0332c145b62099da1fabb2c00c90c3d95e',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
