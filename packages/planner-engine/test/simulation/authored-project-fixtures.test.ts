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
      '25f266fcb69b5e94f8283bfccdcb1bea802602d472c92cd642d248fe9b23d162',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '69025930da855f71c9d2c13d72cc070fad40135498824165c843423efd8abc52',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '79ef66807125dd050cfff44e3ba31f7cc0d40828f586fe5dbf441a34e8203dcd',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'fbcfee46514a0f99cb5cf3ce66b962a4a3e1cc3e1f3035c82bcf02a44020716d',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '7f5373863e0e1cd1358becfd41f8d74ae14e4a5d3ac4e204ca974786d753aead',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '553d73d16e733c548ed2e478b4b1383b2c62e13bfae67223fae2bac1d5e62f06',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '94bb13c27f7302d087f3b60dc116e9273429dc024bba6f0270712db6fb053ed7',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '5d595ba9e5e070df280b7b2e42cdaadb387f2f1b51384553435baeed0ff49310',
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
      'dacf81f8cd7813c108cab4ebb72f81b5bd9d02d125ec68880c79989db1cf0ed5',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '50755472d216600266f54bacc8baa365e5d371609808136ba0af34e28ea88dbb',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'ae8a2778d07ea6797704d532259f7a509530f266942ed7979402646d8df4b79a',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '2e249e4828d4e7c4b861a2be58bc713739c8e05d5227bdc4ec547840532b2e41',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
