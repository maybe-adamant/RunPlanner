import { describe, expect, it } from 'vitest';

import { updateInstallLabel } from '@planner/projections/releaseUpdate';

describe('update install action', () => {
  it('saves first whenever sending to the game would', () => {
    expect(updateInstallLabel(false, 'Unsaved', null)).toBe('Install and restart');
    expect(updateInstallLabel(true, 'Clean', 'Run.runplanner.json')).toBe('Install and restart');
    expect(updateInstallLabel(true, 'Dirty', 'Run.runplanner.json')).toBe('Save and install');
    expect(updateInstallLabel(true, 'Recovered', 'Run.runplanner.json')).toBe('Save and install');
    expect(updateInstallLabel(true, 'Unsaved', null)).toBe('Save and install…');
    expect(updateInstallLabel(true, 'Recovered', null)).toBe('Save and install…');
  });
});
