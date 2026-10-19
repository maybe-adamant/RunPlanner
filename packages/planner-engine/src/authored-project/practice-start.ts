/** The mid-run start points of a biome, in route order. */
export const RUN_START_POINTS = Object.freeze(['opening', 'preboss', 'boss'] as const);

/** A Practice mode start; the biome may dangle from the route. */
export interface RunStartPoint {
  readonly biomeKey: string;
  readonly point: (typeof RUN_START_POINTS)[number];
  /** Base gold added to the game's own starting gold; absent adds none. */
  readonly gold?: number;
}

/** Domain of a start point's gold. */
export const PRACTICE_START_GOLD = Object.freeze({ min: 0, max: 99_999, step: 1 } as const);

function isRunStartPointKind(value: unknown): value is RunStartPoint['point'] {
  return RUN_START_POINTS.some((point) => point === value);
}

/** A malformed shape is absent; malformed gold is absent; finite gold clamps to an integer in its domain. */
export function decodePracticeStart(raw: unknown): RunStartPoint | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const { biomeKey, point, gold } = raw as Record<string, unknown>;
  if (typeof biomeKey !== 'string' || biomeKey.length === 0) return undefined;
  if (!isRunStartPointKind(point)) return undefined;
  if (typeof gold !== 'number' || !Number.isFinite(gold)) return Object.freeze({ biomeKey, point });
  const healedGold = Math.min(
    PRACTICE_START_GOLD.max,
    Math.max(PRACTICE_START_GOLD.min, Math.round(gold)),
  );
  return Object.freeze({ biomeKey, point, gold: healedGold });
}

export function samePracticeStart(
  left: RunStartPoint | undefined,
  right: RunStartPoint | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  return left.biomeKey === right.biomeKey && left.point === right.point && left.gold === right.gold;
}
