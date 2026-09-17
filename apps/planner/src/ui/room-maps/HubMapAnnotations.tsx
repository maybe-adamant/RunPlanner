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
  annotation('combat12', 2222, 951, 'Perfect'),
  annotation('combat17', 1329, 82, 'Perfect'),
  annotation('combat02', 806, 829, 'Good'),
  annotation('combat04', 333, 526, 'Good'),
  annotation('combat14', 499, 917, 'Good'),
  annotation('combat22', 191, 612, 'Good'),
  annotation('combat05', 1309, 1281, 'Good'),
  annotation('combat08', 1714, 1270, 'Good'),
  annotation('combat07', 1734, 1165, 'Good'),
  annotation('combat06', 1206, 1027, 'Good'),
  annotation('combat23', 2421, 940, 'Good'),
  annotation('combat03', 1088, 476, 'Good'),
  annotation('combat11', 172, 695, 'Bad'),
  annotation('combat19', 626, 564, 'Bad'),
  annotation('combat09', 934, 311, 'Bad'),
  annotation('combat20', 1173, 249, 'Bad'),
  annotation('combat13', 1557, 145, 'Bad'),
  annotation('combat10', 1536, 246, 'Bad'),
  annotation('combat21', 1548, 389, 'Bad'),
  annotation('combat18', 1996, 644, 'Bad'),
  annotation('combat15', 2249, 531, 'Bad'),
  annotation('combat16', 2291, 764, 'Bad'),
  annotation('combat01', 2421, 1056, 'Bad'),
  annotation('miniBoss01', 763, 309, 'Special'),
  annotation('miniBoss02', 2222, 1102, 'Special'),
  annotation('story', 1752, 985, 'Special'),
]);

const categoryColors: Record<HubMapAnnotation['category'], string> = {
  Bad: '#F26868',
  Good: '#76E69A',
  Perfect: '#43DDEB',
  Special: '#FACC45',
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
          <text
            dy="0.34em"
            fill="#101923"
            fontSize={annotation.category === 'Special' ? 18 : 27}
            fontWeight="bold"
            textAnchor="middle"
          >
            {annotation.mapLabel}
          </text>
        </g>
      ))}
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
