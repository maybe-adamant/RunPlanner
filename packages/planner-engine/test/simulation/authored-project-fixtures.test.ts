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
      '7832c599cb87c1abd646e37a197ec7ae5e9e25645415091db124086348300080',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '04a42dc8b08528244014cead9a05fe59b782ed9aaf8fb037d751bd64d817144c',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '47fb83a4b71d3634530dd2e76d8140fcc90ab766bee8fab43db509158b6c9bb7',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'd86c0ed22041000a7ee37e5895b84d7b11ca35deb582a546b82a83d2a3d303b1',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'cbd50b0d597792896ccacd365e2237e96ce587a14d04db34fd645de7247395ce',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '2383d45cda209c324b7414a75622722bfc00d9957e75a7b96feac713aef029ce',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'b888147cce7b89a923102169d8f0383045ae7acc297fe368aa7368ec47262c62',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '4d79b464de8a0e3cf16944fce7189c23d28f2dee716c8cdaa8a9c8e51fe78537',
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
      'af6fdbe16aede42e94d7fd0ff10f3234357992b07cfdf7423b7f8ffad94c9b11',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'e05e6aafc4dcf65728544cdec47d5668a651f8a745fdbdedfcd6b084508682b4',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '5478cb92d3da3124f88ae419fbff633e156b024dd3223d0e6ca0daa011390cff',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'b365a36cef79f43e5c81455852336dbfc7e185a3dc2fe026b0fe0e047a6c01aa',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
