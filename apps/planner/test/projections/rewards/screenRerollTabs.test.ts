import { expect, it } from 'vitest';

import {
  earlierScreenFixLine,
  findingScreenTab,
} from '@planner/projections/rewards/screenRerollTabs';

it('routes a screen-chain finding to its earlier screen, the first for nothing left, else the final', () => {
  expect(findingScreenTab({ code: 'rerolledScreenMissing', screen: 1 })).toBe(1);
  expect(findingScreenTab({ code: 'screenRerollUnavailable', reason: 'nothingLeft' })).toBe(0);
  expect(findingScreenTab({ code: 'screenRerollUnavailable', reason: 'disabled' })).toBe('final');
  expect(findingScreenTab({ code: 'rollRepeatsAllOffers' })).toBe('final');
});

it('names the first earlier screen needing a fix only while the final screen is clean', () => {
  expect(earlierScreenFixLine(new Set([2, 1]))).toBe('Reroll 1 needs a fix.');
  expect(earlierScreenFixLine([0])).toBe('Offer needs a fix.');
  expect(earlierScreenFixLine([1, 'final'])).toBeUndefined();
  expect(earlierScreenFixLine([])).toBeUndefined();
});
