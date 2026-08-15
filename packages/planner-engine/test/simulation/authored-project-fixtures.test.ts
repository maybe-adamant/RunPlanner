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
      '2d954cb17b3a7dc35da1394643474a8f7ec57b38c6d0544b0909a734b7264489',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '9068d838e20fe271dc22bb6189c1b01528da439e80c1cfc721f3f2489ea72b4e',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e818366d1a5733df7ffacdbbf6e08c7b594cde26fad1e1e363bd5399b53ccb4d',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '7af98ea142d7f0447227b0a6a386a5562bcc21edd35eac43e2885bccfe33e6a9',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'bc364d2f67e14efe2e88de1b2e7356b00a40da7aa6b905e91352b3a1584c5612',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '98e2f1b437ee8bf0da5034b311b42b49724f4c03448863a04b7ea5000a868dc9',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'fbb6b3ef32f4931fa606c4d2bef500640bdb187d8d0d6146dc36365bd28d6026',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'd8eb28aff82c2fb27248e3c2ffc49c154d220b5ca35a30b1970ed55760f75ff4',
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
      'ac1cbfa0b6eca1c5a5e562b8351e48bd2315abc43e036f7c566f0c7fbe8dd582',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'c3c212804d907ea11f9bc082c5badd6b99ec8a31e0eff8dc1aa88100bf7b1c87',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '7691e4476e1fd84b3d337e424e99ad8e61dc941e65dd357441e3cde2e5280893',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'e955986554e776d5607761eb6a4119ce9b96fb518fcf4a2177baa833d7f58f66',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
