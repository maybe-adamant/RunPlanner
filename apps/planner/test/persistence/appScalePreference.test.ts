import { describe, expect, it, vi } from 'vitest';
import { createBrowserAppScalePreference } from '@planner/persistence/appScalePreference';

describe('app scale preference', () => {
  it('stores scale separately from other local data and restores it', () => {
    const values = new Map([['run-planner.autosave-recovery', 'saved project']]);
    const preference = createBrowserAppScalePreference(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    }));
    expect(preference.read()).toBeUndefined();
    preference.write(80);
    expect(preference.read()).toBe(80);
    expect(values.get('run-planner.autosave-recovery')).toBe('saved project');
  });

  it.each(['not a number', 'Infinity', null])('ignores an unreadable value: %s', (value) => {
    const preference = createBrowserAppScalePreference(() => ({
      getItem: () => value,
      setItem: vi.fn(),
    }));
    expect(preference.read()).toBeUndefined();
  });

  it('allows session scaling when browser storage is restricted', () => {
    const preference = createBrowserAppScalePreference(() => {
      throw new Error('Storage denied');
    });
    expect(preference.read()).toBeUndefined();
    expect(() => preference.write(120)).not.toThrow();
  });
});
