import type { hubMapReward } from './hubMapReward';

export function HubMapMarkerContent({
  label,
  open,
  reward,
}: {
  readonly label: string;
  readonly open: boolean;
  readonly reward: ReturnType<typeof hubMapReward>;
}) {
  return (
    <span aria-hidden="true" className="hub-map-marker-content">
      <span>{label}</span>
      {!open ? (
        <span className="hub-map-marker-status">Closed</span>
      ) : reward.icon === undefined ? null : (
        <img alt="" className="hub-map-reward-icon" draggable={false} src={reward.icon} />
      )}
    </span>
  );
}

/** A water-drop glyph that keeps the fountain distinct from room-quality markers. */
export function HubMapFountainGlyph() {
  return (
    <svg aria-hidden="true" className="hub-map-fountain-glyph" viewBox="0 0 24 24">
      <path d="M12 2.5c-3.6 4.6-6.2 8.1-6.2 11.4a6.2 6.2 0 0 0 12.4 0C18.2 10.6 15.6 7.1 12 2.5Z" />
      <path className="hub-map-fountain-glyph-shine" d="M9.2 14.2a3 3 0 0 0 2.6 3" />
    </svg>
  );
}
