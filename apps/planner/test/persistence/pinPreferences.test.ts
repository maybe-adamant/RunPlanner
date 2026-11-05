import { describe, expect, it } from 'vitest';
import { createBrowserBiomeRailPinPreference } from '@planner/persistence/biomeRailPinPreference';
import { createBrowserNavigationPinPreference } from '@planner/persistence/navigationPinPreference';

describe.each([
  ['panel navigation', createBrowserNavigationPinPreference],
  ['biome rail', createBrowserBiomeRailPinPreference],
])('%s pin preference', (_name, create) => {
  it('stores the pin choice beside other local data and restores it', () => {
    const values = new Map([['run-planner.autosave-recovery', 'saved project']]);
    const preference = create(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    }));
    expect(preference.read()).toBeUndefined();
    preference.write(false);
    expect(preference.read()).toBe(false);
    preference.write(true);
    expect(preference.read()).toBe(true);
    expect(values.get('run-planner.autosave-recovery')).toBe('saved project');
  });

  it('keeps the session choice when browser storage is restricted', () => {
    const preference = create(() => {
      throw new Error('Storage denied');
    });
    expect(preference.read()).toBeUndefined();
    expect(() => preference.write(false)).not.toThrow();
  });
});

it('keeps the panel navigation and biome rail choices apart', () => {
  const values = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  createBrowserNavigationPinPreference(storage).write(false);
  expect(createBrowserBiomeRailPinPreference(storage).read()).toBeUndefined();
});
