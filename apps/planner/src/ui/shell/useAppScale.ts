import { useEffect, useLayoutEffect, useState } from 'react';
import type { AppScalePreference } from '@planner/persistence/appScalePreference';

/** The supported scales; every layout is checked at each of them. */
const scaleLevels = [80, 90, 100, 110, 125, 150] as const;
const minimumScale = Math.min(...scaleLevels);
const maximumScale = Math.max(...scaleLevels);

export interface AppScale {
  readonly percent: number;
  readonly canShrink: boolean;
  readonly canGrow: boolean;
  step(direction: 1 | -1): void;
  reset(): void;
}

/** The supported level closest to a scale, as for one saved before the levels were fixed. */
function nearestLevel(percent: number): number {
  return scaleLevels.reduce((best, level) =>
    Math.abs(level - percent) < Math.abs(best - percent) ? level : best,
  );
}

function clampedStep(current: number, direction: number): number {
  const index = scaleLevels.indexOf(nearestLevel(current) as (typeof scaleLevels)[number]);
  return scaleLevels[Math.max(0, Math.min(scaleLevels.length - 1, index + direction))]!;
}

export function useAppScale(preference?: AppScalePreference): AppScale {
  const [percent, setPercent] = useState(() => {
    const saved = preference?.read();
    return saved === undefined || !Number.isFinite(saved) || saved <= 0 ? 100 : nearestLevel(saved);
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--app-scale');
    root.style.setProperty('--app-scale', String(percent / 100));
    return () => {
      if (previous === '') root.style.removeProperty('--app-scale');
      else root.style.setProperty('--app-scale', previous);
    };
  }, [percent]);

  useEffect(() => {
    preference?.write(percent);
  }, [percent, preference]);

  useEffect(() => {
    const step = (direction: number) => setPercent((current) => clampedStep(current, direction));
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (!['+', '=', '-', '0'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === '0') setPercent(100);
      else step(event.key === '-' ? -1 : 1);
    };
    let wheelDelta = 0;
    let lastWheelTime = 0;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.altKey || event.defaultPrevented || !event.cancelable) return;
      if (event.deltaY === 0) return;
      event.preventDefault();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (event.timeStamp - lastWheelTime > 250 || Math.sign(delta) !== Math.sign(wheelDelta)) {
        wheelDelta = 0;
      }
      lastWheelTime = event.timeStamp;
      wheelDelta += delta;
      // Accumulate trackpad deltas instead of jumping a step for every tiny event.
      if (Math.abs(wheelDelta) >= 80) {
        step(-Math.sign(wheelDelta));
        wheelDelta %= 80;
      }
    };
    globalThis.addEventListener('keydown', keyDown, { capture: true });
    globalThis.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => {
      globalThis.removeEventListener('keydown', keyDown, { capture: true });
      globalThis.removeEventListener('wheel', wheel, { capture: true });
    };
  }, []);

  return {
    percent,
    canShrink: percent > minimumScale,
    canGrow: percent < maximumScale,
    step: (direction) => setPercent((current) => clampedStep(current, direction)),
    reset: () => setPercent(100),
  };
}
