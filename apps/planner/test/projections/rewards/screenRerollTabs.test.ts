import { expect, it } from 'vitest';

import { findingScreenTab } from '@planner/projections/rewards/screenRerollTabs';

it('routes a screen-chain finding to its earlier screen, the first for nothing left, else the final', () => {
  expect(findingScreenTab({ code: 'rerolledScreenMissing', screen: 1 })).toBe(1);
  expect(findingScreenTab({ code: 'screenRerollUnavailable', reason: 'nothingLeft' })).toBe(0);
  expect(findingScreenTab({ code: 'screenRerollUnavailable', reason: 'disabled' })).toBe('final');
  expect(findingScreenTab({ code: 'rollRepeatsAllOffers' })).toBe('final');
});
