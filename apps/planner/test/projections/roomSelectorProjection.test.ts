import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  roomPickerCandidateCategory,
  roomPickerCandidateLabel,
} from '@planner/projections/roomSelectorProjection';

function room(gameName: string) {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`${gameName} is missing from the catalog`);
  return declaration;
}

describe('room selector projection', () => {
  it('shows declared normal-door counts only for F/G/I Combat candidates', () => {
    expect(roomPickerCandidateLabel('F', room('F_Combat01'))).toBe('Combat 01 (1 Door)');
    expect(roomPickerCandidateLabel('G', room('G_Combat01'))).toBe('Combat 01 (2 Doors)');
    expect(roomPickerCandidateLabel('G', room('G_Combat02'))).toBe('Combat 02 (3 Doors)');
    expect(roomPickerCandidateLabel('I', room('I_Combat01'))).toBe('Combat 01 (2 Doors)');

    expect(roomPickerCandidateLabel('H', room('H_MiniBoss01'))).toBe(room('H_MiniBoss01').label);
    expect(roomPickerCandidateLabel('Q', room('Q_Combat03'))).toBe('Combat 03');
    expect(roomPickerCandidateLabel('F', room('F_MiniBoss01'))).toBe('Root-Stalker');
  });

  it.each([
    ['H_Combat09', 'Combat 09 (2 Slots)'],
    ['H_Combat03', 'Combat 03 (3 Slots)'],
    ['H_Combat04', 'Combat 04 (4 Slots)'],
    ['H_Combat01', 'Combat 01 (5 Slots)'],
  ])('shows %s declared cage capacity in its picker label', (gameName, label) => {
    expect(roomPickerCandidateLabel('H', room(gameName))).toBe(label);
  });

  it.each([
    ['P_Combat01', 'Combat 01 (1I/1O)'],
    ['P_Combat04', 'Combat 04 (2I)'],
    ['P_Combat15', 'Combat 15 (2I)'],
    ['P_MiniBoss02', 'Mega-Dracon (1O)'],
    ['P_Story01', 'Dionysus (1I/1O)'],
  ])('shows %s physical door types in its picker label', (gameName, label) => {
    expect(roomPickerCandidateLabel('P', room(gameName))).toBe(label);
  });

  it.each([
    ['P', 'P_Combat04', 'Indoor'],
    ['P', 'P_Combat15', 'Outdoor'],
    ['P', 'P_MiniBoss02', 'Indoor'],
    ['P', 'P_Story01', 'Indoor'],
    ['P', 'P_Reprieve01', 'Indoor'],
    ['P', 'P_Shop01', 'Outdoor'],
    ['P', 'P_PreBoss01', 'Preboss'],
    ['F', 'F_Combat01', 'Combat'],
    ['G', 'G_Reprieve01', 'Fountain'],
  ])('groups %s/%s by room tags only in Olympus', (biomeKey, gameName, category) => {
    expect(roomPickerCandidateCategory(biomeKey, room(gameName))).toBe(category);
  });
});
