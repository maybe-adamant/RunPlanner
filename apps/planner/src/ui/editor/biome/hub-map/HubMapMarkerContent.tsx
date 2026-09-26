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

/** The diamond supplies the distinction; keep its name readable inside it. */
export function HubMapFountainContent() {
  return (
    <span aria-hidden="true" className="hub-map-fountain-content">
      <span className="hub-map-fountain-label">Fountain</span>
    </span>
  );
}
