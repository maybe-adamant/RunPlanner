/**
 * Side-door status-label positions on the captured 2560 × 1440 Ephyra main-room maps.
 * The source capture inventory used a 640 × 360 space; these values are its exact fourfold
 * normalization and are keyed by the declaration-owned parent slot, never by marker order.
 */
export interface EphyraSideRoomAnnotation {
  readonly gameName: string;
  readonly slotKey: string;
  readonly x: number;
  readonly y: number;
}

const annotation = (
  gameName: string,
  slotKey: string,
  x: number,
  y: number,
): EphyraSideRoomAnnotation => Object.freeze({ gameName, slotKey, x, y });

export const ephyraSideRoomAnnotations = Object.freeze([
  annotation('N_Combat02', 'sideDoor1', 560, 568),
  annotation('N_Combat02', 'sideDoor2', 1268, 440),
  annotation('N_Combat03', 'sideDoor1', 1292, 476),
  annotation('N_Combat04', 'sideDoor1', 792, 464),
  annotation('N_Combat04', 'sideDoor2', 1196, 428),
  annotation('N_Combat05', 'sideDoor1', 1016, 420),
  annotation('N_Combat05', 'sideDoor2', 1292, 348),
  annotation('N_Combat05', 'sideDoor3', 1840, 748),
  annotation('N_Combat06', 'sideDoor1', 1316, 356),
  annotation('N_Combat06', 'sideDoor2', 1816, 596),
  annotation('N_Combat09', 'sideDoor1', 772, 748),
  annotation('N_Combat09', 'sideDoor2', 1036, 264),
  annotation('N_Combat09', 'sideDoor3', 1720, 248),
  annotation('N_Combat10', 'sideDoor1', 1044, 356),
  annotation('N_Combat10', 'sideDoor2', 2192, 872),
  annotation('N_Combat11', 'sideDoor1', 2036, 560),
  annotation('N_Combat12', 'sideDoor1', 1072, 608),
  annotation('N_Combat12', 'sideDoor2', 1328, 480),
  annotation('N_Combat12', 'sideDoor3', 1576, 356),
  annotation('N_Combat15', 'sideDoor1', 860, 444),
  annotation('N_Combat16', 'sideDoor1', 712, 728),
  annotation('N_Combat17', 'sideDoor1', 916, 452),
  annotation('N_Combat18', 'sideDoor1', 1676, 300),
  annotation('N_Combat20', 'sideDoor1', 1436, 396),
  annotation('N_Combat22', 'sideDoor1', 776, 492),
  annotation('N_Combat22', 'sideDoor2', 2104, 584),
  annotation('N_Combat23', 'sideDoor1', 1312, 280),
  annotation('N_Combat23', 'sideDoor2', 1856, 324),
  annotation('N_Combat23', 'sideDoor3', 1876, 664),
]);

const annotationsByGameName = new Map<string, readonly EphyraSideRoomAnnotation[]>();
for (const annotationEntry of ephyraSideRoomAnnotations) {
  const current = annotationsByGameName.get(annotationEntry.gameName) ?? [];
  annotationsByGameName.set(annotationEntry.gameName, Object.freeze([...current, annotationEntry]));
}

export function ephyraSideRoomAnnotationsFor(
  gameName: string,
): readonly EphyraSideRoomAnnotation[] {
  return annotationsByGameName.get(gameName) ?? [];
}

/** Coordinates expressed in the parent image's normalized displayed space. */
export function ephyraSideRoomMapPosition(point: Pick<EphyraSideRoomAnnotation, 'x' | 'y'>): {
  readonly left: string;
  readonly top: string;
} {
  return { left: `${(point.x / 2560) * 100}%`, top: `${(point.y / 1440) * 100}%` };
}
