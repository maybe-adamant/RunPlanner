import { useRef } from 'react';
import type { AuthoredEncounterCustomization } from '@run-planner/engine/authored-project';
import type { WorkspaceEncounterPhase } from '@planner/projections/structured-workspace';
import { roomMapPosition } from '@planner/projections/roomMapMarkers';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'cocoonRewardPoint' } }
>;

function CocoonMarker({
  number,
  selected,
  x,
  y,
  diameter,
  select,
}: {
  readonly number: number;
  readonly selected: boolean;
  readonly x: number;
  readonly y: number;
  readonly diameter: number;
  readonly select: () => void;
}) {
  const pointer = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined);
  return (
    <button
      aria-label={`Reward cocoon ${number}`}
      aria-pressed={selected}
      className="cocoon-map-marker"
      data-room-map-overlay-control
      style={{ left: `${x}%`, top: `${y}%`, width: `${diameter}%` }}
      type="button"
      onPointerDown={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5)
          start.moved = true;
      }}
      onPointerCancel={() => {
        if (pointer.current !== undefined) pointer.current.moved = true;
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onClick={(event) => {
        if (event.detail === 0 || pointer.current?.moved !== true) select();
        pointer.current = undefined;
      }}
    >
      <span aria-hidden="true">{number}</span>
    </button>
  );
}

/** A cocoon marker's widest diameter, in image pixels. */
const markerPixels = 80;

export function CocoonRewardPointControl({
  decision,
  id,
  onValue,
}: {
  readonly decision: Decision;
  readonly id: string;
  /** Writes the decision's next value into the dialog draft; null restores Any. */
  readonly onValue: (value: AuthoredEncounterCustomization | null) => void;
}) {
  const selected = decision.value?.kind === 'cocoonRewardPoint' ? decision.value.spawnPointId : '';
  const select = (spawnPointId: number | null) =>
    onValue(spawnPointId === null ? null : { kind: 'cocoonRewardPoint', spawnPointId });
  const { gameName, points } = decision.selection;
  const calibration = roomMapCalibrations[gameName];
  const markers =
    calibration === undefined
      ? []
      : points.map((point) => ({ id: point.id, ...roomMapPosition(point, calibration) }));
  // Markers keep separate hit targets where cocoons crowd.
  const diameter =
    calibration === undefined
      ? 0
      : Math.min(
          markerPixels,
          ...markers.flatMap((marker, index) =>
            markers
              .slice(index + 1)
              .map((other) =>
                Math.hypot(
                  ((marker.left - other.left) * calibration.width) / 100,
                  ((marker.top - other.top) * calibration.height) / 100,
                ),
              ),
          ),
        ) / calibration.width;
  return (
    <section className="encounter-cocoon-position" aria-label="Cocoon reward position">
      <div>
        <ContextualPicker<number | null>
          ariaLabel={decision.label}
          label={decision.label}
          layout="inline"
          id={id}
          placeholder="Any"
          {...(!decision.valueSupported && decision.value !== undefined ? { invalid: true } : {})}
          model={declaredChoicesPicker(
            [
              { key: 'any', value: null, label: 'Any' },
              ...(selected !== '' && !decision.selection.spawnPointIds.includes(selected)
                ? [
                    {
                      key: String(selected),
                      value: selected,
                      label: `${selected} (unavailable)`,
                      disabled: true,
                    },
                  ]
                : []),
              ...decision.selection.spawnPointIds.map((nativeId, index) => ({
                key: String(nativeId),
                value: nativeId,
                label: String(index + 1),
              })),
            ],
            selected === '' ? null : selected,
          )}
          onSelect={select}
        />
      </div>
      <RoomMapViewport
        key={gameName}
        asset={calibration === undefined ? undefined : roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        title={`${gameName} cocoons`}
        overlay={
          markers.length === 0 ? undefined : (
            <div className="cocoon-map-markers">
              {markers.map((marker) => {
                const index = decision.selection.spawnPointIds.indexOf(marker.id);
                return (
                  <CocoonMarker
                    key={marker.id}
                    number={index + 1}
                    selected={selected === marker.id}
                    x={marker.left}
                    y={marker.top}
                    diameter={diameter * 100}
                    select={() => select(marker.id)}
                  />
                );
              })}
            </div>
          )
        }
      />
    </section>
  );
}
