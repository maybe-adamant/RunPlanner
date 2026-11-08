/** How good a Hub door's room is to take, as the board's colour key rates it. */
export type HubDoorQuality = 'Perfect' | 'Good' | 'Bad' | 'Special';

/** The rating of each Hub slot's room, by declared slot identity. */
const hubDoorQualities: Readonly<Record<string, HubDoorQuality>> = Object.freeze({
  combat12: 'Perfect',
  combat17: 'Perfect',
  combat02: 'Good',
  combat04: 'Good',
  combat14: 'Good',
  combat22: 'Good',
  combat05: 'Good',
  combat08: 'Good',
  combat07: 'Good',
  combat06: 'Good',
  combat23: 'Good',
  combat03: 'Good',
  combat11: 'Bad',
  combat19: 'Bad',
  combat09: 'Bad',
  combat20: 'Bad',
  combat13: 'Bad',
  combat10: 'Bad',
  combat21: 'Bad',
  combat18: 'Bad',
  combat15: 'Bad',
  combat16: 'Bad',
  combat01: 'Bad',
  miniBoss01: 'Special',
  miniBoss02: 'Special',
  story: 'Special',
});

export const hubDoorQualityKey = Object.freeze([
  'Perfect',
  'Good',
  'Bad',
  'Special',
] as const satisfies readonly HubDoorQuality[]);

export function hubDoorQuality(hubSlotKey: string): HubDoorQuality | undefined {
  return hubDoorQualities[hubSlotKey];
}

/** A Hub door's short name on its marker: its room number, MB01, or Story. */
export function hubDoorMapLabel(hubSlotKey: string): string {
  if (hubSlotKey === 'story') return 'Story';
  if (hubSlotKey.startsWith('miniBoss')) return `MB${hubSlotKey.slice(-2)}`;
  return hubSlotKey.slice(-2);
}
