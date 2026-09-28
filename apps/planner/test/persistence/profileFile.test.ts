import { describe, expect, it } from 'vitest';

import { profileFileStem } from '@planner/persistence/profileFile';

describe('profile file stem', () => {
  it('drops the planner extension, or any single extension, and any folder', () => {
    expect(profileFileStem('Surface Phial run.runplanner.json')).toBe('Surface Phial run');
    expect(profileFileStem('Surface Phial run.RunPlanner.JSON')).toBe('Surface Phial run');
    expect(profileFileStem('C:\\Plans\\route.json')).toBe('route');
    expect(profileFileStem('/plans/run.v2.runplanner.json')).toBe('run.v2');
    expect(profileFileStem('no-extension')).toBe('no-extension');
    expect(profileFileStem('.runplanner.json')).toBe('.runplanner.json');
  });
});
