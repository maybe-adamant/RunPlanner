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
      '53a70b281ddc03eebcd7bb02b3552589224210267661e9de19be4f6b695fb788',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'fef70642fd04e8963c2912509540cb6c76d0f46b1386dc878d36db232fc85890',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '8434c053a32f4be5719128b1e9d181eb98299f6dbcafaff4d1260877483f3a70',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '28f52c05855ed39e5cb278d41140ed36017cac064af952c5124d8b9aa7a804cc',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'ebf27485e54770c4690001e3c0eeddb9feddb9318e3109a634534f1922041009',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'e9cbbe51385e5220b297342f6a66c5c91ab3f8c70849c0cf2720dfdc760799fd',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'f207c43a864cc985d728b9bbb367af2fd6587852285529a1fd6ecc2020bb8277',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'a3028c5cf89bfa2d0dcb270fe0d449bf0a177f12723d8eff27b17806090b5b21',
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
      '406ec1ea4aace3c7a9683161fe64062e4780c5b4b7b08dfa841b6250b9bb4645',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '1b290c9be5b4b92e75eca57aa9963392461645e92a99e2518c6d37f5355492eb',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'adaee0c5de904a359d32c699fca355de9b2f9348931756d1475af04b698edbd7',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '6cad88f691cad598d795134f199419e9ddb4c19d835c12b618ab979b0fa7ed23',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
