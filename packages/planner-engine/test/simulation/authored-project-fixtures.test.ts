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
      'd33776b3a5732696c66295ee0705ddf1f00a7d7abc05257302d7f215e11468d1',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '8cddf6dacb53501948e4bec137cf371af47aa3d1ce209c3c15104f7d808d8871',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '202954ea046bf4c1405101883232fb32e778e120f5fabfa6fb1474428585c125',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '6803ee456fec48851409df2e3741eb617c5d6e35c5a7b2ad51dffe79f5284680',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '0da736803e3d10988babe360b8a02bb69dcf48dda375a3ba6ff10b149447d379',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1dd21d512d383b9174779c1fd7753a85be614b11bf9fd6c4e48930373a9f5254',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'f8630ad52c829a7b5bf4270b64e738b9491994fef05bf7a62262afb26de221a7',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '96b3b3979ef37a91cbae52c56c0f08e6c8b3d0eede964365d08b9d4caf6d61bc',
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
      '9d1674d79d9ebdf026051465cc1a3bd7d47e9dc7a89295e7286cea71e19144cc',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '431f3f399ffaa02c10f8dd0239e827659dad00c36021df4a8236bd218bba5866',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '4fcab03ea3b2555ec5fa7566895afa98430fc12ba081ccacf198f1b5589a3426',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '8a9c98cd3a2448b353dedd6714736bdcba555e6c8729a7e717542bb4d700d565',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
