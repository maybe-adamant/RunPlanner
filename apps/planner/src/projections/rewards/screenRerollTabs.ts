/** A screen tab: an earlier screen's index, or the final screen. */
export type ScreenTab = number | 'final';

/**
 * The tab a screen-chain finding concerns: its earlier screen, else the final
 * one. A reroll refused for nothing left concerns the first screen it rerolls.
 */
export function findingScreenTab(finding: {
  readonly code: string;
  readonly screen?: number;
  readonly reason?: string;
}): ScreenTab {
  if (finding.screen !== undefined) return finding.screen;
  return finding.code === 'screenRerollUnavailable' && finding.reason === 'nothingLeft'
    ? 0
    : 'final';
}
