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
      '2358c579ce3d8d89614fdd5d2eacc983a22c6518fa889603510570d6e63cf3d8',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'f310d3e07ed83261ce8cffbd6f1461953a3cbfbb19645a9db8da654bc5c8e2f6',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '86975843c0d323e137b5e4036ccad19d6c9be45d4897847a2169fd17fe58581b',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '1ede9ffb7b8b9a32dca6d414d7d0bab848610b3bbf375dafe35aa8e29e0c35fc',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '2f820db73b4c58621d6e2068e5f6b2afdd38095f1f89ab657f34733253aea819',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'd6ac2f140d5cb911014e8bfbb749a4978620d0d30e65a234a9aa38d165617604',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'fd887e2e4d61960e66560b964519d01f98bbf27da9110ce8d4844e36292b2e6b',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '14faf5ebc9aa5046e0a410a34c2e847cd47b200755210659044529e12408ccec',
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
      '22eba04b31befae294cc99726ca8dcacd5e2997947eea9f6243c4c9430e6924b',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'c58591d5bcb423f370d2851a9005c911b38d61ad981de2067389b070293f8e2d',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '4025d645442a1732155a5380a7d71eb8175bc160190f1131e149e98aa1094d19',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'f265534458d82adfcf718744c237a282fc4bf4773655788f456ba3fc375f3863',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
