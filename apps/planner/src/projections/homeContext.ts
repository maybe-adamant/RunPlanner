/** One part of a Home panel's context line, such as "3 in game"; parts read joined by " · ". */
export interface HomeContextPart {
  readonly text: string;
  /** `ok` for a good state, `next` for what plays next; null for plain text. */
  readonly tone: 'ok' | 'next' | null;
}

export function plansText(count: number): string {
  return `${count} ${count === 1 ? 'plan' : 'plans'}`;
}
