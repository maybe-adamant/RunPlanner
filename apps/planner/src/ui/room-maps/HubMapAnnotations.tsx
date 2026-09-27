/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react';

/** Source-image geometry for Ephyra Hub's 2560 × 1440 background. */
export interface HubMapAnnotation {
  readonly category: 'Perfect' | 'Good' | 'Bad' | 'Special';
  readonly gameName: string;
  readonly hubSlotKey: string;
  readonly label: string;
  readonly mapLabel: string;
  readonly x: number;
  readonly y: number;
}

const annotation = (
  hubSlotKey: string,
  x: number,
  y: number,
  category: HubMapAnnotation['category'],
): HubMapAnnotation => {
  const gameName =
    hubSlotKey === 'story'
      ? 'N_Story01'
      : hubSlotKey.startsWith('miniBoss')
        ? `N_MiniBoss${hubSlotKey.slice(-2)}`
        : `N_Combat${hubSlotKey.slice(-2)}`;
  const label =
    hubSlotKey === 'story'
      ? 'Story'
      : hubSlotKey.startsWith('miniBoss')
        ? `Mini-boss ${hubSlotKey.slice(-2)}`
        : `Combat ${hubSlotKey.slice(-2)}`;
  const mapLabel =
    hubSlotKey === 'story'
      ? 'Story'
      : hubSlotKey.startsWith('miniBoss')
        ? `MB${hubSlotKey.slice(-2)}`
        : hubSlotKey.slice(-2);
  return Object.freeze({ category, gameName, hubSlotKey, label, mapLabel, x, y });
};

/**
 * The 26 user-approved annotations are deliberately keyed by declared room
 * identity, rather than screen order or a rendered label.
 */
export const hubMapAnnotations = Object.freeze([
  annotation('combat12', 2214, 952, 'Perfect'),
  annotation('combat17', 1321, 83, 'Perfect'),
  annotation('combat02', 798, 830, 'Good'),
  annotation('combat04', 325, 527, 'Good'),
  annotation('combat14', 491, 918, 'Good'),
  annotation('combat22', 183, 613, 'Good'),
  annotation('combat05', 1301, 1282, 'Good'),
  annotation('combat08', 1706, 1271, 'Good'),
  annotation('combat07', 1726, 1166, 'Good'),
  annotation('combat06', 1198, 1028, 'Good'),
  annotation('combat23', 2413, 941, 'Good'),
  annotation('combat03', 1080, 477, 'Good'),
  annotation('combat11', 164, 696, 'Bad'),
  annotation('combat19', 618, 565, 'Bad'),
  annotation('combat09', 926, 312, 'Bad'),
  annotation('combat20', 1165, 250, 'Bad'),
  annotation('combat13', 1549, 146, 'Bad'),
  annotation('combat10', 1528, 247, 'Bad'),
  annotation('combat21', 1540, 390, 'Bad'),
  annotation('combat18', 1988, 645, 'Bad'),
  annotation('combat15', 2241, 532, 'Bad'),
  annotation('combat16', 2283, 765, 'Bad'),
  annotation('combat01', 2413, 1057, 'Bad'),
  annotation('miniBoss01', 755, 310, 'Special'),
  annotation('miniBoss02', 2214, 1103, 'Special'),
  annotation('story', 1744, 986, 'Special'),
]);

/** The Hub fountain basin between the two braziers; an action site, not a room slot. */
export const hubMapFountainAnnotation = Object.freeze({
  label: 'Fountain',
  x: 1352,
  y: 801,
});

/** Map position in percent of the source image, shared by every interactive Hub marker. */
export function hubMapPosition(point: { readonly x: number; readonly y: number }): {
  readonly left: string;
  readonly top: string;
} {
  return { left: `${(point.x / 2560) * 100}%`, top: `${(point.y / 1440) * 100}%` };
}

const categoryColors: Record<HubMapAnnotation['category'], string> = {
  Bad: '#a32d3b',
  Good: '#247448',
  Perfect: '#49c8dc',
  Special: '#d6b442',
};

const hubMapQualityCategories = Object.freeze([
  'Perfect',
  'Good',
  'Bad',
  'Special',
] as const satisfies readonly HubMapAnnotation['category'][]);

/** Visible, noninteractive category key shared by Hub inspection and authoring. */
export function HubMapQualityLegend(): ReactNode {
  return (
    <div aria-label="Hub room quality legend" className="hub-map-legend">
      {hubMapQualityCategories.map((category) => (
        <span data-category={category} key={category}>
          {category}
        </span>
      ))}
      <span data-category="Fountain">Fountain</span>
    </div>
  );
}

/** Shared inspection drawing; interactive Hub controls supply their own layer. */
export function HubMapReadOnlyOverlay(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      className="hub-map-read-only-overlay"
      viewBox="0 0 2560 1440"
      xmlns="http://www.w3.org/2000/svg"
    >
      {hubMapAnnotations.map((annotation) => (
        <g key={annotation.hubSlotKey} transform={`translate(${annotation.x} ${annotation.y})`}>
          <circle
            fill={categoryColors[annotation.category]}
            r={annotation.category === 'Special' ? 44 : 40}
            stroke="#101923"
            strokeWidth="4"
          />
          <text dy="0.34em" fill="#101923" fontSize="20" fontWeight="700" textAnchor="middle">
            {annotation.mapLabel}
          </text>
        </g>
      ))}
      <g transform={`translate(${hubMapFountainAnnotation.x} ${hubMapFountainAnnotation.y})`}>
        <rect
          x="-40"
          y="-40"
          width="80"
          height="80"
          rx="10"
          fill="#ed963e"
          stroke="#101923"
          strokeWidth="4"
          transform="rotate(45)"
        />
        <text dy="0.34em" fill="#101923" fontSize="20" fontWeight="700" textAnchor="middle">
          Fountain
        </text>
      </g>
    </svg>
  );
}

export function roomMapOverlayFor(gameName: string): ReactNode | undefined {
  return gameName === 'N_Hub' ? (
    <>
      <HubMapReadOnlyOverlay />
      <HubMapQualityLegend />
    </>
  ) : undefined;
}
