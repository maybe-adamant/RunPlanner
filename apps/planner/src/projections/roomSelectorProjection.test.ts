import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { roomPickerCandidateLabel } from './roomSelectorProjection';

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

    expect(roomPickerCandidateLabel('H', room('H_Combat02'))).toBe('Combat 02');
    expect(roomPickerCandidateLabel('P', room('P_Combat01'))).toBe('Combat 01');
    expect(roomPickerCandidateLabel('Q', room('Q_Combat03'))).toBe('Combat 03');
    expect(roomPickerCandidateLabel('F', room('F_MiniBoss01'))).toBe('Root-Stalker');
  });
});
