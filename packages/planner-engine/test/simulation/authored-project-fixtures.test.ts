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
      '3959907149bcd7a93fb567c57c69ff38e50c1403c95e5b861ea1a0f54de34a4c',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'd155caf0a903a53a1af1cc78be5cbd9c499254fcefa8892ac7ca048dba597772',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '22dc4c9c0a4fdfe60c0f5391d201b01a7870ad9aed2af9e00f9ab62b0d54f1bd',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '75838dfc36fd03bed317615d7714723c19a588b46ce83ef2a2a0ab03f823e6b7',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '2b876b49bb0aeb82f13fd935b0a276b264f939fec26489b33b8e99d776734162',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'dcc662713b16225908f754111b44f788ac170b4527519788cf4e8ad4a055dc74',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '564663a0c99fc7bce6eed0619784041298a544633e5a678b81dcdb809976cfed',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '76559dced9eb2494e3c72b55fd2482ad2dc70a1b178ceec7303258e9bc233765',
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
      '53bc83e4fee091b498fe3a391a82882618564d8b2e41f381253735192b5b9d01',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '357fc51a1a3e3efbc094c871b33e6210e3123744c4945ae174c03db8e453c4d5',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'bb702f550913ea897bf405e1cdcdbf4fc2251e7ee364245e590f9bb0ca02d8be',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'c99545146538d9a496c15d63e549f2c79937fb2b38d5510e8d5f568bbf1e8007',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
