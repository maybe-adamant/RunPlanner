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

/** A screen's tab label: the first draw, then one per reroll. */
export function screenTabLabel(index: number): string {
  return index === 0 ? 'Offer' : `Reroll ${index}`;
}

/**
 * The line a clean final tab shows when only earlier screens hold findings:
 * it names the first of them.
 */
export function earlierScreenFixLine(tabs: Iterable<ScreenTab>): string | undefined {
  const all = [...tabs];
  const earlier = all.filter((tab): tab is number => tab !== 'final');
  if (earlier.length === 0 || all.includes('final')) return undefined;
  return `${screenTabLabel(Math.min(...earlier))} needs a fix.`;
}
