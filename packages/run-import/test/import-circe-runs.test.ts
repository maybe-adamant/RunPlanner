import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import { fixture, occurrence, mismatchLines, enteredRooms } from './support/run-import';

describe('run import of the 6-fear Surface victory with Circe', () => {
  const record = fixture('surface-circe');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes as a valid plan entering every recorded room, its entry saves matched', () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it("buys Q_PreBoss01's Mystery Boon from its first slot", () => {
    expect(record.rooms[47]!.name).toBe('Q_PreBoss01');
    const preboss = occurrence(imported.project, 'Q-r47');
    expect(preboss.state.kind === 'shop' && preboss.state.shop?.offers['MixedProgress1']).toEqual(
      expect.objectContaining({
        optionKey: 'BlindBoxLoot',
        reward: expect.objectContaining({ offer: { rewardType: 'BlindBoxLoot' } }),
      }),
    );
    expect(preboss.roomActions.order).toContainEqual(
      expect.objectContaining({ kind: 'interactShopOffer', offerKey: 'MixedProgress1' }),
    );
  });
});

describe('run import of the 6-fear Underworld victory with Circe', () => {
  const record = fixture('underworld-circe');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes as a valid plan entering every recorded room, its entry saves matched', () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it("puts H_Combat03's Gorgon Athena on its first-fought cage", () => {
    expect(record.rooms[26]!.name).toBe('H_Combat03');
    const fields = occurrence(imported.project, 'H-r26');
    // Cage02 is fought first: its Unlock row leads the room's order.
    expect(
      fields.roomActions.order.flatMap((action) =>
        action.kind === 'completeFieldsCage' ? [action.phaseKey] : [],
      ),
    ).toEqual(['Cage02', 'Cage01']);
    expect(
      Object.entries(fields.encounters.gorgonResultByPhase ?? {}).filter(
        ([, result]) => result.athenaOffer != null,
      ),
    ).toEqual([
      [
        'Cage02',
        {
          athenaTriggerConditionMet: true,
          athenaOffer: {
            traitKeys: [
              'AthenaProjectileBoon',
              'InvulnerabilityCastBoon',
              'RetaliateInvulnerabilityBoon',
            ],
            selectedOptionKey: 'option2',
          },
        },
      ],
    ]);
    expect(fields.roomActions.order).toContainEqual({ kind: 'interactGorgon', phaseKey: 'Cage02' });
  });
});
