import { useRef } from 'react';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { cocoonMapFor } from '@planner/ui/room-maps/cocoons/cocoonMapAssets';
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
