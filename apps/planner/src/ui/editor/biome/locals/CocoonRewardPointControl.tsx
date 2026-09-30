import { useRef } from 'react';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { cocoonMapFor } from '@planner/ui/room-maps/cocoons/cocoonMapAssets';

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
    />
  );
}

export function CocoonRewardPointControl({
  decision,
  id,
  interaction,
}: {
  readonly decision: Decision;
  readonly id: string;
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
}) {
  const executeIntent = useCommandIntent();
  const selected = decision.value?.kind === 'cocoonRewardPoint' ? decision.value.spawnPointId : '';
  const select = (spawnPointId: number | null) =>
    executeIntent(
      interaction.intentFor(
        decision.key,
        spawnPointId === null ? null : { kind: 'cocoonRewardPoint', spawnPointId },
      ),
    );
  const map = cocoonMapFor(decision.selection.gameName);
  return (
    <section className="encounter-cocoon-position" aria-label="Cocoon reward position">
      <label className="encounter-customization-row" htmlFor={id}>
        <span>{decision.label}</span>
        <select
          aria-label={decision.label}
          id={id}
          value={selected}
          onChange={(event) =>
            select(event.target.value === '' ? null : Number(event.target.value))
          }
        >
          <option value="">Any</option>
          {selected !== '' && !decision.selection.spawnPointIds.includes(selected) ? (
            <option disabled value={selected}>{`${selected} (unavailable)`}</option>
          ) : null}
          {decision.selection.spawnPointIds.map((nativeId, index) => (
            <option key={nativeId} value={nativeId}>
              {index + 1}
            </option>
          ))}
        </select>
        {!decision.valueSupported && decision.value !== undefined ? (
          <span className="encounter-customization-repair">Needs repair</span>
        ) : null}
      </label>
      <RoomMapViewport
        key={decision.selection.gameName}
        asset={map?.asset}
        controlsPlacement="collapsible-overlay"
        title={`${decision.selection.gameName} cocoons`}
        overlay={
          map === undefined ? undefined : (
            <div className="cocoon-map-markers">
              {decision.selection.spawnPointIds.map((nativeId, index) => {
                const point = map.annotations.points.find(([id]) => id === nativeId);
                if (point === undefined) return null;
                return (
                  <CocoonMarker
                    key={nativeId}
                    number={index + 1}
                    selected={selected === nativeId}
                    x={(point[1] / map.annotations.width) * 100}
                    y={(point[2] / map.annotations.height) * 100}
                    diameter={((2 * map.annotations.radius) / map.annotations.width) * 100}
                    select={() => select(nativeId)}
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
